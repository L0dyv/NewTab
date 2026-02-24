import { getStoredValue, setStoredValue } from './storage'
import { exportSettingsToJson, importSettingsFromJson } from './settingsManager'

export type WebDAVConfig = {
    url: string
    username: string
    password: string
}

const DEFAULT_WEBDAV_CONFIG: WebDAVConfig = {
    url: '',
    username: '',
    password: '',
}

const CONFIG_KEY = 'webdavConfig'
const PASSWORD_KEY = 'webdavPassword'

type ChromeStorageSync = {
    get: (keys: string | string[]) => Promise<Record<string, unknown>>
    set: (items: Record<string, unknown>) => Promise<void>
}

const getChromeSync = (): ChromeStorageSync | undefined => {
    try {
        const sync = (typeof chrome !== 'undefined'
            ? (chrome as unknown as { storage?: { sync?: ChromeStorageSync } })?.storage?.sync
            : undefined)
        return sync
    } catch {
        return undefined
    }
}

const toBase64 = (str: string) => {
    try {
        return btoa(unescape(encodeURIComponent(str)))
    } catch {
        return btoa(str)
    }
}

const authHeader = (cfg: WebDAVConfig) =>
    cfg.username || cfg.password
        ? `Basic ${toBase64(`${cfg.username}:${cfg.password}`)}`
        : undefined

export async function getWebDAVConfig(): Promise<WebDAVConfig> {
    const meta = await getStoredValue<WebDAVConfig>(CONFIG_KEY, DEFAULT_WEBDAV_CONFIG)
    let pwd = ''
    const sync = getChromeSync()
    if (sync) {
        try {
            const r = await sync.get(PASSWORD_KEY)
            if (r && Object.prototype.hasOwnProperty.call(r, PASSWORD_KEY)) {
                pwd = (r[PASSWORD_KEY] as string) ?? ''
            }
        } catch { pwd = '' }
    }
    return { url: meta.url ?? '', username: meta.username ?? '', password: pwd }
}

export async function setWebDAVConfig(cfg: WebDAVConfig): Promise<void> {
    await setStoredValue(CONFIG_KEY, { url: cfg.url ?? '', username: cfg.username ?? '', password: '' })
    const sync = getChromeSync()
    if (!sync) return
    try {
        await sync.set({ [PASSWORD_KEY]: cfg.password ?? '' })
    } catch { /* noop */ }
}

const isHttps = (url: string) => {
    try {
        return new URL(url).protocol === 'https:'
    } catch {
        return false
    }
}

const hex = (buf: ArrayBuffer | Uint8Array) => {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    let s = ''
    for (let i = 0; i < b.length; i++) s += ('0' + b[i].toString(16)).slice(-2)
    return s
}

const md5RotateLeft = (x: number, c: number) => ((x << c) | (x >>> (32 - c))) >>> 0

// Browser WebCrypto does not support MD5, so Digest auth needs a local implementation.
const md5 = (input: string) => {
    const msg = new TextEncoder().encode(input)
    const bitLen = msg.length * 8
    const totalLen = ((((msg.length + 8) >> 6) + 1) << 6) >>> 0
    const data = new Uint8Array(totalLen)
    data.set(msg)
    data[msg.length] = 0x80
    const dv = new DataView(data.buffer)
    dv.setUint32(totalLen - 8, bitLen >>> 0, true)
    dv.setUint32(totalLen - 4, Math.floor(bitLen / 0x100000000) >>> 0, true)

    let a0 = 0x67452301
    let b0 = 0xefcdab89
    let c0 = 0x98badcfe
    let d0 = 0x10325476

    const s = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
        5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
        4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
        6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
    ]
    const k = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0)

    for (let i = 0; i < totalLen; i += 64) {
        const m = new Uint32Array(16)
        for (let j = 0; j < 16; j++) m[j] = dv.getUint32(i + j * 4, true)

        let a = a0
        let b = b0
        let c = c0
        let d = d0

        for (let j = 0; j < 64; j++) {
            let f = 0
            let g = 0
            if (j < 16) {
                f = (b & c) | (~b & d)
                g = j
            } else if (j < 32) {
                f = (d & b) | (~d & c)
                g = (5 * j + 1) % 16
            } else if (j < 48) {
                f = b ^ c ^ d
                g = (3 * j + 5) % 16
            } else {
                f = c ^ (b | ~d)
                g = (7 * j) % 16
            }

            const tmp = d
            d = c
            c = b
            const sum = (a + f + k[j] + m[g]) >>> 0
            b = (b + md5RotateLeft(sum, s[j])) >>> 0
            a = tmp
        }

        a0 = (a0 + a) >>> 0
        b0 = (b0 + b) >>> 0
        c0 = (c0 + c) >>> 0
        d0 = (d0 + d) >>> 0
    }

    const out = new Uint8Array(16)
    const outDv = new DataView(out.buffer)
    outDv.setUint32(0, a0, true)
    outDv.setUint32(4, b0, true)
    outDv.setUint32(8, c0, true)
    outDv.setUint32(12, d0, true)
    return hex(out)
}

