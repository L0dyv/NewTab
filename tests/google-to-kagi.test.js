import assert from "node:assert/strict";

globalThis.__QTN_TEST__ = true;
await import("../content/google-to-kagi.js");

const api = globalThis.__QTN_googleToKagi;

assert.ok(api, "Expected __QTN_googleToKagi to be defined in test mode");

assert.equal(typeof api.isGoogleSearchLikeUrl, "function");
assert.equal(typeof api.getQueryFromUrl, "function");
assert.equal(typeof api.buildKagiSearchUrl, "function");

assert.equal(api.isGoogleSearchLikeUrl("https://www.google.com/search?q=hello"), true);
assert.equal(api.getQueryFromUrl("https://www.google.com/search?q=hello%20world"), "hello world");
assert.equal(api.buildKagiSearchUrl("a&b"), "https://kagi.com/search?q=a%26b");
assert.equal(api.getQueryFromUrl("https://www.google.com/search?q="), null);

console.log("[PASS] google-to-kagi tests");
