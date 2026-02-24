/**
 * Content script: Google search results -> custom engine quick search.
 *
 * Test hook:
 * - In Node tests, set `globalThis.__QTN_TEST__ = true` before importing this file.
 * - Helpers are exposed as `globalThis.__QTN_googleToKagi`.
 */

const STORAGE_KEY_ENGINES = "searchEngines";
const STORAGE_KEY_CURRENT_ENGINE = "currentSearchEngine";
const GOOGLE_QUERY_FIELD_SELECTOR = 'input[name="q"], textarea[name="q"]';

const KAGI_SEARCH_BASE = "https://kagi.com/search?q=";
const KAGI_ASSISTANT_BASE = "https://kagi.com/assistant";

const TOOLBAR_ID = "qtn-engine-toolbar";
const ENGINE_SELECT_ID = "qtn-engine-select";
const ENGINE_BUTTON_ID = "qtn-engine-button";
const ENGINE_STYLE_ID = "qtn-engine-style";
const DISABLED_CLASS = "qtn-engine--disabled";
const DARK_THEME_CLASS = "qtn-engine--dark";
const TOOLBAR_MARGIN = 10;

const FALLBACK_ENGINES = [
  { id: "google", name: "Google", url: "https://www.google.com/search?q=", isDefault: true, enabled: true },
  { id: "bing", name: "Bing", url: "https://www.bing.com/search?q=", enabled: true },
  { id: "duckduckgo", name: "DuckDuckGo", url: "https://duckduckgo.com/?q=", enabled: true },
  { id: "kagi", name: "Kagi", url: "https://kagi.com/search?q=", enabled: true },
  { id: "kagi-assistant", name: "Kagi Assistant", url: "https://kagi.com/assistant", isAI: true, enabled: true },
];

const engineState = {
  engines: FALLBACK_ENGINES.map((engine) => ({ ...engine })),
  currentEngineId: "google",
};

let scheduleEnsure = () => {
  ensureEngineToolbar();
};

function isGoogleLikeHostname(hostname) {
  if (typeof hostname !== "string" || hostname.length === 0) return false;
  const parts = hostname.toLowerCase().split(".").filter(Boolean);
  return parts.includes("google");
}

function isGoogleSearchLikeUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (!isGoogleLikeHostname(url.hostname)) return false;
    return url.searchParams.has("q");
  } catch {
    return false;
  }
}

function getQueryFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    const query = url.searchParams.get("q");
    const trimmed = (query ?? "").trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function buildKagiSearchUrl(query) {
  return `${KAGI_SEARCH_BASE}${encodeURIComponent(query)}`;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasChromeStorageSync() {
  try {
    return typeof chrome !== "undefined" && !!chrome.storage?.sync;
  } catch {
    return false;
  }
}

function storageGet(keys) {
  return new Promise((resolve) => {
    if (!hasChromeStorageSync()) {
      resolve({});
      return;
    }

    try {
      chrome.storage.sync.get(keys, (items) => {
        resolve(items ?? {});
      });
    } catch {
      resolve({});
    }
  });
}

function storageSet(values) {
  return new Promise((resolve) => {
    if (!hasChromeStorageSync()) {
      resolve();
      return;
    }

    try {
      chrome.storage.sync.set(values, () => {
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

function ensureProtocol(urlString) {
  if (!isNonEmptyString(urlString)) return "";
  const trimmed = urlString.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeEngines(rawEngines) {
  const source = Array.isArray(rawEngines) && rawEngines.length > 0 ? rawEngines : FALLBACK_ENGINES;
  const normalized = [];

  for (const raw of source) {
    if (!raw || typeof raw !== "object") continue;

    const id = isNonEmptyString(raw.id) ? raw.id.trim() : "";
    const name = isNonEmptyString(raw.name) ? raw.name.trim() : "";
    const url = isNonEmptyString(raw.url) ? raw.url.trim() : "";
    if (!id || !name || !url) continue;

    normalized.push({
      id,
      name,
      url,
      enabled: raw.enabled !== false,
      isDefault: raw.isDefault === true,
      isAI: raw.isAI === true || id === "kagi-assistant",
    });
  }

  if (normalized.length === 0) {
    return FALLBACK_ENGINES.map((engine) => ({ ...engine }));
  }

  if (!normalized.some((engine) => engine.isDefault)) {
    const google = normalized.find((engine) => engine.id === "google");
    if (google) google.isDefault = true;
    else normalized[0].isDefault = true;
  }

  return normalized;
}

function getEnabledEngines(engines) {
  return (Array.isArray(engines) ? engines : []).filter((engine) => engine.enabled !== false);
}

function pickCurrentEngineId(engines, requestedId) {
  const enabled = getEnabledEngines(engines);
  if (enabled.length === 0) return "google";

  const requested = isNonEmptyString(requestedId) ? requestedId.trim() : "";
  if (requested && enabled.some((engine) => engine.id === requested)) return requested;

  const defaultEngine = enabled.find((engine) => engine.isDefault) ?? enabled[0];
  return defaultEngine?.id ?? "google";
}

function buildEngineSearchUrl(engine, query) {
  if (!engine || typeof engine !== "object") return null;

  const trimmed = (query ?? "").trim();
  if (trimmed.length === 0) return null;

  const encodedQuery = encodeURIComponent(trimmed);
  if (engine.isAI === true || engine.id === "kagi-assistant") {
    const params = new URLSearchParams({
      q: trimmed,
      internet: "true",
    });
    return `${KAGI_ASSISTANT_BASE}?${params.toString()}`;
  }

  const template = ensureProtocol(engine.url);
  if (!template) return null;

  const merged = template.includes("%s")
    ? template.replace(/%s/g, encodedQuery)
    : `${template}${encodedQuery}`;

  try {
    return new URL(merged).toString();
  } catch {
    return null;
  }
}

function isElementVisible(element) {
  if (!element || !(element instanceof Element)) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function findVisibleSearchInput() {
  const inputs = Array.from(document.querySelectorAll(GOOGLE_QUERY_FIELD_SELECTOR));
  if (inputs.length === 0) return null;
  return inputs.find((input) => isElementVisible(input)) ?? inputs[0];
}

function findToolbarAnchorElement() {
  const input = findVisibleSearchInput();
  if (!input) return null;

  const inputRect = input.getBoundingClientRect();
  const candidates = [
    input.closest('[role="combobox"]'),
    input.closest('[role="search"]'),
    input.closest("form"),
    input.parentElement,
    input,
  ].filter(Boolean);

  let best = input;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const element of candidates) {
    if (!isElementVisible(element)) continue;
    const rect = element.getBoundingClientRect();
    const rightDelta = rect.right - inputRect.right;
    const heightOk = rect.height >= inputRect.height * 0.8 && rect.height <= inputRect.height * 3.5;
    if (heightOk && rightDelta >= 40 && rightDelta < bestDelta) {
      best = element;
      bestDelta = rightDelta;
    }
  }

  return best;
}

function parseColorChannels(colorText) {
  if (!isNonEmptyString(colorText)) return null;
  const match = colorText.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;

  const parts = match[1]
    .split(/[,\s/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;

  const rgb = parts.slice(0, 3).map((part) => Number(part));
  if (rgb.some((value) => Number.isNaN(value))) return null;
  const alpha = parts[3] === undefined ? 1 : Number(parts[3]);
  if (Number.isNaN(alpha)) return null;

  return {
    r: Math.max(0, Math.min(255, rgb[0])),
    g: Math.max(0, Math.min(255, rgb[1])),
    b: Math.max(0, Math.min(255, rgb[2])),
    a: Math.max(0, Math.min(1, alpha)),
  };
}

function inferDarkFromColor(colorText) {
  const channels = parseColorChannels(colorText);
  if (!channels || channels.a < 0.06) return null;

  const luminance = (0.2126 * channels.r + 0.7152 * channels.g + 0.0722 * channels.b) / 255;
  return luminance < 0.5;
}

function readThemeSignalFromElement(element) {
  if (!element || !(element instanceof Element)) return null;
  const style = window.getComputedStyle(element);

  const byBackground = inferDarkFromColor(style.backgroundColor);
  if (byBackground !== null) return byBackground;

  const byTextColor = inferDarkFromColor(style.color);
  if (byTextColor !== null) return !byTextColor;

  return null;
}

function readExplicitThemeSignal() {
  const candidates = [
    document.documentElement?.getAttribute("data-theme"),
    document.body?.getAttribute("data-theme"),
    document.documentElement?.getAttribute("data-darkmode"),
    document.body?.getAttribute("data-darkmode"),
    document.documentElement?.getAttribute("color-scheme"),
    document.body?.getAttribute("color-scheme"),
  ];

  for (const raw of candidates) {
    if (!isNonEmptyString(raw)) continue;
    const value = raw.trim().toLowerCase();
    if (value === "1" || value === "true" || value.includes("dark")) return true;
    if (value === "0" || value === "false" || value.includes("light")) return false;
  }

  if (document.documentElement.classList.contains("dark") || document.body?.classList.contains("dark")) return true;
  if (document.documentElement.classList.contains("light") || document.body?.classList.contains("light")) return false;

  return null;
}

function inferGoogleSearchDarkTheme(anchorElement) {
  const explicit = readExplicitThemeSignal();
  if (explicit !== null) return explicit;

  const input = findVisibleSearchInput();
  const candidates = [
    anchorElement,
    input?.closest('[role="combobox"]'),
    input,
    input?.closest("form"),
    document.body,
    document.documentElement,
  ].filter(Boolean);

  for (const element of candidates) {
    const signal = readThemeSignalFromElement(element);
    if (signal !== null) return signal;
  }

  try {
    return !!window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  } catch {
    return false;
  }
}

function syncToolbarTheme(toolbar, anchorElement) {
  if (!toolbar) return;
  const isDark = inferGoogleSearchDarkTheme(anchorElement);
  toolbar.classList.toggle(DARK_THEME_CLASS, isDark);
}

function getCurrentQuery() {
  // URL is the source of truth for Google SPA navigations.
  const fromUrl = getQueryFromUrl(location.href);
  if (fromUrl) return fromUrl;

  const input = findVisibleSearchInput();
  const value = typeof input?.value === "string" ? input.value.trim() : "";
  return value.length > 0 ? value : null;
}

function ensureStyle() {
  if (document.getElementById(ENGINE_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = ENGINE_STYLE_ID;
  style.textContent = `
#${TOOLBAR_ID}{
  position:fixed;
  z-index:2147483647;
  display:inline-flex;
  align-items:center;
  gap:8px;
  pointer-events:none;
}
#${ENGINE_SELECT_ID}{
  height:36px;
  max-width:180px;
  padding:0 12px;
  border:1px solid rgba(60,64,67,.3);
  border-radius:18px;
  background:#fff;
  color:#202124;
  font:500 14px/1 Arial,sans-serif;
  box-shadow:0 1px 3px rgba(60,64,67,.2);
  pointer-events:auto;
}
#${ENGINE_BUTTON_ID}{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:80px;
  height:36px;
  padding:0 14px;
  border:1px solid rgba(60,64,67,.3);
  border-radius:18px;
  background:#fff;
  color:#1a73e8;
  font:500 14px/1 Arial,sans-serif;
  text-decoration:none;
  cursor:pointer;
  user-select:none;
  box-shadow:0 1px 3px rgba(60,64,67,.2);
  pointer-events:auto;
}
#${ENGINE_BUTTON_ID}:hover{background:rgba(60,64,67,.08);}
#${ENGINE_BUTTON_ID}:active{background:rgba(60,64,67,.12);}
#${ENGINE_BUTTON_ID}.${DISABLED_CLASS}{
  opacity:.5;
  cursor:not-allowed;
  pointer-events:none;
}
#${TOOLBAR_ID}.${DARK_THEME_CLASS} #${ENGINE_SELECT_ID}{
  background:#202124;
  color:#e8eaed;
  border-color:rgba(232,234,237,.25);
  box-shadow:0 1px 3px rgba(0,0,0,.45);
}
#${TOOLBAR_ID}.${DARK_THEME_CLASS} #${ENGINE_BUTTON_ID}{
  background:#202124;
  color:#8ab4f8;
  border-color:rgba(232,234,237,.25);
  box-shadow:0 1px 3px rgba(0,0,0,.45);
}
  `.trim();

  document.documentElement.appendChild(style);
}

function createToolbar() {
  const toolbar = document.createElement("div");
  toolbar.id = TOOLBAR_ID;

  const select = document.createElement("select");
  select.id = ENGINE_SELECT_ID;
  select.setAttribute("aria-label", "Search engine");
  select.addEventListener("change", async (event) => {
    const next = String(event.target?.value ?? "");
    if (!next) return;

    const picked = pickCurrentEngineId(engineState.engines, next);
    if (picked === engineState.currentEngineId) return;

    engineState.currentEngineId = picked;
    await storageSet({ [STORAGE_KEY_CURRENT_ENGINE]: picked });
    scheduleEnsure();
  });

  const button = document.createElement("a");
  button.id = ENGINE_BUTTON_ID;
  button.textContent = "Search";
  button.setAttribute("target", "_blank");
  button.setAttribute("rel", "noopener noreferrer");
  button.addEventListener("click", (event) => {
    if (button.classList.contains(DISABLED_CLASS)) {
      event.preventDefault();
    }
  });

  toolbar.appendChild(select);
  toolbar.appendChild(button);
  return toolbar;
}

function getOrCreateToolbar() {
  return document.getElementById(TOOLBAR_ID) ?? createToolbar();
}

function placeToolbar(toolbar, anchorElement) {
  if (!toolbar || !anchorElement || !(anchorElement instanceof Element)) return;

  if (!toolbar.isConnected) {
    document.body.appendChild(toolbar);
  }

  const anchorRect = anchorElement.getBoundingClientRect();
  const toolbarRect = toolbar.getBoundingClientRect();
  const toolbarWidth = toolbarRect.width > 0 ? toolbarRect.width : 280;
  const toolbarHeight = toolbarRect.height > 0 ? toolbarRect.height : 40;

  let left = anchorRect.right + TOOLBAR_MARGIN;
  const maxLeft = window.innerWidth - toolbarWidth - TOOLBAR_MARGIN;
  if (left > maxLeft) {
    left = Math.max(TOOLBAR_MARGIN, maxLeft);
  }

  let top = anchorRect.top + (anchorRect.height - toolbarHeight) / 2;
  const maxTop = Math.max(TOOLBAR_MARGIN, window.innerHeight - toolbarHeight - TOOLBAR_MARGIN);
  if (top < TOOLBAR_MARGIN) top = TOOLBAR_MARGIN;
  if (top > maxTop) top = maxTop;

  toolbar.style.left = `${Math.round(left)}px`;
  toolbar.style.top = `${Math.round(top)}px`;
}

function isToolbarInteracting(toolbar) {
  const select = toolbar.querySelector(`#${ENGINE_SELECT_ID}`);
  return select instanceof HTMLSelectElement && document.activeElement === select;
}

function renderEngineSelect(toolbar) {
  const select = toolbar.querySelector(`#${ENGINE_SELECT_ID}`);
  if (!(select instanceof HTMLSelectElement)) return null;

  const enabled = getEnabledEngines(engineState.engines);
  const engines = enabled.length > 0 ? enabled : getEnabledEngines(FALLBACK_ENGINES);
  if (engines.length === 0) return null;

  const selectedId = pickCurrentEngineId(engines, engineState.currentEngineId);
  const signature = engines.map((engine) => `${engine.id}:${engine.name}`).join("|");
  const isFocused = document.activeElement === select;

  if (!isFocused && select.dataset.signature !== signature) {
    select.textContent = "";
    for (const engine of engines) {
      const option = document.createElement("option");
      option.value = engine.id;
      option.textContent = engine.name;
      select.appendChild(option);
    }
    select.dataset.signature = signature;
  }

  if (!isFocused && select.value !== selectedId) {
    select.value = selectedId;
  }

  const effectiveId = isFocused && isNonEmptyString(select.value) ? select.value : selectedId;
  const selectedEngine = engines.find((engine) => engine.id === effectiveId) ?? engines[0];
  if (!isFocused) {
    engineState.currentEngineId = selectedEngine.id;
  }
  return selectedEngine;
}

function updateToolbarButton(toolbar, selectedEngine) {
  const button = toolbar.querySelector(`#${ENGINE_BUTTON_ID}`);
  if (!button) return;

  const query = getCurrentQuery();
  const targetUrl = selectedEngine ? buildEngineSearchUrl(selectedEngine, query ?? "") : null;
  button.textContent = selectedEngine ? `To ${selectedEngine.name}` : "Search";

  if (targetUrl) {
    button.classList.remove(DISABLED_CLASS);
    button.removeAttribute("aria-disabled");
    button.setAttribute("href", targetUrl);
    button.setAttribute("title", `Search "${query}" with ${selectedEngine.name}`);
  } else {
    button.classList.add(DISABLED_CLASS);
    button.setAttribute("aria-disabled", "true");
    button.removeAttribute("href");
    button.setAttribute("title", "No search query found");
  }
}

function ensureEngineToolbar() {
  if (!isGoogleSearchLikeUrl(location.href)) {
    document.getElementById(TOOLBAR_ID)?.remove?.();
    return;
  }

  const anchorElement = findToolbarAnchorElement();
  if (!anchorElement) {
    document.getElementById(TOOLBAR_ID)?.remove?.();
    return;
  }

  ensureStyle();

  const toolbar = getOrCreateToolbar();
  if (!toolbar.isConnected) {
    document.body.appendChild(toolbar);
  }
  syncToolbarTheme(toolbar, anchorElement);

  const selectedEngine = renderEngineSelect(toolbar);
  updateToolbarButton(toolbar, selectedEngine);

  if (!isToolbarInteracting(toolbar)) {
    placeToolbar(toolbar, anchorElement);
  }
}

async function loadEngineStateFromStorage() {
  const snapshot = await storageGet([STORAGE_KEY_ENGINES, STORAGE_KEY_CURRENT_ENGINE]);
  const engines = normalizeEngines(snapshot[STORAGE_KEY_ENGINES]);
  const current = isNonEmptyString(snapshot[STORAGE_KEY_CURRENT_ENGINE])
    ? snapshot[STORAGE_KEY_CURRENT_ENGINE]
    : "";

  engineState.engines = engines;
  engineState.currentEngineId = pickCurrentEngineId(engines, current);
  scheduleEnsure();
}

function start() {
  if (!isGoogleLikeHostname(location.hostname)) return;

  if (globalThis.__QTN_googleToKagiInstalled === true) return;
  globalThis.__QTN_googleToKagiInstalled = true;

  let scheduled = false;
  scheduleEnsure = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      ensureEngineToolbar();
    }, 50);
  };

  ensureEngineToolbar();
  void loadEngineStateFromStorage();

  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(document.documentElement, { subtree: true, childList: true });

  document.addEventListener(
    "input",
    (event) => {
      const target = event.target;
      if (
        (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
        target.name === "q"
      ) {
        scheduleEnsure();
      }
    },
    true
  );

  window.addEventListener("focus", () => {
    void loadEngineStateFromStorage();
  });
  window.addEventListener("popstate", scheduleEnsure);
  window.addEventListener("resize", scheduleEnsure);
  window.addEventListener("scroll", scheduleEnsure, true);

  const { pushState, replaceState } = history;
  history.pushState = function (...args) {
    const result = pushState.apply(this, args);
    scheduleEnsure();
    return result;
  };
  history.replaceState = function (...args) {
    const result = replaceState.apply(this, args);
    scheduleEnsure();
    return result;
  };

  if (typeof chrome !== "undefined" && chrome.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") return;
      if (changes[STORAGE_KEY_ENGINES] || changes[STORAGE_KEY_CURRENT_ENGINE]) {
        void loadEngineStateFromStorage();
      }
    });
  }
}

// Expose internal helpers for unit tests only.
if (typeof globalThis !== "undefined" && globalThis.__QTN_TEST__ === true) {
  globalThis.__QTN_googleToKagi = {
    isGoogleLikeHostname,
    isGoogleSearchLikeUrl,
    getQueryFromUrl,
    buildKagiSearchUrl,
    normalizeEngines,
    pickCurrentEngineId,
    buildEngineSearchUrl,
  };
}

if (typeof window !== "undefined" && typeof document !== "undefined" && typeof location !== "undefined") {
  start();
}
