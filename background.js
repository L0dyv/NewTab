const parseTitle = (html) => {
    const m = html.match(/<title>([^<]*)<\/title>/i);
    return m ? m[1].trim() : null;
};

const absoluteUrl = (base, href) => {
    try {
        return new URL(href, base).toString();
    } catch {
        return href;
    }
};

const parseIcons = (html, baseUrl) => {
    const links = [];
    const regex = /<link[^>]*rel=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
        const rel = m[1].toLowerCase();
        const href = m[2];
        if (rel.includes("icon") || rel.includes("apple-touch-icon") || rel.includes("mask-icon")) {
            links.push(absoluteUrl(baseUrl, href));
        }
    }
    return links;
};

const tryFetchOk = async (url) => {
    try {
        const res = await fetch(url, { method: "GET", redirect: "follow" });
        if (res.ok) {
            const ct = res.headers.get("content-type") || "";
            if (ct.includes("image") || url.endsWith(".ico") || url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".svg")) {
                return url;
            }
        }
        return null;
    } catch {
        return null;
    }
};

const blobToDataURL = (blob) => new Promise((resolve, reject) => {
    try {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("read error"));
        reader.readAsDataURL(blob);
    } catch (e) {
        reject(e);
    }
});

const fetchToDataURL = async (url) => {
    try {
        const res = await fetch(url, { method: "GET", redirect: "follow" });
        if (!res.ok) return null;
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("image") && !url.endsWith(".ico") && !url.endsWith(".png") && !url.endsWith(".jpg") && !url.endsWith(".svg")) return null;
        const blob = await res.blob();
        const dataUrl = await blobToDataURL(blob);
        return typeof dataUrl === "string" ? dataUrl : null;
    } catch {
        return null;
    }
};

const resolveFavicon = async (pageUrl) => {
    let hostname = "";
    try {
        hostname = new URL(pageUrl).hostname;
    } catch {
        hostname = pageUrl;
    }

    try {
        const htmlRes = await fetch(pageUrl, { method: "GET", redirect: "follow" });
        if (htmlRes.ok) {
            const html = await htmlRes.text();
            const icons = parseIcons(html, pageUrl);
            for (const u of icons) {
                const ok = await tryFetchOk(u);
                if (ok) return ok;
            }
        }
    } catch { }

    const candidates = [
        `https://${hostname}/favicon.ico`,
        `https://${hostname}/favicon.png`,
        `https://${hostname}/apple-touch-icon.png`,
        `https://${hostname}/apple-touch-icon-precomposed.png`,
        `http://${hostname}/favicon.ico`
    ];
    for (const u of candidates) {
        const ok = await tryFetchOk(u);
        if (ok) return ok;
    }
    return null;
};

const OMNIBOX_MAX_HISTORY = 40;
const OMNIBOX_MAX_BOOKMARKS = 25;
const OMNIBOX_MAX_RESULTS = 8;
const OMNIBOX_ENGINE_CACHE_TTL_MS = 5000;

const FALLBACK_OMNIBOX_ENGINES = [
    { id: "google", name: "Google", url: "https://www.google.com/search?q=", isDefault: true, enabled: true },
    { id: "bing", name: "Bing", url: "https://www.bing.com/search?q=", enabled: true },
    { id: "duckduckgo", name: "DuckDuckGo", url: "https://duckduckgo.com/?q=", enabled: true },
    { id: "brave", name: "Brave", url: "https://search.brave.com/search?q=", enabled: true },
    { id: "kagi", name: "Kagi", url: "https://kagi.com/search?q=", enabled: true },
    { id: "kagi-assistant", name: "Kagi Assistant", url: "https://kagi.com/assistant", isAI: true, enabled: true },
];

let omniboxRequestId = 0;
let cachedOmniboxEngine = null;
let cachedOmniboxEngineAt = 0;

const escapeOmnibox = (text = "") => String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeQuery = (text = "") => text.trim().toLowerCase();

const normalizeUrlForMatch = (url = "") => url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");

const HOSTNAME_INDEX_STORAGE_KEY = "hostnameAutocompleteIndexV1";
const HOSTNAME_INDEX_MAX_PREFIX_LENGTH = 8;
const HOSTNAME_INDEX_BUCKET_SIZE = 12;
const HOSTNAME_INDEX_QUERY_LIMIT = 12;
const HOSTNAME_INDEX_REBUILD_DEBOUNCE_MS = 15000;
const HOSTNAME_INDEX_PERSIST_DEBOUNCE_MS = 5000;
const HISTORY_INDEX_SLICE_MAX_RESULTS = 500;
const HISTORY_INDEX_MIN_WINDOW_MS = 24 * 60 * 60 * 1000;

