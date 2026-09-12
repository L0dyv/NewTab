import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
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

  // 单元格 7.5rem 宽、间距 gap-1，与下面 LinkTile 的类名保持一致
  const CELL = 120;
  const GAP = 4;
  // 盒子高度按整页容量固定，与分页用的是同一套行数
  const pageBoxHeight = layout.rows * 104;
  const sectionWidth = (count: number) => {
    const n = Math.max(1, Math.min(layout.cols, count));
    return n * CELL + (n - 1) * GAP;
  };

  return (
    <div
      className="liquid-glass-scrim animate-launchpad-in fixed inset-0 z-40 flex flex-col"
      onWheel={handleWheel}
      onMouseDown={(e) => {
        // 启动台盖在桌面上，点它之外的地方就退回去。"之外"指内容区以外的留白：
        // 网格、筛选框、页码这些是启动台自己的地盘，在它们内部（包括图标之间的
        // 空隙）点击不应该退出，否则想点图标稍微偏一点就把整个面板关掉了。
        const target = e.target as HTMLElement;
        if (!target.closest("[data-launchpad-surface], a, button, input")) onClose();
      }}
    >
      {/* 筛选框：只在 Launchpad 全屏态存在，不会和首页搜索栏同时出现。
          上方留足距离——贴着屏幕顶边会把整套内容压向上半部 */}
      <div data-launchpad-surface className="flex flex-shrink-0 justify-center px-6 pt-24 pb-10">
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

      {/* 网格盒子的高度固定为整页容量，盒子在可用区域里居中，内容在盒子内从
          顶部起排——这正是启动台的做法。居中的是盒子而不是内容：内容居中的话，
          装不满的一页会整块飘到中间，每页第一行也就落在不同高度，翻页时跳动。*/}
      <div className="flex min-h-0 flex-1 items-center justify-center px-10">
        {currentPage.length === 0 ? (
          <p className="text-sm text-muted-foreground select-none">
            {query ? t("dock.noMatches") : t("dock.noLinks")}
          </p>
        ) : (
          <div
            data-launchpad-surface
            className="animate-launchpad-grid w-full max-w-5xl space-y-6"
            style={{ height: pageBoxHeight }}
          >
            {/* 每个分组自成一块：宽度取"列数"与"本组数量"的较小值，于是分割线
                与下方图标等宽。让它横贯整个容器的话，图标只占中间一段、两端各
                拖出一截空线，看起来像没铺满；而直接用 w-fit 又会取消换行约束，
                链接多的分组会排成一条长龙冲出屏幕。*/}
            {currentPage.map((section, index) => (
              <section
                key={`${section.group?.id ?? "__ungrouped__"}-${index}`}
                className="mx-auto"
                style={{ width: sectionWidth(section.links.length) }}
              >
                <div className="mb-2 flex items-center gap-3">
                  <div className="h-px flex-1 bg-foreground/10" />
                  <span className="select-none whitespace-nowrap text-[11px] uppercase tracking-widest text-muted-foreground">
                    {section.group ? section.group.name : t("quickLinks.ungrouped")}
                    {section.continued && ` ${t("dock.continued")}`}
                  </span>
                  <div className="h-px flex-1 bg-foreground/10" />
                </div>
                {/* 每个分组各自居中排列，而不是共用一套固定列。分组之间隔着
                    分割线，跨组对齐本来就没有意义；而固定列在分组链接数少于
                    列数时会把它们挤到左边，右侧空一截。*/}
                <div className="flex flex-wrap justify-center gap-1">
                  {section.links.map((link) => (
                    <LinkTile
                      key={link.id}
                      link={link}
                      groups={groups}
                      iconSize={32}
                      className="w-[7.5rem] shrink-0"
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

      {/* 左右翻页。macOS 的启动台只有底部圆点，靠触控板双指滑动翻页；网页上
          没有这个肌肉记忆，所以补一对箭头，否则只有熟练用户才知道能翻。
          位置贴着内容区（max-w-5xl = 32rem 半宽）外侧，而不是屏幕最边缘——
          放在边缘会离网格太远，看起来不像是这一块的控件。*/}
      {pages.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
            disabled={page === 0}
            aria-label={`${t("dock.page")} ${page}`}
            className={cn(
              "liquid-glass liquid-glass-floating absolute left-[max(1.5rem,calc(50%-34rem))] top-1/2 -translate-y-1/2",
              "flex h-10 w-10 items-center justify-center rounded-full text-foreground/70",
              "transition-opacity hover:text-foreground disabled:pointer-events-none disabled:opacity-0"
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(p + 1, pages.length - 1))}
            disabled={page === pages.length - 1}
            aria-label={`${t("dock.page")} ${page + 2}`}
            className={cn(
              "liquid-glass liquid-glass-floating absolute right-[max(1.5rem,calc(50%-34rem))] top-1/2 -translate-y-1/2",
              "flex h-10 w-10 items-center justify-center rounded-full text-foreground/70",
              "transition-opacity hover:text-foreground disabled:pointer-events-none disabled:opacity-0"
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* 页码指示。每一页都是全部内容的一屏，没有哪页需要与其他页区分 */}
      <div data-launchpad-surface className="flex flex-shrink-0 items-center justify-center gap-2 py-8">
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
        // 与翻页箭头同款的玻璃圆钮：持续可见的部分保持纯图形，一眼能看出这里
        // 可以退出。"按 Esc 也行"放在 tooltip 里，只在指向时出现——Esc 没有
        // 字体支持可靠的符号，写成文字又会一直占着视线。
        className={cn(
          "liquid-glass liquid-glass-floating absolute right-6 top-6",
          "flex h-10 w-10 items-center justify-center rounded-full text-foreground/70",
          "transition-colors hover:text-foreground"
        )}
        aria-label={`${t("common.close")} (Esc)`}
        title={`${t("common.close")} · Esc`}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
