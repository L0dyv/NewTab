import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/hooks/useI18n";

const ThemeToggle = () => {
  const { theme, setTheme, actualTheme } = useTheme();
  const { t } = useI18n();

  const getThemeIcon = () => {
    if (theme === 'system') {
      return <Monitor className="h-5 w-5" />;
    }
    return actualTheme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          {getThemeIcon()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-popover/95 border-border text-popover-foreground shadow-md backdrop-blur-sm"
      >
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="cursor-pointer focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent"
        >
          <Sun className="mr-2 h-4 w-4" />
          {t('theme.light')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="cursor-pointer focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent"
        >
          <Moon className="mr-2 h-4 w-4" />
          {t('theme.dark')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="cursor-pointer focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent"
        >
          <Monitor className="mr-2 h-4 w-4" />
          {t('theme.system')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;
