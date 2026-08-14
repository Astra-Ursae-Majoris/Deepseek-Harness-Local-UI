/** URL whitelist: the app may only load its own local DSH web server. */

export interface ServerTarget {
  /** Full base URL, e.g. http://127.0.0.1:3080 (no trailing slash). */
  url: string
  port: number
}

/**
 * Normalize a user-entered server address into a usable target.
 * Accepts `http://127.0.0.1:3080`, `127.0.0.1:3080`, `localhost:3080`,
 * or a bare port `3080`. Anything else returns null.
 */
export function normalizeServerUrl(input: string): ServerTarget | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  const bare = /^\d{1,5}$/.test(trimmed)
  // Groups: 1=scheme (optional), 2=host, 3=colon+port, 4=port digits.
  const withHost = /^(?:(https?):\/\/)?(127\.0\.0\.1|localhost)(:(\d{1,5}))?$/i.exec(trimmed)
  if (!bare && withHost === null) return null
  let port: number
  if (bare) {
    port = Number(trimmed)
  } else {
    const group = withHost?.[4]
    port = group === undefined ? 3080 : Number(group)
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  const scheme = withHost?.[1]?.toLowerCase() ?? 'http'
  return { url: `${scheme}://127.0.0.1:${port}`, port }
}

/** Whether a navigation target may be loaded inside the app window. */
export function isAllowedAppUrl(raw: string, allowedPort: number): boolean {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    const host = parsed.hostname
    if (host !== '127.0.0.1' && host !== 'localhost' && host !== '[::1]') return false
    const port = parsed.port === '' ? (parsed.protocol === 'https:' ? 443 : 80) : Number(parsed.port)
    return port === allowedPort
  } catch {
    return false
  }
}
