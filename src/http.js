import { FETCH_TIMEOUT_MS, FORBIDDEN_HOSTS, USER_AGENT } from './config.js'

export function assertAllowedUrl (url) {
    let host = ''
    try {
        host = new URL(url).hostname
    } catch {
        throw new Error(`Invalid URL: ${url}`)
    }
    const blocked = FORBIDDEN_HOSTS.find(h => host === h || host.endsWith(`.${h}`))
    if (blocked) {
        throw new Error(`Forbidden data source: ${blocked}`)
    }
    return url
}

export async function fetchBuffer (url, {
    method = 'GET',
    headers = {},
    body,
    timeoutMs = FETCH_TIMEOUT_MS,
    fetchImpl = globalThis.fetch
} = {}) {
    assertAllowedUrl(url)
    const res = await fetchImpl(url, {
        method,
        headers: { 'User-Agent': USER_AGENT, ...headers },
        body,
        signal: AbortSignal.timeout(timeoutMs)
    })
    const buffer = Buffer.from(await res.arrayBuffer())
    return { res, buffer }
}

export async function fetchText (url, opts = {}) {
    const { res, buffer } = await fetchBuffer(url, opts)
    const text = buffer.toString(opts.encoding || 'utf8')
    return { res, text, buffer }
}

export async function fetchJson (url, opts = {}) {
    const headers = { Accept: 'application/json', ...opts.headers }
    const { res, text } = await fetchText(url, { ...opts, headers })
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
    return JSON.parse(text)
}
