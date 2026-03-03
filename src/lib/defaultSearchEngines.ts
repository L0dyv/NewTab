export interface SearchEngine {
    id: string;
    name: string;
    url: string;
    isDefault?: boolean;
    isAI?: boolean;
    enabled?: boolean;
}

export const defaultSearchEngines: SearchEngine[] = [
    { id: "google", name: "Google", url: "https://www.google.com/search?q=", isDefault: true, enabled: true },
    { id: "bing", name: "Bing", url: "https://www.bing.com/search?q=", enabled: true },
    { id: "duckduckgo", name: "DuckDuckGo", url: "https://duckduckgo.com/?q=", enabled: true },
    { id: "brave", name: "Brave", url: "https://search.brave.com/search?q=", enabled: true },
    { id: "kagi", name: "Kagi", url: "https://kagi.com/search?q=", enabled: true },
    { id: "kagi-assistant", name: "Kagi Assistant", url: "https://kagi.com/assistant", isAI: true, enabled: true },
    { id: 'yahoo', name: 'Yahoo', url: 'https://search.yahoo.com/search?p=', enabled: false },
    { id: 'sogou', name: '搜狗', url: 'https://www.sogou.com/web?query=', enabled: false },
    { id: 'yandex', name: 'Yandex', url: 'https://yandex.com/search/?text=', enabled: false },
    { id: 'startpage', name: 'StartPage', url: 'https://www.startpage.com/do/search?q=', enabled: false },
    { id: 'ecosia', name: 'Ecosia', url: 'https://www.ecosia.org/search?q=', enabled: false }
];

export type BuiltinDeletionList = string[];

export const mergeBuiltinEngines = (userEngines: SearchEngine[]): SearchEngine[] => {
    const deleted: BuiltinDeletionList = JSON.parse(
        localStorage.getItem("deletedBuiltinIds") ?? "[]"
    );

    const merged = [...userEngines];

    defaultSearchEngines.forEach(builtin => {
        if (deleted.includes(builtin.id)) return; // 跳过被删除的
        if (!merged.find(e => e.id === builtin.id)) merged.push({ ...builtin });
    });

    if (!merged.some(e => e.isDefault)) {
        const google = merged.find(e => e.id === "google");
        if (google) google.isDefault = true;
    }

    return merged;
}; 
