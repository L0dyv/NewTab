import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(__dirname, "../src/components/HomepageGroupFilter.tsx"),
  "utf8"
);

assert.doesNotMatch(
  source,
  /setActivatorNodeRef|GripVertical/,
  "homepage group tabs should not render a dedicated drag handle"
);

assert.match(
  source,
  /<button[\s\S]*?\{\.\.\.attributes\}[\s\S]*?\{\.\.\.listeners\}/,
  "homepage group tab button should receive dnd-kit listeners"
);

const mainTabButtonPattern = /<button\s+ref=\{setNodeRef\}[\s\S]*?type="button"[\s\S]*?className=\{tabClass\(isActive\)\}[\s\S]*?onClick=\{\(\) => onTabChange\(group\.id\)\}[\s\S]*?\{\.\.\.attributes\}[\s\S]*?\{\.\.\.listeners\}/;
assert.match(
  source,
  mainTabButtonPattern,
  "homepage group tabs should use the whole pill as both click target and drag target"
);

console.log("[PASS] homepage group filter structure tests");
