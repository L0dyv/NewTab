# NewTab

![LightTheme](./assets/LightMode.png)
![DarkTheme](./assets/DarkMode.png)

## 功能亮点
- 替换 Chrome 新标签页与工具栏弹窗为统一的快速启动面板，自动补全历史/书签/URL，支持右键菜单（复制/删除）以及底部直达浏览器设置与扩展页面按钮。
- 搜索引擎可增删排序、设默认、启用/禁用，还能用 Alt+1‥9 切换并按住 Alt 显示提示；可在新标签页与弹窗之间分别设置“在当前页/新标签页打开”，包括 Kagi Assistant。
- 快速链接可拖拽排序、编辑、删除、自动抓标题，可按需跳过删除确认或单条禁用；弹窗最多展示 4 条并提供“添加当前页面”按钮，添加后会提示状态并显示当前 URL。
- 统一设置面板涵盖通用、搜索引擎、快速链接、数据管理，支持中英文语言切换、版本号展示，以及搜索/链接的排序与默认/启用控制。
- 数据管理模块实现 JSON 导入/导出（含确认）、WebDAV 连接测试/备份/恢复、配置保存与恢复后自动刷新，以及重置；`settingsManager.ts` 负责版本兼容、`openSearchInNewTab` 三套开关、导入校验、同步 `chrome.storage.sync` 及派发 `settings:updated`。
- 发布流程：先 `npm run sync-version` 让 `package.json` 与 `manifest.json` 版本一致，再 `npm run build`/`npm run build:ext` 由 `scripts/build-extension.js` 将 `dist` 移到 `release/extensions`，必要时运行 `npm run package:zip` 生成版本化压缩包（详见 `.localdocs/DEVELOPMENT.md`）。
