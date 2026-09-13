import { useEffect, useState } from "react";
import { Settings, Search, Plus, Check, ArrowRight, ChevronDown, FolderInput } from "lucide-react";
import AutoComplete from "@/components/AutoComplete";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { SearchEngine, defaultSearchEngines, mergeBuiltinEngines } from "@/lib/defaultSearchEngines";
import { getStoredValue, migrateLocalStorageToSync, setStoredValue } from "@/lib/storage";
import { sortQuickLinkGroups } from "@/lib/quickLinkGroups";
import { ensureUrlHasProtocol } from "@/lib/url";
import { buildSearchEngineUrl } from "@/lib/searchEngineUrl";
import QuickLinkIcon from "@/components/QuickLinkIcon";
import { useI18n } from "@/hooks/useI18n";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

export default function Popup() {
    const { t } = useI18n();
    const [query, setQuery] = useState("");
    const { theme } = useTheme();
    const [showQuickLinks, setShowQuickLinks] = useState(false);
    const [showShortcutHints, setShowShortcutHints] = useState(false);

    const readOpenSearchInNewTabPopup = () => {
        try {
            const scoped = localStorage.getItem('openSearchInNewTabPopup');
            if (scoped !== null) return scoped === 'true';
            const legacy = localStorage.getItem('openSearchInNewTab') === 'true';
            localStorage.setItem('openSearchInNewTabPopup', String(legacy));
            return legacy;
        } catch {
            return false;
        }
    };

    // 是否在新标签页中打开搜索结果（仅 popup）
    const [openSearchInNewTabPopup, setOpenSearchInNewTabPopup] = useState(readOpenSearchInNewTabPopup);

    const [searchEngines, setSearchEngines] = useState<SearchEngine[]>(() => {
        try {
            const saved = localStorage.getItem('searchEngines');
            if (saved) return mergeBuiltinEngines(JSON.parse(saved));
        } catch {
            /* ignore */
        }
        return defaultSearchEngines;
    });

    const [quickLinks, setQuickLinks] = useState<QuickLink[]>(() => {
        try {
            const saved = localStorage.getItem('quickLinks');
            if (saved) {
                return JSON.parse(saved)
                    .map((link: QuickLink) => ({ ...link, enabled: link.enabled !== false }))
                    .filter((link: QuickLink) => link.enabled);
            }
        } catch {
            /* ignore */
        }
        return [];
    });

    // 分组只用来给"收藏到哪一组"列菜单，不参与 popup 的其他显示
    const [quickLinkGroups, setQuickLinkGroups] = useState<QuickLinkGroup[]>(() => {
        try {
            const saved = localStorage.getItem('quickLinkGroups');
            if (saved) return JSON.parse(saved);
        } catch {
            /* ignore */
        }
        return [];
    });

    const [searchEngine, setSearchEngine] = useState(() => {
        try {
            const saved = localStorage.getItem('currentSearchEngine');
            if (saved) return saved;
        } catch {
            /* ignore */
        }
        const def = defaultSearchEngines.find(e => e.isDefault);
        return def ? def.id : "google";
    });

    // 首次加载：迁移并从 chrome.storage.sync 取值
    useEffect(() => {
        let mounted = true;

        const load = async () => {
            await migrateLocalStorageToSync([
                'searchEngines',
                'quickLinks',
                'quickLinkGroups',
                'currentSearchEngine',
                'deletedBuiltinIds',
                'theme',
                'openSearchInNewTab',
                'openSearchInNewTabNewTab',
                'openSearchInNewTabPopup',
            ]);

            const fallbackEngineId = defaultSearchEngines.find(e => e.isDefault)?.id || "google";
            const [storedEngines, storedLinks, storedGroups, storedEngineId] = await Promise.all([
                getStoredValue<SearchEngine[]>('searchEngines', defaultSearchEngines),
                getStoredValue<QuickLink[]>('quickLinks', []),
                getStoredValue<QuickLinkGroup[]>('quickLinkGroups', []),
                getStoredValue<string>('currentSearchEngine', fallbackEngineId),
            ]);

            if (!mounted) return;

            const mergedEngines = mergeBuiltinEngines(storedEngines);
            setSearchEngines(mergedEngines);

            const normalizedLinks = storedLinks
                .map((link) => ({ ...link, enabled: link.enabled !== false }))
                .filter((link) => link.enabled);
            setQuickLinks(normalizedLinks);
            setQuickLinkGroups(storedGroups);

            if (storedEngineId) {
                setSearchEngine(storedEngineId);
            }
        };

        load();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const rehydrate = async () => {
            const fallbackEngineId = defaultSearchEngines.find(e => e.isDefault)?.id || "google";
            const [storedEngines, storedLinks, storedGroups, storedEngineId] = await Promise.all([
                getStoredValue<SearchEngine[]>('searchEngines', defaultSearchEngines),
                getStoredValue<QuickLink[]>('quickLinks', []),
                getStoredValue<QuickLinkGroup[]>('quickLinkGroups', []),
                getStoredValue<string>('currentSearchEngine', fallbackEngineId),
            ]);

            const mergedEngines = mergeBuiltinEngines(storedEngines);
            setSearchEngines(mergedEngines);

            const normalizedLinks = storedLinks
                .map((link) => ({ ...link, enabled: link.enabled !== false }))
                .filter((link) => link.enabled);
            setQuickLinks(normalizedLinks);
            setQuickLinkGroups(storedGroups);

            if (storedEngineId) {
                setSearchEngine(storedEngineId);
            }
        };

        const handler = () => {
            rehydrate();
            setOpenSearchInNewTabPopup(readOpenSearchInNewTabPopup());
        };
        window.addEventListener('settings:updated', handler);
        return () => window.removeEventListener('settings:updated', handler);
    }, []);

    // 根据快速链接数量决定是否显示
    useEffect(() => {
        setShowQuickLinks(quickLinks.length > 0 && quickLinks.length <= 4);
    }, [quickLinks]);

    // 导航函数：根据设置决定在当前标签页还是新标签页打开
    const navigateTo = (url: string) => {
        if (openSearchInNewTabPopup) {
            // 在新标签页打开
            if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                chrome.tabs.create({ url });
                window.close();
            } else {
                window.open(url, '_blank');
            }
        } else {
            // 在当前标签页打开
            const w = window as unknown as { chrome?: { tabs?: { update: (args: { url: string }) => void } } };
            if (typeof window !== "undefined" && w.chrome?.tabs) {
                w.chrome.tabs.update({ url });
                window.close();
            } else {
                window.location.href = url;
            }
        }
    };

    // 保存当前选中的搜索引擎
    const handleSearchEngineChange = (engineId: string) => {
        setSearchEngine(engineId);
        setStoredValue('currentSearchEngine', engineId);
    };

    // 判断是否为URL
    const isURL = (text: string) => {
        // 不能包含空格
        if (text.includes(' ')) return false;

        try {
            const urlToTest = text.startsWith('http') ? text : `http://${text}`;
            new URL(urlToTest);

            // 包含 . 的域名（如 google.com）
            if (text.includes('.')) return true;

            // localhost 或 localhost:port 格式
            if (/^localhost(:\d+)?(\/.*)?$/i.test(text)) return true;

            // 带有协议前缀的 localhost
            if (/^https?:\/\/localhost(:\d+)?(\/.*)?$/i.test(text)) return true;

            // IP地址格式（如 127.0.0.1:8080）
            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/.test(text)) return true;

            return false;
        } catch {
            return false;
        }
    };

    // 处理Kagi Assistant搜索
    const handleKagiSearch = (query: string) => {
        const params = new URLSearchParams({
            q: query,
            internet: 'true'
        });
        const url = `https://kagi.com/assistant?${params.toString()}`;
        navigateTo(url);
    };

    // 处理搜索提交
    const handleSubmit = (value: string) => {
        if (!value.trim()) return;

        if (isURL(value)) {
            const url = ensureUrlHasProtocol(value);
            navigateTo(url);
        } else {
            const engine = searchEngines.find(e => e.id === searchEngine);
            if (engine) {
                if (engine.id === 'kagi-assistant') {
                    handleKagiSearch(value);
                } else {
                    const searchUrl = buildSearchEngineUrl(engine, value);
                    if (searchUrl) {
                        navigateTo(searchUrl);
                    }
                }
            }
        }
    };

    // 打开快速链接
    const handleQuickLinkClick = (url: string) => {
        navigateTo(url);
    };

    // 打开浏览器设置页面
    const handleOpenSettings = () => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ type: "OPEN_BROWSER_SETTINGS" });
        }
    };

    // 添加当前页面到快速链接
    const [addStatus, setAddStatus] = useState<'idle' | 'added' | 'exists' | 'moved'>('idle');
    const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);

    useEffect(() => {
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
        chrome.runtime.sendMessage({ type: "GET_CURRENT_TAB" }, (res: unknown) => {
            const response = res as { success?: boolean; url?: string } | undefined;
            if (response?.success && response.url) {
                setCurrentTabUrl(response.url);
            }
        });
    }, []);

    const handlePopupOpenInNewTabChange = (checked: boolean) => {
        setOpenSearchInNewTabPopup(checked);
        void setStoredValue('openSearchInNewTabPopup', checked);
        try {
            window.dispatchEvent(new CustomEvent('settings:updated'));
        } catch {
            void 0;
        }
    };
    /**
     * 收藏当前页面。groupId 省略即落入未分组，与加入分组这个功能之前的行为一致。
     */
    const handleAddCurrentPage = async (groupId?: string) => {
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;

        chrome.runtime.sendMessage({ type: "GET_CURRENT_TAB" }, async (res: unknown) => {
            const response = res as { success?: boolean; url?: string; title?: string } | undefined;
            if (!response?.success || !response.url) return;
            setCurrentTabUrl(response.url);

            // 检查是否已存在
            const existingLinks = await getStoredValue<QuickLink[]>('quickLinks', []);
            const existing = existingLinks.find(link => link.url === response.url);
            if (existing) {
                // 已经在用户挑的这一组里了，什么都不用做
                if (existing.groupId === groupId) {
                    setAddStatus('exists');
                    setTimeout(() => setAddStatus('idle'), 2000);
                    return;
                }

                // 在别的组里。用户特地点开菜单挑了一组，这是一次明确的意图，
                // 只回一句"已存在"就把它丢掉了——链接仍躺在原处，而 popup 里
                // 没有任何地方能让他看出这件事。所以按他挑的改，并说清楚这次
                // 是"移动"而不是"新增"。
                const moved = existingLinks.map(link =>
                    link.id === existing.id ? { ...link, groupId } : link
                );
                await setStoredValue('quickLinks', moved);
                setQuickLinks(moved.filter(l => l.enabled));

                if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                    chrome.runtime.sendMessage({ type: 'QUICK_LINKS_UPDATED' });
                }

                setAddStatus('moved');
                setTimeout(() => setAddStatus('idle'), 2000);
                return;
            }

            // 添加新链接
            const newLink: QuickLink = {
                id: `link-${Date.now()}`,
                name: response.title || new URL(response.url).hostname,
                url: response.url,
                groupId,
                enabled: true,
            };
            const updated = [...existingLinks, newLink];
            await setStoredValue('quickLinks', updated);
            setQuickLinks(updated.filter(l => l.enabled));

            // 通知其他页面（如 newtab）刷新快速链接
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ type: 'QUICK_LINKS_UPDATED' });
            }

            setAddStatus('added');
            setTimeout(() => setAddStatus('idle'), 2000);
        });
    };

    const isKagiSelected = searchEngine === 'kagi-assistant';

    // 同步主题设置
    useEffect(() => {
        if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    // 键盘快捷键：Alt + 数字 切换已启用的搜索引擎
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const key = e.key;
            if (!/^[1-9]$/.test(key)) return;
            // 仅响应 Alt + 数字
            if (!e.altKey) return;

            const enabled = searchEngines.filter(s => s.enabled !== false);
            if (enabled.length === 0) return;

            const idx = Math.min(parseInt(key, 10) - 1, enabled.length - 1);
            const target = enabled[idx];
            if (target && target.id !== searchEngine) {
                e.preventDefault();
                handleSearchEngineChange(target.id);
            }
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [searchEngines, searchEngine]);

    // 按住 Alt 键 400ms 后显示快捷键提示
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Alt' && !timer) {
                timer = setTimeout(() => setShowShortcutHints(true), 400);
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                setShowShortcutHints(false);
            }
        };

        const onBlur = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            setShowShortcutHints(false);
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
            if (timer) clearTimeout(timer);
        };
    }, []);

    // 动态计算高度
    const popupHeight = showQuickLinks ? "360px" : "270px";

    return (
        <div
            // 弹窗容器本身就是那扇窗，不是浮在内容上的玻璃面板：它背后是浏览器
            // 的弹窗底，没有内容可透。所以这里用实底加色调起伏，玻璃留给窗内控件
            // relative 是必需的：设置按钮是绝对定位的，没有它会相对视口摆放。
            // 真实弹窗里视口恰好等于窗口尺寸，两者重合把这个问题盖住了
            className="ambient-surface bg-background relative rounded-2xl overflow-hidden"
            style={{ width: "400px", height: popupHeight }}
        >
            <div className="p-4 h-full flex flex-col">
                {/* 设置按钮 */}
                <div className="absolute top-3 right-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={handleOpenSettings}
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>

                {/* 搜索框区域 */}
                <div className="flex-1 flex flex-col justify-center">
                    <div className="relative mb-3">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-600 pointer-events-none z-10" />
                        <AutoComplete
                            value={query}
                            onChange={setQuery}
                            onSubmit={handleSubmit}
                            placeholder={isKagiSelected ? t('index.kagiPlaceholder') : t('index.placeholder')}
                            className="liquid-glass w-full h-11 text-sm px-10 pr-11 rounded-full text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none transition-all duration-200"
                        />

                        {/* 与首页一致：左边的放大镜已说明这是搜索框，这里用箭头表示执行 */}
                        <Button
                            onClick={() => handleSubmit(query)}
                            size="icon"
                            variant="ghost"
                            aria-label={isKagiSelected ? t('index.ask') : t('common.search')}
                            className={cn(
                                "absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full transition-colors duration-200",
                                query.trim()
                                    ? "bg-foreground/85 text-background hover:bg-foreground"
                                    : "text-muted-foreground/60 hover:bg-foreground/10 hover:text-foreground"
                            )}
                        >
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    {/* 搜索引擎选择：与首页同款分段控件 */}
                    <div className="mb-3 flex justify-center">
                        <div className="inline-flex flex-wrap items-center justify-center gap-0.5">
                        {searchEngines.filter(e => e.enabled !== false).map((engine, index) => (
                            <button
                                key={engine.id}
                                type="button"
                                className={`relative inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors duration-200 cursor-pointer select-none border-0 outline-none focus:outline-none ${searchEngine === engine.id
                                    ? "bg-foreground/[0.08] text-foreground"
                                    : "text-muted-foreground hover:text-foreground bg-transparent"
                                    }`}
                                onClick={() => handleSearchEngineChange(engine.id)}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                {engine.name}
                                {/* 与首页一致：快捷键作为名称后的一个淡号码，不做成浮标 */}
                                {showShortcutHints && index < 9 && (
                                    <span className="ml-0.5 text-[10px] font-normal tabular-nums text-muted-foreground/70 animate-in fade-in duration-150">
                                        {index + 1}
                                    </span>
                                )}
                                {engine.isAI && (
                                    <span className="rounded bg-foreground/10 px-1 py-0.5 text-[10px] leading-none text-foreground/70">AI</span>
                                )}
                            </button>
                        ))}
                        </div>
                    </div>

                    {/* 快速链接。名称随图标一起显示，这里和首页是同一个问题：
                        纯图标在 favicon 重复或过于相似时无法分辨 */}
                    {showQuickLinks && (
                        <div className="mt-auto grid grid-cols-4 gap-1">
                            {quickLinks.slice(0, 4).map((link) => (
                                <button
                                    key={link.id}
                                    type="button"
                                    className="group flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 transition-colors duration-150 hover:bg-foreground/[0.06] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => handleQuickLinkClick(link.url)}
                                    title={link.name}
                                >
                                    <span className="block transition-transform duration-200 group-hover:scale-110">
                                        <QuickLinkIcon name={link.name} url={link.url} icon={link.icon} size={28} />
                                    </span>
                                    <span className="w-full truncate text-center text-[10px] leading-none text-foreground/75">
                                        {link.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 添加当前页面按钮 */}
                    <div className="mt-auto border-t border-foreground/10 pt-2">
                        <div className="flex items-center justify-between gap-3 px-1 pb-2">
                            <p className="text-xs text-muted-foreground">
                                {t('popup.openInNewTab')}
                            </p>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={openSearchInNewTabPopup}
                                    onChange={(e) => handlePopupOpenInNewTabChange(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-black/[0.12] dark:bg-white/[0.18] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-black/10 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-stone-600 peer-checked:bg-foreground/70"></div>
                            </label>
                        </div>
                        {/* 有分组时按钮变成菜单的入口：一级是"收藏"这个动作，二级是
                            收藏到哪一组。没有分组就退回普通按钮，一次点击直接收藏，
                            和加入分组这个功能之前完全一样——不该为了一个空菜单多一次点击。*/}
                        {quickLinkGroups.length > 0 ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        disabled={addStatus !== 'idle'}
                                        className="w-full h-9 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
                                    >
                                        {addStatus === 'added' ? (
                                            <><Check className="h-3.5 w-3.5 mr-1.5 text-stone-500" />{t('popup.added')}</>
                                        ) : addStatus === 'moved' ? (
                                            <><FolderInput className="h-3.5 w-3.5 mr-1.5 text-stone-500" />{t('popup.moved')}</>
                                        ) : addStatus === 'exists' ? (
                                            <>{t('popup.exists')}</>
                                        ) : (
                                            <>
                                                <Plus className="h-3.5 w-3.5 mr-1.5" />
                                                {t('popup.addPage')}
                                                <ChevronDown className="h-3.5 w-3.5 ml-1.5 opacity-60" />
                                            </>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="center"
                                    // 弹窗很矮，菜单贴着上下边缘会像是被切断的；留出一圈
                                    // 余量，滚动条也就有地方落
                                    collisionPadding={8}
                                    className="w-52"
                                >
                                    <DropdownMenuItem onClick={() => handleAddCurrentPage()}>
                                        {t('contextMenu.ungrouped')}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {sortQuickLinkGroups(quickLinkGroups).map((group) => (
                                        <DropdownMenuItem
                                            key={group.id}
                                            onClick={() => handleAddCurrentPage(group.id)}
                                        >
                                            {group.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Button
                                variant="ghost"
                                onClick={() => handleAddCurrentPage()}
                                disabled={addStatus !== 'idle'}
                                className="w-full h-9 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
                            >
                                {addStatus === 'added' ? (
                                    <><Check className="h-3.5 w-3.5 mr-1.5 text-stone-500" />{t('popup.added')}</>
                                ) : addStatus === 'moved' ? (
                                    <><FolderInput className="h-3.5 w-3.5 mr-1.5 text-stone-500" />{t('popup.moved')}</>
                                ) : addStatus === 'exists' ? (
                                    <>{t('popup.exists')}</>
                                ) : (
                                    <><Plus className="h-3.5 w-3.5 mr-1.5" />{t('popup.addPage')}</>
                                )}
                            </Button>
                        )}
                        {currentTabUrl && (
                            <div className="mt-1.5 px-2 text-[11px] text-muted-foreground flex items-center gap-1">
                                <span className="flex-shrink-0">{t('popup.addPageUrl')}</span>
                                <span className="min-w-0 flex-1 truncate" title={currentTabUrl}>
                                    {currentTabUrl}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 
