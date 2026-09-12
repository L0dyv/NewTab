import QuickLinkIcon from "@/components/QuickLinkIcon";
import { ensureUrlHasProtocol } from "@/lib/url";
import { cn } from "@/lib/utils";
import LinkContextMenu, { type LinkActions } from "./LinkContextMenu";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

interface LinkTileProps extends LinkActions {
  link: QuickLink;
  groups: QuickLinkGroup[];
  iconSize?: number;
  className?: string;
  onOpen?: () => void;
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
  onCopy,
  onMoveToGroup,
  onRemove,
  onOpen,
}: LinkTileProps) {
  return (
    <LinkContextMenu
      link={link}
      groups={groups}
      onCopy={onCopy}
      onMoveToGroup={onMoveToGroup}
      onRemove={onRemove}
    >
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
    </LinkContextMenu>
  );
}
