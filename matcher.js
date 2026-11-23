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

// Turn a "one hostname/URL per line" text into a clean, de-duplicated list of hostnames.
// Safely extracts and normalizes hostnames using URL API where appropriate.
// Rejects invalid entries, comments (#), empty lines, and ignores paths, protocols, and ports.
function parseExcludedSites(text) {
  const seen = new Set();
  const sites = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;

    let candidate = raw;
    // If input contains :// or starts with //, try parsing as a full URL
    if (candidate.includes("://") || candidate.startsWith("//")) {
      try {
        const parsed = new URL(candidate.startsWith("//") ? `http:${candidate}` : candidate);
        candidate = parsed.hostname;
      } catch {
        continue;
      }
    } else {
      // If it contains a slash, path, query, or hash, strip it or parse with dummy protocol
      try {
        const parsed = new URL(`http://${candidate}`);
        candidate = parsed.hostname;
      } catch {
        continue;
      }
    }

    if (!candidate) continue;

    // Normalise to lower case and strip any trailing dot
    candidate = candidate.toLowerCase().replace(/\.+$/, "");

    // Validate hostname format:
    // Labels can contain alphanumeric and hyphens (not starting/ending with hyphen)
    // IPv4 and IPv6 [::1] (without brackets in hostname) are also valid URL hostnames
    // Must contain at least one valid label, no spaces, no invalid characters
    const validHostnamePattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
    const isIPv6 = /^\[?[a-f0-9:]+\]?$/i.test(candidate) && candidate.includes(":");
    if (!validHostnamePattern.test(candidate) && !isIPv6) {
      continue;
    }

    if (seen.has(candidate)) continue;
    seen.add(candidate);
    sites.push(candidate);
  }
  return sites;
}

// Check if a given hostname matches any hostname in excludedSites.
// Matches exact hostname or dot-boundary subdomains (e.g., "sub.example.com" matches "example.com").
// Never matches partial non-dot boundaries (e.g., "notexample.com" does NOT match "example.com").
function isSiteExcluded(hostname, excludedSites) {
  if (!hostname || !Array.isArray(excludedSites) || excludedSites.length === 0) {
    return false;
  }
  const host = String(hostname).toLowerCase().replace(/\.+$/, "");
  for (const site of excludedSites) {
    const excluded = String(site).toLowerCase().replace(/\.+$/, "");
    if (!excluded) continue;
    if (host === excluded || host.endsWith("." + excluded)) {
      return true;
    }
  }
  return false;
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
  module.exports = { parseCompanyList, parseExcludedSites, isSiteExcluded, escapeRegex, buildRegexChunks, findMatches };
}
