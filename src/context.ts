import type { CookieJar } from 'tough-cookie'
import { BiliApi, PassportApi } from './api'
import { defaultConfig } from './config'
import { saveRefreshToken } from './storage'
import type { AppConfig, BiliContext, DynamicVideo, FansMedal } from './types'
import { createLogger, generateBLsid, randomBetween, sleep } from './utils'
import {
  createCookieJar,
  exportCookieString,
  getBuvid3FromJar,
  getCsrfFromJar,
  getLiveBuvidFromJar,
  mergeCookieFields,
  setJarCookieFields
} from './utils/cookie'
import { envManager } from './utils/env'
import { getConfigPath, readJson, writeJson } from './utils/file'
import { createWbiSalt } from './utils/wbi'

const logger = createLogger('Context')

function parseDynamicVideos(raw: any): DynamicVideo[] {
  const items = raw?.data?.items
  if (!Array.isArray(items)) return []

  const result: DynamicVideo[] = []

  for (const item of items) {
    const archive = item?.modules?.module_dynamic?.major?.archive

    if (!archive?.aid) continue

    result.push({
      aid: String(archive.aid),
      bvid: String(archive.bvid || ''),
      title: archive.title,
      authorMid: item?.modules?.module_author?.mid
    })
  }

  return result
}

function mergeMedalList(raw: any): FansMedal[] {
  const data = raw?.data || {}
  return [...(data.special_list || []), ...(data.list || [])]
}

export async function initializeContext(
  config: AppConfig
): Promise<{ ctx: BiliContext; api: BiliApi }> {
  if (!config.cookie) {
    throw new Error('缺少 Cookie: 请设置环境变量 BILI_TASK_COOKIES')
  }

  const cookieJar = createCookieJar(config.cookie)
  let csrf = getCsrfFromJar(cookieJar)

  if (!csrf) {
    throw new Error('Cookie 缺少 bili_jct，无法执行需要 CSRF 的任务')
  }

  logger.info('初始化, 随机延迟中...')
  await sleep(randomBetween(60000, 120000))

  // 注入 b_lsid（Session cookie，每次任务流程初始时动态生成，不从持久化 cookie 中读取）
  setJarCookieFields(cookieJar, { b_lsid: generateBLsid() })

  const ctx: BiliContext = {
    cookieJar,
    csrf,
    liveBuvid: getLiveBuvidFromJar(cookieJar),
    buvid3: getBuvid3FromJar(cookieJar),
    userAgent: config.userAgent,
    wbiSalt: '',
    dynamicVideos: [],
    fansMedals: []
  }

  const api = new BiliApi(ctx)

  logger.info('请求 nav 初始化用户信息和 WBI salt')
  const nav = await api.user.nav()

  if (nav.code !== 0 || !nav.data?.isLogin) {
    throw new Error(`nav 失败或未登录: ${nav.message || nav.msg || nav.code}`)
  }

  ctx.userInfo = nav.data

  ctx.wbiSalt = createWbiSalt(nav.data.wbi_img?.img_url, nav.data.wbi_img?.sub_url)
  logger.info(`已登录: ${ctx.userInfo.uname}(${ctx.userInfo.mid})`)

  await ensureBiliTicket(config, ctx)

  try {
    await checkAndRefreshCookie(cookieJar, config.userAgent, config)
    csrf = getCsrfFromJar(cookieJar)

    if (!csrf) throw new Error('Cookie 刷新后缺少 bili_jct，无法执行需要 CSRF 的任务')

    ctx.csrf = csrf
  } catch (error) {
    logger.warn('Cookie 刷新流程异常，继续使用当前 Cookie:', error)
  }

  const reward = await api.user.reward()
  if (reward.code === 0) {
    ctx.dailyRewardInfo = reward.data
  } else {
    logger.warn('reward 获取失败', reward.message || reward.msg)
  }

  if (ctx.dailyRewardInfo?.share === false) await sleep(randomBetween(60000, 300000))

  const needDynamic =
    config.DailyTasks.MainSiteTasks.watch.enabled ||
    config.DailyTasks.MainSiteTasks.share.enabled ||
    config.DailyTasks.MainSiteTasks.coin.enabled

  if (needDynamic) {
    const dynamic = await api.video.dynamicAll()

    if (dynamic.code === 0) {
      ctx.dynamicVideos = parseDynamicVideos(dynamic)
    } else {
      logger.warn('dynamicAll 获取失败', dynamic.message || dynamic.msg)
    }

    logger.info(`动态视频数量: ${ctx.dynamicVideos.length}`)
  }

  const needMedals =
    config.DailyTasks.LiveTasks.medalTasks.light.enabled ||
    config.DailyTasks.LiveTasks.medalTasks.like.enabled ||
    config.DailyTasks.LiveTasks.medalTasks.watch.enabled

  if (needMedals) {
    const res = await api.live.fansMedalPanel(1)

    if (res.code === 0) {
      ctx.fansMedals.push(...mergeMedalList(res))
      const totalPage = Number(res.data?.page_info?.total_page || 1)

      for (let page = 2; page <= totalPage; page++) {
        await sleep(300 + Math.floor(Math.random() * 200))
        const res = await api.live.fansMedalPanel(page)

        if (res.code === 0) {
          ctx.fansMedals.push(...mergeMedalList(res))
        } else {
          logger.warn(`粉丝勋章第 ${page} 页获取失败`, res.message || res.msg)
        }
      }
    } else {
      logger.warn('粉丝勋章获取失败', res.message || res.msg)
    }

    logger.info(`粉丝勋章数量: ${ctx.fansMedals.length}`)
  }

  return { ctx, api }
}

