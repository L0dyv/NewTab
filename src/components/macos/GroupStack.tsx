import QuickLinkIcon from "@/components/QuickLinkIcon";
import { useI18n } from "@/hooks/useI18n";
import { stackGridColumns } from "@/lib/macosDock";
import { ensureUrlHasProtocol } from "@/lib/url";
import { cn } from "@/lib/utils";
import LinkContextMenu, { type LinkActions } from "./LinkContextMenu";
import LinkTile from "./LinkTile";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

/** 超过这个数量就从扇形切到网格，和 macOS 的堆栈一样 */
export const FAN_MAX_ITEMS = 8;

/** 扇形里图标的边长，DockBar 计算锚点时要用同一个值。
 *  favicon 多半是 16 或 32px 的位图，画得比源图大就会糊，所以压在 28。*/
export const FAN_ICON_SIZE = 28;

interface GroupStackProps extends LinkActions {
  group: QuickLinkGroup | null;
  links: QuickLink[];
  groups: QuickLinkGroup[];
  /** 面板或图标列相对 Dock 容器的横向位置，由 DockBar 算好并已做边界收拢 */
  anchorX: number;
  /** 扇形里名称挂在图标的哪一侧，靠近屏幕左缘时翻到右侧 */
  fanSide: "left" | "right";
  onOpenLink: () => void;
}

/**
 * Dock 分组展开后的堆栈。
 *
 * 链接少时用扇形：图标竖直排开，各自独立漂浮，没有容器面板，名称是挂在图标
 * 旁边的独立药丸——这是 macOS 堆栈展开的实际形态。链接多了扇形会顶出屏幕，
 * 这时切换到带面板的网格。
 */
export default function GroupStack({
  group,
  links,
  groups,
  anchorX,
  fanSide,
  onCopy,
  onMoveToGroup,
  onRemove,
  onOpenLink,
}: GroupStackProps) {
  const { t } = useI18n();
  const groupName = group ? group.name : t("quickLinks.ungrouped");

  if (links.length === 0) {
    return (
      <div
        className="absolute bottom-full z-20 mb-6 -translate-x-1/2 animate-stack-in"
        style={{ left: anchorX }}
      >
        <div className="liquid-glass liquid-glass-floating whitespace-nowrap rounded-full px-4 py-2 text-xs text-muted-foreground">
          {t("dock.emptyGroup")}
        </div>
      </div>
    );
  }

  // --- 扇形 ---------------------------------------------------------------
  if (links.length <= FAN_MAX_ITEMS) {
    const labelsLeft = fanSide === "left";

    return (
      <div
        className="absolute bottom-full z-20 mb-6"
        style={{
          left: labelsLeft ? anchorX + FAN_ICON_SIZE / 2 : anchorX - FAN_ICON_SIZE / 2,
          transform: labelsLeft ? "translateX(-100%)" : undefined,
        }}
      >
        {/* flex-col-reverse 让第一个链接落在最靠近 Dock 的一端 */}
        <div
          className={cn(
            "flex flex-col-reverse gap-3",
            labelsLeft ? "items-end" : "items-start"
          )}
        >
          {links.map((link, index) => (
            <LinkContextMenu
              key={link.id}
              link={link}
              groups={groups}
              onCopy={onCopy}
              onMoveToGroup={onMoveToGroup}
              onRemove={onRemove}
            >
              <a
                href={ensureUrlHasProtocol(link.url)}
                title={link.name}
                onClick={onOpenLink}
                // 逐项延迟，展开时像依次弹出而不是整块出现
                style={{ animationDelay: `${index * 35}ms` }}
                className={cn(
                  "group animate-stack-in flex items-center gap-2.5 outline-none",
                  !labelsLeft && "flex-row-reverse"
                )}
              >
                <span className="liquid-glass liquid-glass-floating max-w-[11rem] truncate rounded-full px-2.5 py-1 text-[11px] text-foreground">
                  {link.name}
                </span>
                <span className="block transition-transform duration-200 group-hover:scale-110 group-focus-visible:scale-110">
                  <QuickLinkIcon
                    name={link.name}
                    url={link.url}
                    icon={link.icon}
                    size={FAN_ICON_SIZE}
                  />
                </span>
              </a>
            </LinkContextMenu>
          ))}
        </div>
      </div>
    );
  }

  // --- 网格 ---------------------------------------------------------------
  const columns = stackGridColumns(links.length);

  return (
    <div
      className="absolute bottom-full z-20 mb-6 -translate-x-1/2 animate-stack-in"
      style={{ left: anchorX }}
    >
      <div className="liquid-glass liquid-glass-floating rounded-2xl px-3 pb-3 pt-2">
        <div className="select-none px-1 pb-2 text-center text-[11px] font-medium tracking-wide text-muted-foreground">
          {groupName}
        </div>
        <div
          className="grid max-h-[52vh] gap-1 overflow-y-auto scrollbar-hide"
          style={{ gridTemplateColumns: `repeat(${columns}, 5rem)` }}
        >
          {links.map((link) => (
            <LinkTile
              key={link.id}
              link={link}
              groups={groups}
              iconSize={28}
              onCopy={onCopy}
              onMoveToGroup={onMoveToGroup}
              onRemove={onRemove}
              onOpen={onOpenLink}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
