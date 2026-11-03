// Relies on matcher.js and settings.js, which the manifest loads first.

const HIGHLIGHT_CLASS = "company-highlight";
const STYLE_ID = "company-highlighter-style";

// Elements whose text must never be modified
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "SVG"]);

let regexChunks = [];
let observer = null;
let timeout = null;

function isEditable(el) {
  if (el.isContentEditable) return true;
  // Fallback for environments without isContentEditable; the walk is top-down,
  // so skipping the element that sets the attribute also skips its children
  const value = el.getAttribute("contenteditable");
  return value !== null && value.toLowerCase() !== "false";
}

function shouldSkipElement(el) {
  return (
    SKIP_TAGS.has(el.tagName.toUpperCase()) ||
    isEditable(el) ||
    (el.classList && el.classList.contains(HIGHLIGHT_CLASS))
  );
}

// Highlight text nodes
function highlight(node) {
  if (!node) return;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue;
    const matches = findMatches(text, regexChunks);
    if (matches.length === 0) return;

    // Build DOM nodes directly (never innerHTML) so page text cannot inject markup
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    matches.forEach(({ start, end }) => {
      if (start > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, start)));
      }
      const span = document.createElement("span");
      span.className = HIGHLIGHT_CLASS;
      span.textContent = text.slice(start, end);
      fragment.appendChild(span);
      cursor = end;
    });

    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }

    node.replaceWith(fragment);
  } else if (node.nodeType === Node.ELEMENT_NODE && !shouldSkipElement(node)) {
    // Copy the list first: highlighting replaces child nodes while we iterate
    Array.from(node.childNodes).forEach(child => highlight(child));
  }
}

// Put the original text back, e.g. when the extension is switched off or the list changes
function removeHighlights() {
  document.querySelectorAll(`span.${HIGHLIGHT_CLASS}`).forEach(span => {
    const parent = span.parentNode;
    span.replaceWith(document.createTextNode(span.textContent));
    parent.normalize();
  });
}

function countHighlights() {
  return document.querySelectorAll(`span.${HIGHLIGHT_CLASS}`).length;
}

function reportCount() {
  chrome.runtime.sendMessage({ type: "count", count: countHighlights() }).catch(() => {
    // The background worker may be restarting; the next run reports again.
  });
}

function applyColor(color) {
  // Only accept #rrggbb so a stored value can never inject CSS into the page
  if (!/^#[0-9a-f]{6}$/i.test(color)) color = DEFAULT_SETTINGS.color;
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    (document.head || document.documentElement).appendChild(style);
  }
  style.textContent = `span.${HIGHLIGHT_CLASS} { background-color: ${color}; }`;
}

// Debounce to avoid overload
function runHighlight() {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    highlight(document.body);
    reportCount();
  }, 500);
}

function start() {
  runHighlight();
  if (!observer) {
    // Observe dynamic changes (e.g. infinite scroll)
    observer = new MutationObserver(runHighlight);
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

function stop() {
  clearTimeout(timeout);
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  removeHighlights();
  reportCount();
}

async function refresh() {
  const settings = await loadSettings();
  stop();
  if (isSiteExcluded(location.hostname, settings.excludedSites)) {
    return;
  }
  regexChunks = buildRegexChunks(settings.companies);
  applyColor(settings.color);
  if (settings.enabled && regexChunks.length > 0) {
    start();
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.companies || changes.enabled || changes.excludedSites) {
    refresh();
  } else if (changes.color) {
    applyColor(changes.color.newValue);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "getCount") {
    sendResponse({ count: countHighlights() });
  }
});

refresh();
