/**
 * 国际化模块 (i18n)
 * 支持中英双语，根据浏览器语言自动选择，并提供手动切换
 */

export type Locale = 'zh-CN' | 'en';

// 消息定义
const messages: Record<Locale, Record<string, string>> = {
    'zh-CN': {
        // 通用
        'common.search': '搜索',
        'common.settings': '设置',
        'common.add': '添加',
        'common.cancel': '取消',
        'common.save': '保存',
        'common.delete': '删除',
        'common.confirm': '确认',
        'common.close': '关闭',
        'common.edit': '编辑',
        'common.loading': '加载中...',
        'common.AI': 'AI',

        // Index 页面
        'index.welcome': '欢迎回来',
        'index.whatToDo': '你想要做什么？',
        'index.placeholder': '输入网址或搜索...',
        'index.kagiPlaceholder': '向 Kagi Assistant 提问...',
        'index.ask': '提问',
        'index.openSettings': '打开设置',
        'index.openExtensions': '打开扩展程序页面',
        'index.openBrowserSettings': '打开浏览器设置',

        // Popup 页面
        'popup.addPage': '收藏当前页面',
        'popup.added': '已添加',
        'popup.exists': '已存在',
        'popup.openInNewTab': '搜索结果在新标签页打开',
        'popup.addPageUrl': '将收藏：',

        // 自动完成
        'autocomplete.history': '历史',
        'autocomplete.bookmark': '书签',

        // 设置相关
        'settings.title': '设置',
        'settings.general': '通用设置',
        'settings.searchEngines': '搜索引擎设置',
        'settings.searchEnginesShort': '搜索引擎',
        'settings.quickLinks': '快速链接设置',
        'settings.quickLinksShort': '快速链接',
        'settings.importExport': '导入/导出设置',
        'settings.dataManagement': '数据管理',
        'settings.dialog': '设置对话框',
        'settings.unsavedConfirm': '仍有未保存修改，确定关闭？',
        'settings.language': '语言',

        // 通用设置
        'generalSettings.searchBehavior': '搜索行为',
        'generalSettings.openInNewTab': '在新标签页打开搜索结果',
        'generalSettings.openInNewTabDesc': '启用后，搜索结果将在新标签页打开而非当前页面',
        'generalSettings.openInNewTabNewTab': '新标签页：在新标签页打开搜索结果',
        'generalSettings.openInNewTabNewTabDesc': '仅影响新标签页中的搜索行为',

        // 快速链接配置
        'quickLinks.title': '快速链接配置',
        'quickLinks.addNew': '添加新快速链接',
        'quickLinks.name': '名称(可选)',
        'quickLinks.namePlaceholder': '留空将自动获取',
        'quickLinks.url': '网址',
        'quickLinks.urlPlaceholder': 'https://example.com',
        'quickLinks.fetchingTitle': '获取中...',
        'quickLinks.dragHint': '💡 提示：拖拽左侧图标可调整快速链接顺序',
        'quickLinks.confirmDelete': '确认删除这个快速链接？',
        'quickLinks.deleteWarning': '删除后无法恢复。',
        'quickLinks.skipConfirm': '下次不再提示',
        'quickLinks.confirmDeleteBtn': '确认删除',

        // 搜索引擎配置
        'searchEngines.title': '搜索引擎配置',
        'searchEngines.addNew': '添加新搜索引擎',
        'searchEngines.name': '名称',
        'searchEngines.namePlaceholder': '搜索引擎名称',
        'searchEngines.url': '搜索URL',
        'searchEngines.urlHint': '使用 %s 作为搜索词占位符',
        'searchEngines.setDefault': '设为默认',
        'searchEngines.isDefault': '默认',
        'searchEngines.custom': '自定义',
        'searchEngines.builtin': '内置',
        'searchEngines.resetToDefault': '重置为默认',
        'searchEngines.confirmDelete': '确认删除这个搜索引擎？',
        'searchEngines.deleteWarning': '删除后无法恢复；默认搜索引擎不能删除。',
        'searchEngines.skipConfirm': '下次不再提示',
        'searchEngines.confirmDeleteBtn': '确认删除',
        'searchEngines.aboutKagi': '关于 Kagi Assistant',
        'searchEngines.kagiDesc': 'Kagi Assistant 是集成的AI助手，支持多种模型。使用前请确保已登录 Kagi 账户。拖拽左侧图标可调整顺序。',
        'searchEngines.aiSearch': 'AI助手搜索',
        'searchEngines.defaultCannotDisable': '默认搜索引擎不能取消勾选',

        // 导入导出
        'importExport.title': '导入/导出设置',
        'importExport.export': '导出设置',
        'importExport.import': '导入设置',
        'importExport.exportSuccess': '导出成功',
        'importExport.importSuccess': '导入成功',
        'importExport.importError': '导入失败：无效的配置文件',

        // 主题
        'theme.light': '浅色',
        'theme.dark': '深色',
        'theme.system': '跟随系统',

        // 导入导出设置页面
        'importExport.currentSettings': '当前设置概览',
        'importExport.searchEnginesCount': '搜索引擎',
        'importExport.quickLinksCount': '快速链接',
        'importExport.themeLabel': '主题',
        'importExport.unit': '个',
        'importExport.searchBehavior': '搜索行为',
        'importExport.openInNewTab': '在新标签页打开搜索结果',
        'importExport.openInNewTabDesc': '启用后，搜索结果将在新标签页打开而非当前页面',
        'importExport.exportBtn': '导出设置',
        'importExport.importBtn': '导入设置',
        'importExport.importing': '导入中...',
        'importExport.resetBtn': '重置设置',
        'importExport.cloudBackup': '云备份（WebDAV）',
        'importExport.targetUrl': '目标文件 URL',
        'importExport.targetUrlPlaceholder': '例如：https://example.com/dav/NewTab/backup.json',
        'importExport.username': '用户名',
        'importExport.password': '密码',
        'importExport.saveConfig': '保存配置',
        'importExport.testConnection': '测试连接',
        'importExport.testing': '测试中...',
        'importExport.backupToCloud': '备份到云端',
        'importExport.uploading': '上传中...',
        'importExport.restoreFromCloud': '从云端恢复',
        'importExport.restoring': '恢复中...',
        'importExport.webdavHint1': '请填写完整的文件 URL，PUT 将直接写入该文件',
        'importExport.webdavHint2': '也可填写基础 URL，系统将自动创建 NewTab/backup.json',
        'importExport.webdavHint3': '密码仅保存于浏览器同步存储，不写入本地缓存',
        'importExport.webdavHint4': '建议使用 HTTPS 与应用专用密码',
        'importExport.hint1': '导出的配置文件包含所有搜索引擎、快速链接和主题设置',
        'importExport.hint2': '导入设置会覆盖当前所有配置',
        'importExport.hint3': '重置会将所有设置恢复为默认值',
        'importExport.confirmImportTitle': '确认导入设置？',
        'importExport.confirmImportDesc': '导入设置将会覆盖当前所有配置，包括搜索引擎、快速链接和主题设置。此操作无法撤销。',
        'importExport.confirmImportBtn': '确认导入',
        'importExport.confirmResetTitle': '确认重置所有设置？',
        'importExport.confirmResetDesc': '这将删除所有自定义配置，恢复为默认设置。此操作无法撤销，建议先导出当前配置作为备份。',
        'importExport.confirmResetBtn': '确认重置',
        'importExport.insecureTitle': '使用非 HTTPS 连接，存在高风险',
        'importExport.insecureDesc': '凭据与数据可能在网络中被窃听或篡改。确定要继续吗？',
        'importExport.continue': '继续',
        'importExport.settingsExported': '设置已导出',
        'importExport.settingsImported': '设置已导入',
        'importExport.settingsReset': '设置已重置，页面将自动刷新...',
        'importExport.connectionOk': '连接正常',
        'importExport.connectionFailed': '连接失败',
        'importExport.backupUploaded': '备份已上传到云端',
        'importExport.uploadFailed': '上传失败',
        'importExport.settingsRestored': '设置已从云端恢复',
        'importExport.restoreFailed': '恢复失败',
        'importExport.configSaved': 'WebDAV 配置已保存',
        'importExport.saveFailed': '保存失败',
        'importExport.exportFailed': '导出失败',
        'importExport.importFailed': '导入失败',
        'importExport.resetFailed': '重置失败',

        // 语言设置
        'language.title': '语言设置',
        'language.current': '当前语言',
        'language.auto': '自动检测（基于浏览器语言）',

        // 右键菜单
        'contextMenu.copyLink': '复制链接地址',
        'contextMenu.delete': '删除',
    },
    'en': {
        // Common
        'common.search': 'Search',
        'common.settings': 'Settings',
        'common.add': 'Add',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.delete': 'Delete',
        'common.confirm': 'Confirm',
        'common.close': 'Close',
        'common.edit': 'Edit',
        'common.loading': 'Loading...',
        'common.AI': 'AI',

        // Index page
        'index.welcome': 'Welcome back',
        'index.whatToDo': 'What would you like to do?',
        'index.placeholder': 'Enter URL or search...',
        'index.kagiPlaceholder': 'Ask Kagi Assistant...',
        'index.ask': 'Ask',
        'index.openSettings': 'Open Settings',
        'index.openExtensions': 'Open Extensions Page',
        'index.openBrowserSettings': 'Open Browser Settings',

        // Popup page
        'popup.addPage': 'Save Current Page',
        'popup.added': 'Added',
        'popup.exists': 'Already exists',
        'popup.openInNewTab': 'Open results in new tab',
        'popup.addPageUrl': 'Will save:',

        // Autocomplete
        'autocomplete.history': 'History',
        'autocomplete.bookmark': 'Bookmark',

        // Settings related
        'settings.title': 'Settings',
        'settings.general': 'General',
        'settings.searchEngines': 'Search Engine Settings',
        'settings.searchEnginesShort': 'Search Engines',
        'settings.quickLinks': 'Quick Links Settings',
        'settings.quickLinksShort': 'Quick Links',
        'settings.importExport': 'Import/Export Settings',
        'settings.dataManagement': 'Data Management',
        'settings.dialog': 'Settings Dialog',
        'settings.unsavedConfirm': 'You have unsaved changes. Are you sure you want to close?',
        'settings.language': 'Language',

        // General settings
        'generalSettings.searchBehavior': 'Search Behavior',
        'generalSettings.openInNewTab': 'Open search results in new tab',
        'generalSettings.openInNewTabDesc': 'When enabled, search results will open in a new tab instead of the current page',
        'generalSettings.openInNewTabNewTab': 'New tab page: open results in a new tab',
        'generalSettings.openInNewTabNewTabDesc': 'Only affects searches in the new tab page',

        // Quick links config
        'quickLinks.title': 'Quick Links Configuration',
        'quickLinks.addNew': 'Add New Quick Link',
        'quickLinks.name': 'Name (optional)',
        'quickLinks.namePlaceholder': 'Leave empty to auto-fetch',
        'quickLinks.url': 'URL',
        'quickLinks.urlPlaceholder': 'https://example.com',
        'quickLinks.fetchingTitle': 'Fetching...',
        'quickLinks.dragHint': '💡 Tip: Drag the left icon to reorder quick links',
        'quickLinks.confirmDelete': 'Confirm delete this quick link?',
        'quickLinks.deleteWarning': 'This action cannot be undone.',
        'quickLinks.skipConfirm': "Don't ask again",
        'quickLinks.confirmDeleteBtn': 'Confirm Delete',

        // Search engines config
        'searchEngines.title': 'Search Engine Configuration',
        'searchEngines.addNew': 'Add New Search Engine',
        'searchEngines.name': 'Name',
        'searchEngines.namePlaceholder': 'Search engine name',
        'searchEngines.url': 'Search URL',
        'searchEngines.urlHint': 'Use %s as placeholder for search term',
        'searchEngines.setDefault': 'Set as Default',
        'searchEngines.isDefault': 'Default',
        'searchEngines.custom': 'Custom',
        'searchEngines.builtin': 'Built-in',
        'searchEngines.resetToDefault': 'Reset to Default',
        'searchEngines.confirmDelete': 'Confirm delete this search engine?',
        'searchEngines.deleteWarning': 'Cannot be undone; default engine cannot be deleted.',
        'searchEngines.skipConfirm': "Don't ask again",
        'searchEngines.confirmDeleteBtn': 'Confirm Delete',
        'searchEngines.aboutKagi': 'About Kagi Assistant',
        'searchEngines.kagiDesc': 'Kagi Assistant is an integrated AI assistant supporting multiple models. Login to Kagi required. Drag to reorder.',
        'searchEngines.aiSearch': 'AI Assistant Search',
        'searchEngines.defaultCannotDisable': 'Default search engine cannot be disabled',

        // Import/Export
        'importExport.title': 'Import/Export Settings',
        'importExport.export': 'Export Settings',
        'importExport.import': 'Import Settings',
        'importExport.exportSuccess': 'Export successful',
        'importExport.importSuccess': 'Import successful',
        'importExport.importError': 'Import failed: Invalid configuration file',

        // Theme
        'theme.light': 'Light',
        'theme.dark': 'Dark',
        'theme.system': 'System',

        // Import/Export settings page
        'importExport.currentSettings': 'Current Settings Overview',
        'importExport.searchEnginesCount': 'Search Engines',
        'importExport.quickLinksCount': 'Quick Links',
        'importExport.themeLabel': 'Theme',
        'importExport.unit': '',
        'importExport.searchBehavior': 'Search Behavior',
        'importExport.openInNewTab': 'Open search results in new tab',
        'importExport.openInNewTabDesc': 'When enabled, search results will open in a new tab instead of the current page',
        'importExport.exportBtn': 'Export Settings',
        'importExport.importBtn': 'Import Settings',
        'importExport.importing': 'Importing...',
        'importExport.resetBtn': 'Reset Settings',
        'importExport.cloudBackup': 'Cloud Backup (WebDAV)',
        'importExport.targetUrl': 'Target File URL',
        'importExport.targetUrlPlaceholder': 'e.g., https://example.com/dav/NewTab/backup.json',
        'importExport.username': 'Username',
        'importExport.password': 'Password',
        'importExport.saveConfig': 'Save Config',
        'importExport.testConnection': 'Test Connection',
        'importExport.testing': 'Testing...',
        'importExport.backupToCloud': 'Backup to Cloud',
        'importExport.uploading': 'Uploading...',
        'importExport.restoreFromCloud': 'Restore from Cloud',
        'importExport.restoring': 'Restoring...',
        'importExport.webdavHint1': 'Enter the full file URL; PUT will write directly to that file',
        'importExport.webdavHint2': 'Or enter a base URL; the system will auto-create NewTab/backup.json',
        'importExport.webdavHint3': 'Password is only saved in browser sync storage, not in local cache',
        'importExport.webdavHint4': 'HTTPS and app-specific passwords are recommended',
        'importExport.hint1': 'Exported config includes all search engines, quick links, and theme settings',
        'importExport.hint2': 'Importing settings will overwrite all current configurations',
        'importExport.hint3': 'Reset will restore all settings to default values',
        'importExport.confirmImportTitle': 'Confirm Import Settings?',
        'importExport.confirmImportDesc': 'Importing settings will overwrite all current configurations including search engines, quick links, and theme. This action cannot be undone.',
        'importExport.confirmImportBtn': 'Confirm Import',
        'importExport.confirmResetTitle': 'Confirm Reset All Settings?',
        'importExport.confirmResetDesc': 'This will delete all custom configurations and restore defaults. This action cannot be undone. We recommend exporting your current config as a backup first.',
        'importExport.confirmResetBtn': 'Confirm Reset',
        'importExport.insecureTitle': 'Using non-HTTPS connection is high risk',
        'importExport.insecureDesc': 'Credentials and data may be intercepted or tampered with on the network. Are you sure you want to continue?',
        'importExport.continue': 'Continue',
        'importExport.settingsExported': 'Settings exported',
        'importExport.settingsImported': 'Settings imported',
        'importExport.settingsReset': 'Settings reset, page will refresh automatically...',
        'importExport.connectionOk': 'Connection OK',
        'importExport.connectionFailed': 'Connection failed',
        'importExport.backupUploaded': 'Backup uploaded to cloud',
        'importExport.uploadFailed': 'Upload failed',
        'importExport.settingsRestored': 'Settings restored from cloud',
        'importExport.restoreFailed': 'Restore failed',
        'importExport.configSaved': 'WebDAV config saved',
        'importExport.saveFailed': 'Save failed',
        'importExport.exportFailed': 'Export failed',
        'importExport.importFailed': 'Import failed',
        'importExport.resetFailed': 'Reset failed',

        // Language settings
        'language.title': 'Language Settings',
        'language.current': 'Current Language',
        'language.auto': 'Auto-detect (based on browser language)',

        // Context menu
        'contextMenu.copyLink': 'Copy Link',
        'contextMenu.delete': 'Delete',
    },
};

