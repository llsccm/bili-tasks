import assert from 'node:assert/strict'
import test from 'node:test'
import qrcode from 'qrcode-terminal'
import { PassportApi } from '../src/api/passport'
import { defaultConfig } from '../src/config'
import { sleep } from '../src/utils'
import { createCookieJar, exportCookieString, getJarCookieField, setJarCookieFields } from '../src/utils/cookie'

const POLL_INTERVAL_MS = 15_000
const MAX_WAIT_MS = 180_000

test('使用 PassportApi 请求二维码登录并打印 Cookie refresh_token', async () => {
  const jar = createCookieJar()
  const passport = new PassportApi(jar, defaultConfig.userAgent)

  // 1. 获取首页 cookie
  await passport.fetchHomeCookie()
  const buvid3 = getJarCookieField(jar, 'buvid3')
  assert.ok(buvid3, '访问 bilibili 首页响应头 Cookie 缺少 buvid3')

  // 2. 补充 b_lsid、_uuid、buvid_fp
  setJarCookieFields(jar, {
    b_lsid: '0C7B1CDD_19E3D640CEF',
    _uuid: 'CD7CFBB3-CC1F-110B6-101078-6C9B3FEA4EFC11951infoc',
    buvid_fp: 'a3a85232b5abf25a04fbeab85a1e3dd8'
  })

  // 3. 获取 buvid4
  const finger = await passport.getFingerSpi()
  setJarCookieFields(jar, { buvid4: finger.b_4 })

  // 4. 获取 bili_ticket
  const biliTicket = await passport.fetchBiliTicket()
  setJarCookieFields(jar, {
    bili_ticket: biliTicket.ticket,
    bili_ticket_expires: String(biliTicket.created_at + biliTicket.ttl)
  })

  console.log('Web 登录二维码请求 Cookie:', exportCookieString(jar))

  // 5. 申请二维码
  const qrCode = await passport.generateQrCode()
  assert.ok(qrCode.url, 'Web 登录二维码响应缺少 url')
  assert.match(qrCode.qrcode_key, /^[0-9a-f]{32}$/i, 'qrcode_key 应为 32 位十六进制字符串')

  qrcode.generate(qrCode.url, { small: true }, (code: string) => {
    console.log(code)
    console.log('请使用哔哩哔哩客户端扫码确认 Web 登录：', qrCode.url)
  })

  // 6. 轮询
  const startedAt = Date.now()

  while (Date.now() - startedAt <= MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS)

    const result = await passport.pollQrCode(qrCode.qrcode_key)
    assert.equal(result.code, 0, result.message || result.msg || `轮询失败：${result.code}`)

    if (result.data.code === 0) {
      const cookie = exportCookieString(jar)
      console.log('Web 登录 refresh_token:', result.data.refresh_token)
      console.log('Web 登录 timestamp:', result.data.timestamp)
      console.log('Web 登录 Cookie:', cookie)

      assert.ok(result.data.refresh_token, 'Web 登录响应缺少 refresh_token')
      assert.ok(result.data.timestamp! > 0, 'Web 登录响应缺少 timestamp')
      assert.ok(cookie.includes('DedeUserID='), 'Cookie 缺少 DedeUserID')
      assert.ok(cookie.includes('SESSDATA='), 'Cookie 缺少 SESSDATA')
      assert.ok(cookie.includes('bili_jct='), 'Cookie 缺少 bili_jct')
      return
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
})
