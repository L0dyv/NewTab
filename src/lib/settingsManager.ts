import { SearchEngine, defaultSearchEngines, mergeBuiltinEngines } from './defaultSearchEngines';
import { setStoredValue, removeStoredValue } from './storage';

// 快速链接类型定义
export interface QuickLink {
    id: string;
    name: string;
    url: string;
    icon?: string;
    enabled?: boolean;
}

// 主题类型
export type Theme = 'light' | 'dark' | 'system';

// 导出的设置数据结构
export interface ExportedSettings {
    /** 配置版本号，用于后续兼容性处理 */
    version: number;
    /** 导出时间 */
    exportedAt: string;
    /** 搜索引擎配置 */
    searchEngines: SearchEngine[];
    /** 快速链接配置 */
    quickLinks: QuickLink[];
    /** 当前选中的搜索引擎 ID */
    currentSearchEngine: string;
    /** 已删除的内置搜索引擎 ID 列表 */
    deletedBuiltinIds: string[];
    /** 主题设置 */
    theme: Theme;
    /** 是否在新标签页中打开搜索结果 */
    openSearchInNewTab?: boolean;
    /** 新标签页打开搜索结果（仅 newtab） */
    openSearchInNewTabNewTab?: boolean;
    /** 新标签页打开搜索结果（仅 popup） */
    openSearchInNewTabPopup?: boolean;
}

// 当前配置版本
const CURRENT_VERSION = 1;

/**
 * 从 localStorage 获取所有设置
 */
export function getAllSettings(): ExportedSettings {
    const searchEngines = (() => {
        try {
            const saved = localStorage.getItem('searchEngines');
            return saved ? JSON.parse(saved) : defaultSearchEngines;
        } catch {
            return defaultSearchEngines;
        }
    })();

    const quickLinks = (() => {
        try {
            const saved = localStorage.getItem('quickLinks');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    })();

    const currentSearchEngine = localStorage.getItem('currentSearchEngine') ?? 'google';

    const deletedBuiltinIds = (() => {
        try {
            const saved = localStorage.getItem('deletedBuiltinIds');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    })();

    const theme = (localStorage.getItem('theme') as Theme) ?? 'system';

    const legacyOpenSearchInNewTab = localStorage.getItem('openSearchInNewTab') === 'true';
    const openSearchInNewTabNewTab = (() => {
        const raw = localStorage.getItem('openSearchInNewTabNewTab');
        if (raw === null) return legacyOpenSearchInNewTab;
        return raw === 'true';
    })();
    const openSearchInNewTabPopup = (() => {
        const raw = localStorage.getItem('openSearchInNewTabPopup');
        if (raw === null) return legacyOpenSearchInNewTab;
        return raw === 'true';
    })();

    return {
        version: CURRENT_VERSION,
        exportedAt: new Date().toISOString(),
        searchEngines,
        quickLinks,
        currentSearchEngine,
        deletedBuiltinIds,
        theme,
        openSearchInNewTab: openSearchInNewTabNewTab,
        openSearchInNewTabNewTab,
        openSearchInNewTabPopup,
    };
}

/**
 * 验证导入的设置数据
 */
export function validateSettings(data: unknown): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: '无效的配置数据：不是有效的 JSON 对象' };
    }

    const settings = data as Partial<ExportedSettings>;

    // 检查版本号
    if (typeof settings.version !== 'number') {
        return { valid: false, error: '无效的配置数据：缺少版本号' };
    }

    if (settings.version > CURRENT_VERSION) {
        return { valid: false, error: `不支持的配置版本 ${settings.version}，当前支持版本 ${CURRENT_VERSION}` };
    }

    // 检查搜索引擎数组
    if (!Array.isArray(settings.searchEngines)) {
        return { valid: false, error: '无效的配置数据：searchEngines 必须是数组' };
    }

    for (const engine of settings.searchEngines) {
        if (!engine.id || typeof engine.id !== 'string') {
            return { valid: false, error: '无效的搜索引擎配置：缺少 id' };
        }
        if (!engine.name || typeof engine.name !== 'string') {
            return { valid: false, error: '无效的搜索引擎配置：缺少 name' };
        }
        if (!engine.url || typeof engine.url !== 'string') {
            return { valid: false, error: '无效的搜索引擎配置：缺少 url' };
        }
    }

    // 检查快速链接数组
    if (!Array.isArray(settings.quickLinks)) {
        return { valid: false, error: '无效的配置数据：quickLinks 必须是数组' };
    }

    for (const link of settings.quickLinks) {
        if (!link.id || typeof link.id !== 'string') {
            return { valid: false, error: '无效的快速链接配置：缺少 id' };
        }
        if (!link.name || typeof link.name !== 'string') {
            return { valid: false, error: '无效的快速链接配置：缺少 name' };
        }
        if (!link.url || typeof link.url !== 'string') {
            return { valid: false, error: '无效的快速链接配置：缺少 url' };
        }
    }

    // 检查当前搜索引擎
    if (typeof settings.currentSearchEngine !== 'string') {
        return { valid: false, error: '无效的配置数据：currentSearchEngine 必须是字符串' };
    }

    // 检查已删除的内置引擎列表
    if (!Array.isArray(settings.deletedBuiltinIds)) {
        return { valid: false, error: '无效的配置数据：deletedBuiltinIds 必须是数组' };
    }

    // 检查主题
    if (!['light', 'dark', 'system'].includes(settings.theme as string)) {
        return { valid: false, error: '无效的配置数据：theme 必须是 light、dark 或 system' };
    }

    return { valid: true };
}

