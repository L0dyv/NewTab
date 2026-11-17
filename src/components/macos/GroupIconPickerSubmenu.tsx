import { Shapes } from "lucide-react";
import {
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { useI18n } from "@/hooks/useI18n";
import {
  GROUP_ICON_INITIAL,
  GROUP_ICON_KEYS,
  groupInitial,
  inferGroupIconKey,
} from "@/lib/macosDock";
import { cn } from "@/lib/utils";
import GroupIconGlyph from "./groupIcons";
import type { QuickLinkGroup } from "@/lib/types";

interface GroupIconPickerSubmenuProps {
  group: QuickLinkGroup;
  onSelectIcon: (icon: string | undefined) => void;
}

/**
 * 类 Notion 的紧凑分组图标选择二级菜单。
 * 顶部提供“自动匹配”与“首字母”两种模式，下方为 7x4 精选线性图标网格。
 */
export default function GroupIconPickerSubmenu({
  group,
  onSelectIcon,
}: GroupIconPickerSubmenuProps) {
  const { t } = useI18n();
  const inferredKey = inferGroupIconKey(group.name);
  const isAuto = !group.icon;
  const isInitial = group.icon === GROUP_ICON_INITIAL;

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Shapes className="mr-2 h-4 w-4" />
        {t("quickLinks.changeGroupIcon")}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent collisionPadding={12} className="p-2">
        <div className="mb-1.5 flex items-center gap-1 border-b border-foreground/10 pb-1.5">
          <ContextMenuItem
            onSelect={() => onSelectIcon(undefined)}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs",
              isAuto && "bg-foreground/[0.09] font-medium text-foreground"
            )}
          >
            <GroupIconGlyph iconKey={inferredKey} size={13} />
            <span>{t("quickLinks.iconAuto")}</span>
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => onSelectIcon(GROUP_ICON_INITIAL)}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs",
              isInitial && "bg-foreground/[0.09] font-medium text-foreground"
            )}
          >
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[11px] font-semibold leading-none">
              {groupInitial(group.name)}
            </span>
            <span>{t("quickLinks.iconInitial")}</span>
          </ContextMenuItem>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {GROUP_ICON_KEYS.map((key) => {
            const selected = group.icon === key;
            return (
              <ContextMenuItem
                key={key}
                onSelect={() => onSelectIcon(key)}
                className={cn(
                  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg p-0 text-foreground/75 hover:text-foreground",
                  selected &&
                    "bg-foreground/[0.10] text-foreground ring-1 ring-foreground/20"
                )}
              >
                <GroupIconGlyph iconKey={key} size={16} />
              </ContextMenuItem>
            );
          })}
        </div>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
