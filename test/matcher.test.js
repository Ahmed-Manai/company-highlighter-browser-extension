const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCompanyList, parseExcludedSites, isSiteExcluded, buildRegexChunks, findMatches } = require("../matcher.js");

function matchedText(text, companies, chunkSize) {
  const chunks = buildRegexChunks(companies, chunkSize);
  return findMatches(text, chunks).map(({ start, end }) => text.slice(start, end));
}

test("parseCompanyList trims, skips blanks and comments, and de-duplicates ignoring case", () => {
  const list = parseCompanyList("  Acme \r\n\n# a comment\nGlobex\nacme\nInitech  \n");
  assert.deepEqual(list, ["Acme", "Globex", "Initech"]);
});

test("parseCompanyList handles empty input", () => {
  assert.deepEqual(parseCompanyList(""), []);
  assert.deepEqual(parseCompanyList(undefined), []);
});

test("matching ignores case", () => {
  assert.deepEqual(matchedText("I work at ACME and acme.", ["Acme"]), ["ACME", "acme"]);
});

test("the longest name wins when names overlap", () => {
  assert.deepEqual(matchedText("Acme Labs is hiring", ["Acme", "Acme Labs"]), ["Acme Labs"]);
});

test("names only match as whole words", () => {
  assert.deepEqual(matchedText("Acmeish and SuperAcme", ["Acme"]), []);
});

test("names with symbols match", () => {
  assert.deepEqual(matchedText("Jobs at AT&T and C++ shops", ["AT&T", "C++"]), ["AT&T", "C++"]);
});

test("non-ASCII names match with Unicode word boundaries", () => {
  assert.deepEqual(matchedText("Société Générale, not Sociétés", ["Société Générale", "Société"]), ["Société Générale"]);
});

test("lists larger than one regex chunk still match", () => {
  const companies = Array.from({ length: 1200 }, (_, i) => `Company${i}`);
  const chunks = buildRegexChunks(companies, 500);
  assert.equal(chunks.length, 3);
  assert.deepEqual(matchedText("Company5 and Company1199", companies, 500), ["Company5", "Company1199"]);
});

test("an empty list produces no regexes", () => {
  assert.deepEqual(buildRegexChunks([]), []);
});

test("parseExcludedSites trims, skips blanks and comments, and de-duplicates case-insensitively", () => {
  const input = "  example.com \r\n\n# ignore comment\nEXAMPLE.COM\n  github.com  \n";
  assert.deepEqual(parseExcludedSites(input), ["example.com", "github.com"]);
});

test("parseExcludedSites handles empty and undefined input", () => {
  assert.deepEqual(parseExcludedSites(""), []);
  assert.deepEqual(parseExcludedSites(undefined), []);
  assert.deepEqual(parseExcludedSites("   \n\n# comment\n"), []);
});

test("parseExcludedSites normalizes URLs and strips protocols, paths, query params and ports", () => {
  const input = [
    "https://example.com/some/path?query=1#hash",
    "http://sub.example.com:8080/index.html",
    "//cdn.example.org/asset.js",
    "developer.mozilla.org/en-US/docs",
    "localhost:3000/dashboard"
  ].join("\n");

  assert.deepEqual(parseExcludedSites(input), [
    "example.com",
    "sub.example.com",
    "cdn.example.org",
    "developer.mozilla.org",
    "localhost"
  ]);
});

test("parseExcludedSites rejects invalid hostnames", () => {
  const input = [
    "invalid hostname with spaces",
    "http://",
    "....",
    "-startwithdash.com",
    "endswithdash-.com",
    "example..com",
    "valid-site.com"
  ].join("\n");

  assert.deepEqual(parseExcludedSites(input), ["valid-site.com"]);
});

test("isSiteExcluded correctly matches exact hostnames and subdomains", () => {
  const excluded = ["example.com", "my-org.co.uk"];

  // Exact hostname match
  assert.equal(isSiteExcluded("example.com", excluded), true);
  // Subdomain match
  assert.equal(isSiteExcluded("www.example.com", excluded), true);
  // Nested subdomain match
  assert.equal(isSiteExcluded("docs.dev.example.com", excluded), true);
  // Multi-label TLD match & subdomain
  assert.equal(isSiteExcluded("my-org.co.uk", excluded), true);
  assert.equal(isSiteExcluded("app.my-org.co.uk", excluded), true);

  // Case normalization
  assert.equal(isSiteExcluded("WWW.EXAMPLE.COM", excluded), true);
  assert.equal(isSiteExcluded("Example.Com", excluded), true);
  assert.equal(isSiteExcluded("example.com", ["EXAMPLE.COM"]), true);

  // Non-match
  assert.equal(isSiteExcluded("example.org", excluded), false);

  // Similar but unrelated hostname (must not match without dot boundary)
  assert.equal(isSiteExcluded("notexample.com", excluded), false);
  assert.equal(isSiteExcluded("badexample.com", excluded), false);
  assert.equal(isSiteExcluded("example.com.evil.com", excluded), false);

  // Empty excluded list
  assert.equal(isSiteExcluded("example.com", []), false);
  assert.equal(isSiteExcluded("example.com", undefined), false);

  // Trailing dot in hostname or excluded
  assert.equal(isSiteExcluded("example.com.", ["example.com"]), true);
  assert.equal(isSiteExcluded("example.com", ["example.com."]), true);
});