/**
 * 导入设置到 localStorage
 */
export async function importSettings(data: ExportedSettings): Promise<void> {
    const validation = validateSettings(data);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // 补齐内置搜索引擎并保证默认引擎存在
    const mergedEngines = mergeBuiltinEngines(data.searchEngines);
    const defaultEngine = mergedEngines.find(e => e.isDefault) ?? mergedEngines[0] ?? { id: 'google' } as SearchEngine;
    const currentEngineId = mergedEngines.some(e => e.id === data.currentSearchEngine)
        ? data.currentSearchEngine
        : defaultEngine.id;

    // 归一化快速链接 enabled 字段
    const normalizedQuickLinks = data.quickLinks.map(link => ({
        ...link,
        enabled: link.enabled !== false,
    }));

    // 保存所有设置到 localStorage
    localStorage.setItem('searchEngines', JSON.stringify(mergedEngines));
    localStorage.setItem('quickLinks', JSON.stringify(normalizedQuickLinks));
    localStorage.setItem('currentSearchEngine', currentEngineId);
    localStorage.setItem('deletedBuiltinIds', JSON.stringify(data.deletedBuiltinIds));
    localStorage.setItem('theme', data.theme);
    const legacyOpenSearchInNewTab = data.openSearchInNewTab ?? false;
    const openSearchInNewTabNewTab = data.openSearchInNewTabNewTab ?? legacyOpenSearchInNewTab;
    const openSearchInNewTabPopup = data.openSearchInNewTabPopup ?? legacyOpenSearchInNewTab;
    const openSearchInNewTabLegacy = data.openSearchInNewTab ?? openSearchInNewTabNewTab;

    localStorage.setItem('openSearchInNewTab', String(openSearchInNewTabLegacy));
    localStorage.setItem('openSearchInNewTabNewTab', String(openSearchInNewTabNewTab));
    localStorage.setItem('openSearchInNewTabPopup', String(openSearchInNewTabPopup));

    // 同步写入 chrome.storage.sync（忽略失败，保持本地可用）
    await Promise.allSettled([
        setStoredValue('searchEngines', mergedEngines),
        setStoredValue('quickLinks', normalizedQuickLinks),
        setStoredValue('currentSearchEngine', currentEngineId),
        setStoredValue('deletedBuiltinIds', data.deletedBuiltinIds),
        setStoredValue('theme', data.theme),
        setStoredValue('openSearchInNewTab', openSearchInNewTabLegacy),
        setStoredValue('openSearchInNewTabNewTab', openSearchInNewTabNewTab),
        setStoredValue('openSearchInNewTabPopup', openSearchInNewTabPopup),
    ]);

    try {
        window.dispatchEvent(new CustomEvent('settings:updated'));
    } catch {
        void 0;
    }
}

/**
 * 导出设置为 JSON 字符串
 */
export function exportSettingsToJson(): string {
    const settings = getAllSettings();
    return JSON.stringify(settings, null, 2);
}

/**
 * 下载设置为 JSON 文件
 */
export function downloadSettings(): void {
    const jsonString = exportSettingsToJson();
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `newtab-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

/**
 * 从 JSON 字符串导入设置
 */
export async function importSettingsFromJson(jsonString: string): Promise<void> {
    try {
        const data = JSON.parse(jsonString);
        await importSettings(data);
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error('无效的 JSON 格式');
        }
        throw error;
    }
}

/**
 * 从文件导入设置
 */
export function importSettingsFromFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!file.name.endsWith('.json')) {
            reject(new Error('请选择 JSON 格式的配置文件'));
            return;
        }

        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                importSettingsFromJson(content)
                    .then(() => resolve())
                    .catch(reject);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('读取文件失败'));
        };

        reader.readAsText(file, 'utf-8');
    });
}

/**
 * 重置所有设置为默认值
 */
export function resetAllSettings(): void {
    localStorage.removeItem('searchEngines');
    localStorage.removeItem('quickLinks');
    localStorage.removeItem('currentSearchEngine');
    localStorage.removeItem('deletedBuiltinIds');
    localStorage.removeItem('openSearchInNewTab');
    localStorage.removeItem('openSearchInNewTabNewTab');
    localStorage.removeItem('openSearchInNewTabPopup');
    localStorage.setItem('theme', 'system');
    removeStoredValue('webdavConfig');
    removeStoredValue('webdavPassword');
    try { window.dispatchEvent(new CustomEvent('settings:updated')); } catch { void 0 }
}

/**
 * 创建设置备份（返回可用于恢复的数据）
 */
export function createBackup(): ExportedSettings {
    return getAllSettings();
}

/**
 * 从备份恢复设置
 */
export function restoreFromBackup(backup: ExportedSettings): void {
    importSettings(backup);
}
