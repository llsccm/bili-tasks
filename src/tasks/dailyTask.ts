import type { BiliContext, DynamicVideo, TaskEnv } from '../types'
import { createLogger, generateBLsid, nowSec, randomBetween, sleep } from '../utils'
import { setJarCookieFields } from '../utils/cookie'

function firstVideo(ctx: BiliContext): DynamicVideo | undefined {
  return ctx.dynamicVideos[0]
}

// function randomVideo(ctx: BiliContext): DynamicVideo | undefined {
//   if (ctx.dynamicVideos.length === 0) return undefined
//   return ctx.dynamicVideos[randomBetween(0, ctx.dynamicVideos.length - 1)]
// }

export async function runLoginTask(env: TaskEnv): Promise<void> {
  const logger = createLogger('LoginTask')
  const task = env.config.DailyTasks.MainSiteTasks.login
  if (!task.enabled) return

  if (env.ctx.dailyRewardInfo?.login) {
    logger.info('每日登录已完成')
  } else {
    logger.info('已触发每日登录')
  }
}

export async function runWatchVideoTask(env: TaskEnv): Promise<void> {
  const logger = createLogger('WatchVideoTask')
  const task = env.config.DailyTasks.MainSiteTasks.watch
  if (!task.enabled) return

  if (env.ctx.dailyRewardInfo?.watch) {
    logger.info('每日观看视频已完成')
    return
  }

  const video = firstVideo(env.ctx)
  if (!video) throw new Error('没有可用于观看任务的动态视频')

  setJarCookieFields(env.ctx.cookieJar, { b_lsid: generateBLsid() })

  // 通过 videoView 接口获取真实 cid 和 duration
  const viewRes = await env.api.video.videoView({ aid: Number(video.aid), bvid: video.bvid })

  if (viewRes.code !== 0 || !viewRes.data) throw new Error('获取视频信息失败: ' + (viewRes.message || viewRes.msg || '无数据返回'))

  const { cid, duration } = viewRes.data
  const startTs = nowSec()

  // 第一步：模拟打开视频 / 初始心跳上报（played_time=0）
  const openRes = await env.api.video.videoHeartbeatOpen(
    Number(video.aid),
    video.bvid,
    cid,
    startTs
  )

  if (openRes.code !== 0) {
    throw new Error(`模拟打开视频失败: ${openRes.message || openRes.msg}`)
  }

  logger.info(`已模拟打开视频: ${video.aid} ${video.title || ''}`)

  // 等待一段随机时间，模拟真实观看间隔
  await sleep(randomBetween(3000, 6000))

  // 第二步：观看视频心跳结束上报（随机 1~14 秒播放时间）
  const finishRes = await env.api.video.videoHeartbeatFinish(
    Number(video.aid),
    video.bvid,
    cid,
    duration,
    startTs
  )

  if (finishRes.code !== 0) {
    throw new Error(`观看视频心跳结束上报失败: ${finishRes.message || finishRes.msg}`)
  }

  logger.info(`每日观看视频完成: ${video.aid} ${video.title || ''}`)
}

export async function runShareTask(env: TaskEnv): Promise<void> {
  const logger = createLogger('ShareTask')
  const task = env.config.DailyTasks.MainSiteTasks.share
  if (!task.enabled) return

  if (env.ctx.dailyRewardInfo?.share) {
    logger.info('每日分享已完成')
    return
  }

  const video = firstVideo(env.ctx)
  if (!video) throw new Error('没有可用于分享任务的动态视频')

  // 若今日尚未观看该视频，先模拟打开视频（初始心跳上报）
  if (!env.ctx.dailyRewardInfo?.watch) {
    setJarCookieFields(env.ctx.cookieJar, { b_lsid: generateBLsid() })
    const openRes = await env.api.video.videoHeartbeatOpen(Number(video.aid), video.bvid)

    if (openRes.code !== 0) {
      logger.warn(`分享前模拟打开视频失败: ${openRes.message || openRes.msg}`)
    } else {
      logger.info(`分享前已模拟打开视频: ${video.aid}`)
    }

    await sleep(randomBetween(1000, 3000))
  }

  await sleep(randomBetween(1000, 2000))

  const res = await env.api.video.share(video.aid, video.bvid)
  if (res.code !== 0 && res.code !== 71000) {
    throw new Error(`分享失败: ${res.message || res.msg}`)
  }

  logger.info(`每日分享完成: ${video.aid}`)
}

export async function runCoinTask(env: TaskEnv): Promise<void> {
  const logger = createLogger('CoinTask')
  const task = env.config.DailyTasks.MainSiteTasks.coin
  if (!task.enabled) return

  const already = (env.ctx.dailyRewardInfo?.coins || 0) / 10
  let left = Math.max(0, task.num - already)

  if (left <= 0) {
    logger.info('每日投币已完成')
    return
  }

  if (task.dryRun) {
    logger.warn(`dry-run: 需要投币 ${left} 个，未实际执行`)
    return
  }

  for (const video of env.ctx.dynamicVideos) {
    const relation = await env.api.video.videoRelation(video.aid, video.bvid)
    const coined = relation.code === 0 ? Number(relation.data.coin || 0) : 0
    const count = Math.min(1 - coined, left)
    if (count <= 0) continue

    const res = await env.api.video.coinAdd(video.aid, count)

    if (res.code === -104) {
      throw new Error('硬币余额不足')
    }

    if (res.code !== 0) {
      throw new Error(`投币失败: ${res.message || res.msg}`)
    }

    left -= count
    logger.info(`投币成功: ${video.aid} x${count}`)
    if (left <= 0) break

    await sleep(randomBetween(3000, 6000))
  }
}
