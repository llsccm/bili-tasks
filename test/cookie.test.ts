import assert from 'node:assert/strict'
import test from 'node:test'
import { createTestJar } from './loadCookie'
import { getCookieString, exportCookieString } from '../src/utils/cookie'

test('CookieJar 正确加载并可导出 Cookie', async () => {
  const jar = createTestJar()

  const cookie = getCookieString(jar, 'https://www.bilibili.com')
  const exported = exportCookieString(jar)

  console.log('CookieJar cookie 串:', exported.slice(0, 200) + '...')

  assert.ok(exported.includes('SESSDATA='), '完整 Cookie 缺少 SESSDATA')
  assert.ok(exported.includes('bili_jct='), '完整 Cookie 缺少 bili_jct')
  assert.ok(exported.includes('DedeUserID='), '完整 Cookie 缺少 DedeUserID')
  assert.ok(cookie.length > 0, 'getCookieString 应返回非空字符串')
})
