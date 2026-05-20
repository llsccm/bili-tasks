import type { CookieJar } from 'tough-cookie'
import { getCookieString, setCookiesFromResponse } from '../utils/cookie'

export class BiliRequest {
  constructor(
    private readonly baseUrl: string,
    private readonly origin: string,
    private readonly jar: CookieJar,
    private readonly userAgent: string
  ) {}

  async get<T>(
    path: string,
    params?: Record<string, unknown> | string,
    headers?: HeadersInit
  ): Promise<T> {
    const url = this.buildUrl(path, params)
    return this.fetchJson<T>(url, { method: 'GET', headers })
  }

  async postForm<T>(
    path: string,
    body?: Record<string, unknown> | null,
    params?: Record<string, unknown> | string,
    headers?: HeadersInit
  ): Promise<T> {
    const url = this.buildUrl(path, params)
    const form = body ? new URLSearchParams() : undefined

    if (body && form) {
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) form.append(key, String(value))
      }
    }

    return this.fetchJson<T>(url, {
      method: 'POST',
      body: form,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers
      }
    })
  }

  async postMultipart<T>(
    path: string,
    body: Record<string, unknown>,
    params?: Record<string, unknown> | string,
    headers?: HeadersInit
  ): Promise<T> {
    const url = this.buildUrl(path, params)
    const form = new FormData()

    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null) form.append(key, String(value))
    }

    return this.fetchJson<T>(url, {
      method: 'POST',
      body: form,
      headers
    })
  }

  private buildUrl(path: string, params?: Record<string, unknown> | string): string {
    const base = path.startsWith('http') ? path : `${this.baseUrl}${path}`
    if (!params) return base

    const query =
      typeof params === 'string'
        ? params
        : new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()

    return `${base}${base.includes('?') ? '&' : '?'}${query}`
  }

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const cookie = getCookieString(this.jar, url)

    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: this.origin,
        Origin: this.origin,
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': this.userAgent,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(init.headers || {})
      }
    })

    // 自动收集响应中的 Set-Cookie 到 CookieJar
    setCookiesFromResponse(this.jar, url, response.headers)

    const text = await response.text()
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 500)}`)
    }

    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error(`Invalid JSON response: ${text.slice(0, 500)}`)
    }
  }
}
