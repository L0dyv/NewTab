const PROTOCOL_PREFIX = /^https?:\/\//i;
const WWW_PREFIX = /^www\./i;
const DEFAULT_MAX_PREFIX_LENGTH = 8;
const DEFAULT_MAX_BUCKET_SIZE = 12;

const normalizeQuery = (query) => String(query || "").trim().toLowerCase();

const getRecencyBoost = (lastVisitTime) => {
  if (!lastVisitTime) return 0;

  const ageInDays = (Date.now() - lastVisitTime) / (1000 * 60 * 60 * 24);
  if (ageInDays <= 1) return 45;
  if (ageInDays <= 7) return 35;
  if (ageInDays <= 30) return 22;
  if (ageInDays <= 90) return 10;
  return 0;
};

const getPathBonus = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" || parsed.pathname === "" ? 18 : 0;
  } catch {
    return 0;
  }
};

export const normalizeHostname = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    return parsed.hostname.toLowerCase().replace(WWW_PREFIX, "");
  } catch {
    return raw.toLowerCase().replace(PROTOCOL_PREFIX, "").replace(WWW_PREFIX, "").split("/")[0];
  }
};

export const getHostnamePrefixMatch = (query, hostname) => {
  const normalizedQuery = normalizeQuery(query);
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedQuery || !normalizedHostname || /\s/.test(query)) return null;

  if (normalizedHostname.startsWith(normalizedQuery)) {
    return { matchType: "host-prefix" };
  }

  for (const label of normalizedHostname.split(".")) {
    if (label.startsWith(normalizedQuery)) {
      return { matchType: "label-prefix" };
    }
  }

  return null;
};

const getBucketPriority = (prefix, hostname) => {
  const match = getHostnamePrefixMatch(prefix, hostname);
  if (match?.matchType === "host-prefix") return 2;
  if (match?.matchType === "label-prefix") return 1;
  return 0;
};

const getEntryStrength = (entry) => {
  let score = 0;

  if (entry.type === "bookmark") score += 45;
  score += Math.min((entry.typedCount || 0) * 10, 80);
  score += Math.min(Math.log2((entry.visitCount || 0) + 1) * 12, 60);
  score += getRecencyBoost(entry.lastVisitTime);
  score += getPathBonus(entry.url);

  return score;
};

const getCanonicalSource = (entry) => ({
  hostname: entry.hostname,
  title: entry.title,
  url: entry.url,
  type: entry.sourceType || entry.type,
  visitCount: entry.sourceVisitCount ?? entry.visitCount ?? 0,
  typedCount: entry.sourceTypedCount ?? entry.typedCount ?? 0,
  lastVisitTime: entry.sourceLastVisitTime ?? entry.lastVisitTime ?? 0,
});

const chooseCanonicalEntry = (current, next) => {
  if (!current) return next;

  const currentSource = getCanonicalSource(current);
  const currentStrength = getEntryStrength(currentSource);
  const nextStrength = getEntryStrength(next);
  const preferred = nextStrength > currentStrength ? next : current;
  const bookmarked = current.type === "bookmark" || next.type === "bookmark";

  return {
    hostname: preferred.hostname,
    title: preferred.title,
    url: preferred.url,
    type: bookmarked ? "bookmark" : "history",
    visitCount: (current.visitCount || 0) + (next.visitCount || 0),
    typedCount: (current.typedCount || 0) + (next.typedCount || 0),
    lastVisitTime: Math.max(current.lastVisitTime || 0, next.lastVisitTime || 0),
    sourceType: preferred.type,
    sourceVisitCount: preferred.visitCount || 0,
    sourceTypedCount: preferred.typedCount || 0,
    sourceLastVisitTime: preferred.lastVisitTime || 0,
  };
};

const getPrefixKeys = (hostname, maxPrefixLength) => {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) return [];

  const prefixes = new Set();
  const addPrefixes = (value) => {
    const upperBound = Math.min(maxPrefixLength, value.length);
    for (let index = 1; index <= upperBound; index += 1) {
      prefixes.add(value.slice(0, index));
    }
  };

  addPrefixes(normalizedHostname);
  for (const label of normalizedHostname.split(".")) {
    addPrefixes(label);
  }

  return [...prefixes];
};

const sortBucketEntries = (items, maxBucketSize) =>
  items
    .sort(
      (a, b) =>
        b.matchPriority - a.matchPriority ||
        b.strength - a.strength ||
        a.hostname.localeCompare(b.hostname)
    )
    .slice(0, maxBucketSize)
    .map((item) => item.hostname);

