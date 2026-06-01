import { randomUUID, webcrypto } from 'node:crypto'
import type { CookieJar } from 'tough-cookie'
import type {
  BiliResponse,
  BiliTicketData,
  ConfirmCookieRefreshData,
  CookieRefreshData,
  CookieRefreshInfoData,
  FingerSpiData,
  GenerateQrCodeData,
  PollQrCodeData,
  RefreshCsrfData
} from '../types'
import { createLogger, hmacHex } from '../utils'
import {
  getCookieString,
  getJarCookieField,
  responseSetCookies,
  setCookiesFromResponse
} from '../utils/cookie'
import { BiliRequest } from './request'

const logger = createLogger('PassportApi')

const BILI_HOME_URL = 'https://www.bilibili.com/'
const FINGER_SPI_API = 'https://api.bilibili.com/x/frontend/finger/spi'
const BILI_TICKET_API = 'https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket'
const LIVE_GETSHOWINFO_API = 'https://api.live.bilibili.com/live_user/v1/UserCenter/getShowInfo'
const QRCODE_GENERATE_API = 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate'
const QRCODE_POLL_API = 'https://passport.bilibili.com/x/passport-login/web/qrcode/poll'
const COOKIE_INFO_API = 'https://passport.bilibili.com/x/passport-login/web/cookie/info'
const COOKIE_REFRESH_API = 'https://passport.bilibili.com/x/passport-login/web/cookie/refresh'
const COOKIE_REFRESH_CONFIRM_API = 'https://passport.bilibili.com/x/passport-login/web/confirm/refresh'
const CORRESPOND_BASE_URL = 'https://www.bilibili.com/correspond/1'
const CORRESPOND_PUBLIC_KEY_JWK: JsonWebKey = {
  kty: 'RSA',
  n: 'y4HdjgJHBlbaBN04VERG4qNBIFHP6a3GozCl75AihQloSWCXC5HDNgyinEnhaQ_4-gaMud_GF50elYXLlCToR9se9Z8z433U3KjM-3Yx7ptKkmQNAMggQwAVKgq3zYAoidNEWuxpkY_mAitTSRLnsJW-NCTa0bqBFF6Wm1MxgfE',
  e: 'AQAB'
}

let correspondPublicKeyPromise: Promise<webcrypto.CryptoKey> | undefined

function generateLiveBuvid(): string {
  const numeric = BigInt(`0x${randomUUID().replaceAll('-', '')}`) % 10_000_000_000_000_000n
  return `AUTO${numeric.toString().padStart(16, '0')}`
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (item) => item.toString(16).padStart(2, '0')).join('')
}

function getCorrespondPublicKey(): Promise<webcrypto.CryptoKey> {
  if (!correspondPublicKeyPromise) {
    correspondPublicKeyPromise = webcrypto.subtle.importKey(
      'jwk',
      CORRESPOND_PUBLIC_KEY_JWK,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    )
  }

  return correspondPublicKeyPromise
}