const parseDigest = (header: string) => {
    const m = header.replace(/^\s*Digest\s+/i, '')
    const parts: Record<string, string> = {}
    let i = 0
    while (i < m.length) {
        while (i < m.length && (m[i] === ',' || /\s/.test(m[i]))) i++
        if (i >= m.length) break

        let key = ''
        while (i < m.length && m[i] !== '=' && m[i] !== ',') {
            key += m[i]
            i++
        }
        key = key.trim()
        if (!key || i >= m.length || m[i] !== '=') {
            while (i < m.length && m[i] !== ',') i++
            continue
        }

        i++
        let value = ''
        if (m[i] === '"') {
            i++
            while (i < m.length) {
                const ch = m[i]
                if (ch === '\\' && i + 1 < m.length) {
                    value += m[i + 1]
                    i += 2
                    continue
                }
                if (ch === '"') {
                    i++
                    break
                }
                value += ch
                i++
            }
        } else {
            while (i < m.length && m[i] !== ',') {
                value += m[i]
                i++
            }
            value = value.trim()
        }
        parts[key] = value
        while (i < m.length && m[i] !== ',') i++
        if (m[i] === ',') i++
    }

    return parts
}

const pickDigestQop = (rawQop?: string) => {
    if (!rawQop) return ''
    const qops = rawQop.split(',').map(v => v.trim().replace(/^"|"$/g, '')).filter(Boolean)
    if (qops.includes('auth')) return 'auth'
    if (qops.includes('auth-int')) return 'auth-int'
    return qops[0] || ''
}

const quoteDigestValue = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const buildDigestAuth = (method: string, url: string, username: string, password: string, body: BodyInit | null, challenge: Record<string, string>) => {
    const u = new URL(url)
    const uri = u.pathname + (u.search || '')
    const realm = challenge.realm || ''
    const nonce = challenge.nonce || ''
    const qop = pickDigestQop(challenge.qop)
    const opaque = challenge.opaque
    const algorithmRaw = challenge.algorithm?.trim() || ''
    const algorithm = algorithmRaw ? algorithmRaw.toUpperCase() : 'MD5'
    const cnonce = hex(crypto.getRandomValues(new Uint8Array(16)))
    const nc = '00000001'
    if (qop && qop !== 'auth' && qop !== 'auth-int') {
        throw new Error(`暂不支持 Digest qop: ${qop}`)
    }

    let ha1 = md5(`${username}:${realm}:${password}`)
    if (algorithm === 'MD5-SESS') {
        ha1 = md5(`${ha1}:${nonce}:${cnonce}`)
    } else if (algorithm !== 'MD5') {
        throw new Error(`不支持的 Digest 算法: ${algorithmRaw}`)
    }
    let ha2 = md5(`${method}:${uri}`)
    if (qop === 'auth-int') {
        let entityBody = ''
        if (typeof body === 'string') {
            entityBody = body
        } else if (body instanceof URLSearchParams) {
            entityBody = body.toString()
        } else if (body !== null) {
            throw new Error('Digest auth-int 仅支持字符串请求体')
        }
        ha2 = md5(`${method}:${uri}:${md5(entityBody)}`)
    }
    const response = qop
        ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
        : md5(`${ha1}:${nonce}:${ha2}`)

    const pairs = [
        `Digest username="${quoteDigestValue(username)}"`,
        `realm="${quoteDigestValue(realm)}"`,
        `nonce="${quoteDigestValue(nonce)}"`,
        `uri="${quoteDigestValue(uri)}"`,
        `response="${response}"`,
    ]
    if (opaque) pairs.push(`opaque="${quoteDigestValue(opaque)}"`)
    if (algorithmRaw) pairs.push(`algorithm=${algorithmRaw}`)
    if (qop) {
        pairs.push(`qop=${qop}`)
        pairs.push(`nc=${nc}`)
        pairs.push(`cnonce="${cnonce}"`)
    }
    return pairs.join(', ')
}

