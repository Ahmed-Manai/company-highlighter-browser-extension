// Pure matching logic shared by the content script, the settings page and the tests.

// Turn a "one company per line" text into a clean, de-duplicated list.
// Lines starting with # are treated as comments.
function parseCompanyList(text) {
  const seen = new Set();
  const companies = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const name = line.trim();
    if (!name || name.startsWith("#")) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    companies.push(name);
  }
  return companies;
}

// Escape regex safely
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build a few large regexes instead of looping over every name (critical optimization).
// Longer names come first so "Acme Labs" wins over "Acme".
// Boundaries use letter/number lookarounds so names like "C++" or "AT&T" still match.
function buildRegexChunks(companies, chunkSize = 500) {
  const sorted = Array.from(new Set(companies.map(c => c.toLowerCase())))
    .sort((a, b) => b.length - a.length);

  const chunks = [];
  for (let i = 0; i < sorted.length; i += chunkSize) {
    const chunk = sorted.slice(i, i + chunkSize).map(escapeRegex).join("|");
    chunks.push(new RegExp(`(?<![\\p{L}\\p{N}_])(?:${chunk})(?![\\p{L}\\p{N}_])`, "giu"));
  }
  return chunks;
}

// Find non-overlapping matches across all regex chunks (earliest first, then longest)
function findMatches(text, regexChunks) {
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

if (typeof module !== "undefined") {
  module.exports = { parseCompanyList, escapeRegex, buildRegexChunks, findMatches };
}
