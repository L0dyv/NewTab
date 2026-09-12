import { Copy, FolderInput, Trash2 } from "lucide-react";
import QuickLinkIcon from "@/components/QuickLinkIcon";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useI18n } from "@/hooks/useI18n";
import { ensureUrlHasProtocol } from "@/lib/url";
import { sortQuickLinkGroups } from "@/lib/quickLinkGroups";
import { cn } from "@/lib/utils";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

interface LinkTileProps {
  link: QuickLink;
  groups: QuickLinkGroup[];
  iconSize?: number;
  className?: string;
  onCopy: (url: string) => void;
  onMoveToGroup: (linkId: string, groupId: string | undefined) => void;
  onRemove: (linkId: string) => void;
  onOpen?: () => void;
}

/**
 * 图标加名称的链接单元格，堆栈与 Launchpad 共用。
 * 名称始终可见是这次改版的核心诉求，所以这里不做悬浮才显示的处理；
 * 名称最多两行，超出省略，完整名称仍留在 title 里兜底。
 */
export default function LinkTile({
  link,
  groups,
  iconSize = 40,
  className,
  onCopy,
  onMoveToGroup,
  onRemove,
  onOpen,
}: LinkTileProps) {
  const { t } = useI18n();
  const hasAnyGroup = groups.length > 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <a
          href={ensureUrlHasProtocol(link.url)}
          title={link.name}
          onClick={onOpen}
          className={cn(
            "group flex flex-col items-center gap-2 rounded-xl px-2 py-3",
            "hover:bg-foreground/[0.06] active:bg-foreground/[0.1]",
            "transition-colors duration-150 cursor-pointer outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          <div className="transition-transform duration-200 group-hover:scale-110">
            <QuickLinkIcon name={link.name} url={link.url} icon={link.icon} size={iconSize} />
          </div>
          <span className="w-full text-center text-[11px] leading-tight text-foreground/80 line-clamp-2 break-words">
            {link.name}
          </span>
        </a>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={() => onCopy(link.url)}>
          <Copy className="mr-2 h-4 w-4" />
          {t("contextMenu.copyLink")}
        </ContextMenuItem>

        {hasAnyGroup && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <FolderInput className="mr-2 h-4 w-4" />
              {t("contextMenu.moveToGroup")}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem
                onClick={() => onMoveToGroup(link.id, undefined)}
                disabled={!link.groupId}
              >
                {t("contextMenu.ungrouped")}
              </ContextMenuItem>
              <ContextMenuSeparator />
              {sortQuickLinkGroups(groups).map((group) => (
                <ContextMenuItem
                  key={group.id}
                  onClick={() => onMoveToGroup(link.id, group.id)}
                  disabled={link.groupId === group.id}
                >
                  {group.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onRemove(link.id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("contextMenu.delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
