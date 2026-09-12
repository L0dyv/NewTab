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
 * 气泡挂在放大层 .dock-item 之外，否则会跟着图标一起被缩放；留出的下边距
 * 要够放大后的图标向上长出的高度，避免两者重叠。
 */
export default function DockTooltip({ label, visible, className }: DockTooltipProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute bottom-full left-1/2 z-30 mb-8 -translate-x-1/2",
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
