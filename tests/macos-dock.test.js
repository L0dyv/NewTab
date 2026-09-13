import assert from "node:assert/strict";

import {
  buildDockSections,
  dockMagnification,
  fanCapacity,
  stackGridColumns,
  groupInitial,
  filterSections,
  paginateLaunchpad,
  launchpadLayout,
  launchpadPageHeight,
  sectionHeight,
  LAUNCHPAD_CELL,
  LAUNCHPAD_GAP,
  LAUNCHPAD_HEADER_HEIGHT,
  LAUNCHPAD_ROW_HEIGHT,
  LAUNCHPAD_SECTION_GAP,
  FAN_ITEM_HEIGHT,
  FAN_ITEM_GAP,
} from "../src/lib/macosDock.js";

const groups = [
  { id: "g-math", name: "Math", order: 1 },
  { id: "g-daily", name: "Daily", order: 0 },
  { id: "g-empty", name: "Empty", order: 2 },
];

const links = [
  { id: "l1", name: "Alpha", url: "https://alpha.example.com", groupId: "g-daily" },
  { id: "l2", name: "Beta", url: "https://beta.example.com", groupId: "g-math" },
  { id: "l3", name: "Gamma", url: "https://gamma.example.com" },
  { id: "l4", name: "Delta", url: "https://delta.example.com", groupId: "g-daily", enabled: false },
  { id: "l5", name: "Epsilon", url: "https://epsilon.example.com", groupId: "g-daily" },
];

// --- buildDockSections -----------------------------------------------------

{
  const sections = buildDockSections(links, groups);

  assert.deepEqual(
    sections.map((s) => s.group?.id ?? null),
    [null, "g-daily", "g-math", "g-empty"],
    "ungrouped section comes first, then groups in order"
  );

  assert.deepEqual(
    sections[0].links.map((l) => l.id),
    ["l3"],
    "ungrouped section holds links without a groupId"
  );

  assert.deepEqual(
    sections[1].links.map((l) => l.id),
    ["l1", "l5"],
    "disabled links are excluded"
  );

  assert.equal(sections[3].links.length, 0, "empty groups are kept for the dock");
}

{
  const sections = buildDockSections(links, groups, { keepEmpty: false });
  assert.deepEqual(
    sections.map((s) => s.group?.id ?? null),
    [null, "g-daily", "g-math"],
    "keepEmpty=false drops sections with no links"
  );
}

{
  assert.deepEqual(buildDockSections([], []), [], "no links and no groups yields no sections");
  assert.deepEqual(buildDockSections(null, null), [], "null inputs are tolerated");
}

// --- dockMagnification -----------------------------------------------------

{
  assert.equal(dockMagnification(0, 120, 1.8), 1.8, "peak scale at zero distance");
  assert.equal(dockMagnification(120, 120, 1.8), 1, "back to 1 at the spread edge");
  assert.equal(dockMagnification(400, 120, 1.8), 1, "outside the spread stays at 1");
  assert.equal(
    dockMagnification(-60, 120, 1.8),
    dockMagnification(60, 120, 1.8),
    "curve is symmetric around the pointer"
  );

  const near = dockMagnification(30, 120, 1.8);
  const far = dockMagnification(90, 120, 1.8);
  assert.ok(near > far, "closer icons scale more than distant ones");
  assert.ok(far > 1, "icons inside the spread still scale above 1");

  assert.equal(dockMagnification(10, 0, 1.8), 1, "zero spread disables magnification");
  assert.equal(dockMagnification(10, 120, 1), 1, "maxScale of 1 disables magnification");
  assert.equal(dockMagnification(NaN, 120, 1.8), 1, "non-finite distance is safe");
}

// --- stackGridColumns ------------------------------------------------------

