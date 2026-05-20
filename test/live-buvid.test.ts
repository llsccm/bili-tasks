import assert from 'node:assert/strict'
import test from 'node:test'
import { createTestPassport } from './loadCookie'
import { getLiveBuvidFromJar } from '../src/utils/cookie'

test('PassportApi.fetchLiveBuvid 可获取 LIVE_BUVID', async () => {
  const { jar, passport } = createTestPassport()

  const liveBuvid = await passport.fetchLiveBuvid()

  console.log('LIVE_BUVID:', liveBuvid)
  assert.ok(liveBuvid, 'LIVE_BUVID 应为非空字符串')

  // 验证 jar 中也已写入
  const fromJar = getLiveBuvidFromJar(jar)
  console.log('Jar 中的 LIVE_BUVID:', fromJar)
})
