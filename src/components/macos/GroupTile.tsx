import { Folder } from "lucide-react";
import QuickLinkIcon from "@/components/QuickLinkIcon";
import { tilePreviewLinks } from "@/lib/macosDock";
import { cn } from "@/lib/utils";
import type { QuickLink } from "@/lib/types";

interface GroupTileProps {
  links: QuickLink[];
  size?: number;
  className?: string;
}

/**
 * Dock 上代表一个分组的方块：用组内前四个网站的图标拼成 2x2 缩略图。
 * 拼贴直接由分组内容生成，所以用户不需要额外为分组指定图标，
 * 而且一眼能看出这组里大概装了些什么。
 */
export default function GroupTile({ links, size = 48, className }: GroupTileProps) {
  const preview = tilePreviewLinks(links, 4);
  const gap = Math.max(2, Math.round(size * 0.05));
  const padding = Math.max(3, Math.round(size * 0.11));
  const cellSize = (size - padding * 2 - gap) / 2;

  return (
    <div
      className={cn(
        "liquid-glass grid grid-cols-2 place-items-center overflow-hidden",
        className
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        padding,
        gap,
      }}
    >
      {preview.length === 0 && (
        <Folder
          className="col-span-2 text-muted-foreground/45"
          style={{ width: size * 0.38, height: size * 0.38 }}
          strokeWidth={1.5}
        />
      )}

      {/* 只有一个链接时居中放大，避免孤零零缩在左上角 */}
      {preview.length === 1 && (
        <QuickLinkIcon
          className="col-span-2"
          name={preview[0].name}
          url={preview[0].url}
          icon={preview[0].icon}
          size={Math.max(10, Math.floor(size * 0.52))}
        />
      )}

      {preview.length > 1 &&
        preview.map((link) => (
          <QuickLinkIcon
            key={link.id}
            name={link.name}
            url={link.url}
            icon={link.icon}
            size={Math.max(8, Math.floor(cellSize))}
          />
        ))}
    </div>
  );
}
