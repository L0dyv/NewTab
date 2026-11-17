import {
  Archive,
  BookOpen,
  Bookmark,
  Bot,
  Box,
  Briefcase,
  Cloud,
  Code2,
  Compass,
  FileText,
  Folder,
  Gamepad2,
  Globe,
  GraduationCap,
  Hash,
  Inbox,
  Layers,
  Mail,
  MessageSquare,
  Music,
  Palette,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Terminal,
  Tv,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const ICON_COMPONENTS: Record<string, LucideIcon> = {
  inbox: Inbox,
  folder: Folder,
  layers: Layers,
  bookmark: Bookmark,
  star: Star,
  archive: Archive,
  box: Box,
  tag: Tag,
  hash: Hash,
  compass: Compass,
  sparkles: Sparkles,
  bot: Bot,
  terminal: Terminal,
  code: Code2,
  cloud: Cloud,
  mail: Mail,
  message: MessageSquare,
  book: BookOpen,
  graduation: GraduationCap,
  "file-text": FileText,
  briefcase: Briefcase,
  globe: Globe,
  tv: Tv,
  gamepad: Gamepad2,
  music: Music,
  palette: Palette,
  wrench: Wrench,
  shopping: ShoppingBag,
  wallet: Wallet,
};

interface GroupIconGlyphProps {
  iconKey: string;
  size?: number;
  className?: string;
}

/**
 * 渲染分组单色线性图标，锁定与右上角工具栏一致的 1.75 笔触宽度。
 */
export default function GroupIconGlyph({
  iconKey,
  size = 19,
  className,
}: GroupIconGlyphProps) {
  const Icon = ICON_COMPONENTS[iconKey] ?? Folder;
  return <Icon width={size} height={size} strokeWidth={1.75} className={className} />;
}
