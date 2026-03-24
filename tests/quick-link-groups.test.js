import assert from "node:assert/strict";

import {
  updateQuickLinkDraft,
  applyQuickLinkEdit,
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

console.log("[PASS] quick link groups tests");
