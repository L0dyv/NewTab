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

const getRecencyBoost = (lastVisitTime) => {
    if (!lastVisitTime) return 0;

    const ageInDays = (Date.now() - lastVisitTime) / (1000 * 60 * 60 * 24);
    if (ageInDays <= 1) return 45;
    if (ageInDays <= 7) return 35;
    if (ageInDays <= 30) return 22;
    if (ageInDays <= 90) return 10;
    return 0;
};

const matchCandidate = (normalized, candidate) => {
    const title = (candidate.title || "").toLowerCase();
    const rawUrl = (candidate.url || "").toLowerCase();
    const normalizedUrl = normalizeUrlForMatch(candidate.url || "");
    return title.includes(normalized) || rawUrl.includes(normalized) || normalizedUrl.includes(normalized);
};

const scoreCandidate = (normalized, candidate) => {
    const title = (candidate.title || "").toLowerCase();
    const rawUrl = (candidate.url || "").toLowerCase();
    const normalizedUrl = normalizeUrlForMatch(candidate.url || "");

    let score = 0;

    if (normalizedUrl.startsWith(normalized)) score += 120;
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
        const next = { ...candidate, score };
        const dedupeKey = candidate.url.toLowerCase();
        const existing = bestByUrl.get(dedupeKey);

        if (!existing || (existing.score || 0) < score) {
            bestByUrl.set(dedupeKey, next);
        }
    }

    return [...bestByUrl.values()]
        .sort((a, b) =>
            (b.score || 0) - (a.score || 0)
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

    const [historyCandidates, bookmarkCandidates] = await Promise.all([
        getOmniboxHistoryCandidates(query),
        getOmniboxBookmarkCandidates(query),
    ]);

    const ranked = rankOmniboxCandidates(query, [...historyCandidates, ...bookmarkCandidates]);
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
