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
 * 由稳定散列给每个分组挑一个配色，返回色板下标。
 *
 * 六个一模一样的字母方块看起来像键盘而不像 Dock，所以按 id 分配颜色。
 * 散列到色板而不是散列到色相环：色相自由取值必然会撞进橄榄绿、荧光紫这类
 * 不好看的区段，而且 HSL 的 L 不等于感知明度，同一个 L 下黄绿比蓝紫亮得多，
 * 一排方块会明暗不齐。色板里每个颜色的明度是单独调过的。
 *
 * 必须只依赖 id：分组改名或重排后颜色不应该跟着变。
 */
export function groupSwatchIndex(seed, count) {
  const size = Math.max(1, Math.floor(count) || 1);
  const text = String(seed ?? "");

  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  // 末尾必须做一次雪崩混合。少了这步，只差末位的 id（g1/g2/g3）算出的哈希也
  // 只差 1，取模后会落到相邻的色板项上，Dock 上就是一排近似同色的方块。
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;

  return (hash >>> 0) % size;
}

/**
 * 取分组的前 n 个链接，用于需要预览组内内容的地方。
 * 分组为空时返回空数组，由调用方渲染占位。
 */
export function tilePreviewLinks(links, count = 4) {
  return (links || []).slice(0, Math.max(0, count));
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
 * 每个区段占 1 行标题 + ceil(链接数 / cols) 行内容。装不下当前页剩余行数时
 * 换页；单个区段大于整页容量时拆开，续页的区段标记 continued，由渲染层决定
 * 是否弱化重复标题。
 *
 * @param {Array<{ group: object|null, links: Array }>} sections
 * @param {{ cols: number, rows: number }} layout
 * @returns {Array<Array<{ group: object|null, links: Array, continued: boolean }>>}
 */
export function paginateLaunchpad(sections, layout) {
  const cols = Math.max(1, Math.floor(layout?.cols || 1));
  const rows = Math.max(2, Math.floor(layout?.rows || 2));

  const pages = [];
  let current = [];
  let rowsUsed = 0;

  const flush = () => {
    if (current.length > 0) {
      pages.push(current);
      current = [];
      rowsUsed = 0;
    }
  };

  for (const section of sections || []) {
    if (!section.links || section.links.length === 0) continue;

    let remaining = section.links;
    let continued = false;

    while (remaining.length > 0) {
      // 一个区段至少要放下标题行加一行内容，否则先换页。
      if (rows - rowsUsed < 2) {
        flush();
      }

      const capacity = (rows - rowsUsed - 1) * cols;
      const take = Math.min(remaining.length, capacity);
      const chunk = remaining.slice(0, take);

      current.push({ group: section.group, links: chunk, continued });
      rowsUsed += 1 + Math.ceil(take / cols);
      remaining = remaining.slice(take);

      if (remaining.length > 0) {
        continued = true;
        flush();
      }
    }
  }

  flush();
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
