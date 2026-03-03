import { useState, useEffect, useRef, useCallback } from "react";
import { t } from "@/lib/i18n";

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
const MAX_SUGGESTIONS = 10;
const QUERY_CACHE_LIMIT = 100;

const normalizeQuery = (text: string) => text.trim().toLowerCase();
const normalizeUrlForMatch = (url: string) => url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
const getInlineCompletionText = (url: string) => {
  let text = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
  if (text.includes('/')) {
    text = text.split('/')[0];
  }
  return text;
};

const buildFaviconUrl = (url: string) => {
  try {
    const hostname = new URL(url).hostname;
    return hostname ? `https://icons.duckduckgo.com/ip3/${hostname}.ico` : "";
  } catch {
    return "";
  }
};

const matchesSuggestion = (normalizedQuery: string, item: SuggestionItem) => {
  const title = item.title.toLowerCase();
  const rawUrl = item.url.toLowerCase();
  const normalizedUrl = normalizeUrlForMatch(item.url);
  return (
    title.includes(normalizedQuery) ||
    rawUrl.includes(normalizedQuery) ||
    normalizedUrl.includes(normalizedQuery)
  );
};

const getRecencyBoost = (lastVisitTime?: number) => {
  if (!lastVisitTime) return 0;

  const ageInDays = (Date.now() - lastVisitTime) / (1000 * 60 * 60 * 24);
  if (ageInDays <= 1) return 45;
  if (ageInDays <= 7) return 35;
  if (ageInDays <= 30) return 22;
  if (ageInDays <= 90) return 10;
  return 0;
};

const scoreSuggestion = (normalizedQuery: string, item: SuggestionItem) => {
  const title = item.title.toLowerCase();
  const rawUrl = item.url.toLowerCase();
  const normalizedUrl = normalizeUrlForMatch(item.url);

  let score = 0;

  if (normalizedUrl.startsWith(normalizedQuery)) score += 120;
  else if (rawUrl.startsWith(normalizedQuery)) score += 110;
  else if (normalizedUrl.includes(normalizedQuery)) score += 45;

  if (title.startsWith(normalizedQuery)) score += 80;
  else if (title.includes(normalizedQuery)) score += 30;

  if (item.type === 'bookmark') score += 35;

  score += Math.min((item.typedCount || 0) * 10, 80);
  score += Math.min(Math.log2((item.visitCount || 0) + 1) * 12, 60);
  score += getRecencyBoost(item.lastVisitTime);

  return score;
};

