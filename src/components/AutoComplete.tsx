import { useState, useEffect, useRef, useCallback } from "react";
import { t } from "@/lib/i18n";
import {
  getSearchQueryVariants,
  getInlineCompletionCandidate,
  getInlineCompletionText,
  normalizeQuery,
  rankSuggestions,
  shouldUseFallbackPool,
} from "@/lib/autocompleteMatching.js";

interface SuggestionItem {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  type: 'history' | 'bookmark';
  visitCount?: number;
  typedCount?: number;
  lastVisitTime?: number;
  score?: number;
}

interface AutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const INPUT_DEBOUNCE_MS = 120;
const MAX_HISTORY_RESULTS = 30;
const MAX_BOOKMARK_RESULTS = 20;
const RECENT_HISTORY_RESULTS = 200;
const RECENT_BOOKMARK_RESULTS = 200;
const QUERY_CACHE_LIMIT = 100;

const buildFaviconUrl = (url: string) => {
  try {
    const hostname = new URL(url).hostname;
    return hostname ? `https://icons.duckduckgo.com/ip3/${hostname}.ico` : "";
  } catch {
    return "";
  }
};

const mapHistoryItem = (item: chrome.history.HistoryItem, index: number): SuggestionItem | null => {
  const url = item.url || "";
  if (!url) return null;

  return {
    id: `history-${url}-${index}`,
    title: item.title || url,
    url,
    favicon: buildFaviconUrl(url),
    type: 'history',
    visitCount: item.visitCount,
    typedCount: item.typedCount,
    lastVisitTime: item.lastVisitTime
  };
};

const mapBookmarkItem = (bookmark: chrome.bookmarks.BookmarkTreeNode, index: number): SuggestionItem | null => {
  const url = bookmark.url || "";
  if (!url) return null;

  return {
    id: `bookmark-${url}-${index}`,
    title: bookmark.title || url,
    url,
    favicon: buildFaviconUrl(url),
    type: 'bookmark'
  };
};

