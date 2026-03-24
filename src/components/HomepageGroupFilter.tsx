import { useRef, useState, useEffect, useCallback } from "react";
import { Plus, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import type { QuickLinkGroup } from "@/lib/types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderQuickLinkGroups, sortQuickLinkGroups } from "@/lib/quickLinkGroups";

interface HomepageGroupFilterProps {
  groups: QuickLinkGroup[];
  activeTab: string; // 'all' | group.id
  onTabChange: (tab: string) => void;
  onAddGroup?: (name: string) => void;
  onGroupsChange?: (groups: QuickLinkGroup[]) => void;
}

function SortableHomepageGroupTab({
  group,
  isActive,
  tabClass,
  onTabChange,
}: {
  group: QuickLinkGroup;
  isActive: boolean;
  tabClass: (active: boolean) => string;
  onTabChange: (tab: string) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition } = useSortable({ id: group.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      className={tabClass(isActive)}
      onClick={() => onTabChange(group.id)}
      {...attributes}
      {...listeners}
    >
      {group.name}
    </button>
  );
}

export default function HomepageGroupFilter({
  groups,
  activeTab,
  onTabChange,
  onAddGroup,
  onGroupsChange,
}: HomepageGroupFilterProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateMasks = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 2);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateMasks();
    el.addEventListener("scroll", updateMasks, { passive: true });
    window.addEventListener("resize", updateMasks);
    return () => {
      el.removeEventListener("scroll", updateMasks);
      window.removeEventListener("resize", updateMasks);
    };
  }, [updateMasks, groups]);

  useEffect(() => {
    if (isAdding && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAdding]);

  if (groups.length === 0 && !onAddGroup) return null;

  const sortedGroups = sortQuickLinkGroups(groups);

  const tabClass = (active: boolean) =>
    cn(
      "inline-flex items-center px-3 py-1 text-xs font-medium rounded-full",
      "transition-all duration-200 cursor-pointer select-none whitespace-nowrap",
      "border-0 outline-none focus:outline-none",
      active
        ? "bg-accent text-foreground shadow-sm"
        : "text-muted-foreground/70 hover:text-muted-foreground hover:bg-accent/50"
    );

  const handleAddGroup = () => {
    const name = newGroupName.trim();
    if (!name || !onAddGroup) return;
    onAddGroup(name);
    setNewGroupName("");
    setIsAdding(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!onGroupsChange) return;

    const { active, over } = event;
    if (active.id !== over?.id) {
      onGroupsChange(reorderQuickLinkGroups(groups, String(active.id), over ? String(over.id) : null));
    }
  };

  return (
    <div className="relative w-full mb-4">
      {/* Left gradient mask */}
      {showLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      )}

      <div
        ref={scrollRef}
        className="flex items-center justify-center gap-1.5 overflow-x-auto scrollbar-hide py-1"
      >
        {groups.length > 0 && (
          <>
            <button
              type="button"
              className={tabClass(activeTab === "all")}
              onClick={() => onTabChange("all")}
            >
              {t("quickLinks.allGroups")}
            </button>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sortedGroups.map((group) => group.id)} strategy={horizontalListSortingStrategy}>
                <div className="flex items-center gap-1.5">
                  {sortedGroups.map((group) => (
                    <SortableHomepageGroupTab
                      key={group.id}
                      group={group}
                      isActive={activeTab === group.id}
                      tabClass={tabClass}
                      onTabChange={onTabChange}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}

        {/* Add group inline */}
        {onAddGroup && (
          isAdding ? (
            <div className="inline-flex items-center gap-1 flex-shrink-0">
              <Input
                ref={addInputRef}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddGroup();
                  if (e.key === 'Escape') { setIsAdding(false); setNewGroupName(""); }
                }}
                placeholder={t('quickLinks.groupNamePlaceholder')}
                className="h-6 w-24 text-xs"
              />
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={handleAddGroup} disabled={!newGroupName.trim()}>
                <Check className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setIsAdding(false); setNewGroupName(""); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-0.5 px-2 py-1 text-xs font-medium rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/50 transition-all duration-200 cursor-pointer flex-shrink-0"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-3 w-3" />
            </button>
          )
        )}
      </div>

      {/* Right gradient mask */}
      {showRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      )}
    </div>
  );
}
