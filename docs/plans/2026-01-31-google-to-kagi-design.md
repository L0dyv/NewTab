# Google → Kagi Button (Design)

## Goal

On Google search result pages, add a small “Kagi” button near the search box’s search/submit button. Clicking it opens a new tab to `https://kagi.com/search?q=<current query>`.

## Constraints

- Support Google domains across regions (`google.com`, `google.co.jp`, `google.com.hk`, etc.) without maintaining an explicit allowlist.
- Minimal performance impact: do nothing on non-target pages.
- Robust to Google’s frequent DOM changes and SPA navigation.
- No extra permissions beyond what the extension already uses.

## Approaches considered

### 1) Manifest `content_scripts` on `<all_urls>` with fast runtime guard (recommended)

**Pros**
- Works for all `google.*` domains without enumerating TLDs.
- Simple deployment via `manifest.json`.

**Cons**
- Script is injected on all pages, so the guard must be fast and side-effect-free on non-Google pages.

### 2) Manifest `content_scripts` with explicit `matches` for each Google domain

**Pros**
- Minimal injection surface.

**Cons**
- Hard to keep complete; new or uncommon Google domains will be missed.

### 3) Service worker injection via `chrome.scripting`

**Pros**
- Can be selective at runtime.

**Cons**
- More moving parts; still needs robust page detection; heavier than necessary for this feature.

## Design (recommended)

Add a single content script that:

1. **Detects target pages quickly**
   - Only proceed when:
     - The hostname contains the `google` label (e.g., `www.google.com`, `www.google.com.hk`, `accounts.google.com`), and
     - A `q` query parameter exists (common across Google search verticals).
2. **Extracts query**
   - Prefer URL param `q` (source of truth during SPA navigation).
   - Fallback: `input[name="q"]` value when available.
3. **Injects a scoped UI button**
   - Insert adjacent to the search submit button in the top search bar (best effort).
   - Button opens `https://kagi.com/search?q=...` in a new tab (`target="_blank"`, `rel="noopener noreferrer"`).
   - If query is missing/empty: keep the button visible but disabled (aria + styling).
4. **Keeps it stable**
   - Idempotent `ensureButton()` that can run repeatedly without duplicating elements.
   - Use `MutationObserver` + URL change hooks (`popstate`, patched `history.pushState/replaceState`) to re-run `ensureButton()` on navigation and UI changes.
5. **Scoped styling**
   - Inject one `<style>` tag with rules only for the button’s id/class to avoid impacting Google’s CSS.

## Files / integration

- New: `content/google-to-kagi.js` (content script)
- Modify: `manifest.json` (add `content_scripts`)
- Modify: `vite.config.ts` (copy content script into build output)
- New: `tests/google-to-kagi.test.js` + `package.json` test script (Node built-in runner)

## Verification

- `npm test` (Node’s `--test`)
- `npm run build`
- Manual: load unpacked build output and confirm button shows on `https://www.google.com/search?q=test` and opens Kagi in a new tab.

