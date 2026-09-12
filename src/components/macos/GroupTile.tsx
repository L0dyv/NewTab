import { groupInitial, groupSwatchIndex } from "@/lib/macosDock";
import { cn } from "@/lib/utils";

/** Dock 图标的边长。DockBar 的尾部按钮要用同一个值才能对齐 */
export const DOCK_TILE_SIZE = 40;

/**
 * 分组配色板。
 *
 * 手工挑定而不是让色相自由取值：色相环上有橄榄绿、荧光紫这类怎么调都难看的
 * 区段；而且 HSL 的 L 不是感知明度，同一个 L 下黄绿比蓝紫亮得多，一排方块会
 * 明暗不齐。这里每一项的明度都是单独压过的，整排看起来才像一个家族。
 * 饱和度压得比较低，配合页面的暖中性底色。
 */
const SWATCHES = [
  { h: 212, s: 34, l: 52 },
  { h: 174, s: 30, l: 40 },
  { h: 258, s: 28, l: 58 },
  { h: 344, s: 33, l: 57 },
  { h: 26, s: 38, l: 49 },
  { h: 152, s: 26, l: 39 },
  { h: 292, s: 24, l: 55 },
  { h: 200, s: 32, l: 45 },
];

/** 未分组不是用户建的分组，用中性灰把它和彩色分组分开 */
const NEUTRAL_SWATCH = { h: 30, s: 5, l: 52 };

interface GroupTileProps {
  /** 分组名，取首字作为图标上的字形 */
  name: string;
  /** 配色的散列种子，用分组 id：改名后颜色不应该跟着变 */
  seed: string;
  neutral?: boolean;
  size?: number;
  className?: string;
}

/**
 * Dock 上代表一个分组的方块：一个字形加一层按分组分配的配色。
 *
 * 早先这里放的是组内前四个 favicon 拼成的 2x2 缩略图，但拼贴有尺寸下限——
 * 方块 56px 时每格只剩 20px，再缩就糊成色块，Dock 也就没法做小。换成字形
 * 之后这个约束消失了。组内有什么，展开扇形时立刻能看到，不必在 Dock 上再
 * 表达一次。
 */
export default function GroupTile({
  name,
  seed,
  neutral = false,
  size = DOCK_TILE_SIZE,
  className,
}: GroupTileProps) {
  const glyph = groupInitial(name);
  const swatch = neutral
    ? NEUTRAL_SWATCH
    : SWATCHES[groupSwatchIndex(seed, SWATCHES.length)];

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden font-medium text-white",
        className
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.27),
        // 中日韩文字比拉丁字母把字面填得满，所以再收一点
        fontSize: Math.round(size * (/[a-z0-9]/i.test(glyph) ? 0.45 : 0.4)),
        lineHeight: 1,
        background: `linear-gradient(160deg,
          hsl(${swatch.h} ${swatch.s}% ${swatch.l + 8}%) 0%,
          hsl(${(swatch.h + 14) % 360} ${swatch.s}% ${swatch.l}%) 100%)`,
        boxShadow: `inset 0 1px 0 0 rgba(255, 255, 255, 0.22),
          0 1px 2px 0 rgba(41, 37, 36, 0.16)`,
      }}
    >
      <span className="select-none">{glyph}</span>
    </div>
  );
}
