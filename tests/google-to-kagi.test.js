import assert from "node:assert/strict";

globalThis.__QTN_TEST__ = true;
await import("../content/google-to-kagi.js");

const api = globalThis.__QTN_googleToKagi;

assert.ok(api, "Expected __QTN_googleToKagi to be defined in test mode");

assert.equal(typeof api.isGoogleLikeHostname, "function");
assert.equal(typeof api.isGoogleSearchLikeUrl, "function");
assert.equal(typeof api.getQueryFromUrl, "function");
assert.equal(typeof api.buildKagiSearchUrl, "function");
assert.equal(typeof api.normalizeEngines, "function");
assert.equal(typeof api.pickCurrentEngineId, "function");
assert.equal(typeof api.buildEngineSearchUrl, "function");

assert.equal(api.isGoogleLikeHostname("www.google.com"), true);
assert.equal(api.isGoogleLikeHostname("www.google.co.jp"), true);
assert.equal(api.isGoogleLikeHostname("www.bing.com"), false);

assert.equal(api.isGoogleSearchLikeUrl("https://www.google.com/search?q=hello"), true);
assert.equal(api.isGoogleSearchLikeUrl("https://www.google.co.jp/search?q=hello"), true);
assert.equal(api.isGoogleSearchLikeUrl("https://www.google.com/search?hl=en"), false);
assert.equal(api.getQueryFromUrl("https://www.google.com/search?q=hello%20world"), "hello world");
assert.equal(api.getQueryFromUrl("https://www.google.com/search?q=%E4%B8%AD%E6%96%87"), "中文");
assert.equal(api.buildKagiSearchUrl("a&b"), "https://kagi.com/search?q=a%26b");
assert.equal(api.getQueryFromUrl("https://www.google.com/search?q="), null);

assert.equal(
  api.buildEngineSearchUrl(
    { id: "kagi-assistant", name: "Kagi Assistant", url: "https://kagi.com/assistant", isAI: true },
    "hello"
  ),
  "https://kagi.com/assistant?q=hello&internet=true"
);
assert.equal(
  api.buildEngineSearchUrl({ id: "custom", name: "Custom", url: "https://example.com/search?q=" }, "a b"),
  "https://example.com/search?q=a%20b"
);
assert.equal(
  api.buildEngineSearchUrl({ id: "custom", name: "Custom", url: "https://example.com/search?q=%s" }, "a b"),
  "https://example.com/search?q=a%20b"
);
assert.equal(
  api.buildEngineSearchUrl({ id: "custom", name: "Custom", url: "example.com/search?q=" }, "a b"),
  "https://example.com/search?q=a%20b"
);
assert.equal(
  api.buildEngineSearchUrl({ id: "custom", name: "Custom", url: "https://example.com/search?q=" }, ""),
  null
);

const normalized = api.normalizeEngines([{ id: "x", name: "X", url: "https://x.com/?q=", enabled: true }]);
assert.equal(normalized.length, 1);
assert.equal(api.pickCurrentEngineId(normalized, "missing"), "x");

console.log("[PASS] google-to-kagi tests");
