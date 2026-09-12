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
import DockTooltip from "./DockTooltip";
import type { QuickLinkGroup } from "@/lib/types";

export interface DockGroupItemProps {
  group: QuickLinkGroup | null;
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
 * 名称不常驻，只在悬停时以气泡弹出，与 macOS Dock 一致。
 */
export default function DockGroupItem({
  group,
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
  const [hovered, setHovered] = useState(false);
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
      className={cn("relative flex-shrink-0", isDragging && "opacity-80")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...attributes}
      {...listeners}
    >
      {/* 堆栈展开后面板标题里已经有分组名，气泡就不再重复 */}
      {isRenaming ? (
        <div className="absolute bottom-full left-1/2 z-30 mb-8 -translate-x-1/2">
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
            className="liquid-glass w-28 rounded-lg px-2 py-1 text-center text-[11px] leading-none text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      ) : (
        <DockTooltip label={label} visible={hovered && !isDragging && !isOpen} />
      )}

      <div className="dock-item flex flex-col items-center gap-1.5">
        <button
          type="button"
          title=""
          aria-label={label}
          aria-expanded={isOpen}
          onClick={onActivate}
          onMouseEnter={onHover}
          onFocus={() => {
            setHovered(true);
            onHover();
          }}
          onBlur={() => setHovered(false)}
          className="rounded-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GroupTile name={label} seed={group?.id ?? "__ungrouped__"} neutral={!group} />
        </button>

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
