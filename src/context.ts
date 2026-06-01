import { BiliApi, PassportApi } from './api'
import { defaultConfig } from './config'
import type { AppConfig, BiliContext, DynamicVideo, FansMedal } from './types'
import { createLogger, generateBLsid, randomBetween, sleep } from './utils'
import {
  createCookieJar,
  getBuvid3FromJar,
  getCsrfFromJar,
  getLiveBuvidFromJar,
  setJarCookieFields
} from './utils/cookie'
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

  await sleep(randomBetween(6000, 60000))

  const cookieJar = createCookieJar(config.cookie)
  const csrf = getCsrfFromJar(cookieJar)

  if (!csrf) {
    throw new Error('Cookie 缺少 bili_jct，无法执行需要 CSRF 的任务')
  }

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

  await sleep(randomBetween(6000, 60000))

  const reward = await api.user.reward()
  if (reward.code === 0) {
    ctx.dailyRewardInfo = reward.data
  } else {
    logger.warn('reward 获取失败', reward.message || reward.msg)
  }

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
 * 确保 biliTicket 可用（仅用于分享视频任务）。
 * 优先使用配置中的缓存，过期则重新请求并回写配置文件。
 */
export async function ensureBiliTicket(config: AppConfig, ctx: BiliContext): Promise<void> {
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

  // 回写配置文件缓存
  const configPath = getConfigPath()
  const fileConfig = readJson<AppConfig>(configPath, defaultConfig)
  fileConfig._biliTicketCache = { ticket: data.ticket, expiresAt }
  writeJson(configPath, fileConfig)
  logger.info('bili_ticket 已缓存到配置文件')

  // 同步更新运行时配置
  config._biliTicketCache = { ticket: data.ticket, expiresAt }
}