function extractRefreshCsrf(html: string): string | undefined {
  return html.match(/<div\s+[^>]*id=["']1-name["'][^>]*>([^<]+)<\/div>/i)?.[1]?.trim()
}

export class PassportApi {
  private main: BiliRequest

  constructor(
    private readonly jar: CookieJar,
    private readonly userAgent: string
  ) {
    this.main = new BiliRequest(
      'https://api.bilibili.com',
      'https://www.bilibili.com',
      this.jar,
      this.userAgent
    )
  }

  /**
   * 获取 buvid3 和 buvid4。
   */
  async getFingerSpi(): Promise<FingerSpiData> {
    const res = await this.main.get<BiliResponse<FingerSpiData>>(FINGER_SPI_API)
    if (res.code !== 0 || !res.data?.b_3 || !res.data?.b_4) {
      throw new Error(`获取 buvid3/buvid4 失败: ${res.message || res.msg || res.code}`)
    }

    return res.data
  }

  /**
   * 获取 bili_ticket。
   */
  async fetchBiliTicket(): Promise<BiliTicketData> {
    const timestamp = Math.floor(Date.now() / 1000)
    const hexsign = hmacHex('sha256', `ts${timestamp}`, 'XgwSnGZ1p')
    const csrf = getJarCookieField(this.jar, 'bili_jct') || ''

    const res = await this.main.postForm<BiliResponse<BiliTicketData>>(BILI_TICKET_API, null, {
      key_id: 'ec02',
      hexsign,
      'context[ts]': String(timestamp),
      csrf
    })

    if (res.code !== 0 || !res.data?.ticket) {
      throw new Error(`获取 bili_ticket 失败: ${res.message || res.msg || res.code}`)
    }

    logger.info('已从 Web Ticket 接口获取 bili_ticket')
    return res.data
  }

  /**
   * 检查当前 Cookie 是否需要刷新。
   */
  checkCookieRefresh(): Promise<BiliResponse<CookieRefreshInfoData>> {
    const csrf = getJarCookieField(this.jar, 'bili_jct') || ''
    return this.main.get<BiliResponse<CookieRefreshInfoData>>(COOKIE_INFO_API, csrf ? { csrf } : undefined)
  }

  /**
   * 生成用于获取 refresh_csrf 的 correspondPath。
   */
  async generateCorrespondPath(timestamp: number): Promise<string> {
    const publicKey = await getCorrespondPublicKey()
    const data = new TextEncoder().encode(`refresh_${timestamp}`)
    const encrypted = await webcrypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, data)

    return bytesToHex(new Uint8Array(encrypted))
  }

  /**
   * 请求 Correspond 页面并提取实时刷新口令 refresh_csrf。
   */
  async fetchRefreshCsrf(timestamp = Date.now()): Promise<RefreshCsrfData> {
    const correspondPath = await this.generateCorrespondPath(timestamp)
    const url = `${CORRESPOND_BASE_URL}/${correspondPath}`
    const cookie = getCookieString(this.jar, url)
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: BILI_HOME_URL,
        'User-Agent': this.userAgent,
        ...(cookie ? { Cookie: cookie } : {})
      },
      redirect: 'manual'
    })
    const html = await res.text()

    if (!res.ok) {
      throw new Error(`获取 refresh_csrf 失败: HTTP ${res.status} ${res.statusText}: ${html.slice(0, 500)}`)
    }

    const refreshCsrf = extractRefreshCsrf(html)
    if (!refreshCsrf) {
      throw new Error('获取 refresh_csrf 失败: Correspond 页面中未找到 id="1-name" 标签')
    }

    return {
      refreshCsrf,
      correspondPath,
      timestamp
    }
  }

  /**
   * 刷新 Cookie。成功后响应 Set-Cookie 会自动写入当前 CookieJar，并返回新的 refresh_token。
   */
  async refreshCookie(refreshToken: string, refreshCsrf: string): Promise<BiliResponse<CookieRefreshData>> {
    const csrf = getJarCookieField(this.jar, 'bili_jct') || ''
    if (!csrf) {
      throw new Error('Cookie 缺少 bili_jct，无法刷新 Cookie')
    }

    return this.main.postForm<BiliResponse<CookieRefreshData>>(COOKIE_REFRESH_API, {
      csrf,
      refresh_csrf: refreshCsrf,
      source: 'main_web',
      refresh_token: refreshToken
    })
  }

  /**
   * 确认 Cookie 已更新，使旧 refresh_token 对应的 Cookie 失效。
   */
  confirmCookieRefresh(oldRefreshToken: string): Promise<ConfirmCookieRefreshData> {
    const csrf = getJarCookieField(this.jar, 'bili_jct') || ''
    if (!csrf) {
      throw new Error('Cookie 缺少 bili_jct，无法确认 Cookie 更新')
    }

    return this.main.postForm<ConfirmCookieRefreshData>(COOKIE_REFRESH_CONFIRM_API, {
      csrf,
      refresh_token: oldRefreshToken
    })
  }

  /**
   * 从直播接口获取 LIVE_BUVID，失败时使用本地生成值。
   */
  async fetchLiveBuvid(): Promise<string> {
    try {
      const cookie = getCookieString(this.jar, LIVE_GETSHOWINFO_API)
      const res = await fetch(LIVE_GETSHOWINFO_API, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          Referer: 'https://live.bilibili.com/',
          Origin: 'https://live.bilibili.com',
          'User-Agent': this.userAgent,
          Cookie: cookie
        },
        redirect: 'manual'
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }

      // 收集响应 cookie（包括 LIVE_BUVID）
      setCookiesFromResponse(this.jar, LIVE_GETSHOWINFO_API, res.headers)

      // 从响应头中提取 LIVE_BUVID
      const setCookies = responseSetCookies(res.headers)
      const liveBuvidRaw = setCookies
        .find((text: string) => text.startsWith('LIVE_BUVID='))
        ?.split(';')[0]
      const liveBuvid = liveBuvidRaw ? liveBuvidRaw.substring(11) : undefined

      if (!liveBuvid) {
        throw new Error('响应头中未找到 LIVE_BUVID')
      }

      logger.info('已从直播接口响应头获取 LIVE_BUVID')

      return liveBuvid
    } catch (error) {
      const fallback = generateLiveBuvid()
      logger.warn('获取 LIVE_BUVID 失败，使用本地生成值: ', error)
      return fallback
    }
  }

  /**
   * 访问 bilibili 首页获取基础 cookie（buvid3、b_nut 等）。
   */
  async fetchHomeCookie(): Promise<void> {
    const res = await fetch(BILI_HOME_URL, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': this.userAgent,
        Cookie: getCookieString(this.jar, BILI_HOME_URL)
      },
      redirect: 'manual'
    })

    if (!res.ok && res.status !== 302) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }

    // 收集响应 cookie
    setCookiesFromResponse(this.jar, BILI_HOME_URL, res.headers)
    logger.info('已从 bilibili 首页获取基础 cookie')
  }

  /**
   * 申请 Web 二维码登录。
   */
  async generateQrCode(): Promise<GenerateQrCodeData> {
    const params = new URLSearchParams({
      source: 'main-fe-header',
      go_url: 'https://www.bilibili.com/?spm_id_from=333.937.0.0',
      web_location: '333.1007',
      'x-bili-locale-json': '{"c_locale":{"language":"zh","region":"CN"},"always_translate":true}'
    })
    const url = `${QRCODE_GENERATE_API}?${params.toString()}`
    const cookie = getCookieString(this.jar, url)
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: BILI_HOME_URL,
        'User-Agent': this.userAgent,
        ...(cookie ? { Cookie: cookie } : {})
      },
      redirect: 'manual'
    })
    const text = await res.text()

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 500)}`)
    }

    const body = JSON.parse(text) as BiliResponse<GenerateQrCodeData>
    if (body.code !== 0 || !body.data?.url || !body.data?.qrcode_key) {
      throw new Error(`申请二维码失败: ${body.message || body.msg || body.code}`)
    }

    return body.data
  }

  /**
   * 轮询二维码登录状态。登录成功后 cookie 自动写入 jar。
   */
  async pollQrCode(qrcodeKey: string): Promise<BiliResponse<PollQrCodeData>> {
    const params = new URLSearchParams({
      qrcode_key: qrcodeKey,
      source: 'main-fe-header',
      go_url: 'https://www.bilibili.com/?spm_id_from=333.937.0.0',
      web_location: '333.1007',
      'x-bili-locale-json': '{"c_locale":{"language":"zh","region":"CN"},"always_translate":true}'
    })
    const url = `${QRCODE_POLL_API}?${params.toString()}`
    const cookie = getCookieString(this.jar, url)
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: BILI_HOME_URL,
        'User-Agent': this.userAgent,
        ...(cookie ? { Cookie: cookie } : {})
      },
      redirect: 'manual'
    })
    const text = await res.text()

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 500)}`)
    }

    const body = JSON.parse(text) as BiliResponse<PollQrCodeData>

    // 登录成功时收集 cookie
    if (body.data?.code === 0) {
      setCookiesFromResponse(this.jar, url, res.headers)
    }

    return body
  }
}
