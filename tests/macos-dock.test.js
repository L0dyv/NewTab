import assert from "node:assert/strict";

import {
  buildDockSections,
  dockMagnification,
  stackGridColumns,
  groupInitial,
  groupSwatchIndex,
  tilePreviewLinks,
  filterSections,
  paginateLaunchpad,
  launchpadLayout,
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

// --- groupSwatchIndex ------------------------------------------------------

{
  const PALETTE = 8;
  const index = groupSwatchIndex("group-1", PALETTE);

  assert.ok(Number.isInteger(index), "the index is a whole number");
  assert.ok(index >= 0 && index < PALETTE, "the index stays inside the palette");
  assert.equal(groupSwatchIndex("group-1", PALETTE), index, "the same id is stable");
  assert.equal(groupSwatchIndex("", PALETTE), groupSwatchIndex("", PALETTE), "an empty id is stable");
  assert.ok(Number.isInteger(groupSwatchIndex(null, PALETTE)), "a missing id does not throw");
  assert.equal(groupSwatchIndex("a", 0), 0, "a degenerate palette size is tolerated");
  assert.equal(groupSwatchIndex("a", 1), 0, "a single-colour palette always picks it");

  // 修复前哈希与 id 线性相关，g1/g2/g3 会依次落到 0/1/2。要防的是这种相关性
  // 本身。不能断言"相邻 id 必不撞色"——8 个颜色配 6 个分组，正确的实现也会撞。
  const sequence = Array.from({ length: 16 }, (_, i) => groupSwatchIndex(`g${i}`, PALETTE));
  const tracksTheIds = sequence.every(
    (value, i) => i === 0 || value === (sequence[i - 1] + 1) % PALETTE
  );
  assert.ok(!tracksTheIds, "swatch choice must not simply follow the id sequence");

  // 分布要大致均匀，而不是挤在少数几个颜色上
  const counts = new Array(PALETTE).fill(0);
  const samples = 400;
  for (let i = 0; i < samples; i += 1) {
    counts[groupSwatchIndex(`group-${i}`, PALETTE)] += 1;
  }
  const even = samples / PALETTE;
  for (const count of counts) {
    assert.ok(
      count > even * 0.5 && count < even * 1.7,
      `a palette entry drew ${count} of ${samples}, far from an even ${even}`
    );
  }
}

// --- tilePreviewLinks ------------------------------------------------------

{
  assert.deepEqual(tilePreviewLinks([1, 2, 3, 4, 5, 6]), [1, 2, 3, 4], "takes at most four tiles");
  assert.deepEqual(tilePreviewLinks([1, 2]), [1, 2], "shorter groups pass through");
  assert.deepEqual(tilePreviewLinks([], 4), [], "empty group yields no tiles");
  assert.deepEqual(tilePreviewLinks(null), [], "null is tolerated");
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
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix}${i}`, url: "https://e.com" }));

{
  const pages = paginateLaunchpad(
    [{ group: { id: "a", name: "A" }, links: makeLinks(3, "a") }],
    { cols: 4, rows: 5 }
  );
  assert.equal(pages.length, 1, "a small section fits on one page");
  assert.equal(pages[0][0].continued, false, "first chunk is not marked continued");
}

{
  // 每页 5 行：区段一占 1+1=2 行，区段二占 1+2=3 行，正好填满一页。
  const pages = paginateLaunchpad(
    [
      { group: { id: "a", name: "A" }, links: makeLinks(4, "a") },
      { group: { id: "b", name: "B" }, links: makeLinks(8, "b") },
      { group: { id: "c", name: "C" }, links: makeLinks(2, "c") },
    ],
    { cols: 4, rows: 5 }
  );

  assert.equal(pages.length, 2, "the third section spills to a second page");
  assert.deepEqual(pages[0].map((s) => s.group.id), ["a", "b"], "first page holds A and B");
  assert.deepEqual(pages[1].map((s) => s.group.id), ["c"], "second page holds C");
}

{
  // 单个区段超过整页容量时必须拆开，且不能丢链接。
  const pages = paginateLaunchpad(
    [{ group: { id: "big", name: "Big" }, links: makeLinks(30, "b") }],
    { cols: 4, rows: 5 }
  );

  assert.ok(pages.length > 1, "an oversized section splits across pages");
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
  assert.equal(pages.length, 1, "empty sections do not create pages");
  assert.equal(pages[0].length, 1, "empty sections are skipped entirely");
}

{
  assert.deepEqual(paginateLaunchpad([], { cols: 4, rows: 5 }), [], "no sections yields no pages");
  assert.deepEqual(paginateLaunchpad(null, null), [], "null inputs are tolerated");

  const degenerate = paginateLaunchpad(
    [{ group: { id: "a", name: "A" }, links: makeLinks(3, "a") }],
    { cols: 0, rows: 0 }
  );
  assert.ok(degenerate.length >= 1, "degenerate layout still places every link");
  assert.equal(
    degenerate.flat().flatMap((s) => s.links).length,
    3,
    "degenerate layout drops nothing"
  );
}

// --- launchpadLayout -------------------------------------------------------

{
  const wide = launchpadLayout(1920, 1080);
  assert.ok(wide.cols >= 2 && wide.cols <= 9, "columns stay within the clamp");
  assert.ok(wide.rows >= 2, "rows never fall below two");

  const narrow = launchpadLayout(420, 640);
  assert.ok(narrow.cols >= 2, "narrow viewports still get at least two columns");
  assert.ok(narrow.cols < wide.cols, "narrow viewports get fewer columns than wide ones");

  const tiny = launchpadLayout(0, 0);
  assert.equal(tiny.cols, 2, "zero width clamps to the minimum columns");
  assert.equal(tiny.rows, 2, "zero height clamps to the minimum rows");
}

console.log("[PASS] macos dock tests");
