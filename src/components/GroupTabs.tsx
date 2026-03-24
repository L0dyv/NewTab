import { useState, useRef, useEffect } from "react";
import { Plus, Check, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useI18n } from "@/hooks/useI18n";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  deleteQuickLinkGroup,
  renameQuickLinkGroup,
  reorderQuickLinkGroups,
} from "@/lib/quickLinkGroups";

interface GroupTabsProps {
  groups: QuickLinkGroup[];
  links: QuickLink[];
  activeGroupFilter: string; // 'all' | '__ungrouped__' | group.id
  onActiveGroupFilterChange: (filter: string) => void;
  onGroupsChange: (groups: QuickLinkGroup[]) => void;
  onLinksChange: (links: QuickLink[]) => void;
}

// Sortable wrapper for individual group tabs
function SortableGroupTab({
  group,
  isActive,
  isRenaming,
  renamingName,
  linkCount,
  tabClass,
  onTabClick,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  onStartRename,
  onDeleteRequest,
  renameInputRef,
  t,
}: {
  group: QuickLinkGroup;
  isActive: boolean;
  isRenaming: boolean;
  renamingName: string;
  linkCount: number;
  tabClass: (active: boolean) => string;
  onTabClick: () => void;
  onRenameChange: (value: string) => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  onStartRename: () => void;
  onDeleteRequest: () => void;
  renameInputRef: React.RefObject<HTMLInputElement>;
  t: (key: string) => string;
}) {
  const { setNodeRef, attributes, listeners, transform, transition } = useSortable({ id: group.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  if (isRenaming) {
    return (
      <div ref={setNodeRef} style={style} className="relative inline-flex items-center">
        <div className="inline-flex items-center gap-1">
          <Input
            ref={renameInputRef}
            value={renamingName}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameConfirm();
              if (e.key === 'Escape') onRenameCancel();
            }}
            className="h-7 w-24 text-xs"
          />
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRenameConfirm}>
            <Check className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRenameCancel}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="relative inline-flex items-center">
      <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground flex-shrink-0 touch-none">
        <GripVertical className="h-3 w-3" />
      </div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            className={tabClass(isActive)}
            onClick={onTabClick}
          >
            {group.name}({linkCount})
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-[120px]">
          <ContextMenuItem onSelect={onStartRename}>
            {t('quickLinks.renameGroup')}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={onDeleteRequest}
            className="text-destructive focus:text-destructive"
          >
            {t('quickLinks.deleteGroup')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

export default function GroupTabs({
  groups,
  links,
  activeGroupFilter,
  onActiveGroupFilterChange,
  onGroupsChange,
  onLinksChange,
}: GroupTabsProps) {
  const { t } = useI18n();
  const [isAdding, setIsAdding] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (isAdding && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingId]);

  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

  const ungroupedCount = links.filter(l => !l.groupId).length;

  const getGroupLinkCount = (groupId: string) =>
    links.filter(l => l.groupId === groupId).length;

  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    const maxOrder = groups.reduce((max, g) => Math.max(max, g.order), -1);
    const newGroup: QuickLinkGroup = {
      id: `group-${Date.now()}`,
      name,
      order: maxOrder + 1,
    };
    onGroupsChange([...groups, newGroup]);
    setNewGroupName("");
    setIsAdding(false);
  };

  const renameGroup = () => {
    const name = renamingName.trim();
    if (!name || !renamingId) return;
    onGroupsChange(renameQuickLinkGroup(groups, renamingId, name));
    setRenamingId(null);
    setRenamingName("");
  };

  const deleteGroup = (groupId: string) => {
    const nextState = deleteQuickLinkGroup(groups, links, groupId);
    onLinksChange(nextState.links);
    onGroupsChange(nextState.groups);
    if (activeGroupFilter === groupId) {
      onActiveGroupFilterChange('all');
    }
    setDeleteConfirmId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      onGroupsChange(reorderQuickLinkGroups(groups, String(active.id), over ? String(over.id) : null));
    }
  };

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 cursor-pointer select-none border-0 outline-none focus:outline-none whitespace-nowrap ${
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-stone-600 dark:text-stone-400 hover:bg-accent hover:text-foreground bg-transparent"
    }`;

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-6 pt-4 pb-2">
      {/* All tab */}
      <button
        type="button"
        className={tabClass(activeGroupFilter === 'all')}
        onClick={() => onActiveGroupFilterChange('all')}
      >
        {t('quickLinks.allGroups')}
      </button>

      {/* Ungrouped tab */}
      <button
        type="button"
        className={tabClass(activeGroupFilter === '__ungrouped__')}
        onClick={() => onActiveGroupFilterChange('__ungrouped__')}
      >
        {t('quickLinks.ungrouped')}({ungroupedCount})
      </button>

      {/* Group tabs - sortable */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortedGroups.map(g => g.id)} strategy={horizontalListSortingStrategy}>
          {sortedGroups.map((group) => (
            <SortableGroupTab
              key={group.id}
              group={group}
              isActive={activeGroupFilter === group.id}
              isRenaming={renamingId === group.id}
              renamingName={renamingName}
              linkCount={getGroupLinkCount(group.id)}
              tabClass={tabClass}
              onTabClick={() => onActiveGroupFilterChange(group.id)}
              onRenameChange={setRenamingName}
              onRenameConfirm={renameGroup}
              onRenameCancel={() => { setRenamingId(null); setRenamingName(""); }}
              onStartRename={() => { setRenamingId(group.id); setRenamingName(group.name); }}
              onDeleteRequest={() => setDeleteConfirmId(group.id)}
              renameInputRef={renameInputRef}
              t={t}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add new group */}
      {isAdding ? (
        <div className="inline-flex items-center gap-1">
          <Input
            ref={addInputRef}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addGroup();
              if (e.key === 'Escape') { setIsAdding(false); setNewGroupName(""); }
            }}
            placeholder={t('quickLinks.groupNamePlaceholder')}
            className="h-7 w-28 text-xs"
          />
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={addGroup} disabled={!newGroupName.trim()}>
            <Check className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setIsAdding(false); setNewGroupName(""); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200 cursor-pointer border border-dashed border-border"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-3 w-3" />
          {t('quickLinks.newGroup')}
        </button>
      )}

      {/* Delete group confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('quickLinks.deleteGroupConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('quickLinks.deleteGroupWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteGroup(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('quickLinks.deleteGroupBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
