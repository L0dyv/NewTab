import assert from "node:assert/strict";

import {
  getInlineCompletionCandidate,
  rankSuggestions,
  shouldUseFallbackPool,
} from "../src/lib/autocompleteMatching.js";

const now = Date.now();

const okjikeSuggestion = {
  id: "history-okjike",
  title: "Jike",
  url: "https://web.okjike.com/feed",
  type: "history",
  visitCount: 12,
  typedCount: 3,
  lastVisitTime: now,
};

const otherSuggestion = {
  id: "history-other",
  title: "Other",
  url: "https://example.com/",
  type: "history",
  visitCount: 1,
  typedCount: 0,
  lastVisitTime: now - 86400000 * 30,
};

assert.equal(shouldUseFallbackPool("ok"), true);
assert.equal(shouldUseFallbackPool("web."), true);
assert.equal(shouldUseFallbackPool("search query"), false);

const rankedForLabelPrefix = rankSuggestions("ok", [otherSuggestion, okjikeSuggestion]);
assert.equal(rankedForLabelPrefix[0]?.url, okjikeSuggestion.url);

const rankedForHostPrefix = rankSuggestions("web.", [otherSuggestion, okjikeSuggestion]);
assert.equal(rankedForHostPrefix[0]?.url, okjikeSuggestion.url);

assert.deepEqual(getInlineCompletionCandidate("web.", okjikeSuggestion.url), {
  previewText: "web.okjike.com",
  committedText: "web.okjike.com",
  targetUrl: okjikeSuggestion.url,
  matchType: "host-prefix",
});

assert.deepEqual(getInlineCompletionCandidate("ok", okjikeSuggestion.url), {
  previewText: "okjike.com",
  committedText: "web.okjike.com",
  targetUrl: okjikeSuggestion.url,
  matchType: "label-prefix",
});

assert.equal(getInlineCompletionCandidate("jik", okjikeSuggestion.url), null);
assert.equal(getInlineCompletionCandidate("gemini ", "https://gemini.google.com/"), null);
assert.equal(getInlineCompletionCandidate("gemini cli", "https://gemini.google.com/"), null);

console.log("[PASS] autocomplete matching tests");