{
  assert.equal(stackGridColumns(9), 3, "a square count uses its own root");
  assert.equal(stackGridColumns(10), 4, "a non-square count rounds the root up");
  assert.equal(stackGridColumns(1), 1, "a single link needs one column");
  assert.equal(stackGridColumns(0), 1, "an empty grid still reports one column");
  assert.equal(stackGridColumns(100), 5, "column count is capped so the panel fits");

  for (let n = 1; n <= 60; n += 1) {
    const cols = stackGridColumns(n);
    assert.ok(cols >= 1 && cols <= 5, `columns stay in range for ${n} links`);
    assert.ok(Number.isInteger(cols), `columns are whole for ${n} links`);
  }
}

// --- groupInitial ----------------------------------------------------------

{
  assert.equal(groupInitial("Mail"), "M", "latin initials are upper-cased");
  assert.equal(groupInitial("mail"), "M", "a lower-case name still yields a capital");
  assert.equal(groupInitial("邮箱"), "邮", "a CJK name keeps its first character");
  assert.equal(groupInitial("  Usage  "), "U", "surrounding space is ignored");
  assert.equal(groupInitial("3D"), "3", "a digit passes through unchanged");
  assert.equal(groupInitial(""), "?", "an empty name falls back to a placeholder");
  assert.equal(groupInitial(null), "?", "a missing name falls back to a placeholder");

  // charAt 会把代理对从中间切开，留下半个码元
  assert.equal(groupInitial("🚀 Launch"), "🚀", "an astral character is not split in half");
}

// --- filterSections --------------------------------------------------------

{
  const sections = buildDockSections(links, groups, { keepEmpty: false });

  assert.equal(filterSections(sections, "").length, 3, "empty query keeps everything");
  assert.equal(filterSections(sections, "   ").length, 3, "whitespace query keeps everything");

  const byName = filterSections(sections, "alph");
  assert.deepEqual(
    byName.map((s) => s.links.map((l) => l.id)),
    [["l1"]],
    "matches link names case-insensitively"
  );

  const byUrl = filterSections(sections, "beta.example");
  assert.deepEqual(
    byUrl.map((s) => s.links.map((l) => l.id)),
    [["l2"]],
    "matches link urls"
  );

  const byGroup = filterSections(sections, "daily");
  assert.deepEqual(
    byGroup.map((s) => s.links.map((l) => l.id)),
    [["l1", "l5"]],
    "a group name match keeps every link in that group"
  );

  assert.deepEqual(filterSections(sections, "zzzz"), [], "no match yields no sections");
}

// --- paginateLaunchpad -----------------------------------------------------

const makeLinks = (n, prefix = "x") =>
  Array.from({ length: n }, (_, i) => ({
    id: prefix + i,
    name: prefix + i,
    url: "https://e.com",
  }));

{
  // 一页是全部内容的一屏：分组连续铺开，装得下就同处一页。
  // 预算 300px 放得下 A(117) + 间距 24 + B(117) = 258，再加 C 就是 399，超了。
  const pages = paginateLaunchpad(
    [
      { group: { id: "a", name: "A" }, links: makeLinks(3, "a") },
      { group: { id: "b", name: "B" }, links: makeLinks(2, "b") },
      { group: { id: "c", name: "C" }, links: makeLinks(1, "c") },
    ],
    { cols: 4, gridHeight: 300 }
  );

  assert.equal(pages.length, 2, "three one-row groups overflow a 300px page");
  assert.deepEqual(
    pages.map((page) => page.map((s) => s.group.id)),
    [["a", "b"], ["c"]],
    "groups run on until the page is full, then continue on the next"
  );
  assert.ok(
    pages.every((page) => page.every((s) => s.continued === false)),
    "a group that is not split is never marked continued"
  );

  const seen = pages.flat().flatMap((s) => s.links.map((l) => l.id));
  assert.equal(seen.length, 6, "every link is placed");
  assert.equal(new Set(seen).size, 6, "no link is placed twice");
}

