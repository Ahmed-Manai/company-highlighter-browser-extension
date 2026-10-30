let companySet = new Set();

// Elements whose text must never be modified
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "SVG"]);

// Load company list (one name per line) bundled with the extension
async function loadCompanies() {
  try {
    const response = await fetch(chrome.runtime.getURL("companies.txt"));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();

    companySet = new Set(
      text.split("\n")
        .map(c => c.trim().toLowerCase())
        .filter(Boolean)
    );

    console.log("Company Highlighter: loaded companies:", companySet.size);
  } catch (err) {
    console.warn(
      "Company Highlighter: could not load companies.txt. " +
      "Create it in the extension folder (see README).",
      err
    );
    companySet = new Set();
  }
}

// Escape regex safely
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build a few large regexes instead of looping over every name (critical optimization).
// Longer names come first so "Acme Labs" wins over "Acme".
// Boundaries use letter/number lookarounds so names like "C++" or "AT&T" still match.
function buildRegex() {
  const chunkSize = 500; // avoid huge regex crash
  const companies = Array.from(companySet).sort((a, b) => b.length - a.length);

  const chunks = [];
  for (let i = 0; i < companies.length; i += chunkSize) {
    const chunk = companies.slice(i, i + chunkSize)
      .map(escapeRegex)
      .join("|");

    chunks.push(new RegExp(`(?<![\\p{L}\\p{N}_])(?:${chunk})(?![\\p{L}\\p{N}_])`, "giu"));
  }

  return chunks;
}

let regexChunks = [];

// Find non-overlapping matches across all regex chunks (earliest first, then longest)
function findMatches(text) {
  const matches = [];

  regexChunks.forEach(regex => {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length });
    }
  });

  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const result = [];
  let lastEnd = 0;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      result.push(match);
      lastEnd = match.end;
    }
  }
  return result;
}

function shouldSkipElement(el) {
  return (
    SKIP_TAGS.has(el.tagName.toUpperCase()) ||
    el.isContentEditable ||
    (el.classList && el.classList.contains("company-highlight"))
  );
}

// Highlight text nodes
function highlight(node) {
  if (!node) return;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue;
    const matches = findMatches(text);
    if (matches.length === 0) return;

    // Build DOM nodes directly (never innerHTML) so page text cannot inject markup
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    matches.forEach(({ start, end }) => {
      if (start > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, start)));
      }
      const span = document.createElement("span");
      span.className = "company-highlight";
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

// Debounce to avoid overload
let timeout = null;

function runHighlight() {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    highlight(document.body);
  }, 500);
}

// Observe dynamic changes (e.g. infinite scroll)
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
  if (companySet.size === 0) return;

  regexChunks = buildRegex();

  runHighlight();
  observeDOM();
})();