import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/useTheme";

const ThemeToggle = () => {
  const { theme, setTheme, actualTheme } = useTheme();

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
          className="text-stone-500 dark:text-stone-500 hover:text-stone-800 dark:hover:text-stone-100"
        >
          {getThemeIcon()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-stone-50/95 dark:bg-stone-900/95 border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 shadow-md backdrop-blur-sm"
      >
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="cursor-pointer focus:bg-stone-100 dark:focus:bg-stone-800 focus:text-stone-900 dark:focus:text-stone-100 data-[highlighted]:bg-stone-100 dark:data-[highlighted]:bg-stone-800"
        >
          <Sun className="mr-2 h-4 w-4" />
          浅色
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="cursor-pointer focus:bg-stone-100 dark:focus:bg-stone-800 focus:text-stone-900 dark:focus:text-stone-100 data-[highlighted]:bg-stone-100 dark:data-[highlighted]:bg-stone-800"
        >
          <Moon className="mr-2 h-4 w-4" />
          深色
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="cursor-pointer focus:bg-stone-100 dark:focus:bg-stone-800 focus:text-stone-900 dark:focus:text-stone-100 data-[highlighted]:bg-stone-100 dark:data-[highlighted]:bg-stone-800"
        >
          <Monitor className="mr-2 h-4 w-4" />
          跟随系统
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;
