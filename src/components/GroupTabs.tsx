import { useState, useRef, useEffect } from "react";
import { Plus, Check, X, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useI18n } from "@/hooks/useI18n";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

interface GroupTabsProps {
  groups: QuickLinkGroup[];
  links: QuickLink[];
  activeGroupFilter: string; // 'all' | '__ungrouped__' | group.id
  onActiveGroupFilterChange: (filter: string) => void;
  onGroupsChange: (groups: QuickLinkGroup[]) => void;
  onLinksChange: (links: QuickLink[]) => void;
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
    onGroupsChange(groups.map(g =>
      g.id === renamingId ? { ...g, name } : g
    ));
    setRenamingId(null);
    setRenamingName("");
  };

  const deleteGroup = (groupId: string) => {
    // Move links back to ungrouped
    onLinksChange(links.map(l =>
      l.groupId === groupId ? { ...l, groupId: undefined } : l
    ));
    onGroupsChange(groups.filter(g => g.id !== groupId));
    if (activeGroupFilter === groupId) {
      onActiveGroupFilterChange('all');
    }
    setDeleteConfirmId(null);
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

      {/* Group tabs */}
      {sortedGroups.map((group) => (
        <div key={group.id} className="relative inline-flex items-center">
          {renamingId === group.id ? (
            <div className="inline-flex items-center gap-1">
              <Input
                ref={renameInputRef}
                value={renamingName}
                onChange={(e) => setRenamingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') renameGroup();
                  if (e.key === 'Escape') { setRenamingId(null); setRenamingName(""); }
                }}
                className="h-7 w-24 text-xs"
              />
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={renameGroup}>
                <Check className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setRenamingId(null); setRenamingName(""); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="inline-flex items-center">
              <button
                type="button"
                className={tabClass(activeGroupFilter === group.id)}
                onClick={() => onActiveGroupFilterChange(group.id)}
              >
                {group.name}({getGroupLinkCount(group.id)})
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-0.5 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[120px]">
                  <DropdownMenuItem onClick={() => { setRenamingId(group.id); setRenamingName(group.name); }}>
                    {t('quickLinks.renameGroup')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteConfirmId(group.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    {t('quickLinks.deleteGroup')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      ))}

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
