let companySet = new Set();

// Load company list
async function loadCompanies() {
  const response = await fetch(chrome.runtime.getURL("companies.txt"));
  const text = await response.text();

  companySet = new Set(
    text.split("\n")
      .map(c => c.trim().toLowerCase())
      .filter(Boolean)
  );

  console.log("Loaded companies:", companySet.size);
}

// Escape regex safely
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build ONE regex instead of 13k loops (critical optimization)
let regex = null;

function buildRegex() {
  const chunkSize = 500; // avoid huge regex crash
  const companies = Array.from(companySet);

  const chunks = [];
  for (let i = 0; i < companies.length; i += chunkSize) {
    const chunk = companies.slice(i, i + chunkSize)
      .map(escapeRegex)
      .join("|");

    chunks.push(new RegExp(`\\b(${chunk})\\b`, "gi"));
  }

  return chunks;
}

let regexChunks = [];

// Highlight text nodes
function highlight(node) {
  if (!node) return;

  // ❗ Skip if already highlighted
  if (
    node.nodeType === 1 &&
    node.classList &&
    node.classList.contains("company-highlight")
  ) {
    return;
  }

  if (node.nodeType === 3) {
    let text = node.nodeValue;

    let matched = false;
    regexChunks.forEach(regex => {
      if (regex.test(text)) matched = true;
    });

    if (!matched) return;

    const span = document.createElement("span");

    let newHTML = text;

    regexChunks.forEach(regex => {
      newHTML = newHTML.replace(regex, match =>
        `<span class="company-highlight">${match}</span>`
      );
    });

    span.innerHTML = newHTML;
    node.replaceWith(span);

  } else if (
    node.nodeType === 1 &&
    !["SCRIPT", "STYLE", "NOSCRIPT"].includes(node.tagName)
  ) {
    node.childNodes.forEach(child => highlight(child));
  }
}

// Debounce to avoid overload
let timeout = null;

function runHighlight() {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    highlight(document.body);
  }, 500);
}

// Observe dynamic changes (LinkedIn infinite scroll)
function observeDOM() {
  const observer = new MutationObserver(runHighlight);

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Init
(async function () {
  await loadCompanies();
  regexChunks = buildRegex();

  runHighlight();
  observeDOM();
})();