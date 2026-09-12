import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initFaviconCache } from './lib/faviconCache'

// 本地化字体 - Noto Serif SC（思源宋体）
// 衬线只用在首页的欢迎标题上，字号大且只有一个字重，所以只加载 300
import '@fontsource/noto-serif-sc/300.css'

type ChromeRuntime = { id?: string }
type ChromeRoot = { runtime?: ChromeRuntime }
type ChromeWindow = { chrome?: ChromeRoot }

if (!window.location.search.includes('focus')) {
    const q = window.location.search
    window.location.search = q ? `${q}&focus` : '?focus'
} else {
    const w = window as unknown as ChromeWindow
    const isExtension = !!w.chrome?.runtime?.id
    if (import.meta.env.DEV && !isExtension && !window.location.search.includes('noreset')) {
        try { localStorage.clear() } catch { void 0 }
    }
    // 尽早初始化 favicon 缓存（不阻塞渲染）
    initFaviconCache()
    createRoot(document.getElementById('root')!).render(<App />)
}
