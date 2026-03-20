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
    const [bgDone, setBgDone] = useState(false);

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
        setBgDone(false);
    }, [url]);

    // 首先尝试从内存缓存同步获取
    useEffect(() => {
        // 先检查内存缓存
        const cached = getCachedFavicon(pageUrl);
        if (cached) {
            setResolvedSrc(cached);
            setBgDone(true);
            return;
        }

        // 非扩展环境没有 background，直接放行到网络 fallback
        if (!isExtension || !chrome?.runtime?.sendMessage) {
            setBgDone(true);
            return;
        }

        // 内存缓存没有，才发消息给 background
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
                setBgDone(true);
            });
        } catch {
            setBgDone(true);
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

    // 确定要加载的图片 src：
    // 1. 有 resolvedSrc 时直接用（来自缓存或 background 解析）
    // 2. bgDone 但没有 resolvedSrc 时，才 fallback 到网络 sources
    // 3. 还在等 background 响应时，不加载任何图片（显示占位符）
    const imgSrc = resolvedSrc ?? (bgDone ? sources[stage] : null);

    return (
        <div
            className={`relative flex items-center justify-center rounded-md ${className}`}
            style={{ width: size, height: size }}
        >
            {imgSrc && !loadFailed && (
                <img
                    src={imgSrc}
                    alt={name}
                    className="w-full h-full object-contain"
                    onError={() => {
                        if (resolvedSrc) {
                            // resolvedSrc 加载失败，进入 fallback 流程
                            setResolvedSrc(null);
                            setStage(0);
                        } else if (stage < sources.length - 1) {
                            setStage(stage + 1);
                        } else {
                            setLoadFailed(true);
                        }
                    }}
                />
            )}
            {(!imgSrc || loadFailed) && (
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
