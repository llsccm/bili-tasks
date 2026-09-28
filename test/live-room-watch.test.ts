import assert from 'node:assert/strict'
import process from 'node:process'
import test from 'node:test'
import { PassportApi } from '../src/api'
import { RoomHeart } from '../src/tasks/live-heart'
import { createTestContext } from './loadCookie'

test('RoomHeart 观看指定直播间', async (t) => {
  const { ctx, api } = await createTestContext()
  const roomId =
    readPositiveIntegerEnv('BILI_TEST_LIVE_ROOM_ID') ?? readPositiveIntegerEnv('BILI_LIVE_ROOM_ID')
  const roomUid =
    readPositiveIntegerEnv('BILI_TEST_LIVE_ROOM_UID') ??
    readPositiveIntegerEnv('BILI_LIVE_ROOM_UID')
  const watchMinutes = readPositiveNumberEnv('BILI_TEST_LIVE_WATCH_MINUTES') ?? 30

  if (!roomId) {
    t.skip('设置 BILI_TEST_LIVE_ROOM_ID 后运行指定直播间观看测试')
    return
  }

  if (!roomUid) {
    t.skip('设置 BILI_TEST_LIVE_ROOM_UID 后运行指定直播间观看测试')
    return
  }

  if (!ctx.liveBuvid) {
    const passport = new PassportApi(ctx.cookieJar, ctx.userAgent)
    ctx.liveBuvid = await passport.fetchLiveBuvid()
  }

  assert.ok(ctx.liveBuvid, '缺少 LIVE_BUVID')

  const roomInfoRes = await api.live.getInfoByRoom(roomId)
  assert.equal(roomInfoRes.code, 0, roomInfoRes.message || roomInfoRes.msg)

  const roomInfo = roomInfoRes.data.room_info

  assert.ok(roomInfo.room_id > 0, '直播间 room_id 应为正整数')
  assert.ok(roomInfo.area_id > 0, '直播间 area_id 应为正整数')
  assert.ok(roomInfo.parent_area_id > 0, '直播间 parent_area_id 应为正整数')

  const heart = new RoomHeart(
    api,
    ctx,
    {
      enabled: true,
      maxRooms: 1,
      maxTime: watchMinutes
    },
    roomInfo.room_id,
    roomInfo.area_id,
    roomInfo.parent_area_id,
    roomUid
  )

  console.log(
    'RoomHeart:',
    `room=${roomInfo.room_id}`,
    `ruid=${roomUid}`,
    `minutes=${watchMinutes}`
  )
  const ok = await heart.start()
  assert.equal(ok, true)
})

function readPositiveIntegerEnv(name: string): number | undefined {
  const value = process.env[name]?.trim()
  if (!value) return undefined

  const parsed = Number(value)
  assert.ok(Number.isInteger(parsed) && parsed > 0, `${name} 必须是正整数`)
  return parsed
}

function readPositiveNumberEnv(name: string): number | undefined {
  const value = process.env[name]?.trim()
  if (!value) return undefined

  const parsed = Number(value)
  assert.ok(Number.isFinite(parsed) && parsed > 0, `${name} 必须是正数`)
  return parsed
}
