import assert from "node:assert/strict";

import {
  updateQuickLinkDraft,
  applyQuickLinkEdit,
  renameQuickLinkGroup,
  deleteQuickLinkGroup,
  reorderQuickLinkGroups,
  sortQuickLinkGroups,
} from "../src/lib/quickLinkGroups.js";

const links = [
  {
    id: "link-1",
    name: "Alpha",
    url: "https://alpha.example.com",
    enabled: true,
  },
  {
    id: "link-2",
    name: "Beta",
    url: "https://beta.example.com",
    enabled: true,
    groupId: "group-b",
  },
];

const initialDraft = {
  name: "Beta",
  url: "https://beta.example.com",
  groupId: "group-b",
};

const groups = [
  {
    id: "group-a",
    name: "Alpha Group",
    order: 0,
  },
  {
    id: "group-b",
    name: "Beta Group",
    order: 1,
  },
  {
    id: "group-c",
    name: "Gamma Group",
    order: 2,
  },
];

assert.deepEqual(
  updateQuickLinkDraft(initialDraft, {
    groupId: "group-a",
  }),
  {
    name: "Beta",
    url: "https://beta.example.com",
    groupId: "group-a",
  }
);

assert.deepEqual(
  applyQuickLinkEdit(links, "link-2", {
    name: "Beta Docs",
    url: "https://docs.beta.example.com",
    groupId: "group-a",
  }),
  [
    links[0],
    {
      id: "link-2",
      name: "Beta Docs",
      url: "https://docs.beta.example.com",
      enabled: true,
      groupId: "group-a",
    },
  ]
);

assert.deepEqual(
  renameQuickLinkGroup(groups, "group-b", "Docs"),
  [
    groups[0],
    {
      id: "group-b",
      name: "Docs",
      order: 1,
    },
    groups[2],
  ]
);

assert.deepEqual(
  reorderQuickLinkGroups(groups, "group-c", "group-a"),
  [
    {
      id: "group-c",
      name: "Gamma Group",
      order: 0,
    },
    {
      id: "group-a",
      name: "Alpha Group",
      order: 1,
    },
    {
      id: "group-b",
      name: "Beta Group",
      order: 2,
    },
  ]
);

assert.deepEqual(
  deleteQuickLinkGroup(groups, links, "group-b"),
  {
    groups: [
      groups[0],
      groups[2],
    ],
    links: [
      links[0],
      {
        id: "link-2",
        name: "Beta",
        url: "https://beta.example.com",
        enabled: true,
        groupId: undefined,
      },
    ],
  }
);

assert.deepEqual(
  sortQuickLinkGroups([
    groups[2],
    groups[0],
    groups[1],
  ]),
  [
    groups[0],
    groups[1],
    groups[2],
  ]
);

assert.deepEqual(
  groups,
  [
    {
      id: "group-a",
      name: "Alpha Group",
      order: 0,
    },
    {
      id: "group-b",
      name: "Beta Group",
      order: 1,
    },
    {
      id: "group-c",
      name: "Gamma Group",
      order: 2,
    },
  ]
);

console.log("[PASS] quick link groups tests");