// 当前语言
let currentLocale: Locale = 'zh-CN';

// 语言变化监听器
const listeners: Set<() => void> = new Set();

/**
 * 检测浏览器语言并返回合适的 Locale
 */
const detectBrowserLocale = (): Locale => {
    if (typeof navigator === 'undefined') return 'zh-CN';
    const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'zh-CN';
    return lang.startsWith('zh') ? 'zh-CN' : 'en';
};

/**
 * 初始化语言设置
 * 优先使用用户保存的设置，否则使用浏览器语言
 */
export const initLocale = (): Locale => {
    try {
        const saved = localStorage.getItem('locale');
        if (saved && (saved === 'zh-CN' || saved === 'en')) {
            currentLocale = saved;
        } else {
            currentLocale = detectBrowserLocale();
        }
    } catch {
        currentLocale = detectBrowserLocale();
    }
    return currentLocale;
};

/**
 * 获取当前语言
 */
export const getLocale = (): Locale => currentLocale;

/**
 * 设置语言
 */
export const setLocale = (locale: Locale): void => {
    if (locale !== currentLocale) {
        currentLocale = locale;
        try {
            localStorage.setItem('locale', locale);
        } catch {
            // ignore
        }
        // 通知所有监听器
        listeners.forEach(listener => listener());
    }
};

/**
 * 获取翻译文本
 * @param key 翻译键
 * @param fallback 默认值（当键不存在时）
 */
export const t = (key: string, fallback?: string): string => {
    const msg = messages[currentLocale]?.[key];
    if (msg !== undefined) return msg;
    // 尝试英文
    const enMsg = messages['en']?.[key];
    if (enMsg !== undefined) return enMsg;
    return fallback ?? key;
};

/**
 * 添加语言变化监听器
 */
export const addLocaleListener = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/**
 * 获取所有支持的语言
 */
export const getSupportedLocales = (): { value: Locale; label: string }[] => [
    { value: 'zh-CN', label: '简体中文' },
    { value: 'en', label: 'English' },
];

// 初始化
initLocale();
