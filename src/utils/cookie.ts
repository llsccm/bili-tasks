import { CookieJar, Cookie } from 'tough-cookie'

// ─── tough-cookie 工具函数 ───────────────────────────────────────────

/**
 * 从原始 cookie 字符串创建 CookieJar。
 * 将每个 key=value 对设置到所有 bilibili 域名下，确保跨子域可用。
 */
export function createCookieJar(cookieString?: string): CookieJar {
  const jar = new CookieJar()

  if (!cookieString) return jar

  const parts = cookieString.split(';')
  for (const part of parts) {
    const index = part.indexOf('=')
    if (index <= 0) continue

    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (!key) continue

    try {
      const cookie = new Cookie({
        key,
        value,
        domain: 'bilibili.com',
        path: '/'
      })

      jar.setCookieSync(cookie, 'https://bilibili.com')
    } catch (error) {
      console.error(`Cookie 注入失败 [${key}]:`, error)
    }
  }

  return jar
}

/**
 * 从 CookieJar 中获取指定 URL 对应的 cookie 字符串。
 */
export function getCookieString(jar: CookieJar, url: string): string {
  return jar.getCookieStringSync(url)
}

/**
 * 从 HTTP 响应头中提取 Set-Cookie 并写入 CookieJar。
 */
export function setCookiesFromResponse(jar: CookieJar, url: string, headers: Headers): void {
  const setCookies = responseSetCookies(headers)
  for (const raw of setCookies) {
    try {
      jar.setCookieSync(raw, url)
    } catch {
      // 忽略解析失败的 cookie
    }
  }
}

/**
 * 从 CookieJar 读取指定 cookie 字段值。
 */
export function getJarCookieField(jar: CookieJar, name: string): string | undefined {
  const cookies = jar.getCookiesSync('https://www.bilibili.com', {
    http: true,
    allPaths: true
  })
  const found = cookies.find((c) => c.key === name)
  return found?.value
}

/**
 * 从 CookieJar 读取 bili_jct (CSRF token)。
 */
export function getCsrfFromJar(jar: CookieJar): string {
  return getJarCookieField(jar, 'bili_jct') || ''
}

/**
 * 从 CookieJar 读取 buvid3。
 */
export function getBuvid3FromJar(jar: CookieJar): string | undefined {
  return getJarCookieField(jar, 'buvid3')
}

/**
 * 从 CookieJar 读取 LIVE_BUVID。
 */
export function getLiveBuvidFromJar(jar: CookieJar): string | undefined {
  return getJarCookieField(jar, 'LIVE_BUVID')
}

/**
 * 向 CookieJar 写入一组字段到所有 bilibili 域名。
 */
export function setJarCookieFields(
  jar: CookieJar,
  fields: Record<string, string | undefined>
): void {
  for (const [key, value] of Object.entries(fields)) {
    if (!value) continue

    try {
      const cookie = new Cookie({
        key,
        value,
        domain: 'bilibili.com',
        path: '/'
      })

      jar.setCookieSync(cookie, 'https://bilibili.com')
    } catch (error) {
      console.error(`Cookie 更新失败 [${key}]:`, error)
    }
  }
}

/**
 * 将 CookieJar 导出为可存储的 cookie 字符串
 */
export function exportCookieString(jar: CookieJar): string {
  return jar.getCookieStringSync('https://bilibili.com', { allPaths: true })
}

// ─── 旧版兼容函数（保留供过渡期使用） ──────────────────────────────

export function responseSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] }
  const cookies = withGetSetCookie.getSetCookie?.()
  if (cookies?.length) {
    return cookies
  }

  const combined = headers.get('set-cookie')
  return combined ? splitSetCookie(combined) : []
}

function splitSetCookie(value: string): string[] {
  return value.split(/,(?=\s*[^;,\s]+=)/).map((item) => item.trim())
}

function serializeCookie(cookieMap: Map<string, string>): string {
  return Array.from(cookieMap.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}

function cookieMapFromSetCookies(setCookies: string[]): Map<string, string> {
  const cookieMap = new Map<string, string>()

  for (const item of setCookies) {
    const firstPart = item.split(';')[0]?.trim()
    const index = firstPart?.indexOf('=') ?? -1
    if (!firstPart || index <= 0) continue

    cookieMap.set(firstPart.slice(0, index), firstPart.slice(index + 1))
  }

  return cookieMap
}

export function mergeCookieFields(
  cookie: string,
  fields: Record<string, string | undefined>
): string {
  const cookieMap = cookieMapFromSetCookies(cookie.split(';'))

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      cookieMap.set(key, value)
    } else {
      cookieMap.delete(key)
    }
  }

  return serializeCookie(cookieMap)
}