{
  // 标题按真实高度计价，而不是按一整行图标。这正是原先"页面报告自己满了、
  // 实际只铺到六成"的来源：两个标题凭空吃掉两行图标的高度。
  const oneRow = sectionHeight(4, 4);
  assert.equal(
    oneRow,
    LAUNCHPAD_HEADER_HEIGHT + LAUNCHPAD_ROW_HEIGHT,
    "a one-row group costs its header plus one row of icons"
  );
  assert.ok(
    LAUNCHPAD_HEADER_HEIGHT < LAUNCHPAD_ROW_HEIGHT / 2,
    "a header is far shorter than an icon row, so it must not be priced as one"
  );

  const budget = 3 * oneRow + 2 * LAUNCHPAD_SECTION_GAP;
  const pages = paginateLaunchpad(
    Array.from({ length: 3 }, (_, i) => ({
      group: { id: "g" + i, name: "G" + i },
      links: makeLinks(4, "g" + i),
    })),
    { cols: 4, gridHeight: budget }
  );
  assert.equal(pages.length, 1, "a budget sized for three groups holds exactly three");
  assert.equal(
    launchpadPageHeight(pages[0], 4),
    budget,
    "and fills it to the pixel, with no phantom rows left over"
  );
}

{
  // 每一页都要铺到放不下为止：不能出现"这页还空着一大截、内容却压在下一页"
  const sections = [3, 9, 2, 14, 5, 1].map((n, i) => ({
    group: { id: "s" + i, name: "S" + i },
    links: makeLinks(n, "s" + i),
  }));
  const layout = { cols: 4, gridHeight: 480 };
  const pages = paginateLaunchpad(sections, layout);

  pages.forEach((page, index) => {
    const height = launchpadPageHeight(page, layout.cols);
    assert.ok(
      height <= layout.gridHeight,
      `page ${index} (${height}px) must fit the ${layout.gridHeight}px box`
    );

    const next = pages[index + 1]?.[0];
    if (!next) return;
    const smallest =
      LAUNCHPAD_SECTION_GAP + LAUNCHPAD_HEADER_HEIGHT + LAUNCHPAD_ROW_HEIGHT;
    assert.ok(
      height + smallest > layout.gridHeight,
      `page ${index} broke early: another row still fits in ${layout.gridHeight - height}px`
    );
  });
}

{
  // 分组顺序必须保持，翻页读下来就是原本的排列
  const pages = paginateLaunchpad(
    [
      { group: { id: "a", name: "A" }, links: makeLinks(8, "a") },
      { group: { id: "b", name: "B" }, links: makeLinks(8, "b") },
    ],
    { cols: 4, gridHeight: 300 }
  );
  // 一个分组跨页时会出现多次，所以合并相邻的重复项再比。要保证的是顺序不变、
  // 且两个分组不交错，而不是每个分组只出现一次。
  const order = pages
    .flat()
    .map((s) => s.group.id)
    .filter((id, i, all) => id !== all[i - 1]);
  assert.deepEqual(order, ["a", "b"], "sections keep their order and never interleave");
}

{
  // 只有单个分组装不下整页时才拆，且不能丢链接
  const pages = paginateLaunchpad(
    [{ group: { id: "big", name: "Big" }, links: makeLinks(30, "b") }],
    { cols: 4, rows: 5 }
  );

  assert.equal(pages.length, 2, "16 fit on a page, so 30 needs two");
  assert.equal(pages[0][0].links.length, 16, "the first page fills to capacity");
  assert.equal(pages[0][0].continued, false, "the first chunk is not continued");
  assert.equal(pages[1][0].continued, true, "later chunks are marked continued");

  const seen = pages.flat().flatMap((s) => s.links.map((l) => l.id));
  assert.equal(seen.length, 30, "no link is dropped while splitting");
  assert.equal(new Set(seen).size, 30, "no link is duplicated while splitting");
}

