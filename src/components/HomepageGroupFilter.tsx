import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import type { QuickLinkGroup } from "@/lib/types";

interface HomepageGroupFilterProps {
  groups: QuickLinkGroup[];
  activeTab: string; // 'all' | group.id
  onTabChange: (tab: string) => void;
}

export default function HomepageGroupFilter({
  groups,
  activeTab,
  onTabChange,
}: HomepageGroupFilterProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

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

  if (groups.length === 0) return null;

  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

  const tabClass = (active: boolean) =>
    cn(
      "inline-flex items-center px-3 py-1 text-xs font-medium rounded-full",
      "transition-all duration-200 cursor-pointer select-none whitespace-nowrap",
      "border-0 outline-none focus:outline-none",
      active
        ? "bg-accent text-foreground shadow-sm"
        : "text-muted-foreground/70 hover:text-muted-foreground hover:bg-accent/50"
    );

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
        <button
          type="button"
          className={tabClass(activeTab === "all")}
          onClick={() => onTabChange("all")}
        >
          {t("quickLinks.allGroups")}
        </button>
        {sortedGroups.map((group) => (
          <button
            key={group.id}
            type="button"
            className={tabClass(activeTab === group.id)}
            onClick={() => onTabChange(group.id)}
          >
            {group.name}
          </button>
        ))}
      </div>

      {/* Right gradient mask */}
      {showRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      )}
    </div>
  );
}