let hostnameIndexCache = null;
let hostnameIndexLoadPromise = null;
let hostnameIndexBuildPromise = null;
let hostnameIndexPersistTimer = null;
let hostnameIndexRebuildTimer = null;
let hostnameIndexDirty = false;

const getRecencyBoost = (lastVisitTime) => {
    if (!lastVisitTime) return 0;

    const ageInDays = (Date.now() - lastVisitTime) / (1000 * 60 * 60 * 24);
    if (ageInDays <= 1) return 45;
    if (ageInDays <= 7) return 35;
    if (ageInDays <= 30) return 22;
    if (ageInDays <= 90) return 10;
    return 0;
};

const getUrlPathBonus = (url) => {
    try {
        const parsed = new URL(url);
        return parsed.pathname === "/" || parsed.pathname === "" ? 18 : 0;
    } catch {
        return 0;
    }
};

const getHostnamePrefixMatch = (normalizedQuery, url) => {
    if (!normalizedQuery) return null;

    const normalizedUrl = normalizeUrlForMatch(url || "");
    const slashIndex = normalizedUrl.indexOf("/");
    const hostname = slashIndex >= 0 ? normalizedUrl.slice(0, slashIndex) : normalizedUrl;
    if (!hostname) return null;

    if (hostname.startsWith(normalizedQuery)) {
        return { matchType: "host-prefix" };
    }

    for (const label of hostname.split(".")) {
        if (label.startsWith(normalizedQuery)) {
            return { matchType: "label-prefix" };
        }
    }

    return null;
};

const getHostnameMatchPriority = (normalizedQuery, url) => {
    const match = getHostnamePrefixMatch(normalizedQuery, url);
    if (match?.matchType === "host-prefix") return 2;
    if (match?.matchType === "label-prefix") return 1;
    return 0;
};

const getHostnameIndexEntryStrength = (entry) => {
    let score = 0;

    if (entry.type === "bookmark") score += 45;
    score += Math.min((entry.typedCount || 0) * 10, 80);
    score += Math.min(Math.log2((entry.visitCount || 0) + 1) * 12, 60);
    score += getRecencyBoost(entry.lastVisitTime);
    score += getUrlPathBonus(entry.url);

    return score;
};

const getCanonicalHostnameSource = (entry) => ({
    hostname: entry.hostname,
    title: entry.title,
    url: entry.url,
    type: entry.sourceType || entry.type,
    visitCount: entry.sourceVisitCount ?? entry.visitCount ?? 0,
    typedCount: entry.sourceTypedCount ?? entry.typedCount ?? 0,
    lastVisitTime: entry.sourceLastVisitTime ?? entry.lastVisitTime ?? 0,
});

