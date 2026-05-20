import assert from 'node:assert/strict'
import test from 'node:test'
import { createTestContext } from './loadCookie'

const VIDEO_AID = '116596081231786'

test('api.video.share 分享默认视频', async () => {
  const { ctx, api } = createTestContext()

  ctx.dynamicVideos = [
    {
      aid: VIDEO_AID,
      bvid: '',
      title: '默认测试视频'
    }
  ]

  const res = await api.video.share(ctx.dynamicVideos[0].aid)

  console.log(
    'api.video.share:',
    `aid=${ctx.dynamicVideos[0].aid}`,
    `code=${res.code}`,
    res.message || res.msg || ''
  )

  assert.ok(
    [0, 200, 71000].includes(res.code),
    `实际响应码为 ${res.code}，不在预期列表 [0, 200, 71000] 内`
  )
})
