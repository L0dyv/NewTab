import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import {
  filterSections,
  launchpadLayout,
  launchpadPageHeight,
  paginateLaunchpad,
} from "@/lib/macosDock";
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

  // 盒子高度只跟视口有关，与这次装了多少内容无关。
  //
  // 取"最高一页的实际高度"看似更紧凑，实际会让整块的高度随内容变化，而整块
  // 又是在视口里居中的——于是"只看一个分组"和"全部展示"的起始高度差出一大截，
  // 每次打开启动台，筛选框和第一行图标都落在不同的地方。启动台不是这样的：
  // 不管里面装了什么，那个框始终在同一个位置，内容少就把空白留在下面。
  const pageBoxMinHeight = useMemo(
    () =>
      Math.max(
        layout.gridHeight,
        ...pages.map((p) => launchpadPageHeight(p, layout.cols))
      ),
    [pages, layout.cols, layout.gridHeight]
  );

  return (
    <div
      className="liquid-glass-scrim animate-launchpad-in fixed inset-0 z-40 flex flex-col"
      onWheel={handleWheel}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;

        // 右键菜单是 Portal 到 body 上的，并不在底板的 DOM 里，但 React 的
        // 合成事件仍沿组件树冒到这里。只看"点的是什么元素"会把菜单项判成
        // 点在了启动台之外：底板随即关闭，菜单跟着卸载，那一下点击永远走不到
        // 它的处理函数——菜单看起来"点一下就没了，什么也没发生"。
        // 判据改成这一下是不是真的落在底板的 DOM 内。
        if (!e.currentTarget.contains(target)) return;

        // 启动台盖在桌面上，点它之外的地方就退回去。"之外"指内容区以外的留白：
        // 网格、筛选框、页码这些是启动台自己的地盘，在它们内部（包括图标之间的
        // 空隙）点击不应该退出，否则想点图标稍微偏一点就把整个面板关掉了。
        if (!target.closest("[data-launchpad-surface], a, button, input")) onClose();
      }}
    >
      {/* 筛选框与网格算作同一块，一起在视口里居中。把筛选框钉在顶部、只让网格
          在剩余空间里居中的话，两者之间会裂开一大片空白，也就不成其为一块。*/}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-10">
      {/* 记号挂在整块上，而不是只挂在筛选框和网格各自身上：两者之间的间隔也是
          启动台的地盘，点在那里不该退出。限宽到内容宽度，左右两侧的留白仍算
          "外部"。*/}
      <div data-launchpad-surface className="flex w-full max-w-5xl flex-col items-center gap-14">
      <div className="flex w-full justify-center">
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

      {/* 网格盒子有下限高度，内容在盒子内从顶部起排——这正是启动台的做法。
          装不满的一页是盒子下半部留空，而不是内容整块飘到中间；每页第一行因此
          都落在同一高度，翻页不跳。*/}
      <div className="flex w-full justify-center">
        {currentPage.length === 0 ? (
          <p className="text-sm text-muted-foreground select-none">
            {query ? t("dock.noMatches") : t("dock.noLinks")}
          </p>
        ) : (
          <div
            data-launchpad-surface
            className="animate-launchpad-grid space-y-6"
            // 宽度正好是列阵的宽度，用下限高度而不是固定高度：内容更高时盒子
            // 跟着长，不会溢出
            style={{ width: layout.gridWidth, minHeight: pageBoxMinHeight }}
          >
            {/* 所有分组共用一套列位置——这是启动台的根本：整屏只有一个网格，
                每个图标都落在固定的格子上。让每个分组按自己的数量定宽再各自
                居中，就会出现三套互不相干的列（首行一套、折行一套、下一个分组
                又一套），谁也对不上谁。*/}
            {currentPage.map((section, index) => (
              <section
                key={`${section.group?.id ?? "__ungrouped__"}-${index}`}
                className="w-full"
              >
                {/* 标题贴左，和下面的图标同一条左边界，横线补满剩下的宽度。
                    分组不满一行时居中的标题会飘到图标右边老远，像是配给别人的。*/}
                <div className="mb-2 flex items-center gap-3">
                  <span className="select-none whitespace-nowrap text-[11px] uppercase tracking-widest text-muted-foreground">
                    {section.group ? section.group.name : t("quickLinks.ungrouped")}
                    {section.continued && ` ${t("dock.continued")}`}
                  </span>
                  <div className="h-px flex-1 bg-foreground/10" />
                </div>
                {/* 从第一列起往右排，排满换行。折行那一行同样从第一列起——
                    启动台最后一行不满时就是左对齐的，居中反而会让它和上一行
                    错开半格。*/}
                <div className="flex flex-wrap justify-start gap-1">
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
      </div>
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
