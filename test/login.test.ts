import assert from 'node:assert/strict'
import test from 'node:test'
import qrcode from 'qrcode-terminal'
import { defaultConfig } from '../src/config'
import type {
  BiliResponse,
  BiliTicketData,
  FingerSpiData,
  GenerateQrCodeData,
  PollQrCodeData
} from '../src/types'
import { hmacHex, sleep } from '../src/utils'
import { getCookieField, mergeCookieFields, normalizeCookie } from '../src/utils/cookie'

const BILI_HOME_URL = 'https://www.bilibili.com/'
const FINGER_SPI_API = 'https://api.bilibili.com/x/frontend/finger/spi'
const BILI_TICKET_API = 'https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket'
const WEB_QRCODE_GENERATE_API = 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate'
const WEB_QRCODE_POLL_API = 'https://passport.bilibili.com/x/passport-login/web/qrcode/poll'
const POLL_INTERVAL_MS = 10_000
const MAX_WAIT_MS = 180_000
const WEB_SOURCE = 'main-fe-header'
const WEB_LOCATION = '333.1007'
const WEB_GO_URL = 'https://www.bilibili.com/?spm_id_from=333.937.0.0'
const WEB_LOCALE_JSON = JSON.stringify({
  c_locale: {
    language: 'zh',
    region: 'CN'
  },
  always_translate: true
})

interface WebQrCodePollResult {
  data: PollQrCodeData
  cookies: string[]
}

function buildWebLoginParams(params: Record<string, string>): URLSearchParams {
  const searchParams = new URLSearchParams({
    source: WEB_SOURCE,
    web_location: WEB_LOCATION,
    'x-bili-locale-json': WEB_LOCALE_JSON,
    ...params
  })

  return searchParams
}

async function getWebLoginApi<T>(
  url: string,
  params: URLSearchParams,
  cookie?: string
): Promise<BiliResponse<T>> {
  const requestUrl = `${url}?${params.toString()}`
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    Referer: BILI_HOME_URL,
    'User-Agent': defaultConfig.userAgent
  }
  if (cookie) headers.Cookie = cookie

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers
  })
  const text = await response.text()

  assert.equal(
    response.ok,
    true,
    `HTTP ${response.status} ${response.statusText}: ${text.slice(0, 500)}`
  )
  return JSON.parse(text) as BiliResponse<T>
}

function getSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[]
    raw?: () => Record<string, string[]>
  }

  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }

  if (typeof headers.raw === 'function') {
    return headers.raw()['set-cookie'] || []
  }

  const cookie = response.headers.get('set-cookie')
  return cookie ? [cookie] : []
}

async function fetchBilibiliHomeCookie(): Promise<string> {
  const response = await fetch(BILI_HOME_URL, {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': defaultConfig.userAgent
    },
    redirect: 'manual'
  })
  const text = await response.text()

  assert.equal(
    response.ok,
    true,
    `HTTP ${response.status} ${response.statusText}: ${text.slice(0, 500)}`
  )

  const cookie = normalizeCookie(getSetCookies(response))
  assert.ok(getCookieField(cookie, 'buvid3'), '访问 bilibili 首页响应头 Cookie 缺少 buvid3')
  assert.ok(getCookieField(cookie, 'b_nut'), '访问 bilibili 首页响应头 Cookie 缺少 b_nut')

  return cookie
}

async function fetchJsonWithCookie<T>(url: string, cookie: string): Promise<BiliResponse<T>> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: BILI_HOME_URL,
      'User-Agent': defaultConfig.userAgent,
      Cookie: cookie
    },
    redirect: 'manual'
  })
  const text = await response.text()

  assert.equal(
    response.ok,
    true,
    `HTTP ${response.status} ${response.statusText}: ${text.slice(0, 500)}`
  )
  return JSON.parse(text) as BiliResponse<T>
}

async function getFingerSpi(cookie: string): Promise<FingerSpiData> {
  const result = await fetchJsonWithCookie<FingerSpiData>(FINGER_SPI_API, cookie)

  assert.equal(result.code, 0, result.message || result.msg || `获取 buvid4 失败：${result.code}`)
  assert.ok(result.data?.b_4, 'finger/spi 响应缺少 buvid4')

  return result.data
}

