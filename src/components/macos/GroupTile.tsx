import { resolveGroupTileVisual } from "@/lib/macosDock";
import { cn } from "@/lib/utils";
import GroupIconGlyph from "./groupIcons";
import type { QuickLinkGroup } from "@/lib/types";

/** Dock 图标的边长。DockBar 的尾部按钮要用同一个值才能对齐 */
export const DOCK_TILE_SIZE = 42;

interface GroupTileProps {
  /** 分组对象；为 null 时代表“未分组”（固定渲染收件匣图标） */
  group: QuickLinkGroup | null;
  size?: number;
  className?: string;
}

/**
 * Dock 上代表一个分组的微瓷方块：统一单色线性图标（与页面右上角工具栏同笔触），
 * 支持按组名默认推断、右键自选图标，或切换为现代无饰线首字母。
 */
export default function GroupTile({
  group,
  size = DOCK_TILE_SIZE,
  className,
}: GroupTileProps) {
  const visual = resolveGroupTileVisual(group);

  return (
    <div
      className={cn(
        "dock-tile flex items-center justify-center overflow-hidden transition-colors",
        group ? "text-foreground/80 hover:text-foreground" : "text-foreground/70 hover:text-foreground",
        className
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
      }}
    >
      {visual.kind === "initial" ? (
        <span
          className="select-none font-semibold tracking-tight"
          style={{
            fontSize: Math.round(size * (/[a-z0-9]/i.test(visual.glyph) ? 0.4 : 0.38)),
            lineHeight: 1,
          }}
        >
          {visual.glyph}
        </span>
      ) : (
        <GroupIconGlyph
          iconKey={visual.iconKey}
          size={Math.round(size * 0.46)}
        />
      )}
    </div>
  );
}
