import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import qrcode from 'qrcode-terminal'
import { defaultConfig } from '../src/config'
import { sleep } from '../src/utils'
import type { BiliResponse } from '../src/types'

const TV_APPKEY = '4409e2ce8ffd12b8'
const TV_APPSEC = '59b43e04ad6965f34319062b478f83dd'
const TV_LOCAL_ID = '0'
const TV_MOBI_APP = 'android_tv_yst'
const TV_QRCODE_AUTH_CODE_API = 'https://passport.bilibili.com/x/passport-tv-login/qrcode/auth_code'
const TV_QRCODE_POLL_API = 'https://passport.bilibili.com/x/passport-tv-login/qrcode/poll'
const POLL_INTERVAL_MS = 15_000
const MAX_WAIT_MS = 180_000

interface TvQrCodeAuthCodeData {
  url: string
  auth_code: string
}

interface TvQrCodePollData {
  mid: number
  access_token: string
  refresh_token: string
  expires_in: number
  cookie_info: COOKIEINFO
}

interface COOKIEINFO {
  cookies: [
    {
      name: string
      value: string
    }
  ]
}

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex')
}

function buildSignedTvParams(params: Record<string, string>): URLSearchParams {
  const signedParams = new URLSearchParams(params)
  const signPayload = Array.from(signedParams.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  signedParams.set('sign', md5(signPayload + TV_APPSEC))
  return signedParams
}

async function postTvLoginApi<T>(url: string, params: URLSearchParams): Promise<BiliResponse<T>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': defaultConfig.userAgent
    },
    body: params
  })
  const text = await response.text()

  assert.equal(response.ok, true, `HTTP ${response.status} ${response.statusText}: ${text.slice(0, 500)}`)
  return JSON.parse(text) as BiliResponse<T>
}

async function requestTvQrCode(): Promise<TvQrCodeAuthCodeData> {
  const params = buildSignedTvParams({
    appkey: TV_APPKEY,
    local_id: TV_LOCAL_ID,
    mobi_app: TV_MOBI_APP,
    ts: String(Math.floor(Date.now() / 1000))
  })
  const result = await postTvLoginApi<TvQrCodeAuthCodeData>(TV_QRCODE_AUTH_CODE_API, params)

  assert.equal(result.code, 0, result.message || result.msg || `申请 TV 登录二维码失败：${result.code}`)
  assert.ok(result.data?.url, 'TV 登录二维码响应缺少 url')
  assert.match(result.data.auth_code || '', /^[0-9a-f]{32}$/i, 'TV 登录二维码响应 auth_code 应为 32 位十六进制字符串')

  return result.data
}

async function pollTvQrCode(authCode: string): Promise<TvQrCodePollData> {
  const startedAt = Date.now()

  while (Date.now() - startedAt <= MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS)

    const params = buildSignedTvParams({
      appkey: TV_APPKEY,
      auth_code: authCode,
      local_id: TV_LOCAL_ID,
      ts: String(Math.floor(Date.now() / 1000))
    })
    const result = await postTvLoginApi<TvQrCodePollData | null>(TV_QRCODE_POLL_API, params)

    if (result.code === 0 && result.data) {
      return result.data
    }

    if (result.code === 86039) {
      console.log('TV 登录二维码尚未确认')
      continue
    }

    if (result.code === 86090) {
      console.log('TV 登录二维码已扫码，等待确认')
      continue
    }

    if (result.code === 86038) {
      assert.fail('TV 登录二维码已失效，请重新运行测试')
    }

    assert.fail(`轮询 TV 登录二维码失败：${result.code} ${result.message || result.msg || ''}`)
  }

  assert.fail('等待扫码确认超时，请重新运行测试')
}

test('使用云视听小电视 TV 二维码登录并打印 access_key Cookie', async () => {
  const qrCode = await requestTvQrCode()

  qrcode.generate(qrCode.url, { small: true }, (code: string) => {
    console.log(code)
    console.log('请使用哔哩哔哩客户端扫码确认 TV 登录：', qrCode.url)
  })

  const token = await pollTvQrCode(qrCode.auth_code)
  const cookie = token.cookie_info
  console.log('TV 登录用户 mid:', token.mid)
  console.log('TV 登录 access_key:', token.access_token)
  console.log('TV 登录 refresh_token:', token.refresh_token)
  console.log('TV 登录 expires_in:', token.expires_in)
  console.log('TV 登录 Cookie:', cookie)

  assert.ok(token.mid > 0, 'TV 登录响应缺少 mid')
  assert.ok(token.access_token, 'TV 登录响应缺少 access_token')
  assert.ok(token.refresh_token, 'TV 登录响应缺少 refresh_token')
})
