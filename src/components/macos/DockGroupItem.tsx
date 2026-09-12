import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Trash2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";
import GroupTile from "./GroupTile";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

export interface DockGroupItemProps {
  group: QuickLinkGroup | null;
  links: QuickLink[];
  isOpen: boolean;
  /** 未分组这一项不参与排序，也不能重命名或删除 */
  sortable: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  onActivate: () => void;
  onHover: () => void;
  onRename?: (groupId: string, name: string) => void;
  onDelete?: (groupId: string) => void;
  onEditingChange?: (editing: boolean) => void;
}

/**
 * Dock 上的一个分组。
 *
 * 外层节点承载 dnd-kit 的拖拽位移，内层 .dock-item 承载指针放大，
 * 两个 transform 分开写在不同元素上，否则会互相覆盖。
 */
export default function DockGroupItem({
  group,
  links,
  isOpen,
  sortable,
  registerRef,
  onActivate,
  onHover,
  onRename,
  onDelete,
  onEditingChange,
}: DockGroupItemProps) {
  const { t } = useI18n();
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const sortableState = useSortable({ id: group?.id ?? "__ungrouped__", disabled: !sortable });
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = sortableState;

  useEffect(() => {
    if (isRenaming) inputRef.current?.select();
  }, [isRenaming]);

  useEffect(() => {
    onEditingChange?.(isRenaming);
  }, [isRenaming, onEditingChange]);

  const startRename = () => {
    if (!group) return;
    setDraftName(group.name);
    setIsRenaming(true);
  };

  const commitRename = () => {
    const name = draftName.trim();
    if (group && name && name !== group.name) {
      onRename?.(group.id, name);
    }
    setIsRenaming(false);
  };

  const confirmDelete = () => {
    if (!group) return;
    const ok = window.confirm(
      `${t("quickLinks.deleteGroupConfirm")}\n${t("quickLinks.deleteGroupWarning")}`
    );
    if (ok) onDelete?.(group.id);
  };

  const label = group ? group.name : t("quickLinks.ungrouped");

  const body = (
    <div
      ref={(el) => {
        setNodeRef(el);
        registerRef(el);
      }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : undefined,
      }}
      className={cn("flex-shrink-0", isDragging && "opacity-80")}
      {...attributes}
      {...listeners}
    >
      <div className="dock-item flex w-16 flex-col items-center gap-1">
        <button
          type="button"
          title={label}
          aria-label={label}
          aria-expanded={isOpen}
          onClick={onActivate}
          onMouseEnter={onHover}
          onFocus={onHover}
          className="rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GroupTile links={links} size={48} />
        </button>

        {isRenaming ? (
          <input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setIsRenaming(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-[74px] rounded-md border border-border bg-card px-1 py-0.5 text-center text-[10px] text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <span className="max-w-full truncate text-[10px] leading-none text-foreground/70 select-none">
            {label}
          </span>
        )}

        {/* 展开状态指示点，对应 macOS Dock 上已打开应用的圆点 */}
        <span
          className={cn(
            "h-1 w-1 rounded-full transition-opacity duration-150",
            isOpen ? "dock-open-dot bg-foreground/70 opacity-100" : "opacity-0"
          )}
        />
      </div>
    </div>
  );

  // 未分组没有可管理的实体，不挂右键菜单
  if (!group) return body;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{body}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={startRename}>
          <Pencil className="mr-2 h-4 w-4" />
          {t("quickLinks.renameGroup")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={confirmDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("quickLinks.deleteGroup")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
