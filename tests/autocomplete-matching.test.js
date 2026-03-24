import assert from "node:assert/strict";

import {
  getSearchQueryVariants,
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

const strongButFuzzyV2Suggestion = {
  id: "history-v2ray",
  title: "V2Ray Docs",
  url: "https://example.com/tutorials/v2ray",
  type: "history",
  visitCount: 120,
  typedCount: 8,
  lastVisitTime: now,
};

const v2exSuggestion = {
  id: "history-v2ex",
  title: "V2EX",
  url: "https://www.v2ex.com/",
  type: "history",
  visitCount: 8,
  typedCount: 1,
  lastVisitTime: now - 86400000 * 10,
};

const strongButFuzzyBilibSuggestion = {
  id: "history-bilib-note",
  title: "Bilib Notes",
  url: "https://example.com/notes/bilib-reference",
  type: "history",
  visitCount: 300,
  typedCount: 12,
  lastVisitTime: now,
};

const bilibiliSuggestion = {
  id: "history-bilibili",
  title: "bilibili",
  url: "https://www.bilibili.com/",
  type: "history",
  visitCount: 10,
  typedCount: 1,
  lastVisitTime: now - 86400000 * 5,
};

const almaReleaseSuggestion = {
  id: "history-alma-releases",
  title: "alma-releases",
  url: "https://github.com/AlmaLinux/alma-releases/releases",
  type: "history",
  visitCount: 18,
  typedCount: 2,
  lastVisitTime: now - 86400000,
};

assert.equal(shouldUseFallbackPool("ok"), true);
assert.equal(shouldUseFallbackPool("web."), true);
assert.equal(shouldUseFallbackPool("searchquery"), false);
assert.equal(shouldUseFallbackPool("search query"), true);
assert.equal(shouldUseFallbackPool("alma release"), true);

assert.deepEqual(getSearchQueryVariants("alma release"), [
  "alma release",
  "alma-release",
  "almarelease",
]);
assert.deepEqual(getSearchQueryVariants("v."), [
  "v.",
]);

const rankedForLabelPrefix = rankSuggestions("ok", [otherSuggestion, okjikeSuggestion]);
assert.equal(rankedForLabelPrefix[0]?.url, okjikeSuggestion.url);

const rankedForHostPrefix = rankSuggestions("web.", [otherSuggestion, okjikeSuggestion]);
assert.equal(rankedForHostPrefix[0]?.url, okjikeSuggestion.url);

const rankedForV2HostPrefix = rankSuggestions("v2", [strongButFuzzyV2Suggestion, v2exSuggestion]);
assert.equal(rankedForV2HostPrefix[0]?.url, v2exSuggestion.url);

const rankedForBilibHostPrefix = rankSuggestions("bilib", [strongButFuzzyBilibSuggestion, bilibiliSuggestion]);
assert.equal(rankedForBilibHostPrefix[0]?.url, bilibiliSuggestion.url);

const rankedForLooseSeparatorMatch = rankSuggestions("alma release", [otherSuggestion, almaReleaseSuggestion]);
assert.equal(rankedForLooseSeparatorMatch[0]?.url, almaReleaseSuggestion.url);

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