async function fetchBiliTicket(cookie: string): Promise<BiliTicketData> {
  const timestamp = Math.floor(Date.now() / 1000)
  const hexsign = hmacHex('sha256', `ts${timestamp}`, 'XgwSnGZ1p')
  const params = new URLSearchParams({
    key_id: 'ec02',
    hexsign,
    'context[ts]': String(timestamp),
    csrf: getCookieField(cookie, 'bili_jct') || ''
  })
  const response = await fetch(`${BILI_TICKET_API}?${params.toString()}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: BILI_HOME_URL,
      'User-Agent': defaultConfig.userAgent,
      Cookie: cookie
    },
    redirect: 'manual'
  })
  const text = await response.text()

  assert.equal(
    response.ok,
    true,
    `HTTP ${response.status} ${response.statusText}: ${text.slice(0, 500)}`
  )

  const result = JSON.parse(text) as BiliResponse<BiliTicketData>
  assert.equal(
    result.code,
    0,
    result.message || result.msg || `获取 bili_ticket 失败：${result.code}`
  )
  assert.ok(result.data?.ticket, 'Web Ticket 响应缺少 bili_ticket')
  assert.ok(result.data.created_at > 0, 'Web Ticket 响应缺少 created_at')
  assert.ok(result.data.ttl > 0, 'Web Ticket 响应缺少 ttl')

  return result.data
}

async function prepareWebQrCodeCookie(): Promise<string> {
  let cookie = await fetchBilibiliHomeCookie()
  cookie = mergeCookieFields(cookie, {
    b_lsid: 'E1CCDA9F_19E3C784F0A',
    _uuid: 'FCEEA510B-3528-DB4B-86C5-857E1077442A878064infoc',
    buvid_fp: 'a3a85232b5abf25a04fbeab85a1e3dd8'
  })

  const finger = await getFingerSpi(cookie)
  cookie = mergeCookieFields(cookie, { buvid4: finger.b_4 })

  const biliTicket = await fetchBiliTicket(cookie)
  cookie = mergeCookieFields(cookie, {
    bili_ticket: biliTicket.ticket,
    bili_ticket_expires: String(biliTicket.created_at + biliTicket.ttl)
  })

  return cookie
}

async function requestWebQrCode(cookie: string): Promise<GenerateQrCodeData> {
  const params = buildWebLoginParams({ go_url: WEB_GO_URL })
  const result = await getWebLoginApi<GenerateQrCodeData>(WEB_QRCODE_GENERATE_API, params, cookie)

  assert.equal(
    result.code,
    0,
    result.message || result.msg || `申请 Web 登录二维码失败：${result.code}`
  )
  assert.ok(result.data?.url, 'Web 登录二维码响应缺少 url')
  assert.match(
    result.data.qrcode_key || '',
    /^[0-9a-f]{32}$/i,
    'Web 登录二维码响应 qrcode_key 应为 32 位十六进制字符串'
  )

  return result.data
}

async function pollWebQrCode(qrcodeKey: string, cookie: string): Promise<WebQrCodePollResult> {
  const startedAt = Date.now()

  while (Date.now() - startedAt <= MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS)

    const params = buildWebLoginParams({ qrcode_key: qrcodeKey })
    const requestUrl = `${WEB_QRCODE_POLL_API}?${params.toString()}`
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: BILI_HOME_URL,
        'User-Agent': defaultConfig.userAgent,
        Cookie: cookie
      },
      redirect: 'manual'
    })
    const text = await response.text()

    assert.equal(
      response.ok,
      true,
      `HTTP ${response.status} ${response.statusText}: ${text.slice(0, 500)}`
    )

    const result = JSON.parse(text) as BiliResponse<PollQrCodeData>
    assert.equal(
      result.code,
      0,
      result.message || result.msg || `轮询 Web 登录二维码失败：${result.code}`
    )

    if (result.data.code === 0) {
      return {
        data: result.data,
        cookies: getSetCookies(response)
      }
    }

    if (result.data.code === 86101) {
      console.log('Web 登录二维码尚未扫码')
      continue
    }

    if (result.data.code === 86090) {
      console.log('Web 登录二维码已扫码，等待确认')
      continue
    }

    if (result.data.code === 86038) {
      assert.fail('Web 登录二维码已失效，请重新运行测试')
    }

    assert.fail(`轮询 Web 登录二维码失败：${result.data.code} ${result.data.message}`)
  }

  assert.fail('等待扫码确认超时，请重新运行测试')
}

function cookieHeaderIncludes(cookies: string[], name: string): boolean {
  return cookies.some((cookie) => cookie.startsWith(`${name}=`) || cookie.includes(`; ${name}=`))
}

test('使用 Web Cookie 请求二维码登录并打印 Cookie refresh_token', async () => {
  const webCookie = await prepareWebQrCodeCookie()
  console.log('Web 登录二维码请求 Cookie:', webCookie)

  const qrCode = await requestWebQrCode(webCookie)

  qrcode.generate(qrCode.url, { small: true }, (code: string) => {
    console.log(code)
    console.log('请使用哔哩哔哩客户端扫码确认 Web 登录：', qrCode.url)
  })

  const result = await pollWebQrCode(qrCode.qrcode_key, webCookie)
  console.log('Web 登录跳转 URL:', result.data.url)
  console.log('Web 登录 refresh_token:', result.data.refresh_token)
  console.log('Web 登录 timestamp:', result.data.timestamp)
  console.log('Web 登录 Cookie:', result.cookies)

  assert.equal(result.data.code, 0, result.data.message || 'Web 登录失败')
  assert.ok(result.data.refresh_token, 'Web 登录响应缺少 refresh_token')
  assert.ok(result.data.timestamp, 'Web 登录响应缺少 timestamp')
  assert.ok(
    cookieHeaderIncludes(result.cookies, 'DedeUserID'),
    'Web 登录响应 Cookie 缺少 DedeUserID'
  )
  assert.ok(
    cookieHeaderIncludes(result.cookies, 'DedeUserID__ckMd5'),
    'Web 登录响应 Cookie 缺少 DedeUserID__ckMd5'
  )
  assert.ok(cookieHeaderIncludes(result.cookies, 'SESSDATA'), 'Web 登录响应 Cookie 缺少 SESSDATA')
  assert.ok(cookieHeaderIncludes(result.cookies, 'bili_jct'), 'Web 登录响应 Cookie 缺少 bili_jct')
})
