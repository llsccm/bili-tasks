import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process, { loadEnvFile } from 'node:process'
import type { CookieJar } from 'tough-cookie'
import { BiliApi, PassportApi } from '../src/api'
import { defaultConfig } from '../src/config'
import type { BiliContext } from '../src/types'
import { createCookieJar, getCsrfFromJar, getBuvid3FromJar, getLiveBuvidFromJar } from '../src/utils/cookie'
import { createWbiSalt } from '../src/utils/wbi'

export function loadCookieFromEnv(): string {
  const envPath = resolve(process.cwd(), '.env')
  assert.ok(existsSync(envPath), '缺少 .env 文件')

  loadEnvFile(envPath)

  const cookie = process.env.BILI_TASK_COOKIES || process.env.COOKIES || process.env.cookies

  assert.ok(cookie, '.env 中缺少 cookies')
  return cookie
}

/**
 * 创建用于测试的 CookieJar。
 */
export function createTestJar(): CookieJar {
  const cookie = loadCookieFromEnv()
  return createCookieJar(cookie)
}

/**
 * 创建用于测试的 BiliContext 和 BiliApi。
 */
export async function createTestContext(): Promise<{ ctx: BiliContext; api: BiliApi }> {
  const jar = createTestJar()
  const csrf = getCsrfFromJar(jar)
  assert.ok(csrf, 'Cookie 缺少 bili_jct')

  const ctx: BiliContext = {
    cookieJar: jar,
    csrf,
    liveBuvid: getLiveBuvidFromJar(jar),
    buvid3: getBuvid3FromJar(jar),
    userAgent: defaultConfig.userAgent,
    wbiSalt: '',
    dynamicVideos: [],
    fansMedals: []
  }

  const api = new BiliApi(ctx)
  const nav = await api.user.nav()
  assert.equal(nav.code, 0, nav.message || nav.msg)
  assert.ok(nav.data?.isLogin, 'nav 返回未登录状态')

  ctx.userInfo = nav.data
  ctx.wbiSalt = createWbiSalt(nav.data.wbi_img?.img_url, nav.data.wbi_img?.sub_url)
  assert.ok(ctx.wbiSalt, 'nav 缺少 wbi_img，无法生成 WBI salt')

  return { ctx, api }
}

/**
 * 创建用于测试的 PassportApi。
 */
export function createTestPassport(): { jar: CookieJar; passport: PassportApi } {
  const jar = createTestJar()
  const passport = new PassportApi(jar, defaultConfig.userAgent)
  return { jar, passport }
}