const flattenBookmarks = (nodes: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] => {
  const result: chrome.bookmarks.BookmarkTreeNode[] = [];

  const visit = (node: chrome.bookmarks.BookmarkTreeNode) => {
    if (node.url) {
      result.push(node);
    }

    for (const child of node.children || []) {
      visit(child);
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  return result;
};

const setQueryCache = (cache: Map<string, SuggestionItem[]>, key: string, value: SuggestionItem[]) => {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);

  if (cache.size > QUERY_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
};

const mergeSuggestionItemsByUrl = (items: SuggestionItem[]): SuggestionItem[] => {
  const byUrl = new Map<string, SuggestionItem>();

  for (const item of items) {
    if (!item?.url) continue;

    const dedupeKey = item.url.toLowerCase();
    const existing = byUrl.get(dedupeKey);
    if (!existing) {
      byUrl.set(dedupeKey, item);
      continue;
    }

    byUrl.set(dedupeKey, {
      ...existing,
      title: existing.title || item.title || item.url,
      favicon: existing.favicon || item.favicon,
      type: existing.type === 'bookmark' || item.type === 'bookmark' ? 'bookmark' : 'history',
      visitCount: Math.max(existing.visitCount || 0, item.visitCount || 0),
      typedCount: Math.max(existing.typedCount || 0, item.typedCount || 0),
      lastVisitTime: Math.max(existing.lastVisitTime || 0, item.lastVisitTime || 0)
    });
  }

  return [...byUrl.values()];
};

const AutoComplete = ({ value, onChange, onSubmit, placeholder, className }: AutoCompleteProps) => {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const requestIdRef = useRef(0);
  const queryCacheRef = useRef<Map<string, SuggestionItem[]>>(new Map());
  const lastQueryRef = useRef("");
  const lastCandidatePoolRef = useRef<SuggestionItem[]>([]);
  const inlineCompletionBlockedByDeleteRef = useRef(false);
  const inlineCompletionTargetRef = useRef<string | null>(null);
  const inlineCompletionDisplayRef = useRef<string | null>(null);
  const recentHistoryPoolRef = useRef<SuggestionItem[] | null>(null);
  const recentHistoryPromiseRef = useRef<Promise<SuggestionItem[]> | null>(null);
  const recentBookmarkPoolRef = useRef<SuggestionItem[] | null>(null);
  const recentBookmarkPromiseRef = useRef<Promise<SuggestionItem[]> | null>(null);

  // 检查是否在Chrome扩展环境中
  const isExtension = typeof chrome !== 'undefined' && chrome.history && chrome.bookmarks;

  // 获取Chrome浏览器历史记录
  const getChromeHistory = useCallback(async (text: string): Promise<SuggestionItem[]> => {
    const query = text.trim();
    if (!isExtension || !query) {
      return [];
    }

    try {
      const queries = getSearchQueryVariants(query);
      const resultGroups = await Promise.all(
        queries.map((variant) => chrome.history.search({
          text: variant,
          startTime: 0,
          maxResults: MAX_HISTORY_RESULTS
        }))
      );

      return mergeSuggestionItemsByUrl(
        resultGroups
          .flat()
          .map(mapHistoryItem)
          .filter((item): item is SuggestionItem => item !== null)
      ).slice(0, MAX_HISTORY_RESULTS);
    } catch (error) {
      console.error('Failed to get Chrome history:', error);
      return [];
    }
  }, [isExtension]);

  // 获取Chrome书签
  const getChromeBookmarks = useCallback(async (text: string): Promise<SuggestionItem[]> => {
    const query = text.trim();
    if (!isExtension || !query) {
      return [];
    }

    try {
      const queries = getSearchQueryVariants(query);
      const resultGroups = await Promise.all(
        queries.map((variant) => chrome.bookmarks.search(variant))
      );
      return mergeSuggestionItemsByUrl(
        resultGroups
          .flat()
          .map(mapBookmarkItem)
          .filter((item): item is SuggestionItem => item !== null)
      ).slice(0, MAX_BOOKMARK_RESULTS);
    } catch (error) {
      console.error('Failed to get Chrome bookmarks:', error);
      return [];
    }
  }, [isExtension]);

  const getIndexedHostnameSuggestions = useCallback(async (text: string): Promise<SuggestionItem[]> => {
    const query = text.trim();
    if (!isExtension || !query || query.includes(" ") || !chrome.runtime?.sendMessage) {
      return [];
    }

    return new Promise((resolve) => {
      const runtimeApi = chrome.runtime as typeof chrome.runtime & {
        lastError?: unknown;
      };

      try {
        chrome.runtime.sendMessage(
          {
            type: "GET_HOSTNAME_AUTOCOMPLETE",
            query,
            limit: MAX_HISTORY_RESULTS,
          },
          (response: { success?: boolean; candidates?: SuggestionItem[] } | undefined) => {
            if (runtimeApi.lastError || !response?.success || !Array.isArray(response.candidates)) {
              resolve([]);
              return;
            }

            resolve(
              response.candidates.filter((item): item is SuggestionItem =>
                Boolean(item?.id && item?.url)
              )
            );
          }
        );
      } catch {
        resolve([]);
      }
    });
  }, [isExtension]);

  const getRecentHistoryPool = useCallback(async (): Promise<SuggestionItem[]> => {
    if (!isExtension) {
      return [];
    }

    if (recentHistoryPoolRef.current) {
      return recentHistoryPoolRef.current;
    }

    if (!recentHistoryPromiseRef.current) {
      recentHistoryPromiseRef.current = chrome.history.search({
        text: '',
        startTime: 0,
        maxResults: RECENT_HISTORY_RESULTS
      }).then((results) => {
        const mapped = results
          .map(mapHistoryItem)
          .filter((item): item is SuggestionItem => item !== null);
        recentHistoryPoolRef.current = mapped;
        return mapped;
      }).catch((error) => {
        console.error('Failed to get recent Chrome history:', error);
        return [];
      }).finally(() => {
        recentHistoryPromiseRef.current = null;
      });
    }

    return recentHistoryPromiseRef.current;
  }, [isExtension]);

  const getRecentBookmarkPool = useCallback(async (): Promise<SuggestionItem[]> => {
    if (!isExtension) {
      return [];
    }

    if (recentBookmarkPoolRef.current) {
      return recentBookmarkPoolRef.current;
    }

    if (!recentBookmarkPromiseRef.current) {
      recentBookmarkPromiseRef.current = chrome.bookmarks.getTree().then((tree) => {
        const mapped = flattenBookmarks(tree)
          .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
          .slice(0, RECENT_BOOKMARK_RESULTS)
          .map(mapBookmarkItem)
          .filter((item): item is SuggestionItem => item !== null);
        recentBookmarkPoolRef.current = mapped;
        return mapped;
      }).catch((error) => {
        console.error('Failed to get bookmark pool:', error);
        return [];
      }).finally(() => {
        recentBookmarkPromiseRef.current = null;
      });
    }

    return recentBookmarkPromiseRef.current;
  }, [isExtension]);

  // 内联补全功能
  const applyInlineCompletion = useCallback((query: string, suggestions: SuggestionItem[]) => {
    if (inlineCompletionBlockedByDeleteRef.current) return;
    if (!suggestions.length || !inputRef.current || isComposing || !query.trim()) return;

    const matchedCandidate = suggestions
      .map((suggestion) => getInlineCompletionCandidate(query, suggestion.url))
      .find((candidate) => candidate !== null);

    if (!matchedCandidate) return;

    const input = inputRef.current;
    const currentValue = input.value;

    if (currentValue === query) {
      input.value = matchedCandidate.previewText;
      input.setSelectionRange(query.length, matchedCandidate.previewText.length);
      inlineCompletionTargetRef.current = matchedCandidate.targetUrl;
      inlineCompletionDisplayRef.current = matchedCandidate.previewText;
      onChange(matchedCandidate.previewText);
    }
  }, [onChange, isComposing]);

  const getCurrentInputValue = useCallback(() => {
    return inputRef.current?.value ?? value;
  }, [value]);

  const commitSuggestions = useCallback((query: string, nextSuggestions: SuggestionItem[], shouldCache = true) => {
    setSuggestions(nextSuggestions);
    setShowSuggestions(nextSuggestions.length > 0);
    setSelectedIndex(-1);

    if (nextSuggestions.length === 0) {
      inlineCompletionTargetRef.current = null;
      inlineCompletionDisplayRef.current = null;
    }

    const normalizedQuery = normalizeQuery(query);
    lastQueryRef.current = normalizedQuery;
    if (normalizedQuery && shouldCache) {
      setQueryCache(queryCacheRef.current, normalizedQuery, nextSuggestions);
    }

    if (nextSuggestions.length > 0) {
      applyInlineCompletion(query, nextSuggestions);
    }
  }, [applyInlineCompletion]);

  const getSuggestions = useCallback(async (query: string) => {
    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
      requestIdRef.current += 1;
      lastQueryRef.current = "";
      lastCandidatePoolRef.current = [];
      inlineCompletionTargetRef.current = null;
      inlineCompletionDisplayRef.current = null;
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const cached = queryCacheRef.current.get(normalizedQuery);
    if (cached) {
      commitSuggestions(query, cached, false);
      return;
    }

    if (
      normalizedQuery.startsWith(lastQueryRef.current) &&
      lastCandidatePoolRef.current.length > 0
    ) {
      const quickSuggestions = rankSuggestions(query, lastCandidatePoolRef.current);
      if (quickSuggestions.length > 0) {
        commitSuggestions(query, quickSuggestions, false);
      }
    }

    const currentRequestId = ++requestIdRef.current;

      try {
        let indexedHostnameResults: SuggestionItem[] = [];
        let historyResults: SuggestionItem[] = [];
        let bookmarkResults: SuggestionItem[] = [];
        let fallbackHistoryResults: SuggestionItem[] = [];
        let fallbackBookmarkResults: SuggestionItem[] = [];

        if (isExtension) {
          const shouldUseFallback = shouldUseFallbackPool(query);
          [indexedHostnameResults, historyResults, bookmarkResults, fallbackHistoryResults, fallbackBookmarkResults] = await Promise.all([
            getIndexedHostnameSuggestions(query),
            getChromeHistory(query),
            getChromeBookmarks(query),
            shouldUseFallback ? getRecentHistoryPool() : Promise.resolve([]),
            shouldUseFallback ? getRecentBookmarkPool() : Promise.resolve([])
          ]);
      }

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      const candidatePool = [
        ...indexedHostnameResults,
        ...historyResults,
        ...bookmarkResults,
        ...fallbackHistoryResults,
        ...fallbackBookmarkResults
      ];
      lastCandidatePoolRef.current = candidatePool;
      const rankedSuggestions = rankSuggestions(query, candidatePool);

      commitSuggestions(query, rankedSuggestions);
    } catch (error) {
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      console.error('获取建议失败:', error);
      inlineCompletionTargetRef.current = null;
      inlineCompletionDisplayRef.current = null;
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [isExtension, getIndexedHostnameSuggestions, getChromeHistory, getChromeBookmarks, getRecentHistoryPool, getRecentBookmarkPool, commitSuggestions]);

  const debouncedGetSuggestions = useCallback((query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      getSuggestions(query);
    }, INPUT_DEBOUNCE_MS);
  }, [getSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const nativeInputEvent = e.nativeEvent as InputEvent | undefined;
    const inputType = nativeInputEvent?.inputType || "";
    if (inputType.startsWith("delete")) {
      inlineCompletionBlockedByDeleteRef.current = true;
    } else if (inputType.startsWith("insert")) {
      inlineCompletionBlockedByDeleteRef.current = false;
    }

    inlineCompletionTargetRef.current = null;
    inlineCompletionDisplayRef.current = null;
    onChange(newValue);

    if (!isComposing) {
      debouncedGetSuggestions(newValue);
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    inlineCompletionBlockedByDeleteRef.current = false;
    inlineCompletionTargetRef.current = null;
    inlineCompletionDisplayRef.current = null;
    const newValue = e.currentTarget.value;
    onChange(newValue);
    debouncedGetSuggestions(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = inputRef.current;
    const commitInlinePreview = () => {
      if (!input || input.selectionStart === input.selectionEnd) return false;

      e.preventDefault();
      if (inlineCompletionTargetRef.current) {
        const committedText = getInlineCompletionText(inlineCompletionTargetRef.current);
        input.value = committedText;
        inlineCompletionDisplayRef.current = committedText;
        onChange(committedText);
      }
      input.setSelectionRange(input.value.length, input.value.length);
      return true;
    };

    if (isComposing) return;

    if (e.key === 'Backspace' || e.key === 'Delete') {
      inlineCompletionBlockedByDeleteRef.current = true;
      inlineCompletionTargetRef.current = null;
      inlineCompletionDisplayRef.current = null;
    } else if (
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey
    ) {
      inlineCompletionBlockedByDeleteRef.current = false;
    }

    if (!showSuggestions) {
      if (e.key === 'Enter') {
        const currentValue = getCurrentInputValue();
        const inlineTarget = inlineCompletionTargetRef.current;
        const inlineDisplay = inlineCompletionDisplayRef.current;
        onSubmit(inlineTarget && inlineDisplay === currentValue ? inlineTarget : currentValue);
      } else if (e.key === 'Tab' || e.key === 'ArrowRight') {
        commitInlinePreview();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        } else {
          const currentValue = getCurrentInputValue();
          const inlineTarget = inlineCompletionTargetRef.current;
          const inlineDisplay = inlineCompletionDisplayRef.current;
          onSubmit(inlineTarget && inlineDisplay === currentValue ? inlineTarget : currentValue);
        }
        break;
      case 'Escape':
        e.preventDefault();
        inlineCompletionTargetRef.current = null;
        inlineCompletionDisplayRef.current = null;
        setShowSuggestions(false);
        setSuggestions([]);
        setSelectedIndex(-1);
        break;
      case 'Tab':
      case 'ArrowRight': {
        commitInlinePreview();
        break;
      }
    }
  };

  const handleSuggestionSelect = (suggestion: SuggestionItem) => {
    inlineCompletionBlockedByDeleteRef.current = false;
    inlineCompletionTargetRef.current = null;
    inlineCompletionDisplayRef.current = null;
    onChange(suggestion.url);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    onSubmit(suggestion.url);
  };

  const handleSuggestionClick = (suggestion: SuggestionItem) => {
    handleSuggestionSelect(suggestion);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const cache = queryCacheRef.current;
    return () => {
      requestIdRef.current += 1;
      lastQueryRef.current = "";
      lastCandidatePoolRef.current = [];
      inlineCompletionBlockedByDeleteRef.current = false;
      inlineCompletionTargetRef.current = null;
      inlineCompletionDisplayRef.current = null;
      recentHistoryPoolRef.current = null;
      recentHistoryPromiseRef.current = null;
      recentBookmarkPoolRef.current = null;
      recentBookmarkPromiseRef.current = null;
      cache.clear();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // 自动聚焦到输入框
  useEffect(() => {
    // 多次尝试聚焦，确保能够获得焦点
    const focusAttempts = [50, 150, 300, 500];
    const timers: NodeJS.Timeout[] = [];

    focusAttempts.forEach(delay => {
      const timer = setTimeout(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
      }, delay);
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  // 监听键盘 & 组合事件，任何输入法都能触发
  useEffect(() => {
    // 判断事件目标是否为可编辑元素
    const isInteractive = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      target.closest('input, textarea, [contenteditable="true"]');

    const tryFocus = () => {
      if (document.activeElement !== inputRef.current && inputRef.current) {
        inputRef.current.focus();
      }
    };

    // 中文/日文等输入法开始时
    const onCompStart = (e: CompositionEvent) => {
      if (!isInteractive(e.target)) tryFocus();
    };

    // 任意字符按键（排除功能键）按下时
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isInteractive(e.target)) return;
      tryFocus();
    };

    const compHandler = (e: Event) => onCompStart(e as CompositionEvent);
    document.addEventListener('compositionstart', compHandler);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('compositionstart', compHandler);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        spellCheck={false}
        autoFocus
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-2 bg-popover rounded-xl shadow-xl border border-border z-50 max-h-96 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer border-b border-border/50 last:border-b-0 transition-colors ${index === selectedIndex ? 'bg-accent' : ''
                }`}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                {suggestion.favicon ? (
                  <img src={suggestion.favicon} alt="" className="w-4 h-4" onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }} />
                ) : (
                  <div className="w-4 h-4 bg-muted-foreground/30 rounded"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">
                  {suggestion.title}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {suggestion.url}
                </div>
              </div>
              <div className="flex-shrink-0">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${suggestion.type === 'history'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-accent text-accent-foreground'
                  }`}>
                  {suggestion.type === 'history' ? t('autocomplete.history') : t('autocomplete.bookmark')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutoComplete;
