import assert from 'node:assert/strict'
import test from 'node:test'
import { createTestContext } from './loadCookie'

test('api.user.nav 返回正确响应', async () => {
  const { api } = createTestContext()

  const res = await api.user.nav()

  console.log('fetch nav:', `已登录: ${res.data.uname} ${res.data.mid}`)

  assert.equal(res.code, 0)
})
