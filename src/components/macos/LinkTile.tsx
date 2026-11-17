import QuickLinkIcon from "@/components/QuickLinkIcon";
import { ensureUrlHasProtocol } from "@/lib/url";
import { cn } from "@/lib/utils";
import LinkContextMenu, { type LinkActions } from "./LinkContextMenu";
import { useInlineLinkRename } from "./useInlineLinkRename";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

interface LinkTileProps extends LinkActions {
  link: QuickLink;
  groups: QuickLinkGroup[];
  iconSize?: number;
  className?: string;
  onOpen?: () => void;
  onEditingChange?: (editing: boolean) => void;
}

/**
 * 图标在上、名称在下的网格单元，Launchpad 与链接较多时的堆栈网格共用。
 * 名称始终可见，所以不做成悬浮才显示；最多两行，超出省略。
 */
export default function LinkTile({
  link,
  groups,
  iconSize = 40,
  className,
  onRename,
  onCopy,
  onMoveToGroup,
  onRemove,
  onOpen,
  onEditingChange,
}: LinkTileProps) {
  const {
    isRenaming,
    draftName,
    setDraftName,
    inputRef,
    startRename,
    commitRename,
    handleKeyDown,
  } = useInlineLinkRename({ link, onRename, onEditingChange });

  return (
    <LinkContextMenu
      link={link}
      groups={groups}
      onStartRename={startRename}
      onCopy={onCopy}
      onMoveToGroup={onMoveToGroup}
      onRemove={onRemove}
    >
      {isRenaming ? (
        <div
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl bg-foreground/[0.06] px-1.5 py-3",
            className
          )}
        >
          <div>
            <QuickLinkIcon name={link.name} url={link.url} icon={link.icon} size={iconSize} />
          </div>
          <input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            aria-label={link.name}
            className="liquid-glass w-full rounded-md px-1.5 py-0.5 text-center text-[11px] leading-tight text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      ) : (
        <a
          href={ensureUrlHasProtocol(link.url)}
          title={link.name}
          onClick={onOpen}
          className={cn(
            "group flex flex-col items-center gap-2 rounded-xl px-2 py-3",
            "hover:bg-foreground/[0.06] active:bg-foreground/[0.1]",
            "transition-colors duration-150 cursor-pointer outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          <div className="transition-transform duration-200 group-hover:scale-110">
            <QuickLinkIcon name={link.name} url={link.url} icon={link.icon} size={iconSize} />
          </div>
          <span className="w-full text-center text-[11px] leading-tight text-foreground/80 line-clamp-2 break-words">
            {link.name}
          </span>
        </a>
      )}
    </LinkContextMenu>
  );
}
