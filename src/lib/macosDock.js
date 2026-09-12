// macOS 风格首页的纯逻辑层：Dock 放大曲线、分组归集、Launchpad 筛选与分页。
// 这里不依赖 React 与 DOM，便于单独测试。

import { sortQuickLinkGroups } from "./quickLinkGroups.js";

/**
 * 把链接按分组归集成 Dock/Launchpad 需要的区段列表。
 * 未分组的链接排在最前，其余按分组 order 排列。空分组也会保留，
 * 因为 Dock 需要展示所有分组（包括还没放链接的新分组）。
 *
 * @param {Array} links 全部快速链接
 * @param {Array} groups 全部分组
 * @param {{ keepEmpty?: boolean }} [options] keepEmpty 为 false 时丢弃空区段
 * @returns {Array<{ group: object|null, links: Array }>}
 */
export function buildDockSections(links, groups, options = {}) {
  const { keepEmpty = true } = options;
  const enabled = (links || []).filter((link) => link.enabled !== false);
  const sorted = sortQuickLinkGroups(groups || []);

  const sections = [];
  const ungrouped = enabled.filter((link) => !link.groupId);
  if (ungrouped.length > 0) {
    sections.push({ group: null, links: ungrouped });
  }

  for (const group of sorted) {
    const groupLinks = enabled.filter((link) => link.groupId === group.id);
    if (groupLinks.length === 0 && !keepEmpty) continue;
    sections.push({ group, links: groupLinks });
  }

  return sections;
}

/**
 * macOS Dock 的放大衰减曲线。
 * 距离为 0 时取到 maxScale，到达 spread 时回落为 1，两端导数为 0，
 * 所以指针划过 Dock 时不会出现突变的台阶感。
 *
 * @param {number} distance 指针与图标中心的水平距离（像素，可为负）
 * @param {number} spread 影响半径（像素）
 * @param {number} maxScale 中心处的最大缩放
 * @returns {number} 该图标应使用的缩放值
 */
export function dockMagnification(distance, spread, maxScale) {
  if (!Number.isFinite(distance) || !(spread > 0)) return 1;
  const scale = Number.isFinite(maxScale) ? maxScale : 1;
  if (scale <= 1) return 1;

  const d = Math.abs(distance);
  if (d >= spread) return 1;

  const falloff = (Math.cos((d / spread) * Math.PI) + 1) / 2;
  return 1 + (scale - 1) * falloff;
}

/**
 * 堆栈切换到网格形态时用几列。
 * 开方后向上取整，让网格尽量接近正方形；上限 5 列，避免面板横向顶出视口。
 * DockBar 要用它算面板宽度以收拢锚点，所以两边必须取同一个值。
 */
export function stackGridColumns(count) {
  const n = Math.max(0, Math.floor(count) || 0);
  if (n <= 1) return 1;
  return Math.max(1, Math.min(5, Math.ceil(Math.sqrt(n))));
}

/**
 * 取分组名的首字作为 Dock 图标上的字形。
 *
 * 用 Array.from 而不是 charAt，否则 emoji 一类的代理对会被从中间截断。
 * 拉丁字母统一转大写，中日韩文字保持原样。
 */
export function groupInitial(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";

  const first = Array.from(trimmed)[0];
  return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}

/**
 * Launchpad 的筛选：对名称与网址做大小写无关的子串匹配，
 * 分组名命中时保留该分组下的全部链接。筛选后丢弃空区段。
 */
export function filterSections(sections, query) {
  const keyword = (query || "").trim().toLowerCase();
  if (!keyword) return sections;

  const result = [];
  for (const section of sections) {
    const groupName = (section.group?.name || "").toLowerCase();
    if (groupName && groupName.includes(keyword)) {
      result.push(section);
      continue;
    }

    const matched = section.links.filter((link) => {
      const name = (link.name || "").toLowerCase();
      const url = (link.url || "").toLowerCase();
      return name.includes(keyword) || url.includes(keyword);
    });

    if (matched.length > 0) {
      result.push({ ...section, links: matched });
    }
  }

  return result;
}

/**
 * 把区段铺进 Launchpad 的分页网格。
 *
 * 一个分组占满一页。让多个分组挤在同一页上，等于分页和分组两套划分同时存在
 * 却互不对齐，翻页就失去了含义；一组一页之后，翻页就是"换一个分组"。
 * 单个分组超过一页容量时才拆开，续页标记 continued，由渲染层决定是否弱化
 * 重复出现的标题。
 *
 * 每页留一行给分组标题，其余行放链接。
 *
 * @param {Array<{ group: object|null, links: Array }>} sections
 * @param {{ cols: number, rows: number }} layout
 * @returns {Array<Array<{ group: object|null, links: Array, continued: boolean }>>}
 */
export function paginateLaunchpad(sections, layout) {
  const cols = Math.max(1, Math.floor(layout?.cols || 1));
  const rows = Math.max(2, Math.floor(layout?.rows || 2));
  const capacity = Math.max(1, (rows - 1) * cols);

  const filled = (sections || []).filter((s) => s.links && s.links.length > 0);
  const pages = [];

  // 第一页是"全部"：按分组顺序铺开，各组之间由渲染层画分割线。它不受单页容量
  // 限制，装不下就纵向滚动——分页在这里的含义是"换一个分组"，不该把"全部"
  // 也切成几段。只有一个分组时这一页与该组自己那页完全相同，就不必再加。
  if (filled.length > 1) {
    pages.push(
      filled.map((s) => ({ group: s.group, links: s.links, continued: false }))
    );
  }

  for (const section of filled) {
    let remaining = section.links;
    let continued = false;

    while (remaining.length > 0) {
      pages.push([
        { group: section.group, links: remaining.slice(0, capacity), continued },
      ]);
      remaining = remaining.slice(capacity);
      continued = true;
    }
  }

  return pages;
}

/**
 * 依据可用视口尺寸推算 Launchpad 的列数与行数。
 * 单元格尺寸与两侧留白保持与渲染层一致，避免算出的页容量和实际排版对不上。
 */
export function launchpadLayout(width, height, cell = { width: 132, height: 116 }) {
  const usableWidth = Math.max(0, (width || 0) - 160);
  const usableHeight = Math.max(0, (height || 0) - 300);

  const cols = Math.max(2, Math.min(9, Math.floor(usableWidth / cell.width) || 2));
  const rows = Math.max(2, Math.floor(usableHeight / cell.height) || 2);

  return { cols, rows };
}
