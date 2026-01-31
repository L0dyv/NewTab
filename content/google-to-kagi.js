/**
 * Content script: Google search results → Kagi quick search button.
 *
 * Test hook:
 * - In Node tests, set `globalThis.__QTN_TEST__ = true` before importing this file.
 * - Helpers are exposed as `globalThis.__QTN_googleToKagi`.
 */

const KAGI_SEARCH_BASE = "https://kagi.com/search?q=";
const KAGI_BUTTON_ID = "qtn-kagi-btn";
const KAGI_STYLE_ID = "qtn-kagi-style";

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
    const q = url.searchParams.get("q");
    const trimmed = (q ?? "").trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function buildKagiSearchUrl(query) {
  return `${KAGI_SEARCH_BASE}${encodeURIComponent(query)}`;
}

function getCurrentQuery() {
  // Prefer URL param (survives SPA navigations), fallback to input value.
  const fromUrl = getQueryFromUrl(location.href);
  if (fromUrl) return fromUrl;

  const input = document.querySelector('input[name="q"]');
  const value = typeof input?.value === "string" ? input.value.trim() : "";
  return value.length > 0 ? value : null;
}

function ensureStyle() {
  if (document.getElementById(KAGI_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = KAGI_STYLE_ID;
  style.textContent = `
#${KAGI_BUTTON_ID}{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  height:32px;
  min-width:48px;
  margin-left:6px;
  padding:0 12px;
  border:1px solid rgba(60,64,67,.3);
  border-radius:16px;
  background:transparent;
  color:#1a73e8;
  font:500 13px/1 Arial, sans-serif;
  text-decoration:none;
  cursor:pointer;
  user-select:none;
}
#${KAGI_BUTTON_ID}:hover{background:rgba(60,64,67,.08);}
#${KAGI_BUTTON_ID}:active{background:rgba(60,64,67,.12);}
#${KAGI_BUTTON_ID}.qtn-kagi-btn--disabled{
  opacity:.5;
  cursor:not-allowed;
  pointer-events:none;
}
  `.trim();
  document.documentElement.appendChild(style);
}

function findSearchSubmitButton() {
  const input = document.querySelector('input[name="q"]');
  const form = input?.closest?.("form");
  if (!form) return null;

  const buttons = Array.from(form.querySelectorAll('button[type="submit"]'));
  if (buttons.length === 0) return null;

  return buttons[buttons.length - 1];
}

function ensureKagiButton() {
  if (!isGoogleSearchLikeUrl(location.href)) {
    document.getElementById(KAGI_BUTTON_ID)?.remove?.();
    return;
  }

  const submitButton = findSearchSubmitButton();
  if (!submitButton) return;

  ensureStyle();

  let kagi = document.getElementById(KAGI_BUTTON_ID);
  if (!kagi) {
    kagi = document.createElement("a");
    kagi.id = KAGI_BUTTON_ID;
    kagi.textContent = "Kagi";
    kagi.setAttribute("aria-label", "Search with Kagi");
    kagi.setAttribute("rel", "noopener noreferrer");
    kagi.setAttribute("target", "_blank");

    submitButton.insertAdjacentElement("afterend", kagi);
  }

  const query = getCurrentQuery();
  if (query) {
    kagi.classList.remove("qtn-kagi-btn--disabled");
    kagi.removeAttribute("aria-disabled");
    kagi.setAttribute("href", buildKagiSearchUrl(query));
    kagi.setAttribute("title", `Search "${query}" with Kagi`);
  } else {
    kagi.classList.add("qtn-kagi-btn--disabled");
    kagi.setAttribute("aria-disabled", "true");
    kagi.removeAttribute("href");
    kagi.setAttribute("title", "No search query found");
  }
}

function start() {
  if (!isGoogleLikeHostname(location.hostname)) return;

  if (globalThis.__QTN_googleToKagiInstalled === true) return;
  globalThis.__QTN_googleToKagiInstalled = true;

  let scheduled = false;
  const scheduleEnsure = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      ensureKagiButton();
    }, 50);
  };

  // Initial run
  ensureKagiButton();

  // DOM changes (Google often updates the search UI dynamically)
  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(document.documentElement, { subtree: true, childList: true });

  // SPA navigation hooks
  window.addEventListener("popstate", scheduleEnsure);
  const { pushState, replaceState } = history;
  history.pushState = function (...args) {
    const res = pushState.apply(this, args);
    scheduleEnsure();
    return res;
  };
  history.replaceState = function (...args) {
    const res = replaceState.apply(this, args);
    scheduleEnsure();
    return res;
  };
}

// Expose internal helpers for unit tests only.
if (typeof globalThis !== "undefined" && globalThis.__QTN_TEST__ === true) {
  globalThis.__QTN_googleToKagi = {
    isGoogleSearchLikeUrl,
    getQueryFromUrl,
    buildKagiSearchUrl,
  };
}

if (typeof window !== "undefined" && typeof document !== "undefined" && typeof location !== "undefined") {
  start();
}