{
  const pages = paginateLaunchpad(
    [
      { group: null, links: makeLinks(2, "u") },
      { group: { id: "a", name: "A" }, links: [] },
    ],
    { cols: 4, rows: 5 }
  );
  assert.equal(pages.length, 1, "an empty group does not take a page");
  assert.equal(pages[0][0].group, null, "the ungrouped section still gets one");
}

{
  assert.deepEqual(paginateLaunchpad([], { cols: 4, rows: 5 }), [], "no sections yields no pages");
  assert.deepEqual(paginateLaunchpad(null, null), [], "null inputs are tolerated");
  assert.equal(launchpadPageHeight([], 4), 0, "an empty page has no height");

  const degenerate = paginateLaunchpad(
    [{ group: { id: "a", name: "A" }, links: makeLinks(3, "a") }],
    { cols: 0, rows: 0 }
  );
  assert.ok(degenerate.length >= 1, "a degenerate layout still places every link");
  assert.equal(
    degenerate.flat().flatMap((s) => s.links).length,
    3,
    "a degenerate layout drops nothing"
  );
}

// --- launchpadLayout -------------------------------------------------------

{
  const wide = launchpadLayout(1920, 1080);
  assert.ok(wide.cols >= 3 && wide.cols <= 8, "columns stay within the clamp");
  assert.ok(wide.rows >= 2 && wide.rows <= 6, "rows stay within the clamp");

  const narrow = launchpadLayout(420, 640);
  assert.ok(narrow.cols >= 3, "narrow viewports still get the minimum columns");
  assert.ok(narrow.cols < wide.cols, "narrow viewports get fewer columns than wide ones");

  const tiny = launchpadLayout(0, 0);
  assert.equal(tiny.cols, 3, "zero width clamps to the minimum columns");
  assert.equal(tiny.rows, 2, "zero height clamps to the minimum rows");

  // 内容区自身有 1024px 上限，列数不能跟着视口一起涨——那正是网格比内容宽、
  // 图标挤在左边的原因
  assert.equal(
    launchpadLayout(3840, 1080).cols,
    launchpadLayout(1440, 1080).cols,
    "columns stop growing once the content box is full, however wide the window"
  );

  // 盒子宽度就是列阵的宽度。两者一旦分开，分组各自居中就会排出互不对齐的列。
  for (const [w, h] of [[1920, 1080], [1366, 768], [420, 640]]) {
    const layout = launchpadLayout(w, h);
    assert.equal(
      layout.gridWidth,
      layout.cols * LAUNCHPAD_CELL + (layout.cols - 1) * LAUNCHPAD_GAP,
      `the box at ${w}x${h} is exactly as wide as its columns`
    );
    assert.ok(layout.gridHeight > 0, `the box at ${w}x${h} has a usable height`);
  }
}

// --- fanCapacity -----------------------------------------------------------

{
  const pitch = FAN_ITEM_HEIGHT + FAN_ITEM_GAP;

  assert.equal(
    fanCapacity(40 * pitch),
    8,
    "a tall window still caps the fan, so it never reaches the search block"
  );
  assert.equal(fanCapacity(0), 1, "no room at all still reports one, never zero");
  assert.equal(fanCapacity(-500), 1, "a nonsense height reports one");

  const roomFor5 = 5 * FAN_ITEM_HEIGHT + 4 * FAN_ITEM_GAP;
  assert.equal(fanCapacity(roomFor5), 5, "a short window follows the real height instead");
  assert.ok(
    fanCapacity(roomFor5 - 1) < 5,
    "one pixel short of five items is four, so the fan never overflows"
  );

  // 单调：窗口变高，能放的只多不少
  let previous = 0;
  for (let h = 0; h <= 40 * pitch; h += 17) {
    const now = fanCapacity(h);
    assert.ok(now >= previous, `capacity must not shrink as height grows (at ${h}px)`);
    previous = now;
  }
}

console.log("[PASS] macos dock tests");
