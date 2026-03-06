# Google → Kagi Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a “Kagi” button on Google search results pages that opens Kagi search for the current query in a new tab.

**Architecture:** A lightweight MV3 content script injected via `manifest.json` (with a fast runtime guard) that idempotently inserts a button next to Google’s search submit button and keeps it updated during SPA navigation.

**Tech Stack:** MV3 content script, plain JS DOM manipulation, Node built-in `node:test` for unit tests, Vite static copy for build packaging.

---

### Task 1: Add test runner + failing tests for core logic

**Files:**
- Modify: `package.json`
- Create: `tests/google-to-kagi.test.js`

**Step 1: Write the failing test**

Create `tests/google-to-kagi.test.js` asserting:
- Google domain + `q` param is detected as “target page”
- Query extraction returns the expected decoded string
- Kagi URL builder encodes special characters correctly
- Empty query returns “disabled” state

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because the content script helpers don’t exist yet.

---

### Task 2: Add content script skeleton with test hooks (no DOM work yet)

**Files:**
- Create: `content/google-to-kagi.js`

**Step 1: Add minimal skeleton**

- Define a small set of helper functions (page detection / query / URL builder).
- Expose helpers to tests only when `globalThis.__QTN_TEST__ === true`.
- Ensure the script does not execute DOM code when `document` is unavailable (Node).

**Step 2: Run tests**

Run: `npm test`

Expected: Still FAIL, but now specifically due to missing/wrong helper behavior (not missing module).

---

### Task 3: Implement core logic to satisfy tests

**Files:**
- Modify: `content/google-to-kagi.js`
- Test: `tests/google-to-kagi.test.js`

**Step 1: Implement minimal logic**

- `isGoogleLikeHostname(hostname)`
- `isGoogleSearchLikeUrl(urlString)`
- `getQueryFromUrl(urlString)`
- `buildKagiSearchUrl(query)`

**Step 2: Run tests**

Run: `npm test`

Expected: PASS.

---

### Task 4: Implement DOM insertion (idempotent + stable)

**Files:**
- Modify: `content/google-to-kagi.js`

**Step 1: Implement DOM “ensure” loop**

- Find a reasonable anchor near the search bar submit button.
- Insert a single button (identified by a stable id).
- Update button href/disabled state based on current query.
- Add `MutationObserver` and history navigation hooks to re-run `ensureButton()` with throttling.

**Step 2: Run manual check**

- Load extension unpacked.
- Visit `https://www.google.com/search?q=hello` and confirm placement and click behavior.

---

### Task 5: Package the content script into the build output

**Files:**
- Modify: `manifest.json`
- Modify: `vite.config.ts`

**Step 1: Add manifest entry**

Add a `content_scripts` entry pointing to `content/google-to-kagi.js` with `matches: ["<all_urls>"]` and `run_at: "document_idle"`.

**Step 2: Copy file during build**

Update `vite.config.ts` `viteStaticCopy` targets to include `content/google-to-kagi.js`.

**Step 3: Verify build**

Run: `npm run build`

Expected: Build completes and `release/extensions/content/google-to-kagi.js` exists.

