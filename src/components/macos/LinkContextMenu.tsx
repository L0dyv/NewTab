import { useRef, type ReactNode } from "react";
import { Copy, FolderInput, Pencil, Trash2 } from "lucide-react";
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
  onRename: (linkId: string, name: string) => void;
  onCopy: (url: string) => void;
  onMoveToGroup: (linkId: string, groupId: string | undefined) => void;
  onRemove: (linkId: string) => void;
}

interface LinkContextMenuProps extends Omit<LinkActions, "onRename"> {
  link: QuickLink;
  groups: QuickLinkGroup[];
  children: ReactNode;
  onStartRename: () => void;
}

/**
 * 快速链接的右键菜单。堆栈的扇形与网格两种形态、以及 Launchpad 都用它，
 * 菜单项只在这里维护一份。
 */
export default function LinkContextMenu({
  link,
  groups,
  children,
  onStartRename,
  onCopy,
  onMoveToGroup,
  onRemove,
}: LinkContextMenuProps) {
  const { t } = useI18n();
  const hasAnyGroup = groups.length > 0;
  const renamingRef = useRef(false);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        onCloseAutoFocus={(e) => {
          // 菜单退场动画结束后 Radix 默认会把焦点还给触发器（或打开菜单前聚焦
          // 的筛选框），那会让刚打开的重命名输入框立刻失焦并提前收起。
          if (renamingRef.current) {
            e.preventDefault();
            renamingRef.current = false;
          }
        }}
      >
        <ContextMenuItem
          onSelect={() => {
            renamingRef.current = true;
            onStartRename();
          }}
        >
          <Pencil className="mr-2 h-4 w-4" />
          {t("contextMenu.rename")}
        </ContextMenuItem>

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
