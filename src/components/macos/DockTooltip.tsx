import { cn } from "@/lib/utils";

interface DockTooltipProps {
  label: string;
  visible: boolean;
  className?: string;
}

/**
 * Dock 图标的悬浮名称气泡。
 *
 * macOS 的 Dock 不挂常驻标签，只在指针悬停时弹出名称，图标本身靠外观辨认。
 * 气泡挂在放大层 .dock-item 之外，否则会跟着图标一起被缩放。
 *
 * 名称挂在 Dock 下方而不是上方。上方是堆栈展开的地方：悬停到一半堆栈就顶了
 * 上来，名字要么被盖住、要么为了避让而提前消失，等于没有。下方没有东西跟它
 * 争位置，指着哪一项，哪一项的名字就一直在。
 * 放大是以底边为原点向上长的，所以图标不会向下侵入这里，留一点间距即可。
 */
export default function DockTooltip({ label, visible, className }: DockTooltipProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-full left-1/2 z-30 mt-5 -translate-x-1/2",
        "transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
    >
      <span className="liquid-glass liquid-glass-floating block whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] leading-none text-foreground">
        {label}
      </span>
    </div>
  );
}
