import { randomUUID } from 'node:crypto'
import type { CookieJar } from 'tough-cookie'
import type {
  BiliResponse,
  BiliTicketData,
  FingerSpiData,
  GenerateQrCodeData,
  PollQrCodeData
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

function generateLiveBuvid(): string {
  const numeric = BigInt(`0x${randomUUID().replaceAll('-', '')}`) % 10_000_000_000_000_000n
  return `AUTO${numeric.toString().padStart(16, '0')}`
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
      throw new Error(`获取 buvid3/buvid4 失败：${res.message || res.msg || res.code}`)
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
      throw new Error(`获取 bili_ticket 失败：${res.message || res.msg || res.code}`)
    }

    logger.info('已从 Web Ticket 接口获取 bili_ticket')
    return res.data
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
      logger.warn('获取 LIVE_BUVID 失败，使用本地生成值：', error)
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
      throw new Error(`申请二维码失败：${body.message || body.msg || body.code}`)
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