const toHostnameEntry = (item) => {
  const hostname = normalizeHostname(item?.url);
  if (!hostname || !item?.url) return null;

  return {
    hostname,
    title: item.title || item.url,
    url: item.url,
    type: item.type === "bookmark" ? "bookmark" : "history",
    visitCount: item.visitCount || 0,
    typedCount: item.typedCount || 0,
    lastVisitTime: item.lastVisitTime || 0,
    sourceType: item.type === "bookmark" ? "bookmark" : "history",
    sourceVisitCount: item.visitCount || 0,
    sourceTypedCount: item.typedCount || 0,
    sourceLastVisitTime: item.lastVisitTime || 0,
  };
};

export const createHostnameAutocompleteSnapshot = (items, options = {}) => {
  const maxPrefixLength = options.maxPrefixLength || DEFAULT_MAX_PREFIX_LENGTH;
  const maxBucketSize = options.maxBucketSize || DEFAULT_MAX_BUCKET_SIZE;
  const entriesByHost = {};

  for (const item of items || []) {
    const entry = toHostnameEntry(item);
    if (!entry) continue;

    entriesByHost[entry.hostname] = chooseCanonicalEntry(entriesByHost[entry.hostname], entry);
  }

  const prefixBuckets = {};

  for (const entry of Object.values(entriesByHost)) {
    const strength = getEntryStrength(entry);
    for (const prefix of getPrefixKeys(entry.hostname, maxPrefixLength)) {
      const bucket = prefixBuckets[prefix] || new Map();
      const existing = bucket.get(entry.hostname);
      const nextItem = {
        hostname: entry.hostname,
        strength,
        matchPriority: getBucketPriority(prefix, entry.hostname),
      };

      if (
        !existing ||
        existing.matchPriority < nextItem.matchPriority ||
        (existing.matchPriority === nextItem.matchPriority && existing.strength < nextItem.strength)
      ) {
        bucket.set(entry.hostname, nextItem);
      }

      prefixBuckets[prefix] = bucket;
    }
  }

  const serializedBuckets = {};
  for (const [prefix, bucket] of Object.entries(prefixBuckets)) {
    serializedBuckets[prefix] = sortBucketEntries([...bucket.values()], maxBucketSize);
  }

  return {
    version: 1,
    generatedAt: Date.now(),
    maxPrefixLength,
    maxBucketSize,
    entriesByHost,
    prefixBuckets: serializedBuckets,
  };
};

export const upsertHostnameAutocompleteSnapshot = (snapshot, item) => {
  const entry = toHostnameEntry(item);
  if (!entry) return snapshot;

  const maxPrefixLength = snapshot?.maxPrefixLength || DEFAULT_MAX_PREFIX_LENGTH;
  const maxBucketSize = snapshot?.maxBucketSize || DEFAULT_MAX_BUCKET_SIZE;
  const entriesByHost = {
    ...(snapshot?.entriesByHost || {}),
  };
  entriesByHost[entry.hostname] = chooseCanonicalEntry(entriesByHost[entry.hostname], entry);

  const prefixBuckets = {
    ...(snapshot?.prefixBuckets || {}),
  };
  const mergedEntry = entriesByHost[entry.hostname];
  const strength = getEntryStrength(mergedEntry);

  for (const prefix of getPrefixKeys(entry.hostname, maxPrefixLength)) {
    const hostnames = new Set(prefixBuckets[prefix] || []);
    hostnames.add(entry.hostname);

    prefixBuckets[prefix] = sortBucketEntries(
      [...hostnames].map((hostname) => ({
        hostname,
        strength: getEntryStrength(entriesByHost[hostname]),
        matchPriority: getBucketPriority(prefix, hostname),
      })),
      maxBucketSize
    );
  }

  return {
    version: snapshot?.version || 1,
    generatedAt: Date.now(),
    maxPrefixLength,
    maxBucketSize,
    entriesByHost,
    prefixBuckets,
  };
};

export const queryHostnameAutocompleteSnapshot = (snapshot, query, limit = DEFAULT_MAX_BUCKET_SIZE) => {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery || /\s/.test(query)) return [];

  const maxPrefixLength = snapshot?.maxPrefixLength || DEFAULT_MAX_PREFIX_LENGTH;
  const prefixKey = normalizedQuery.slice(0, maxPrefixLength);
  const bucket = snapshot?.prefixBuckets?.[prefixKey] || [];
  const results = [];

  for (const hostname of bucket) {
    const entry = snapshot?.entriesByHost?.[hostname];
    if (!entry) continue;

    const match = getHostnamePrefixMatch(normalizedQuery, hostname);
    if (!match) continue;

    results.push({
      hostname: entry.hostname,
      title: entry.title,
      url: entry.url,
      type: entry.type,
      visitCount: entry.visitCount,
      typedCount: entry.typedCount,
      lastVisitTime: entry.lastVisitTime,
      matchType: match.matchType,
    });

    if (results.length >= limit) {
      break;
    }
  }

  return results;
};