const chooseHostnameIndexEntry = (current, next) => {
    if (!current) return next;

    const currentStrength = getHostnameIndexEntryStrength(getCanonicalHostnameSource(current));
    const nextStrength = getHostnameIndexEntryStrength(next);
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

const toHostnameIndexEntry = (item) => {
    const url = item?.url || "";
    const hostname = normalizeUrlForMatch(url).split("/")[0];
    if (!hostname || !url) return null;

    return {
        hostname,
        title: item.title || url,
        url,
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

const getHostnameIndexPrefixes = (hostname, maxPrefixLength = HOSTNAME_INDEX_MAX_PREFIX_LENGTH) => {
    if (!hostname) return [];

    const prefixes = new Set();
    const addPrefixes = (value) => {
        const upperBound = Math.min(maxPrefixLength, value.length);
        for (let index = 1; index <= upperBound; index += 1) {
            prefixes.add(value.slice(0, index));
        }
    };

    addPrefixes(hostname);
    for (const label of hostname.split(".")) {
        addPrefixes(label);
    }

    return [...prefixes];
};

const sortHostnameBucketItems = (items, maxBucketSize = HOSTNAME_INDEX_BUCKET_SIZE) =>
    items
        .sort((a, b) =>
            b.matchPriority - a.matchPriority
            || b.strength - a.strength
            || a.hostname.localeCompare(b.hostname)
        )
        .slice(0, maxBucketSize)
        .map((item) => item.hostname);

const createHostnameIndexSnapshot = (items, options = {}) => {
    const maxPrefixLength = options.maxPrefixLength || HOSTNAME_INDEX_MAX_PREFIX_LENGTH;
    const maxBucketSize = options.maxBucketSize || HOSTNAME_INDEX_BUCKET_SIZE;
    const entriesByHost = {};

    for (const item of items || []) {
        const entry = toHostnameIndexEntry(item);
        if (!entry) continue;
        entriesByHost[entry.hostname] = chooseHostnameIndexEntry(entriesByHost[entry.hostname], entry);
    }

    const buckets = {};
    for (const entry of Object.values(entriesByHost)) {
        const strength = getHostnameIndexEntryStrength(entry);
        for (const prefix of getHostnameIndexPrefixes(entry.hostname, maxPrefixLength)) {
            const bucket = buckets[prefix] || new Map();
            const nextItem = {
                hostname: entry.hostname,
                strength,
                matchPriority: getHostnameMatchPriority(prefix, entry.hostname),
            };
            const existing = bucket.get(entry.hostname);
            if (
                !existing
                || existing.matchPriority < nextItem.matchPriority
                || (existing.matchPriority === nextItem.matchPriority && existing.strength < nextItem.strength)
            ) {
                bucket.set(entry.hostname, nextItem);
            }
            buckets[prefix] = bucket;
        }
    }

    const prefixBuckets = {};
    for (const [prefix, bucket] of Object.entries(buckets)) {
        prefixBuckets[prefix] = sortHostnameBucketItems([...bucket.values()], maxBucketSize);
    }

    return {
        version: 1,
        generatedAt: Date.now(),
        maxPrefixLength,
        maxBucketSize,
        entriesByHost,
        prefixBuckets,
    };
};

const upsertHostnameIndexSnapshot = (snapshot, item) => {
    const entry = toHostnameIndexEntry(item);
    if (!entry) return snapshot;

    const maxPrefixLength = snapshot?.maxPrefixLength || HOSTNAME_INDEX_MAX_PREFIX_LENGTH;
    const maxBucketSize = snapshot?.maxBucketSize || HOSTNAME_INDEX_BUCKET_SIZE;
    const entriesByHost = {
        ...(snapshot?.entriesByHost || {}),
    };
    entriesByHost[entry.hostname] = chooseHostnameIndexEntry(entriesByHost[entry.hostname], entry);

    const prefixBuckets = {
        ...(snapshot?.prefixBuckets || {}),
    };

    for (const prefix of getHostnameIndexPrefixes(entry.hostname, maxPrefixLength)) {
        const hostnames = new Set(prefixBuckets[prefix] || []);
        hostnames.add(entry.hostname);
        prefixBuckets[prefix] = sortHostnameBucketItems(
            [...hostnames]
                .map((hostname) => {
                    const bucketEntry = entriesByHost[hostname];
                    if (!bucketEntry) return null;
                    return {
                        hostname,
                        strength: getHostnameIndexEntryStrength(bucketEntry),
                        matchPriority: getHostnameMatchPriority(prefix, hostname),
                    };
                })
                .filter(Boolean),
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

const queryHostnameIndexSnapshot = (snapshot, query, limit = HOSTNAME_INDEX_QUERY_LIMIT) => {
    const normalizedQuery = normalizeQuery(query);
    if (!normalizedQuery || /\s/.test(query)) return [];

    const prefixKey = normalizedQuery.slice(0, snapshot?.maxPrefixLength || HOSTNAME_INDEX_MAX_PREFIX_LENGTH);
    const bucket = snapshot?.prefixBuckets?.[prefixKey] || [];
    const results = [];

    for (const hostname of bucket) {
        const entry = snapshot?.entriesByHost?.[hostname];
        if (!entry) continue;
        const match = getHostnamePrefixMatch(normalizedQuery, hostname);
        if (!match) continue;

        results.push({
            id: `host-${hostname}`,
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

const loadHostnameIndexSnapshot = async () => {
    if (hostnameIndexCache) return hostnameIndexCache;
    if (hostnameIndexLoadPromise) return hostnameIndexLoadPromise;

    hostnameIndexLoadPromise = (async () => {
        try {
            const data = await chrome.storage.local.get(HOSTNAME_INDEX_STORAGE_KEY);
            const snapshot = data?.[HOSTNAME_INDEX_STORAGE_KEY];
            if (snapshot?.version === 1) {
                hostnameIndexCache = snapshot;
                hostnameIndexDirty = false;
                return snapshot;
            }
        } catch { }
        return null;
    })().finally(() => {
        hostnameIndexLoadPromise = null;
    });

    return hostnameIndexLoadPromise;
};

const scheduleHostnameIndexPersist = () => {
    if (hostnameIndexPersistTimer) {
        clearTimeout(hostnameIndexPersistTimer);
    }

    hostnameIndexPersistTimer = setTimeout(async () => {
        hostnameIndexPersistTimer = null;
        if (!hostnameIndexCache || !hostnameIndexDirty) return;

        try {
            await chrome.storage.local.set({
                [HOSTNAME_INDEX_STORAGE_KEY]: hostnameIndexCache,
            });
            hostnameIndexDirty = false;
        } catch { }
    }, HOSTNAME_INDEX_PERSIST_DEBOUNCE_MS);
};

const setHostnameIndexCache = (snapshot) => {
    hostnameIndexCache = snapshot;
    hostnameIndexDirty = true;
    scheduleHostnameIndexPersist();
    return snapshot;
};

const mergeHistoryItemsByUrl = (items) => {
    const byUrl = new Map();
    for (const item of items || []) {
        if (!item?.url) continue;
        const existing = byUrl.get(item.url);
        if (!existing) {
            byUrl.set(item.url, item);
            continue;
        }
        byUrl.set(item.url, {
            ...existing,
            title: existing.title || item.title || item.url,
            visitCount: Math.max(existing.visitCount || 0, item.visitCount || 0),
            typedCount: Math.max(existing.typedCount || 0, item.typedCount || 0),
            lastVisitTime: Math.max(existing.lastVisitTime || 0, item.lastVisitTime || 0),
        });
    }
    return [...byUrl.values()];
};

const collectHistoryBootstrapItems = async (startTime, endTime) => {
    const results = await chrome.history.search({
        text: "",
        startTime,
        endTime,
        maxResults: HISTORY_INDEX_SLICE_MAX_RESULTS,
    });

    if (
        results.length < HISTORY_INDEX_SLICE_MAX_RESULTS
        || (endTime - startTime) <= HISTORY_INDEX_MIN_WINDOW_MS
    ) {
        return results;
    }

    const midpoint = Math.floor((startTime + endTime) / 2);
    if (midpoint <= startTime || midpoint >= endTime) {
        return results;
    }

    const [older, newer] = await Promise.all([
        collectHistoryBootstrapItems(startTime, midpoint),
        collectHistoryBootstrapItems(midpoint + 1, endTime),
    ]);

    return mergeHistoryItemsByUrl([...older, ...newer]);
};

const flattenBookmarkTree = (nodes) => {
    const result = [];
    const visit = (node) => {
        if (node?.url) {
            result.push(node);
        }
        for (const child of node?.children || []) {
            visit(child);
        }
    };
    for (const node of nodes || []) {
        visit(node);
    }
    return result;
};

const rebuildHostnameIndexSnapshot = async () => {
    if (hostnameIndexBuildPromise) return hostnameIndexBuildPromise;

    hostnameIndexBuildPromise = (async () => {
        const [historyItems, bookmarkTree] = await Promise.all([
            collectHistoryBootstrapItems(0, Date.now()).catch(() => []),
            chrome.bookmarks.getTree().catch(() => []),
        ]);

        const bookmarkItems = flattenBookmarkTree(bookmarkTree)
            .map((item) => ({
                title: item.title || item.url || "",
                url: item.url || "",
                type: "bookmark",
                lastVisitTime: item.dateAdded || 0,
            }))
            .filter((item) => Boolean(item.url));

        const snapshot = createHostnameIndexSnapshot([
            ...historyItems.map((item) => ({
                title: item.title || item.url || "",
                url: item.url || "",
                type: "history",
                visitCount: item.visitCount,
                typedCount: item.typedCount,
                lastVisitTime: item.lastVisitTime,
            })),
            ...bookmarkItems,
        ]);

        hostnameIndexCache = snapshot;
        hostnameIndexDirty = false;
        await chrome.storage.local.set({
            [HOSTNAME_INDEX_STORAGE_KEY]: snapshot,
        }).catch(() => { });
        return snapshot;
    })().finally(() => {
        hostnameIndexBuildPromise = null;
    });

    return hostnameIndexBuildPromise;
};

const scheduleHostnameIndexRebuild = (delay = HOSTNAME_INDEX_REBUILD_DEBOUNCE_MS) => {
    if (hostnameIndexRebuildTimer) {
        clearTimeout(hostnameIndexRebuildTimer);
    }

    hostnameIndexRebuildTimer = setTimeout(() => {
        hostnameIndexRebuildTimer = null;
        rebuildHostnameIndexSnapshot().catch(() => { });
    }, delay);
};

const ensureHostnameIndexSnapshot = async () => {
    const snapshot = await loadHostnameIndexSnapshot();
    if (snapshot) return snapshot;

    rebuildHostnameIndexSnapshot().catch(() => { });
    return null;
};

const getHostnameIndexCandidates = async (query, limit = HOSTNAME_INDEX_QUERY_LIMIT) => {
    const snapshot = await ensureHostnameIndexSnapshot();
    if (!snapshot) return [];
    return queryHostnameIndexSnapshot(snapshot, query, limit);
};

const getStorageValue = async (key, fallbackValue) => {
    try {
        const syncData = await chrome.storage.sync.get(key);
        if (Object.prototype.hasOwnProperty.call(syncData, key)) {
            return syncData[key];
        }
    } catch { }

    try {
        const localData = await chrome.storage.local.get(key);
        if (Object.prototype.hasOwnProperty.call(localData, key)) {
            return localData[key];
        }
    } catch { }

    return fallbackValue;
};

const getCurrentSearchEngineConfig = async () => {
    if (cachedOmniboxEngine && (Date.now() - cachedOmniboxEngineAt) < OMNIBOX_ENGINE_CACHE_TTL_MS) {
        return cachedOmniboxEngine;
    }

    const [savedEngines, currentSearchEngine] = await Promise.all([
        getStorageValue("searchEngines", FALLBACK_OMNIBOX_ENGINES),
        getStorageValue("currentSearchEngine", "google"),
    ]);

    const engines = Array.isArray(savedEngines) ? savedEngines : FALLBACK_OMNIBOX_ENGINES;
    const selected = engines.find((engine) => engine.id === currentSearchEngine)
        || engines.find((engine) => engine.isDefault)
        || engines.find((engine) => engine.enabled !== false)
        || FALLBACK_OMNIBOX_ENGINES[0];

    const engine = {
        id: selected?.id || "google",
        name: selected?.name || "Google",
        url: selected?.url || "https://www.google.com/search?q=",
    };

    cachedOmniboxEngine = engine;
    cachedOmniboxEngineAt = Date.now();
    return engine;
};

const ensureUrlHasProtocol = (rawUrl) => {
    const url = String(rawUrl || "").trim();
    if (!url) return "";
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) return url;
    return `https://${url}`;
};

const isLikelyUrl = (text) => {
    if (!text || text.includes(" ")) return false;

    try {
        const urlToTest = text.startsWith("http") ? text : `http://${text}`;
        new URL(urlToTest);

        if (text.includes(".")) return true;
        if (/^localhost(:\d+)?(\/.*)?$/i.test(text)) return true;
        if (/^https?:\/\/localhost(:\d+)?(\/.*)?$/i.test(text)) return true;
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/.test(text)) return true;
        return false;
    } catch {
        return false;
    }
};

const buildSearchEngineUrl = (engine, query) => {
    const trimmed = String(query || "").trim();
    if (!trimmed) return null;

    if (engine?.id === "kagi-assistant") {
        const params = new URLSearchParams({
            q: trimmed,
            internet: "true",
        });
        return `https://kagi.com/assistant?${params.toString()}`;
    }

    const template = ensureUrlHasProtocol(engine?.url || "https://www.google.com/search?q=");
    if (!template) return null;

    const encodedQuery = encodeURIComponent(trimmed);
    const merged = template.includes("%s")
        ? template.replace(/%s/g, encodedQuery)
        : `${template}${encodedQuery}`;

    try {
        return new URL(merged).toString();
    } catch {
        return null;
    }
};

const openByDisposition = (url, disposition) => {
    if (!url) return;

    if (disposition === "currentTab") {
        chrome.tabs.update({ url });
        return;
    }

    if (disposition === "newBackgroundTab") {
        chrome.tabs.create({ url, active: false });
        return;
    }

    chrome.tabs.create({ url, active: true });
};

const matchCandidate = (normalized, candidate) => {
    const title = (candidate.title || "").toLowerCase();
    const rawUrl = (candidate.url || "").toLowerCase();
    const normalizedUrl = normalizeUrlForMatch(candidate.url || "");
    return Boolean(getHostnamePrefixMatch(normalized, candidate.url || ""))
        || title.includes(normalized)
        || rawUrl.includes(normalized)
        || normalizedUrl.includes(normalized);
};

const scoreCandidate = (normalized, candidate) => {
    const title = (candidate.title || "").toLowerCase();
    const rawUrl = (candidate.url || "").toLowerCase();
    const normalizedUrl = normalizeUrlForMatch(candidate.url || "");
    const hostnameMatch = getHostnamePrefixMatch(normalized, candidate.url || "");

    let score = 0;

    if (hostnameMatch?.matchType === "host-prefix") score += 140;
    else if (hostnameMatch?.matchType === "label-prefix") score += 115;
    else if (rawUrl.startsWith(normalized)) score += 110;
    else if (normalizedUrl.includes(normalized)) score += 45;

    if (title.startsWith(normalized)) score += 80;
    else if (title.includes(normalized)) score += 30;

    if (candidate.type === "bookmark") score += 35;

    score += Math.min((candidate.typedCount || 0) * 10, 80);
    score += Math.min(Math.log2((candidate.visitCount || 0) + 1) * 12, 60);
    score += getRecencyBoost(candidate.lastVisitTime);

    return score;
};

const rankOmniboxCandidates = (query, candidates) => {
    const normalized = normalizeQuery(query);
    const bestByUrl = new Map();

    for (const candidate of candidates) {
        if (!candidate?.url || !matchCandidate(normalized, candidate)) continue;

        const score = scoreCandidate(normalized, candidate);
        const next = {
            ...candidate,
            score,
            matchPriority: getHostnameMatchPriority(normalized, candidate.url),
        };
        const dedupeKey = candidate.url.toLowerCase();
        const existing = bestByUrl.get(dedupeKey);

        if (
            !existing
            || (existing.matchPriority || 0) < next.matchPriority
            || (
                (existing.matchPriority || 0) === next.matchPriority
                && (existing.score || 0) < score
            )
        ) {
            bestByUrl.set(dedupeKey, next);
        }
    }

    return [...bestByUrl.values()]
        .sort((a, b) =>
            (b.matchPriority || 0) - (a.matchPriority || 0)
            || (b.score || 0) - (a.score || 0)
            || (b.typedCount || 0) - (a.typedCount || 0)
            || (b.visitCount || 0) - (a.visitCount || 0)
            || (b.lastVisitTime || 0) - (a.lastVisitTime || 0)
        )
        .slice(0, OMNIBOX_MAX_RESULTS);
};

const getDisplayUrl = (url) => {
    try {
        const parsed = new URL(url);
        const path = parsed.pathname === "/" ? "" : parsed.pathname;
        return `${parsed.hostname}${path}`;
    } catch {
        return url;
    }
};

const getOmniboxHistoryCandidates = async (query) => {
    try {
        const results = await chrome.history.search({
            text: query,
            startTime: 0,
            maxResults: OMNIBOX_MAX_HISTORY,
        });

        return results
            .filter((item) => Boolean(item.url))
            .map((item) => ({
                title: item.title || item.url || "",
                url: item.url || "",
                type: "history",
                visitCount: item.visitCount,
                typedCount: item.typedCount,
                lastVisitTime: item.lastVisitTime,
            }));
    } catch {
        return [];
    }
};

const getOmniboxBookmarkCandidates = async (query) => {
    try {
        const results = await chrome.bookmarks.search(query);
        return results
            .filter((item) => Boolean(item.url))
            .slice(0, OMNIBOX_MAX_BOOKMARKS)
            .map((item) => ({
                title: item.title || item.url || "",
                url: item.url || "",
                type: "bookmark",
            }));
    } catch {
        return [];
    }
};

const buildOmniboxSuggestions = async (query, engine) => {
    const escapedQuery = escapeOmnibox(query);
    const escapedEngineName = escapeOmnibox(engine.name || "Google");

    const [indexedCandidates, historyCandidates, bookmarkCandidates] = await Promise.all([
        getHostnameIndexCandidates(query, OMNIBOX_MAX_RESULTS),
        getOmniboxHistoryCandidates(query),
        getOmniboxBookmarkCandidates(query),
    ]);

    const ranked = rankOmniboxCandidates(query, [...indexedCandidates, ...historyCandidates, ...bookmarkCandidates]);
    const suggestions = [
        {
            content: `search:${query}`,
            description: `Search <match>${escapedQuery}</match> with <dim>${escapedEngineName}</dim>`,
        },
    ];

    for (const item of ranked) {
        const escapedTitle = escapeOmnibox(item.title || item.url || "");
        const escapedUrl = escapeOmnibox(getDisplayUrl(item.url || ""));
        const escapedType = item.type === "bookmark" ? "Bookmark" : "History";
        suggestions.push({
            content: `url:${item.url}`,
            description: `<dim>[${escapedType}]</dim> ${escapedTitle} <url>${escapedUrl}</url>`,
        });
    }

    return suggestions;
};

const handleOmniboxInputEntered = async (text, disposition) => {
    const input = String(text || "").trim();
    if (!input) return;

    if (input.startsWith("url:")) {
        openByDisposition(input.slice(4), disposition);
        return;
    }

    if (input.startsWith("search:")) {
        const query = input.slice(7).trim();
        if (!query) return;
        const engine = await getCurrentSearchEngineConfig();
        const searchUrl = buildSearchEngineUrl(engine, query);
        openByDisposition(searchUrl, disposition);
        return;
    }

    if (isLikelyUrl(input)) {
        openByDisposition(ensureUrlHasProtocol(input), disposition);
        return;
    }

    const engine = await getCurrentSearchEngineConfig();
    const searchUrl = buildSearchEngineUrl(engine, input);
    openByDisposition(searchUrl, disposition);
};

if (chrome.omnibox) {
    chrome.omnibox.setDefaultSuggestion({
        description: "Type to search with NewTab or open URL",
    });

    chrome.omnibox.onInputChanged.addListener((text, suggest) => {
        const requestId = ++omniboxRequestId;

        (async () => {
            const query = String(text || "").trim();
            const engine = await getCurrentSearchEngineConfig();
            const escapedEngineName = escapeOmnibox(engine.name || "Google");
            const escapedQuery = escapeOmnibox(query);

            if (query) {
                chrome.omnibox.setDefaultSuggestion({
                    description: `Press Enter to search <match>${escapedQuery}</match> with <dim>${escapedEngineName}</dim>`,
                });
            } else {
                chrome.omnibox.setDefaultSuggestion({
                    description: `Type to search with <dim>${escapedEngineName}</dim> or open URL`,
                });
                suggest([]);
                return;
            }

            const suggestions = await buildOmniboxSuggestions(query, engine);
            if (requestId !== omniboxRequestId) return;
            suggest(suggestions);
        })().catch(() => {
            if (requestId === omniboxRequestId) {
                suggest([]);
            }
        });
    });

    chrome.omnibox.onInputEntered.addListener((text, disposition) => {
        handleOmniboxInputEntered(text, disposition).catch(() => { });
    });

    chrome.omnibox.onInputCancelled.addListener(() => {
        omniboxRequestId += 1;
    });
}

if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "sync" && areaName !== "local") return;
        if (changes.searchEngines || changes.currentSearchEngine) {
            cachedOmniboxEngine = null;
            cachedOmniboxEngineAt = 0;
        }
    });
}

if (chrome.runtime?.onInstalled) {
    chrome.runtime.onInstalled.addListener(() => {
        loadHostnameIndexSnapshot().then((snapshot) => {
            if (!snapshot) {
                scheduleHostnameIndexRebuild(100);
            }
        }).catch(() => { });
    });
}

if (chrome.runtime?.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
        loadHostnameIndexSnapshot().then((snapshot) => {
            if (!snapshot) {
                scheduleHostnameIndexRebuild(100);
            }
        }).catch(() => { });
    });
}

if (chrome.history?.onVisited) {
    chrome.history.onVisited.addListener((item) => {
        (async () => {
            const snapshot = await ensureHostnameIndexSnapshot();
            if (!snapshot) return;

            setHostnameIndexCache(upsertHostnameIndexSnapshot(snapshot, {
                title: item.title || item.url || "",
                url: item.url || "",
                type: "history",
                visitCount: item.visitCount,
                typedCount: item.typedCount,
                lastVisitTime: item.lastVisitTime,
            }));
        })().catch(() => { });
    });
}

if (chrome.history?.onVisitRemoved) {
    chrome.history.onVisitRemoved.addListener(() => {
        scheduleHostnameIndexRebuild();
    });
}

if (chrome.bookmarks?.onCreated) {
    chrome.bookmarks.onCreated.addListener((id, bookmark) => {
        if (!bookmark?.url) return;

        loadHostnameIndexSnapshot().then((snapshot) => {
            if (!snapshot) {
                scheduleHostnameIndexRebuild(100);
                return;
            }

            setHostnameIndexCache(upsertHostnameIndexSnapshot(snapshot, {
                title: bookmark.title || bookmark.url || "",
                url: bookmark.url || "",
                type: "bookmark",
                lastVisitTime: bookmark.dateAdded || Date.now(),
            }));
        }).catch(() => { });
    });
}

if (chrome.bookmarks?.onChanged) {
    chrome.bookmarks.onChanged.addListener(() => {
        scheduleHostnameIndexRebuild();
    });
}

if (chrome.bookmarks?.onRemoved) {
    chrome.bookmarks.onRemoved.addListener(() => {
        scheduleHostnameIndexRebuild();
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "GET_HOSTNAME_AUTOCOMPLETE") {
        (async () => {
            try {
                const query = String(message.query || "");
                const limit = Number.isFinite(message.limit) ? message.limit : HOSTNAME_INDEX_QUERY_LIMIT;
                const candidates = await getHostnameIndexCandidates(query, limit);
                sendResponse({ success: true, candidates });
            } catch {
                sendResponse({ success: false, candidates: [] });
            }
        })();
        return true;
    }

    // 获取当前活动标签页信息
    if (message && message.type === "GET_CURRENT_TAB") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
                sendResponse({ success: true, url: tabs[0].url, title: tabs[0].title });
            } else {
                sendResponse({ success: false });
            }
        });
        return true;
    }

    // 处理打开扩展程序页面的请求
    if (message && message.type === "OPEN_EXTENSIONS_PAGE") {
        chrome.tabs.create({ url: "chrome://extensions" });
        sendResponse({ success: true });
        return false;
    }

    // 处理打开浏览器设置页面的请求
    if (message && message.type === "OPEN_BROWSER_SETTINGS") {
        chrome.tabs.create({ url: "chrome://settings" });
        sendResponse({ success: true });
        return false;
    }

    // 处理快速链接更新通知，广播到所有标签页
    if (message && message.type === "QUICK_LINKS_UPDATED") {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.id && tab.id !== sender.tab?.id) {
                    chrome.tabs.sendMessage(tab.id, { type: 'QUICK_LINKS_UPDATED' }).catch(() => {
                        // 忽略无法接收消息的标签页
                    });
                }
            });
        });
        sendResponse({ success: true });
        return false;
    }

    if (message && message.type === "FETCH_PAGE_TITLE" && message.url) {
        (async () => {
            try {
                const res = await fetch(message.url, { method: "GET", redirect: "follow" });
                if (res.ok) {
                    const html = await res.text();
                    const title = parseTitle(html);
                    sendResponse({ success: true, title: title || null });
                } else {
                    sendResponse({ success: false });
                }
            } catch {
                sendResponse({ success: false });
            }
        })();
        return true;
    }

    if (message && message.type === "RESOLVE_FAVICON" && message.url) {
        (async () => {
            try {
                const key = "faviconsCache";
                const data = await chrome.storage.local.get(key);
                const cache = data[key] || {};
                const cacheKey = message.url;
                const cached = cache[cacheKey];

                // 检查缓存
                if (cached) {
                    // 如果是失败缓存，检查是否过期（1小时）
                    if (cached.failed) {
                        const expireTime = 60 * 60 * 1000; // 1 hour
                        if (Date.now() - cached.timestamp < expireTime) {
                            sendResponse({ success: false });
                            return;
                        }
                        // 过期了，删除失败缓存，继续重试
                        delete cache[cacheKey];
                    } else {
                        const src = typeof cached === "string" ? cached : (cached.data || cached.src);
                        sendResponse({ success: true, src });
                        return;
                    }
                }

                const src = await resolveFavicon(message.url);
                if (src) {
                    const dataUrl = await fetchToDataURL(src);

                    // 验证是否真的是图片（防止 Cloudflare 验证页等 HTML 被缓存）
                    if (dataUrl && !dataUrl.startsWith('data:image/')) {
                        // 不是图片，缓存为失败状态
                        cache[cacheKey] = { failed: true, timestamp: Date.now() };
                        await chrome.storage.local.set({ [key]: cache });
                        sendResponse({ success: false });
                        return;
                    }

                    cache[cacheKey] = dataUrl ? { src, data: dataUrl } : { src };
                    await chrome.storage.local.set({ [key]: cache });
                    sendResponse({ success: true, src: dataUrl || src });
                } else {
                    // favicon 获取失败，缓存失败状态并设置过期时间
                    cache[cacheKey] = { failed: true, timestamp: Date.now() };
                    await chrome.storage.local.set({ [key]: cache });
                    sendResponse({ success: false });
                }
            } catch {
                sendResponse({ success: false });
            }
        })();
        return true;
    }
});
