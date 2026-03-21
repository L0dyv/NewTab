import assert from "node:assert/strict";

import {
  createHostnameAutocompleteSnapshot,
  queryHostnameAutocompleteSnapshot,
  upsertHostnameAutocompleteSnapshot,
} from "../src/lib/hostnameAutocompleteIndex.js";

const now = Date.now();

const snapshot = createHostnameAutocompleteSnapshot(
  [
    {
      title: "Gemini",
      url: "https://gemini.google.com/app",
      type: "history",
      visitCount: 8,
      typedCount: 2,
      lastVisitTime: now - 5_000,
    },
    {
      title: "Gemini Home",
      url: "https://gemini.google.com/",
      type: "bookmark",
      visitCount: 1,
      typedCount: 1,
      lastVisitTime: now - 1_000,
    },
    {
      title: "Jike",
      url: "https://web.okjike.com/feed",
      type: "history",
      visitCount: 12,
      typedCount: 3,
      lastVisitTime: now,
    },
  ],
  {
    maxPrefixLength: 4,
    maxBucketSize: 6,
  }
);

const geMatches = queryHostnameAutocompleteSnapshot(snapshot, "ge");
assert.equal(geMatches[0]?.hostname, "gemini.google.com");
assert.equal(geMatches[0]?.url, "https://gemini.google.com/");
assert.equal(geMatches[0]?.matchType, "host-prefix");

const longMatches = queryHostnameAutocompleteSnapshot(snapshot, "gemin");
assert.equal(longMatches[0]?.hostname, "gemini.google.com");

const okMatches = queryHostnameAutocompleteSnapshot(snapshot, "ok");
assert.equal(okMatches[0]?.hostname, "web.okjike.com");
assert.equal(okMatches[0]?.matchType, "label-prefix");

assert.deepEqual(queryHostnameAutocompleteSnapshot(snapshot, "gemini cli"), []);

const updatedSnapshot = upsertHostnameAutocompleteSnapshot(snapshot, {
  title: "Gemini Dashboard",
  url: "https://gemini.google.com/dashboard",
  type: "history",
  visitCount: 20,
  typedCount: 6,
  lastVisitTime: now + 10_000,
});
assert.equal(
  queryHostnameAutocompleteSnapshot(updatedSnapshot, "ge")[0]?.url,
  "https://gemini.google.com/dashboard"
);

console.log("[PASS] hostname autocomplete index tests");
