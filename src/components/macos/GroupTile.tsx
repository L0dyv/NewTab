import { groupInitial } from "@/lib/macosDock";
import { cn } from "@/lib/utils";

/** Dock 图标的边长。DockBar 的尾部按钮要用同一个值才能对齐 */
export const DOCK_TILE_SIZE = 42;

interface GroupTileProps {
  /** 分组名，取首字作为图标上的字形 */
  name: string;
  size?: number;
  className?: string;
}

/**
 * Dock 上代表一个分组的方块：一块玻璃，上面一个衬线字形。
 *
 * 不上色。真实 Dock 上的堆栈本就是半透明的玻璃方块，不是彩色应用图标；
 * 之前按分组散列出配色，等于把"好看"交给随机数决定，排出来一行花方块。
 * 区分靠字形本身，颜色交给玻璃透出的底色。
 *
 * 更早还试过组内 favicon 的 2x2 拼贴，但拼贴有尺寸下限——方块 56px 时每格
 * 只剩 20px，再小就糊了，Dock 因此没法做小。字形没有这个限制。
 */
export default function GroupTile({
  name,
  size = DOCK_TILE_SIZE,
  className,
}: GroupTileProps) {
  const glyph = groupInitial(name);

  return (
    <div
      className={cn(
        "liquid-glass font-glyph flex items-center justify-center overflow-hidden",
        "text-foreground/85",
        className
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.27),
        // 中日韩文字比拉丁字母把字面填得满，所以再收一点
        fontSize: Math.round(size * (/[a-z0-9]/i.test(glyph) ? 0.46 : 0.42)),
        lineHeight: 1,
      }}
    >
      <span className="select-none">{glyph}</span>
    </div>
  );
}
