import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.join(__dirname, relative), "utf8");

const dockBar = read("../src/components/macos/DockBar.tsx");
const dockGroupItem = read("../src/components/macos/DockGroupItem.tsx");
const css = read("../src/index.css");

// --- 两个 transform 必须分开挂 ---------------------------------------------
// dnd-kit 的拖拽位移和指针放大都写 transform，挂在同一个元素上会互相覆盖：
// 拖动时图标不跟手，或者放大时排序预览错位。

{
  const dndTransformBlock = dockGroupItem.match(
    /transform:\s*CSS\.Transform\.toString\(transform\)/
  );
  assert.ok(dndTransformBlock, "sortable node still applies the dnd-kit transform");

  // 承载 dnd transform 的那个 div 的开标签里不能出现 dock-item
  const outerTag = dockGroupItem.slice(
    dockGroupItem.lastIndexOf("<div", dndTransformBlock.index),
    dockGroupItem.indexOf(">", dndTransformBlock.index)
  );
  assert.doesNotMatch(
    outerTag,
    /dock-item/,
    "the dnd-kit transform node must not also carry the magnification class"
  );

  assert.match(
    dockGroupItem,
    /className="dock-item/,
    "magnification lives on a nested .dock-item element"
  );
}

// --- 放大不能走 React 状态 -------------------------------------------------
// 指针每移动一次就 setState 会重渲整条 Dock，跟手的放大必须直接写 DOM。

{
  const handler = dockBar.match(
    /const handlePointerMove[\s\S]*?\n  \};/
  );
  assert.ok(handler, "DockBar exposes a pointer move handler");
  assert.doesNotMatch(
    handler[0],
    /\bset[A-Z]\w*\(/,
    "pointer move must not trigger a React state update"
  );
  assert.match(
    handler[0],
    /scheduleMagnification\(\)/,
    "pointer move defers to the rAF-scheduled magnification pass"
  );

  assert.match(
    dockBar,
    /requestAnimationFrame\(applyMagnification\)/,
    "magnification is applied inside requestAnimationFrame"
  );
  assert.match(
    dockBar,
    /style\.setProperty\("--dock-scale"/,
    "magnification writes the scale straight to the DOM"
  );
}

// --- rAF 与定时器必须清理 --------------------------------------------------

{
  assert.match(
    dockBar,
    /cancelAnimationFrame\(rafRef\.current\)/,
    "a pending animation frame is cancelled on unmount"
  );
  assert.match(
    dockBar,
    /clearTimeout\(hoverTimerRef\.current\)/,
    "the hover-open timer is cleared on unmount"
  );
  assert.match(
    dockBar,
    /clearTimeout\(closeTimerRef\.current\)/,
    "the hover-close timer is cleared on unmount"
  );
}

// --- 液态玻璃要同时定义浅色与深色 ------------------------------------------

{
  assert.match(css, /\.liquid-glass\s*\{/, "the liquid glass skin is defined");
  assert.match(css, /\.dark \.liquid-glass\s*\{/, "the liquid glass skin has a dark variant");
  assert.match(
    css,
    /-webkit-backdrop-filter:/,
    "backdrop-filter carries the -webkit- prefix for older Chromium"
  );

  // 反光必须是叠加背景层：绝对定位伪元素的包含块是 padding box，
  // 在有内边距的面板上会缩进一圈，露出没有反光的边。
  assert.doesNotMatch(
    css,
    /\.liquid-glass::before/,
    "the specular sheen must be a background layer, not an inset pseudo-element"
  );
}

// --- 降低动态效果偏好 ------------------------------------------------------

{
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)/,
    "animations respect the reduced motion preference"
  );
}

console.log("[PASS] macos dock structure tests");
