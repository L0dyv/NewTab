import assert from "node:assert/strict";

import {
  buildDockSections,
  dockMagnification,
  stackGridColumns,
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