const extractDigestChallenge = (header: string) => {
    const idx = header.search(/Digest\s+/i)
    return idx >= 0 ? header.slice(idx) : ''
}

const requestWithAuth = async (method: string, url: string, baseHeaders: Record<string, string>, body: BodyInit | null, cfg: WebDAVConfig) => {
    const h1: Record<string, string> = { ...baseHeaders }
    const basic = authHeader(cfg)
    if (basic) h1['Authorization'] = basic
    let resp = await fetch(url, { method, headers: h1, body })
    if (resp.status === 401) {
        const wa = resp.headers.get('www-authenticate') || ''
        if (/Digest/i.test(wa)) {
            try {
                const chal = parseDigest(extractDigestChallenge(wa))
                const digest = buildDigestAuth(method, url, cfg.username, cfg.password, body, chal)
                const h2: Record<string, string> = { ...baseHeaders, Authorization: digest }
                resp = await fetch(url, { method, headers: h2, body })
            } catch {
                // keep original 401 response when digest header cannot be satisfied
            }
        }
    }
    return resp
}

const ensureSlash = (url: string) => {
    try {
        const u = new URL(url)
        if (!u.pathname.endsWith('/')) {
            u.pathname = u.pathname + '/'
        }
        return u.toString()
    } catch {
        return url.endsWith('/') ? url : url + '/'
    }
}

const DEFAULT_DIR = 'NewTab'
const ts = () => {
    const d = new Date()
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
    const YYYY = d.getFullYear()
    const MM = pad(d.getMonth() + 1)
    const DD = pad(d.getDate())
    const hh = pad(d.getHours())
    const mm = pad(d.getMinutes())
    const ss = pad(d.getSeconds())
    return `${YYYY}${MM}${DD}${hh}${mm}${ss}`
}
const timestampFile = () => `backup_${ts()}.json`

const buildDirUrl = (baseUrl: string) => {
    const base = ensureSlash(baseUrl)
    return base + DEFAULT_DIR + '/'
}

const isDirectory = (url: string) => {
    try { return new URL(url).pathname.endsWith('/') } catch { return url.endsWith('/') }
}

const ensureAppDir = async (baseUrl: string, cfg: WebDAVConfig) => {
    const dirUrl = buildDirUrl(baseUrl)
    const r = await requestWithAuth('PROPFIND', dirUrl, { Depth: '0' }, null, cfg)
    if (r.ok || (r.status >= 200 && r.status < 400)) return dirUrl
    const mk = await requestWithAuth('MKCOL', dirUrl, {}, null, cfg)
    return dirUrl
}

