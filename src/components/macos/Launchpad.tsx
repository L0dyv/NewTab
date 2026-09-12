import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { filterSections, launchpadLayout, paginateLaunchpad } from "@/lib/macosDock";
import { cn } from "@/lib/utils";
import LinkTile from "./LinkTile";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

interface LaunchpadProps {
  sections: { group: QuickLinkGroup | null; links: QuickLink[] }[];
  groups: QuickLinkGroup[];
  onClose: () => void;
  onCopy: (url: string) => void;
  onMoveToGroup: (linkId: string, groupId: string | undefined) => void;
  onRemoveLink: (linkId: string) => void;
}

/**
 * 全屏的"全部展示"视图，对应 macOS 的 Launchpad。
 * 所有链接都带名称，按分组归类，超过一屏时横向分页。
 */
export default function Launchpad({
  sections,
  groups,
  onClose,
  onCopy,
  onMoveToGroup,
  onRemoveLink,
}: LaunchpadProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState(() =>
    launchpadLayout(window.innerWidth, window.innerHeight)
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const wheelLockRef = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onResize = () =>
      setLayout(launchpadLayout(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const filtered = useMemo(() => filterSections(sections, query), [sections, query]);
  const pages = useMemo(() => paginateLaunchpad(filtered, layout), [filtered, layout]);

  // 筛选或换尺寸后页数会变，把当前页收回合法区间
  useEffect(() => {
    setPage((prev) => Math.min(prev, Math.max(0, pages.length - 1)));
  }, [pages.length]);

  useEffect(() => {
    setPage(0);
  }, [query]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowRight") {
        setPage((p) => Math.min(p + 1, pages.length - 1));
      }
      if (e.key === "ArrowLeft") {
        setPage((p) => Math.max(p - 1, 0));
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, pages.length]);

  // 滚轮翻页，加一个节流窗口，避免惯性滚动一次跳好几页
  const handleWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 12) return;

    const now = Date.now();
    if (now - wheelLockRef.current < 420) return;
    wheelLockRef.current = now;

    setPage((p) =>
      delta > 0 ? Math.min(p + 1, pages.length - 1) : Math.max(p - 1, 0)
    );
  };

  const currentPage = pages[page] ?? [];

  return (
    <div
      className="liquid-glass-scrim animate-launchpad-in fixed inset-0 z-40 flex flex-col"
      onWheel={handleWheel}
      onMouseDown={(e) => {
        // 启动台盖在桌面上，点空白处就退回去。判断"是否点在可交互元素上"，
        // 而不是只认最外层节点——后者会让内容区的空白区域点了没反应。
        const target = e.target as HTMLElement;
        if (!target.closest("a, button, input, [role='menuitem']")) onClose();
      }}
    >
      {/* 筛选框：只在 Launchpad 全屏态存在，不会和首页搜索栏同时出现 */}
      <div className="flex flex-shrink-0 justify-center px-6 pt-16 pb-8">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("dock.filterPlaceholder")}
            className={cn(
              "liquid-glass w-full rounded-full py-2.5 pl-10 pr-9 text-sm",
              "text-foreground placeholder:text-muted-foreground",
              "outline-none focus:ring-2 focus:ring-ring"
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("common.clear")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex min-h-0 flex-1 justify-center px-10">
        {currentPage.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground select-none">
            {query ? t("dock.noMatches") : t("dock.noLinks")}
          </p>
        ) : (
          <div className="animate-launchpad-grid w-full max-w-5xl space-y-6 overflow-y-auto scrollbar-hide">
            {currentPage.map((section, index) => (
              <section key={`${section.group?.id ?? "__ungrouped__"}-${index}`}>
                <div className="mb-2 flex items-center gap-3">
                  <div className="h-px flex-1 bg-foreground/10" />
                  <span className="select-none text-[11px] uppercase tracking-widest text-muted-foreground">
                    {section.group ? section.group.name : t("quickLinks.ungrouped")}
                    {section.continued && ` ${t("dock.continued")}`}
                  </span>
                  <div className="h-px flex-1 bg-foreground/10" />
                </div>
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}
                >
                  {section.links.map((link) => (
                    <LinkTile
                      key={link.id}
                      link={link}
                      groups={groups}
                      iconSize={32}
                      onCopy={onCopy}
                      onMoveToGroup={onMoveToGroup}
                      onRemove={onRemoveLink}
                      onOpen={onClose}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* 页码指示 */}
      <div className="flex flex-shrink-0 items-center justify-center gap-2 py-8">
        {pages.length > 1 &&
          pages.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setPage(index)}
              aria-label={`${t("dock.page")} ${index + 1}`}
              aria-current={index === page}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                index === page
                  ? "w-5 bg-foreground/70"
                  : "w-1.5 bg-foreground/25 hover:bg-foreground/45"
              )}
            />
          ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 rounded-full p-2 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        aria-label={t("common.close")}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
