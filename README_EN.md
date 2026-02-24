# NewTab

![LightTheme](./assets/LightMode.png)
![DarkTheme](./assets/DarkMode.png)

## Features
- Replace Chrome’s new tab page and toolbar popup with a unified quick-launch surface that autocompletes history, bookmarks, and URLs, exposes a right-click menu (copy/delete), and includes bottom shortcuts to browser settings and extensions.
- Manage search engines (add/delete/reorder/set default/enable/disable) and switch with Alt+1‥9 (hold Alt to reveal hints); control whether searches open in the current tab or a new tab separately for the new tab surface and the popup, including Kagi Assistant.
- Quick links can be reordered, edited, deleted, auto-fetch titles, optionally skip delete confirmations, and toggle visibility per entry; the popup shows up to four links and has an “Add current page” button that reports duplicates/added status with the current URL.
- Unified settings modal covers general, search engine, quick link, and data management sections, supports zh/en language switching and version display, and lets you reorder/search defaults.
- Data management handles JSON export/import (with confirmation), WebDAV connection testing/upload/restore (credential saving, HTTPS checks), and reset+auto refresh; `settingsManager.ts` provides version compatibility, three `openSearchInNewTab` toggles, import validation, Chrome sync persistence, and `settings:updated` events.
- Release flow: `npm run sync-version` keeps `package.json` and `manifest.json` aligned, `npm run build`/`npm run build:ext` runs `scripts/build-extension.js` to move `dist` → `release/extensions`, and `npm run package:zip` produces a versioned zip (see `.localdocs/DEVELOPMENT.md`).