export async function testWebDAVConnection(cfg: WebDAVConfig, options?: { allowInsecure?: boolean }): Promise<{ ok: boolean; status: number; message?: string }> {
    if (!cfg.url) return { ok: false, status: 0, message: '未配置 URL' }
    if (!isHttps(cfg.url) && !options?.allowInsecure) {
        return { ok: false, status: 0, message: '使用非 HTTPS 连接，需确认后继续' }
    }

    const headers: Record<string, string> = {}
    const auth = authHeader(cfg)
    if (auth) headers['Authorization'] = auth

    try {
        if (isDirectory(cfg.url)) {
            const dirUrl = await ensureAppDir(cfg.url, cfg)
            const r0 = await requestWithAuth('PROPFIND', dirUrl, { Depth: '0' }, null, cfg)
            if (r0.ok || (r0.status >= 200 && r0.status < 400)) {
                return { ok: true, status: r0.status }
            }
        }
        const r1 = await requestWithAuth('HEAD', cfg.url, headers, null, cfg)
        if (r1.ok || (r1.status >= 200 && r1.status < 400)) {
            return { ok: true, status: r1.status }
        }

        const r2 = await requestWithAuth('OPTIONS', cfg.url, headers, null, cfg)
        if (r2.ok || (r2.status >= 200 && r2.status < 400)) {
            return { ok: true, status: r2.status }
        }

        const r3 = await requestWithAuth('PROPFIND', cfg.url, { ...headers, Depth: '0' }, null, cfg)
        if (r3.ok || (r3.status >= 200 && r3.status < 400)) {
            return { ok: true, status: r3.status }
        }

        return { ok: false, status: r3.status, message: `连接失败 (${r3.status})` }
    } catch (e) {
        return { ok: false, status: 0, message: e instanceof Error ? e.message : '网络错误' }
    }
}

export async function uploadBackupToWebDAV(cfg: WebDAVConfig, json?: string, options?: { allowInsecure?: boolean }): Promise<void> {
    const url = cfg.url
    if (!url) throw new Error('未配置 WebDAV 目标 URL')
    if (!isHttps(url) && !options?.allowInsecure) {
        throw new Error('使用非 HTTPS 连接，需确认后继续')
    }

    const body = json ?? exportSettingsToJson()

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    let target = url
    if (isDirectory(url)) {
        const dir = await ensureAppDir(url, cfg)
        target = dir + timestampFile()
    }
    const resp = await requestWithAuth('PUT', target, headers, body, cfg)
    if (!resp.ok) {
        throw new Error(`上传失败：HTTP ${resp.status}`)
    }
}

export async function downloadBackupFromWebDAV(cfg: WebDAVConfig, options?: { allowInsecure?: boolean }): Promise<string> {
    const url = cfg.url
    if (!url) throw new Error('未配置 WebDAV 目标 URL')
    if (!isHttps(url) && !options?.allowInsecure) {
        throw new Error('使用非 HTTPS 连接，需确认后继续')
    }

    const headers: Record<string, string> = {}
    let target = url
    if (isDirectory(url)) {
        const dir = await ensureAppDir(url, cfg)
        const latest = await pickLatestBackupFile(dir, cfg)
        if (!latest) throw new Error('未找到备份文件')
        target = latest
    }
    const resp = await requestWithAuth('GET', target, headers, null, cfg)
    if (!resp.ok) {
        throw new Error(`下载失败：HTTP ${resp.status}`)
    }

    const text = await resp.text()
    return text
}

const pickLatestBackupFile = async (dirUrl: string, cfg: WebDAVConfig): Promise<string | null> => {
    const resp = await requestWithAuth('PROPFIND', dirUrl, { Depth: '1' }, null, cfg)
    if (!resp.ok) return null
    const xml = await resp.text()
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml')
        const all = Array.from(doc.getElementsByTagName('*'))
        const responses = all.filter(el => el.localName === 'response')
        const files: { href: string; name: string }[] = []
        for (const r of responses) {
            const hrefEl = Array.from(r.getElementsByTagName('*')).find(el => el.localName === 'href') as Element | undefined
            if (!hrefEl || !hrefEl.textContent) continue
            const href = hrefEl.textContent
            let name = ''
            try { name = new URL(href, dirUrl).pathname.split('/').filter(Boolean).pop() || '' } catch { name = href.split('/').filter(Boolean).pop() || '' }
            if (/^backup_\d{14}\.json$/.test(name)) {
                const full = (() => { try { return new URL(href, dirUrl).toString() } catch { return dirUrl + name } })()
                files.push({ href: full, name })
            }
        }
        if (files.length === 0) return null
        files.sort((a, b) => (a.name > b.name ? -1 : a.name < b.name ? 1 : 0))
        return files[0].href
    } catch {
        return null
    }
}

export async function restoreFromWebDAV(cfg: WebDAVConfig, options?: { allowInsecure?: boolean }): Promise<void> {
    const json = await downloadBackupFromWebDAV(cfg, options)
    await importSettingsFromJson(json)
}