/**
 * 确保 biliTicket 可用
 * 优先使用配置中的缓存，过期则重新请求并回写配置文件
 */
async function ensureBiliTicket(config: AppConfig, ctx: BiliContext): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const cache = config._biliTicketCache

  // 缓存存在且未过期（预留 60 秒余量）
  if (cache && cache.ticket && cache.expiresAt - now > 60) {
    logger.info('使用缓存的 bili_ticket')
    setJarCookieFields(ctx.cookieJar, {
      bili_ticket: cache.ticket,
      bili_ticket_expires: String(cache.expiresAt)
    })
    return
  }

  // 缓存不存在或已过期，重新请求
  logger.info('bili_ticket 缓存不存在或已过期，重新请求')
  const passport = new PassportApi(ctx.cookieJar, ctx.userAgent)
  const data = await passport.fetchBiliTicket()

  const expiresAt = data.created_at + data.ttl

  // 注入 cookieJar
  setJarCookieFields(ctx.cookieJar, {
    bili_ticket: data.ticket,
    bili_ticket_expires: String(expiresAt)
  })

  // 同步更新运行时配置
  config._biliTicketCache = { ticket: data.ticket, expiresAt }

  // 回写配置文件缓存
  const configPath = getConfigPath()
  const fileConfig = readJson<AppConfig>(configPath, defaultConfig)
  fileConfig._biliTicketCache = { ticket: data.ticket, expiresAt }
  writeJson(configPath, fileConfig)
  logger.info('bili_ticket 已缓存到配置文件')
}

/**
 * 检查 Cookie 是否需要刷新，如果需要且存在 refreshToken 则执行完整刷新流程
 * 刷新成功后会更新 CookieJar、持久化新 Cookie 和新 refreshToken
 */
async function checkAndRefreshCookie(
  cookieJar: CookieJar,
  userAgent: string,
  config: AppConfig
): Promise<void> {
  const passport = new PassportApi(cookieJar, userAgent)

  logger.info('检查 Cookie 是否需要刷新')
  const info = await passport.checkCookieRefresh()

  if (info.code !== 0) {
    logger.warn('Cookie 刷新检查接口异常', info.message || info.msg)
    return
  }

  if (!info.data?.refresh) {
    logger.info('Cookie 无需刷新')
    return
  }

  // 需要刷新
  const oldRefreshToken = config.refreshToken
  if (!oldRefreshToken) {
    logger.warn(
      'Cookie 需要刷新，但配置中缺少 refreshToken（ac_time_value），跳过刷新。' +
        '请通过登录流程获取 refreshToken 后写入配置文件。'
    )
    return
  }

  logger.info('Cookie 需要刷新，开始刷新流程')

  // 1. 获取 refresh_csrf
  const { refreshCsrf, timestamp } = await passport.fetchRefreshCsrf(info.data.timestamp)
  logger.info(`已获取 refresh_csrf (timestamp=${timestamp})`)

  // 2. 刷新 Cookie（响应 Set-Cookie 会自动写入 CookieJar）
  const refreshRes = await passport.refreshCookie(oldRefreshToken, refreshCsrf)

  if (refreshRes.code !== 0 || !refreshRes.data?.refresh_token) {
    throw new Error(`Cookie 刷新失败: ${refreshRes.message || refreshRes.msg || refreshRes.code}`)
  }

  const newRefreshToken = refreshRes.data.refresh_token
  logger.info('Cookie 刷新成功，确认更新并使旧 Cookie 失效')

  // 3. 确认刷新，使旧 refresh_token 对应的 Cookie 失效
  await passport.confirmCookieRefresh(oldRefreshToken)

  // 4. 持久化新 refresh_token
  saveRefreshToken(newRefreshToken)
  config.refreshToken = newRefreshToken
  logger.info('已保存新 refreshToken 到配置文件')

  // 5. 持久化新 Cookie（过滤 Session cookie 和 bili_ticket）
  const rawCookie = exportCookieString(cookieJar)
  const cookie = mergeCookieFields(rawCookie, {
    b_lsid: undefined,
    bili_ticket_expires: undefined,
    bili_ticket: undefined
  })

  await envManager.saveEnv('BILI_TASK_COOKIES', cookie, { remark: 'BiliTask 登录 Cookie' })
  config.cookie = cookie
  logger.info('已持久化刷新后的 Cookie')
}
