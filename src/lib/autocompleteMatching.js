/**
 * @typedef {{
 *   id: string;
 *   title: string;
 *   url: string;
 *   type: "history" | "bookmark";
 *   visitCount?: number;
 *   typedCount?: number;
 *   lastVisitTime?: number;
 *   score?: number;
 * }} SuggestionLike
 */

const PROTOCOL_PREFIX = /^https?:\/\//i;
const WWW_PREFIX = /^www\./i;
const MAX_SUGGESTIONS = 10;

export const normalizeQuery = (text) => text.trim().toLowerCase();

export const normalizeUrlForMatch = (url) =>
  url.toLowerCase().replace(PROTOCOL_PREFIX, "").replace(WWW_PREFIX, "");

export const getInlineCompletionText = (url) => {
  const normalizedUrl = normalizeUrlForMatch(url);
  const slashIndex = normalizedUrl.indexOf("/");
  return slashIndex >= 0 ? normalizedUrl.slice(0, slashIndex) : normalizedUrl;
};

const getHostnamePrefixMatch = (normalizedQuery, url) => {
  if (!normalizedQuery) return null;

  const hostname = getInlineCompletionText(url);
  if (!hostname) return null;

  const normalizedHostname = hostname.toLowerCase();
  if (normalizedHostname.startsWith(normalizedQuery)) {
    return { matchType: "host-prefix", startIndex: 0, hostname };
  }

  let cursor = 0;
  for (const label of hostname.split(".")) {
    if (label.toLowerCase().startsWith(normalizedQuery)) {
      return { matchType: "label-prefix", startIndex: cursor, hostname };
    }
    cursor += label.length + 1;
  }

  return null;
};

const hasHostnamePrefixMatch = (normalizedQuery, url) =>
  getHostnamePrefixMatch(normalizedQuery, url) !== null;

const getHostnameMatchPriority = (normalizedQuery, url) => {
  const match = getHostnamePrefixMatch(normalizedQuery, url);
  if (match?.matchType === "host-prefix") return 2;
  if (match?.matchType === "label-prefix") return 1;
  return 0;
};

export const shouldUseFallbackPool = (query) => {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return false;
  if (normalizedQuery.includes(" ")) return false;
  return normalizedQuery.length <= 3 || normalizedQuery.includes(".");
};

export const getInlineCompletionCandidate = (query, url) => {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery || /\s/.test(query)) return null;

  const match = getHostnamePrefixMatch(normalizedQuery, url);
  if (!match) return null;

  const committedText = match.hostname;
  const previewText =
    match.matchType === "host-prefix"
      ? committedText
      : committedText.slice(match.startIndex);

  if (previewText.length <= normalizedQuery.length) {
    return null;
  }

  return {
    previewText,
    committedText,
    targetUrl: url,
    matchType: match.matchType,
  };
};

export const matchesSuggestion = (normalizedQuery, item) => {
  if (!normalizedQuery) return false;

  const title = item.title.toLowerCase();
  const rawUrl = item.url.toLowerCase();
  const normalizedUrl = normalizeUrlForMatch(item.url);

  return (
    hasHostnamePrefixMatch(normalizedQuery, item.url) ||
    title.includes(normalizedQuery) ||
    rawUrl.includes(normalizedQuery) ||
    normalizedUrl.includes(normalizedQuery)
  );
};

const getRecencyBoost = (lastVisitTime) => {
  if (!lastVisitTime) return 0;

  const ageInDays = (Date.now() - lastVisitTime) / (1000 * 60 * 60 * 24);
  if (ageInDays <= 1) return 45;
  if (ageInDays <= 7) return 35;
  if (ageInDays <= 30) return 22;
  if (ageInDays <= 90) return 10;
  return 0;
};

export const scoreSuggestion = (normalizedQuery, item) => {
  const title = item.title.toLowerCase();
  const rawUrl = item.url.toLowerCase();
  const normalizedUrl = normalizeUrlForMatch(item.url);
  const hostnameMatch = getHostnamePrefixMatch(normalizedQuery, item.url);

  let score = 0;

  if (hostnameMatch?.matchType === "host-prefix") score += 140;
  else if (hostnameMatch?.matchType === "label-prefix") score += 115;
  else if (rawUrl.startsWith(normalizedQuery)) score += 110;
  else if (normalizedUrl.includes(normalizedQuery)) score += 45;

  if (title.startsWith(normalizedQuery)) score += 80;
  else if (title.includes(normalizedQuery)) score += 30;

  if (item.type === "bookmark") score += 35;

  score += Math.min((item.typedCount || 0) * 10, 80);
  score += Math.min(Math.log2((item.visitCount || 0) + 1) * 12, 60);
  score += getRecencyBoost(item.lastVisitTime);

  return score;
};

/**
 * @param {string} query
 * @param {SuggestionLike[]} items
 * @returns {SuggestionLike[]}
 */
export const rankSuggestions = (query, items) => {
  const normalizedQuery = normalizeQuery(query);
  const bestByUrl = new Map();

  for (const item of items) {
    if (!matchesSuggestion(normalizedQuery, item)) continue;

    const score = scoreSuggestion(normalizedQuery, item);
    const rankedItem = {
      ...item,
      score,
      matchPriority: getHostnameMatchPriority(normalizedQuery, item.url),
    };
    const dedupeKey = item.url.toLowerCase();
    const existing = bestByUrl.get(dedupeKey);

    if (
      !existing ||
      (existing.matchPriority || 0) < rankedItem.matchPriority ||
      (
        (existing.matchPriority || 0) === rankedItem.matchPriority &&
        (existing.score || 0) < score
      )
    ) {
      bestByUrl.set(dedupeKey, rankedItem);
    }
  }

  return [...bestByUrl.values()]
    .sort(
      (a, b) =>
        (b.matchPriority || 0) - (a.matchPriority || 0) ||
        (b.score || 0) - (a.score || 0) ||
        (b.typedCount || 0) - (a.typedCount || 0) ||
        (b.visitCount || 0) - (a.visitCount || 0) ||
        (b.lastVisitTime || 0) - (a.lastVisitTime || 0)
    )
    .slice(0, MAX_SUGGESTIONS);
};

