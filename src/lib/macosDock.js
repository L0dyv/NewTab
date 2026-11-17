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

/** 扇形里一项的高度与行距，DockBar 判断放不放得下时要用同一套值 */
export const FAN_ITEM_HEIGHT = 28;
export const FAN_ITEM_GAP = 12;

/** 扇形项数的上限。Dock 到搜索区之间大约就这么高——再多几项，药丸就会压到
 *  搜索框和引擎标签上；扇形是一颗颗分开的药丸，中间透出下面的内容，叠上去
 *  是花的，不像面板那样能干净地盖住。超出就改用网格。*/
const FAN_MAX_ITEMS = 8;

/**
 * Dock 上方这段高度里，扇形最多能竖着放几项。
 *
 * 上限之外还要看实际余量：窗口矮的时候连 8 项也放不下，硬排会顶出屏幕，
 * 这时改用网格反而更紧凑。
 *
 * @param {number} availableHeight Dock 顶边以上可用的像素高度
 * @returns {number} 扇形能容纳的项数
 */
export function fanCapacity(availableHeight) {
  const space = Math.max(0, availableHeight || 0);
  const fits = Math.floor((space + FAN_ITEM_GAP) / (FAN_ITEM_HEIGHT + FAN_ITEM_GAP));
  return Math.max(1, Math.min(FAN_MAX_ITEMS, fits));
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
 * 供分组自选的精选单色线性图标键值（4 行 x 7 列 = 28 枚）。
 * 前排为无特定语义的抽象容器图标，组内内容混杂时也自然百搭；
 * 后排为高频日常领域图标。未分组专用的 "inbox" 不在此列，保持唯一语义。
 */
export const GROUP_ICON_KEYS = [
  "folder",
  "layers",
  "bookmark",
  "star",
  "archive",
  "box",
  "tag",
  "hash",
  "compass",
  "sparkles",
  "bot",
  "terminal",
  "code",
  "cloud",
  "mail",
  "message",
  "book",
  "graduation",
  "file-text",
  "briefcase",
  "globe",
  "tv",
  "gamepad",
  "music",
  "palette",
  "wrench",
  "shopping",
  "wallet",
];

/** 显式选择使用无饰线首字母代替图形图标 */
export const GROUP_ICON_INITIAL = "initial";

const GROUP_ICON_SET = new Set(GROUP_ICON_KEYS);

const GROUP_ICON_RULES = [
  {
    key: "mail",
    latin: ["mail", "email", "gmail", "outlook", "inbox", "post"],
    cjk: ["邮箱", "邮件", "信箱"],
  },
  {
    key: "bot",
    latin: ["ai", "llm", "gpt", "chatgpt", "claude", "gemini", "agent", "model", "prompt"],
    cjk: ["智能", "大模型", "模型"],
  },
  {
    key: "graduation",
    latin: ["uni", "university", "college", "school", "edu", "education", "academic", "course", "paper", "arxiv", "scholar", "math"],
    cjk: ["大学", "学校", "高校", "学术", "课程", "论文", "科研", "数学", "学习", "教务"],
  },
  {
    key: "code",
    latin: ["dev", "code", "coding", "github", "git", "repo", "program", "programming", "frontend", "backend", "api", "sdk"],
    cjk: ["开发", "代码", "编程", "源码", "工程", "技术"],
  },
  {
    key: "cloud",
    latin: ["infra", "cloud", "server", "ops", "devops", "deploy", "vps", "nas", "docker", "k8s", "network", "dns"],
    cjk: ["云", "服务器", "运维", "部署", "基础设施", "节点", "网络"],
  },
  {
    key: "terminal",
    latin: ["cli", "shell", "terminal", "linux", "ssh", "bash"],
    cjk: ["终端", "命令行"],
  },
  {
    key: "tv",
    latin: ["media", "video", "videos", "stream", "streaming", "movie", "movies", "film", "tv", "anime", "youtube", "bilibili"],
    cjk: ["影音", "视频", "影视", "电影", "番剧", "动漫", "直播"],
  },
  {
    key: "gamepad",
    latin: ["ent", "entertainment", "game", "games", "gaming", "steam", "play", "fun"],
    cjk: ["娱乐", "游戏", "摸鱼", "休闲"],
  },
  {
    key: "music",
    latin: ["music", "audio", "song", "songs", "podcast", "spotify", "radio"],
    cjk: ["音乐", "歌单", "播客", "音频", "听书"],
  },
  {
    key: "book",
    latin: ["eng", "english", "lang", "language", "book", "books", "read", "reading", "novel", "wiki", "dict"],
    cjk: ["英语", "外语", "阅读", "读书", "书籍", "小说", "词典", "百科"],
  },
  {
    key: "file-text",
    latin: ["doc", "docs", "note", "notes", "blog", "blogs", "article", "news", "rss", "write", "writing"],
    cjk: ["文档", "笔记", "博客", "资讯", "文章", "写作", "资料"],
  },
  {
    key: "briefcase",
    latin: ["work", "office", "job", "career", "team", "project", "corp", "biz"],
    cjk: ["工作", "办公", "职场", "项目", "公司", "业务"],
  },
  {
    key: "palette",
    latin: ["design", "ui", "ux", "art", "figma", "color", "font", "photo", "image"],
    cjk: ["设计", "美术", "灵感", "配色", "字体", "图片", "摄影"],
  },
  {
    key: "message",
    latin: ["social", "chat", "forum", "bbs", "community", "sns", "reddit", "twitter"],
    cjk: ["社交", "社区", "论坛", "聊天", "讨论"],
  },
  {
    key: "wrench",
    latin: ["tool", "tools", "util", "utils", "utility", "kit", "convert"],
    cjk: ["工具", "实用", "在线工具", "效率"],
  },
  {
    key: "shopping",
    latin: ["shop", "shopping", "store", "buy", "mall", "deal"],
    cjk: ["购物", "商城", "电商", "海淘"],
  },
  {
    key: "wallet",
    latin: ["finance", "bank", "pay", "money", "crypto", "stock", "invest", "bill", "usage"],
    cjk: ["财务", "金融", "银行", "账单", "理财", "股票", "用量"],
  },
  {
    key: "star",
    latin: ["fav", "favorite", "favorites", "star", "top", "daily", "often", "pinned"],
    cjk: ["常用", "精选", "高频", "日常", "置顶", "收藏"],
  },
];

/**
 * 按分组名称推断默认图标键值；拉丁词按完整词元匹配（避免 "Mail" 误中 "ai"），
 * 未命中任何规则时统一回退为 "folder"。
 */
export function inferGroupIconKey(name) {
  const raw = (name || "").trim().toLowerCase();
  if (!raw) return "folder";

  const latinTokens = new Set(raw.split(/[^a-z0-9]+/).filter(Boolean));

  for (const rule of GROUP_ICON_RULES) {
    if (rule.latin.some((word) => latinTokens.has(word))) {
      return rule.key;
    }
    if (rule.cjk.some((phrase) => raw.includes(phrase))) {
      return rule.key;
    }
  }

  return "folder";
}

/**
 * 解析分组在 Dock 方块上应渲染的视觉形态。
 */
export function resolveGroupTileVisual(group) {
  if (!group) {
    return { kind: "icon", iconKey: "inbox" };
  }

  if (group.icon === GROUP_ICON_INITIAL) {
    return { kind: "initial", glyph: groupInitial(group.name) };
  }

  if (group.icon && GROUP_ICON_SET.has(group.icon)) {
    return { kind: "icon", iconKey: group.icon };
  }

  return { kind: "icon", iconKey: inferGroupIconKey(group.name) };
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

/** Launchpad 网格的实际排版尺寸，取自浏览器里量到的真实盒子。
 *  渲染层与分页必须共用这一套，否则算出的页容量和排出来的高度对不上。*/
export const LAUNCHPAD_CELL = 120; // LinkTile 宽度
export const LAUNCHPAD_GAP = 4; // 单元格之间的间距
export const LAUNCHPAD_ROW_HEIGHT = 92; // LinkTile 高度
export const LAUNCHPAD_HEADER_HEIGHT = 25; // 分组标题行加它下方的外边距
export const LAUNCHPAD_SECTION_GAP = 24; // 相邻分组之间的间距

/**
 * 一个区段排出来有多高（像素）。
 *
 * @param {number} linkCount 这一段里的链接数
 * @param {number} cols 每行几个
 */
export function sectionHeight(linkCount, cols) {
  const columns = Math.max(1, Math.floor(cols) || 1);
  const rows = Math.max(1, Math.ceil(Math.max(0, linkCount) / columns));
  return (
    LAUNCHPAD_HEADER_HEIGHT + rows * LAUNCHPAD_ROW_HEIGHT + (rows - 1) * LAUNCHPAD_GAP
  );
}

/** 一页排出来有多高，渲染层据此给页盒子定高，使各页等高、翻页不跳。 */
export function launchpadPageHeight(page, cols) {
  return (page || []).reduce(
    (total, section, index) =>
      total +
      (index > 0 ? LAUNCHPAD_SECTION_GAP : 0) +
      sectionHeight(section.links.length, cols),
    0
  );
}

/**
 * 把区段铺进 Launchpad 的分页网格。
 *
 * 一页就是"全部内容的一屏"，与分组无关：按分组顺序连续铺开，装满一页就换下
 * 一页，分组之间由渲染层画分割线。这里不再一组一页——那样"页"会同时表示
 * 一个分组和一屏内容，页码点两件事都说不清；分组入口由 Dock 的堆栈承担。
 *
 * 容量按像素算而不是按"行"算。标题行只有 25px，图标行有 92px，把两者都当成
 * 一行计价的话，每个区段都会凭空多占掉七十来个像素——页面报告自己满了，实际
 * 只铺到六成，后面还压着好几页。
 *
 * 单个区段大于整页容量时拆开，续页标记 continued，由渲染层决定是否弱化重复
 * 出现的标题。
 *
 * @param {Array<{ group: object|null, links: Array }>} sections
 * @param {{ cols: number, gridHeight?: number, rows?: number }} layout
 * @returns {Array<Array<{ group: object|null, links: Array, continued: boolean }>>}
 */
export function paginateLaunchpad(sections, layout) {
  const cols = Math.max(1, Math.floor(layout?.cols || 1));
  const minimum = LAUNCHPAD_HEADER_HEIGHT + LAUNCHPAD_ROW_HEIGHT;
  const fallback =
    Math.max(2, Math.floor(layout?.rows || 2)) * (LAUNCHPAD_ROW_HEIGHT + LAUNCHPAD_GAP);
  const budget = Math.max(minimum, Math.floor(layout?.gridHeight || fallback));

  const pages = [];
  let current = [];
  let used = 0;

  const flush = () => {
    if (current.length > 0) {
      pages.push(current);
      current = [];
      used = 0;
    }
  };

  for (const section of sections || []) {
    if (!section.links || section.links.length === 0) continue;

    let remaining = section.links;
    let continued = false;

    while (remaining.length > 0) {
      const lead = current.length > 0 ? LAUNCHPAD_SECTION_GAP : 0;

      // 一个区段至少要放下标题加一行图标，否则先换页。空页一定放得下，
      // 因为 budget 不小于这个下限，所以这里不会空转。
      if (used + lead + minimum > budget) {
        flush();
        continue;
      }

      const room = budget - used - lead - LAUNCHPAD_HEADER_HEIGHT;
      const rowsFit = Math.max(
        1,
        Math.floor((room + LAUNCHPAD_GAP) / (LAUNCHPAD_ROW_HEIGHT + LAUNCHPAD_GAP))
      );
      const take = Math.min(remaining.length, rowsFit * cols);

      current.push({ group: section.group, links: remaining.slice(0, take), continued });
      used += lead + sectionHeight(take, cols);
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
 * 依据可用视口尺寸推算 Launchpad 的网格尺寸。
 * 单元格尺寸与两侧留白保持与渲染层一致，避免算出的页容量和实际排版对不上。
 */
export function launchpadLayout(width, height, cell = { width: 128, height: 104 }) {
  // 内容区受 1024px 上限限制，再减去两侧留白。按视口宽度算列数会得出比内容区
  // 更多的列，铺不满就成了左对齐，右侧空一截。
  const usableWidth = Math.min(1024, Math.max(0, (width || 0) - 80));
  // 上方筛选框与下方页码各占一段固定高度，余下的才是网格能用的高度
  const usableHeight = Math.max(0, (height || 0) - 240);

  const cols = Math.max(3, Math.min(8, Math.floor(usableWidth / cell.width) || 3));
  const rows = Math.max(2, Math.min(6, Math.floor(usableHeight / cell.height) || 2));

  return {
    cols,
    rows,
    // 网格盒子正好等于列阵的宽度，于是所有区段共用同一套列位置，左右留白也对称
    gridWidth: cols * LAUNCHPAD_CELL + (cols - 1) * LAUNCHPAD_GAP,
    gridHeight: rows * (LAUNCHPAD_ROW_HEIGHT + LAUNCHPAD_GAP),
  };
}
