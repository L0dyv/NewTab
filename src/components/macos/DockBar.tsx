import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Check, LayoutGrid, Plus, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { dockMagnification, stackGridColumns } from "@/lib/macosDock";
import { reorderQuickLinkGroups, sortQuickLinkGroups } from "@/lib/quickLinkGroups";
import { cn } from "@/lib/utils";
import DockGroupItem from "./DockGroupItem";
import DockTooltip from "./DockTooltip";
import GroupStack, { FAN_MAX_ITEMS } from "./GroupStack";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

const UNGROUPED_KEY = "__ungrouped__";

/** 放大参数：影响半径与峰值缩放，调大 SPREAD 会让更多邻居一起抬起 */
const MAGNIFY_SPREAD = 110;
const MAGNIFY_MAX_SCALE = 1.45;
const MAGNIFY_LIFT = 10;

/** 悬浮多久后自动展开堆栈；已有堆栈打开时切换是即时的 */
const HOVER_OPEN_DELAY = 180;
const HOVER_CLOSE_DELAY = 220;

/** 与 GroupStack 网格的实际排版保持一致，用于把面板收拢进视口 */
const STACK_CELL = 80;
const STACK_GAP = 4;
const STACK_PADDING = 24;

/** 扇形名称药丸最宽 11rem 加图标与间距，离左缘不足这个距离就把名称翻到右侧 */
const FAN_LABEL_RESERVE = 230;

interface DockSection {
  group: QuickLinkGroup | null;
  links: QuickLink[];
}

interface DockBarProps {
  sections: DockSection[];
  groups: QuickLinkGroup[];
  onGroupsChange: (groups: QuickLinkGroup[]) => void;
  onAddGroup: (name: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onOpenLaunchpad: () => void;
  onCopy: (url: string) => void;
  onMoveToGroup: (linkId: string, groupId: string | undefined) => void;
  onRemoveLink: (linkId: string) => void;
}

interface Slot {
  outer: HTMLDivElement;
  inner: HTMLElement;
  center: number;
}

export default function DockBar({
  sections,
  groups,
  onGroupsChange,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
  onOpenLaunchpad,
  onCopy,
  onMoveToGroup,
  onRemoveLink,
}: DockBarProps) {
  const { t } = useI18n();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const outerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const slotsRef = useRef<Slot[]>([]);
  const pointerXRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const suppressRef = useRef(false);

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [anchorX, setAnchorX] = useState(0);
  const [fanSide, setFanSide] = useState<"left" | "right">("left");
  const [isAdding, setIsAdding] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const sortedGroups = useMemo(() => sortQuickLinkGroups(groups), [groups]);
  const sortableIds = useMemo(() => sortedGroups.map((g) => g.id), [sortedGroups]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const openSection = useMemo(() => {
    if (!openKey) return null;
    return (
      sections.find((s) => (s.group?.id ?? UNGROUPED_KEY) === openKey) ?? null
    );
  }, [openKey, sections]);

  // 未分组只有真的存在链接时才占一个 Dock 槽位
  const ungroupedSection = useMemo(
    () => sections.find((s) => s.group === null) ?? null,
    [sections]
  );
  const ungroupedCount = ungroupedSection?.links.length ?? 0;

  // --- 放大 ----------------------------------------------------------------

  const measureSlots = useCallback(() => {
    const next: Slot[] = [];
    for (const outer of outerRefs.current) {
      if (!outer) continue;
      const inner = outer.querySelector<HTMLElement>(".dock-item");
      if (!inner) continue;
      const rect = outer.getBoundingClientRect();
      next.push({ outer, inner, center: rect.left + rect.width / 2 });
    }
    slotsRef.current = next;
  }, []);

  const applyMagnification = useCallback(() => {
    rafRef.current = null;
    const pointerX = pointerXRef.current;
    const off = suppressRef.current || pointerX === null;

    for (const slot of slotsRef.current) {
      const scale = off
        ? 1
        : dockMagnification(pointerX - slot.center, MAGNIFY_SPREAD, MAGNIFY_MAX_SCALE);
      slot.inner.style.setProperty("--dock-scale", scale.toFixed(4));
      slot.inner.style.setProperty(
        "--dock-lift",
        `${(-(scale - 1) * MAGNIFY_LIFT).toFixed(2)}px`
      );
    }
  }, []);

  const scheduleMagnification = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(applyMagnification);
  }, [applyMagnification]);

  const setSettling = useCallback((settling: boolean) => {
    for (const slot of slotsRef.current) {
      slot.inner.classList.toggle("dock-item-settling", settling);
    }
  }, []);

  // 槽位数量或内容变化后重新测量中心点；transform 不影响布局，所以缓存是安全的。
  // 槽位变少时要先截断 ref 数组，否则会留下已卸载的旧节点。
  const slotCount = (ungroupedCount > 0 ? 1 : 0) + sortedGroups.length + 2;
  useLayoutEffect(() => {
    outerRefs.current.length = slotCount;
    measureSlots();
    setSettling(true);
  }, [measureSlots, setSettling, slotCount, isAdding]);

