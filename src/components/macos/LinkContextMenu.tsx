import type { ReactNode } from "react";
import { Copy, FolderInput, Trash2 } from "lucide-react";
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
import { sortQuickLinkGroups } from "@/lib/quickLinkGroups";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

export interface LinkActions {
  onCopy: (url: string) => void;
  onMoveToGroup: (linkId: string, groupId: string | undefined) => void;
  onRemove: (linkId: string) => void;
}

interface LinkContextMenuProps extends LinkActions {
  link: QuickLink;
  groups: QuickLinkGroup[];
  children: ReactNode;
}

/**
 * 快速链接的右键菜单。堆栈的扇形与网格两种形态、以及 Launchpad 都用它，
 * 菜单项只在这里维护一份。
 */
export default function LinkContextMenu({
  link,
  groups,
  children,
  onCopy,
  onMoveToGroup,
  onRemove,
}: LinkContextMenuProps) {
  const { t } = useI18n();
  const hasAnyGroup = groups.length > 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
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
