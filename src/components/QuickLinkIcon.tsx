import { useMemo, useState, useEffect } from "react";
import { getCachedFavicon, updateMemoryCache } from "@/lib/faviconCache";
import { ensureUrlHasProtocol } from "@/lib/url";

interface QuickLinkIconProps {
    name: string;
    url: string;
    icon?: string;
    size?: number;
    className?: string;
}

const QuickLinkIcon = ({ name, url, icon, size = 32, className = "" }: QuickLinkIconProps) => {
    const [loadFailed, setLoadFailed] = useState(false);
    const [stage, setStage] = useState(0);
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

    const normalizedUrl = useMemo(() => ensureUrlHasProtocol(url), [url]);

    const hostname = useMemo(() => {
        try {
            return new URL(normalizedUrl).hostname;
        } catch {
            return url;
        }
    }, [normalizedUrl, url]);

    const label = useMemo(() => {
        const source = (name || hostname || "?").trim();
        return source ? source.charAt(0).toUpperCase() : "?";
    }, [name, hostname]);

    const isExtension = typeof chrome !== "undefined";
    const pageUrl = useMemo(() => {
        try {
            return new URL(normalizedUrl).toString();
        } catch {
            return url;
        }
    }, [normalizedUrl, url]);

    const sources = useMemo(() => {
        // 注意：不使用 chrome://favicon/ 因为扩展页面不允许直接加载该协议
        // favicon 获取已由 background.js 的 RESOLVE_FAVICON 消息处理
        const list: string[] = [];
        list.push(`https://${hostname}/favicon.ico`);
        list.push(`https://icons.duckduckgo.com/ip3/${hostname}.ico`);
        list.push(`https://favicon.yandex.net/favicon/${hostname}`);
        list.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`);
        list.push(`http://${hostname}/favicon.ico`);
        return list;
    }, [hostname]);

    useEffect(() => {
        setStage(0);
        setLoadFailed(false);
        setResolvedSrc(null);
    }, [url]);

    // 首先尝试从内存缓存同步获取
    useEffect(() => {
        // 先检查内存缓存
        const cached = getCachedFavicon(pageUrl);
        if (cached) {
            setResolvedSrc(cached);
            return;
        }

        // 内存缓存没有，才发消息给 background
        if (isExtension && chrome?.runtime?.sendMessage) {
            try {
                chrome.runtime.sendMessage({ type: 'RESOLVE_FAVICON', url: pageUrl }, (res) => {
                    if (res && (res as { success?: boolean; src?: string }).success && (res as { src?: string }).src) {
                        const src = (res as { src?: string }).src || null;
                        if (src) {
                            // 更新内存缓存
                            updateMemoryCache(pageUrl, src);
                            setResolvedSrc(src);
                        }
                    }
                });
            } catch {
                setResolvedSrc(null);
            }
        }
    }, [isExtension, pageUrl]);

    if (icon) {
        return (
            <div
                className={className}
                style={{ width: size, height: size, fontSize: size * 0.75, lineHeight: 1 }}
            >
                {icon}
            </div>
        );
    }

    return (
        <div
            className={`relative flex items-center justify-center rounded-md ${className}`}
            style={{ width: size, height: size }}
        >
            {!loadFailed && (
                <img
                    src={resolvedSrc ?? sources[stage]}
                    alt={name}
                    className="w-full h-full object-contain"
                    onError={() => {
                        if (stage < sources.length - 1) {
                            setStage(stage + 1);
                        } else {
                            setLoadFailed(true);
                        }
                    }}
                />
            )}
            {loadFailed && (
                <div
                    className="w-full h-full rounded-md bg-secondary text-secondary-foreground font-semibold flex items-center justify-center"
                    style={{ fontSize: size * 0.5 }}
                >
                    {label}
                </div>
            )}
        </div>
    );
};

export default QuickLinkIcon;
