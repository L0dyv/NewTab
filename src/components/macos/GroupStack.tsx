import { useI18n } from "@/hooks/useI18n";
import LinkTile from "./LinkTile";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

interface GroupStackProps {
  group: QuickLinkGroup | null;
  links: QuickLink[];
  groups: QuickLinkGroup[];
  /** 面板中心相对 Dock 容器的横向位置，由 DockBar 算好并已做边界收拢 */
  anchorX: number;
  onCopy: (url: string) => void;
  onMoveToGroup: (linkId: string, groupId: string | undefined) => void;
  onRemove: (linkId: string) => void;
  onOpenLink: () => void;
}

/**
 * Dock 分组展开后的堆栈面板，浮在 Dock 上方。
 * 链接数量决定列数，最多五列；再多则纵向滚动，避免面板长到出屏。
 */
export default function GroupStack({
  group,
  links,
  groups,
  anchorX,
  onCopy,
  onMoveToGroup,
  onRemove,
  onOpenLink,
}: GroupStackProps) {
  const { t } = useI18n();
  const columns = Math.max(1, Math.min(5, links.length));

  return (
    <div
      className="absolute bottom-full mb-3 -translate-x-1/2 animate-stack-in z-20"
      style={{ left: anchorX }}
    >
      <div className="liquid-glass rounded-2xl px-3 pb-3 pt-2 shadow-xl">
        <div className="px-1 pb-2 text-center text-[11px] font-medium tracking-wide text-muted-foreground select-none">
          {group ? group.name : t("quickLinks.ungrouped")}
        </div>

        {links.length === 0 ? (
          <div className="px-6 py-4 text-center text-xs text-muted-foreground/70 select-none">
            {t("dock.emptyGroup")}
          </div>
        ) : (
          <div
            className="grid gap-1 max-h-[52vh] overflow-y-auto scrollbar-hide"
            style={{ gridTemplateColumns: `repeat(${columns}, 5rem)` }}
          >
            {links.map((link) => (
              <LinkTile
                key={link.id}
                link={link}
                groups={groups}
                iconSize={34}
                onCopy={onCopy}
                onMoveToGroup={onMoveToGroup}
                onRemove={onRemove}
                onOpen={onOpenLink}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
