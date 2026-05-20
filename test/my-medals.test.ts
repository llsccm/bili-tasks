import assert from 'node:assert/strict'
import test from 'node:test'
import { createTestContext } from './loadCookie'

test('api.live.fansMedalPanel 获取持有粉丝勋章', async () => {
  const { api } = createTestContext()

  const res = await api.live.fansMedalPanel(1, 5)

  console.log('fansMedalPanel:', `粉丝勋章数量: ${res.data?.list?.length ?? 0}`)

  assert.equal(res.code, 0)
  assert.ok(Array.isArray(res.data.list) || Array.isArray(res.data.special_list), 'data 应包含 list 或 special_list 数组')
})
