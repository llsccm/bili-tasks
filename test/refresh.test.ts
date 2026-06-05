import assert from 'node:assert/strict'
import test from 'node:test'
import { createTestContext } from './loadCookie'
import { PassportApi } from '../src/api'

test('passport checkCookieRefresh', async () => {
  const { ctx } = createTestContext()

  const passport = new PassportApi(ctx.cookieJar, ctx.userAgent)
  const res = await passport.checkCookieRefresh()
  console.log(res)

  assert.ok(res.data.refresh === false)
})
