const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCompanyList, buildRegexChunks, findMatches } = require("../matcher.js");

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