const rankSuggestions = (query: string, items: SuggestionItem[]): SuggestionItem[] => {
  const normalizedQuery = normalizeQuery(query);
  const bestByUrl = new Map<string, SuggestionItem>();

  for (const item of items) {
    if (!matchesSuggestion(normalizedQuery, item)) continue;

    const score = scoreSuggestion(normalizedQuery, item);
    const rankedItem = { ...item, score };
    const dedupeKey = item.url.toLowerCase();
    const existing = bestByUrl.get(dedupeKey);

    if (!existing || (existing.score || 0) < score) {
      bestByUrl.set(dedupeKey, rankedItem);
    }
  }

  return [...bestByUrl.values()]
    .sort((a, b) =>
      (b.score || 0) - (a.score || 0) ||
      (b.typedCount || 0) - (a.typedCount || 0) ||
      (b.visitCount || 0) - (a.visitCount || 0) ||
      (b.lastVisitTime || 0) - (a.lastVisitTime || 0)
    )
    .slice(0, MAX_SUGGESTIONS);
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

  // 检查是否在Chrome扩展环境中
  const isExtension = typeof chrome !== 'undefined' && chrome.history && chrome.bookmarks;

  // 获取Chrome浏览器历史记录
  const getChromeHistory = useCallback(async (text: string): Promise<SuggestionItem[]> => {
    const query = text.trim();
    if (!isExtension || !query) {
      return [];
    }

    try {
      const results = await chrome.history.search({
        text: query,
        startTime: 0,
        maxResults: MAX_HISTORY_RESULTS
      });

      return results.map((item, index) => {
        const url = item.url || "";
        if (!url) return null;

        return {
          id: `history-${url}-${index}`,
          title: item.title || url,
          url,
          favicon: buildFaviconUrl(url),
          type: 'history' as const,
          visitCount: item.visitCount,
          typedCount: item.typedCount,
          lastVisitTime: item.lastVisitTime
        };
      }).filter((item): item is SuggestionItem => item !== null);
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
      const results = await chrome.bookmarks.search(query);
      return results
        .filter((bookmark) => Boolean(bookmark.url))
        .slice(0, MAX_BOOKMARK_RESULTS)
        .map((bookmark, index) => {
          const url = bookmark.url || "";
          return {
            id: `bookmark-${url}-${index}`,
            title: bookmark.title || url,
            url,
            favicon: buildFaviconUrl(url),
            type: 'bookmark' as const
          };
        });
    } catch (error) {
      console.error('Failed to get Chrome bookmarks:', error);
      return [];
    }
  }, [isExtension]);

  // 内联补全功能
  const applyInlineCompletion = useCallback((query: string, suggestions: SuggestionItem[]) => {
    if (inlineCompletionBlockedByDeleteRef.current) return;
    if (!suggestions.length || !inputRef.current || isComposing || !query.trim()) return;

    const normalizedQuery = query.toLowerCase();
    const matchedSuggestion = suggestions.find((suggestion) => {
      const text = getInlineCompletionText(suggestion.url).toLowerCase();
      return text.startsWith(normalizedQuery) && text.length > normalizedQuery.length;
    });
    if (!matchedSuggestion) return;

    const completionText = getInlineCompletionText(matchedSuggestion.url);

    const input = inputRef.current;
    const currentValue = input.value;

    if (currentValue === query) {
      input.value = completionText;
      input.setSelectionRange(query.length, completionText.length);
      onChange(completionText);
    }
  }, [onChange, isComposing]);

  const getCurrentInputValue = useCallback(() => {
    return inputRef.current?.value ?? value;
  }, [value]);

  const commitSuggestions = useCallback((query: string, nextSuggestions: SuggestionItem[], shouldCache = true) => {
    setSuggestions(nextSuggestions);
    setShowSuggestions(nextSuggestions.length > 0);
    setSelectedIndex(-1);

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
      let historyResults: SuggestionItem[] = [];
      let bookmarkResults: SuggestionItem[] = [];

      if (isExtension) {
        [historyResults, bookmarkResults] = await Promise.all([
          getChromeHistory(query),
          getChromeBookmarks(query)
        ]);
      }

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      const candidatePool = [...historyResults, ...bookmarkResults];
      lastCandidatePoolRef.current = candidatePool;
      const rankedSuggestions = rankSuggestions(query, candidatePool);

      commitSuggestions(query, rankedSuggestions);
    } catch (error) {
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      console.error('获取建议失败:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [isExtension, getChromeHistory, getChromeBookmarks, commitSuggestions]);

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
    const newValue = e.currentTarget.value;
    onChange(newValue);
    debouncedGetSuggestions(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return;

    if (e.key === 'Backspace' || e.key === 'Delete') {
      inlineCompletionBlockedByDeleteRef.current = true;
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
        onSubmit(getCurrentInputValue());
      } else if (e.key === 'Tab' || e.key === 'ArrowRight') {
        const input = inputRef.current;
        if (input && input.selectionStart !== input.selectionEnd) {
          e.preventDefault();
          input.setSelectionRange(input.value.length, input.value.length);
        }
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
          onSubmit(getCurrentInputValue());
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSuggestions([]);
        setSelectedIndex(-1);
        break;
      case 'Tab':
      case 'ArrowRight': {
        const input = inputRef.current;
        if (input && input.selectionStart !== input.selectionEnd) {
          e.preventDefault();
          input.setSelectionRange(input.value.length, input.value.length);
        }
        break;
      }
    }
  };

  const handleSuggestionSelect = (suggestion: SuggestionItem) => {
    inlineCompletionBlockedByDeleteRef.current = false;
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
          className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-stone-900 rounded-xl shadow-xl border border-stone-200 dark:border-stone-800 z-50 max-h-96 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer border-b border-stone-100 dark:border-stone-800 last:border-b-0 transition-colors ${index === selectedIndex ? 'bg-stone-100 dark:bg-stone-800' : ''
                }`}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                {suggestion.favicon ? (
                  <img src={suggestion.favicon} alt="" className="w-4 h-4" onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }} />
                ) : (
                  <div className="w-4 h-4 bg-stone-300 dark:bg-stone-600 rounded"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-stone-900 dark:text-stone-100 truncate">
                  {suggestion.title}
                </div>
                <div className="text-sm text-stone-500 dark:text-stone-400 truncate">
                  {suggestion.url}
                </div>
              </div>
              <div className="flex-shrink-0">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${suggestion.type === 'history'
                  ? 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                  : 'bg-stone-300 dark:bg-stone-600 text-stone-800 dark:text-stone-200'
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