  useEffect(() => {
    const onResize = () => {
      measureSlots();
      scheduleMagnification();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measureSlots, scheduleMagnification]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const handlePointerMove = (e: React.MouseEvent) => {
    pointerXRef.current = e.clientX;
    scheduleMagnification();
  };

  const handleDockEnter = () => {
    setSettling(false);
  };

  const handleDockLeave = () => {
    pointerXRef.current = null;
    setSettling(true);
    scheduleMagnification();
  };

  const suppressMagnification = useCallback(
    (suppressed: boolean) => {
      suppressRef.current = suppressed;
      scheduleMagnification();
    },
    [scheduleMagnification]
  );

  // --- 堆栈开合 ------------------------------------------------------------

  const computeAnchor = useCallback((key: string, linkCount: number) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return { x: 0, fanSide: "left" as const };

    const slot = slotsRef.current.find((s) => s.outer.dataset.dockKey === key);
    const wrapperRect = wrapper.getBoundingClientRect();
    const center = slot ? slot.center : wrapperRect.left + wrapperRect.width / 2;

    // 扇形的名称药丸朝一侧伸出，离屏幕左缘太近时翻到右侧，免得被裁掉
    const fanSide = center < FAN_LABEL_RESERVE ? ("right" as const) : ("left" as const);

    // 扇形的图标就落在 Dock 图标正上方，不需要收拢
    if (linkCount > 0 && linkCount <= FAN_MAX_ITEMS) {
      return { x: center - wrapperRect.left, fanSide };
    }

    // 网格是一整块面板，宽度可以精确算出，无需测量也就没有先渲染再修正的跳动
    const columns = stackGridColumns(linkCount);
    const stackWidth = columns * STACK_CELL + (columns - 1) * STACK_GAP + STACK_PADDING;
    const half = stackWidth / 2;
    const margin = 12;

    const clamped = Math.min(
      Math.max(center, half + margin),
      window.innerWidth - half - margin
    );
    return { x: clamped - wrapperRect.left, fanSide };
  }, []);

  const openStack = useCallback(
    (key: string, pin: boolean) => {
      const section = sections.find((s) => (s.group?.id ?? UNGROUPED_KEY) === key);
      const anchor = computeAnchor(key, section?.links.length ?? 0);
      setAnchorX(anchor.x);
      setFanSide(anchor.fanSide);
      setOpenKey(key);
      if (pin) setPinned(true);
    },
    [computeAnchor, sections]
  );

  const closeStack = useCallback(() => {
    setOpenKey(null);
    setPinned(false);
  }, []);

  const clearTimers = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleHover = useCallback(
    (key: string) => {
      if (suppressRef.current) return;
      clearTimers();

      // 已经有堆栈打开时切换是即时的，和 macOS 菜单一致
      if (openKey) {
        if (openKey !== key) openStack(key, pinned);
        return;
      }

      hoverTimerRef.current = setTimeout(() => {
        hoverTimerRef.current = null;
        openStack(key, false);
      }, HOVER_OPEN_DELAY);
    },
    [openKey, openStack, pinned]
  );

  const handleActivate = useCallback(
    (key: string) => {
      clearTimers();
      if (openKey === key && pinned) {
        closeStack();
        return;
      }
      openStack(key, true);
    },
    [closeStack, openKey, openStack, pinned]
  );

  const handleWrapperLeave = () => {
    handleDockLeave();
    clearTimers();
    if (pinned) return; // 点开的堆栈要一直留着，直到点别处或切到另一组
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      closeStack();
    }, HOVER_CLOSE_DELAY);
  };

  const handleWrapperEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  // 点击别处或按 Escape 关闭已固定的堆栈
  useEffect(() => {
    if (!openKey) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) closeStack();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeStack();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openKey, closeStack]);

  // 分组被删除时，指向它的堆栈要跟着关掉
  useEffect(() => {
    if (!openKey || openKey === UNGROUPED_KEY) return;
    if (!groups.some((g) => g.id === openKey)) closeStack();
  }, [openKey, groups, closeStack]);

  // --- 拖拽排序 ------------------------------------------------------------

  const handleDragStart = () => {
    clearTimers();
    closeStack();
    suppressMagnification(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    suppressMagnification(false);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onGroupsChange(reorderQuickLinkGroups(groups, String(active.id), String(over.id)));
    }
    requestAnimationFrame(measureSlots);
  };

  // --- 新建分组 ------------------------------------------------------------

  useEffect(() => {
    if (isAdding) addInputRef.current?.focus();
  }, [isAdding]);

  const commitAddGroup = () => {
    const name = newGroupName.trim();
    if (name) onAddGroup(name);
    setNewGroupName("");
    setIsAdding(false);
    suppressMagnification(false);
  };

  const cancelAddGroup = () => {
    setNewGroupName("");
    setIsAdding(false);
    suppressMagnification(false);
  };

  // --- 渲染 ----------------------------------------------------------------

  let slotIndex = 0;
  const nextRef = (key: string) => {
    const index = slotIndex++;
    return (el: HTMLDivElement | null) => {
      outerRefs.current[index] = el;
      if (el) el.dataset.dockKey = key;
    };
  };

  return (
    <div
      ref={wrapperRef}
      className="relative flex justify-center"
      onMouseEnter={handleWrapperEnter}
      onMouseLeave={handleWrapperLeave}
    >
      {openSection && (
        <GroupStack
          group={openSection.group}
          links={openSection.links}
          groups={groups}
          anchorX={anchorX}
          fanSide={fanSide}
          onCopy={onCopy}
          onMoveToGroup={onMoveToGroup}
          onRemove={onRemoveLink}
          onOpenLink={closeStack}
        />
      )}

      <div
        className="liquid-glass liquid-glass-floating flex items-end gap-3.5 rounded-[24px] px-3.5 py-2.5"
        onMouseMove={handlePointerMove}
        onMouseEnter={handleDockEnter}
      >
        {/* 未分组：不参与排序，也没有右键管理项 */}
        {ungroupedSection && (
          <DockGroupItem
            group={null}
            isOpen={openKey === UNGROUPED_KEY}
            sortable={false}
            registerRef={nextRef(UNGROUPED_KEY)}
            onActivate={() => handleActivate(UNGROUPED_KEY)}
            onHover={() => handleHover(UNGROUPED_KEY)}
          />
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => suppressMagnification(false)}
        >
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            <div className="flex items-end gap-3.5">
              {sortedGroups.map((group) => {
                const section = sections.find((s) => s.group?.id === group.id);
                return (
                  <DockGroupItem
                    key={group.id}
                    group={group}
                    isOpen={openKey === group.id}
                    sortable
                    registerRef={nextRef(group.id)}
                    onActivate={() => handleActivate(group.id)}
                    onHover={() => handleHover(group.id)}
                    onRename={onRenameGroup}
                    onDelete={onDeleteGroup}
                    onEditingChange={suppressMagnification}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* 分隔线只在左侧确实有分组时才画，否则会孤零零挂在 Dock 开头 */}
        {(ungroupedCount > 0 || sortedGroups.length > 0) && (
          <div className="mx-1 h-9 w-px self-center bg-foreground/15" />
        )}

        {/* 新建分组 */}
        <div
          ref={nextRef("__add__")}
          className="relative flex-shrink-0"
          onMouseEnter={() => setHoveredSlot("__add__")}
          onMouseLeave={() => setHoveredSlot(null)}
        >
          {isAdding ? (
            <div className="absolute bottom-full left-1/2 z-30 mb-8 -translate-x-1/2">
              <input
                ref={addInputRef}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAddGroup();
                  if (e.key === "Escape") cancelAddGroup();
                }}
                placeholder={t("quickLinks.groupNamePlaceholder")}
                className="liquid-glass w-32 rounded-lg px-2 py-1 text-center text-[11px] leading-none text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          ) : (
            <DockTooltip label={t("quickLinks.newGroup")} visible={hoveredSlot === "__add__"} />
          )}

          <div className="dock-item flex">
            {isAdding ? (
              <div className="flex h-[42px] w-[42px] items-center justify-center gap-1 rounded-[12px] border border-dashed border-border">
                <button
                  type="button"
                  onClick={commitAddGroup}
                  disabled={!newGroupName.trim()}
                  className="rounded p-0.5 text-foreground/70 hover:text-foreground disabled:opacity-30"
                  aria-label={t("common.confirm")}
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={cancelAddGroup}
                  className="rounded p-0.5 text-foreground/70 hover:text-foreground"
                  aria-label={t("common.cancel")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label={t("quickLinks.newGroup")}
                onClick={() => {
                  clearTimers();
                  closeStack();
                  setIsAdding(true);
                  suppressMagnification(true);
                }}
                className={cn(
                  "flex h-[42px] w-[42px] items-center justify-center rounded-[12px]",
                  "border border-dashed border-border text-muted-foreground/70",
                  "hover:border-foreground/40 hover:text-foreground",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* 全部展示 */}
        <div
          ref={nextRef("__launchpad__")}
          className="relative flex-shrink-0"
          onMouseEnter={() => setHoveredSlot("__launchpad__")}
          onMouseLeave={() => setHoveredSlot(null)}
        >
          <DockTooltip label={t("dock.showAll")} visible={hoveredSlot === "__launchpad__"} />

          <div className="dock-item flex">
            <button
              type="button"
              aria-label={t("dock.showAll")}
              onClick={() => {
                clearTimers();
                closeStack();
                onOpenLaunchpad();
              }}
              onMouseEnter={() => clearTimers()}
              className={cn(
                "liquid-glass flex h-[42px] w-[42px] items-center justify-center rounded-[12px]",
                "text-foreground/75 hover:text-foreground",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <LayoutGrid className="h-6 w-6" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
