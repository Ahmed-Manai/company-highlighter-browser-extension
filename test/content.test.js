const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const SCRIPTS = ["matcher.js", "settings.js", "content.js"].map(f => fs.readFileSync(path.join(ROOT, f), "utf8"));

// Just enough of the extension API for the content script
function fakeChrome(initial) {
  const store = { ...initial };
  const changeListeners = [];
  const messageListeners = [];
  const sent = [];
  return {
    sent,
    messageListeners,
    storage: {
      local: {
        async get(defaults) {
          return { ...defaults, ...store };
        },
        async set(changes) {
          const diff = {};
          for (const [key, value] of Object.entries(changes)) {
            diff[key] = { oldValue: store[key], newValue: value };
            store[key] = value;
          }
          changeListeners.forEach(listener => listener(diff, "local"));
        }
      },
      onChanged: { addListener: listener => changeListeners.push(listener) }
    },
    runtime: {
      async sendMessage(message) {
        sent.push(message);
      },
      onMessage: { addListener: listener => messageListeners.push(listener) }
    }
  };
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function loadPage(html, settings, url = "https://example.com/page") {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url,
    runScripts: "dangerously"
  });
  const chrome = fakeChrome(settings);
  dom.window.chrome = chrome;
  // Run each file as a classic script, like the browser does, so top-level
  // declarations are shared between them (eval would keep each file's const private)
  SCRIPTS.forEach(source => {
    const script = dom.window.document.createElement("script");
    script.textContent = source;
    dom.window.document.head.appendChild(script);
  });
  await wait(700); // initial load plus the 500 ms debounce
  return { window: dom.window, document: dom.window.document, chrome };
}

// Objects created inside the jsdom window have their own prototypes, so compare plain copies
const plain = value => JSON.parse(JSON.stringify(value));

const highlights = document => Array.from(document.querySelectorAll("span.company-highlight")).map(s => s.textContent);

test("highlights companies from the stored list", async () => {
  const { document, chrome } = await loadPage("<p>Offers from Acme and Globex.</p>", { companies: ["Acme", "Globex"] });
  assert.deepEqual(highlights(document), ["Acme", "Globex"]);
  assert.deepEqual(plain(chrome.sent.at(-1)), { type: "count", count: 2 });
});

test("page text is never turned into markup", async () => {
  const { document } = await loadPage("<p>Acme &lt;img src=x onerror=alert(1)&gt;</p>", { companies: ["Acme"] });
  assert.equal(document.querySelectorAll("img").length, 0);
  assert.equal(document.querySelector("p").textContent, "Acme <img src=x onerror=alert(1)>");
});

test("text in form fields and scripts is left alone", async () => {
  const { document } = await loadPage(
    "<textarea>Acme</textarea><div contenteditable='true'>Acme</div><script>var x = 'Acme';</script><p>Acme</p>",
    { companies: ["Acme"] }
  );
  assert.deepEqual(highlights(document), ["Acme"]);
  assert.equal(document.querySelector("textarea").value, "Acme");
});

test("does nothing when switched off", async () => {
  const { document } = await loadPage("<p>Acme</p>", { companies: ["Acme"], enabled: false });
  assert.deepEqual(highlights(document), []);
});

test("switching off restores the original text", async () => {
  const { document, chrome } = await loadPage("<p>Work at Acme today</p>", { companies: ["Acme"] });
  assert.deepEqual(highlights(document), ["Acme"]);

  await chrome.storage.local.set({ enabled: false });
  await wait(50);

  assert.deepEqual(highlights(document), []);
  const p = document.querySelector("p");
  assert.equal(p.childNodes.length, 1);
  assert.equal(p.textContent, "Work at Acme today");
});

test("editing the list updates the page without a reload", async () => {
  const { document, chrome } = await loadPage("<p>Acme and Globex</p>", { companies: ["Acme"] });
  await chrome.storage.local.set({ companies: ["Globex"] });
  await wait(700);
  assert.deepEqual(highlights(document), ["Globex"]);
});

test("highlights content added after the page loaded", async () => {
  const { document } = await loadPage("<div id='feed'></div>", { companies: ["Acme"] });
  const item = document.createElement("p");
  item.textContent = "New job at Acme";
  document.getElementById("feed").appendChild(item);
  await wait(700);
  assert.deepEqual(highlights(document), ["Acme"]);
});

test("only a #rrggbb colour reaches the page stylesheet", async () => {
  const { document } = await loadPage("<p>Acme</p>", { companies: ["Acme"], color: "red; } body { display: none" });
  const css = document.getElementById("company-highlighter-style").textContent;
  assert.match(css, /background-color: #ffeb3b;/);
  assert.doesNotMatch(css, /display: none/);
});

test("answers the popup's match count request", async () => {
  const { chrome } = await loadPage("<p>Acme, Acme and Globex</p>", { companies: ["Acme", "Globex"] });
  let response;
  chrome.messageListeners.forEach(listener => listener({ type: "getCount" }, {}, r => { response = r; }));
  assert.deepEqual(plain(response), { count: 3 });
});

test("does not highlight when the site is excluded", async () => {
  const { document } = await loadPage(
    "<p>Acme is here</p>",
    { companies: ["Acme"], excludedSites: ["example.com"] },
    "https://example.com/test"
  );
  assert.deepEqual(highlights(document), []);
});

test("does not highlight on subdomains of excluded sites", async () => {
  const { document } = await loadPage(
    "<p>Acme is here</p>",
    { companies: ["Acme"], excludedSites: ["example.com"] },
    "https://sub.example.com/test"
  );
  assert.deepEqual(highlights(document), []);
});

test("dynamically adding an excluded site stops highlighting and clears spans without reload", async () => {
  const { document, chrome } = await loadPage(
    "<p>Acme is here</p>",
    { companies: ["Acme"], excludedSites: [] },
    "https://example.com/test"
  );
  assert.deepEqual(highlights(document), ["Acme"]);

  await chrome.storage.local.set({ excludedSites: ["example.com"] });
  await wait(100);

  assert.deepEqual(highlights(document), []);
  assert.equal(document.querySelector("p").textContent, "Acme is here");
  assert.deepEqual(plain(chrome.sent.at(-1)), { type: "count", count: 0 });
});

test("dynamically removing an excluded site resumes highlighting without reload", async () => {
  const { document, chrome } = await loadPage(
    "<p>Acme is here</p>",
    { companies: ["Acme"], excludedSites: ["example.com"] },
    "https://example.com/test"
  );
  assert.deepEqual(highlights(document), []);

  await chrome.storage.local.set({ excludedSites: [] });
  await wait(700);

  assert.deepEqual(highlights(document), ["Acme"]);
  assert.deepEqual(plain(chrome.sent.at(-1)), { type: "count", count: 1 });
});
