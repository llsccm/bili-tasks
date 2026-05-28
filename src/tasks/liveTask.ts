import type { BiliApi } from '../api'
import { RoomHeart } from './live-heart'
import type { AppConfig, FansMedal, TaskEnv } from '../types'
import { createLogger, sleep, randomBetween } from '../utils'

export async function runLightMedalTask(env: TaskEnv): Promise<void> {
  const logger = createLogger('LightMedalTask')
  const { light: task, danmuList } = env.config.DailyTasks.LiveTasks.medalTasks
  if (!task.enabled) return

  const medals = filterMedals(env.config, env.ctx.fansMedals)
    .filter((medal) => medal.medal.is_lighted !== 1)
    .slice(0, task.maxRooms)

  await sendDanmuToMedals(env.api, medals, danmuList, task.danmuPerRoom, '弹幕点亮')

  logger.info('粉丝勋章点亮任务完成')
}

/**
 * 向粉丝勋章对应直播间发送弹幕。
 */
export async function sendDanmuToMedals(
  api: BiliApi,
  medals: FansMedal[],
  danmuList: string[],
  danmuPerRoom: number,
  successAction = '弹幕发送'
): Promise<void> {
  const logger = createLogger('SendDanmuTask')
  if (medals.length === 0 || danmuList.length === 0 || danmuPerRoom <= 0) return

  let danmuIndex = 0
  for (const medal of medals) {
    for (let i = 0; i < danmuPerRoom; i++) {
      const danmu = danmuList[danmuIndex++ % danmuList.length]
      const res = await api.live.sendMsg(danmu, medal.room_info.room_id)

      if (res.code === 0 && res.msg !== 'k') {
        logger.info(`${successAction}: ${medal.medal.medal_name} ${danmu}`)
      } else {
        logger.warn(`弹幕发送异常: ${res.message || res.msg}`)
      }

      await sleep(randomBetween(6000, 8000))
    }
  }
}

/**
 * 点赞任务
 */
export async function runLikeMedalTask(env: TaskEnv): Promise<void> {
  const logger = createLogger('LikeMedalTask')
  const task = env.config.DailyTasks.LiveTasks.medalTasks.like
  if (!task.enabled) return

  // 开播才能点赞
  const medals = filterMedals(env.config, env.ctx.fansMedals)
    .filter((medal) => medal.room_info.living_status === 1)
    .slice(0, task.maxRooms)

  for (let i = 0; i < medals.length; i++) {
    const medal = medals[i]
    const click = await getLikeMedalClickCount(env.api, medal)

    if (click <= 0) {
      logger.info(`直播间点赞任务已完成: ${medal.medal.medal_name} room=${medal.room_info.room_id}`)
    } else {
      const res = await env.api.live.likeReport(
        medal.room_info.room_id,
        medal.medal.target_id,
        click
      )

      if (res.code === 0) {
        logger.info(
          `直播间点赞: ${medal.medal.medal_name} room=${medal.room_info.room_id} click=${click}`
        )
      } else {
        logger.warn(`点赞失败: ${res.message || res.msg}`)
      }

      if (i < medals.length - 1) {
        logger.info(`等待延时中`)
        await sleep(randomBetween(30000, 35000))
      }
    }
  }

  logger.info('直播间点赞任务完成')
}

export async function runWatchLiveTask(env: TaskEnv): Promise<void> {
  const logger = createLogger('WatchLiveTask')
  const task = env.config.DailyTasks.LiveTasks.medalTasks.watch
  if (!task.enabled) return

  if (!env.ctx.liveBuvid) {
    logger.warn('缺少 LIVE_BUVID，跳过直播观看任务')
    return
  }

  const medals = filterMedals(env.config, env.ctx.fansMedals, true).slice(0, task.maxRooms)

  for (const medal of medals) {
    const [areaId, parentAreaId] = await getAreaInfo(env.api, medal)
    if (areaId <= 0 || parentAreaId <= 0) continue

    const roomId = medal.room_info.room_id
    logger.info(`开始直播观看心跳: room=${roomId}`)
    const heart = new RoomHeart(
      env.api,
      env.ctx,
      task,
      roomId,
      areaId,
      parentAreaId,
      medal.medal.target_id
    )
    await heart.start()
  }

  logger.info('直播观看任务完成')
}

/**
 * 过滤粉丝勋章 白名单/黑名单
 */
function filterMedals(config: AppConfig, medals: FansMedal[], watchOnly = false): FansMedal[] {
  const medalConfig = config.DailyTasks.LiveTasks.medalTasks
  const { roomidList, isWhiteList } = medalConfig

  // 使用 Map 缓存 roomId 及对应索引，统一类型并提供 O(1) 查询
  const roomIndexMap = new Map<number, number>()
  for (let i = 0; i < roomidList.length; i++) {
    roomIndexMap.set(Number(roomidList[i]), i)
  }

  const filtered = medals.filter((medal) => {
    const roomId = Number(medal.room_info.room_id)
    const whiteBlackOk = isWhiteList ? roomIndexMap.has(roomId) : !roomIndexMap.has(roomId)
    const levelOk = !watchOnly || medal.medal.level < 120
    return whiteBlackOk && levelOk
  })

  // 白名单模式下，根据 Map 缓存的索引进行排序
  if (isWhiteList) {
    filtered.sort((a, b) => {
      const indexA = roomIndexMap.get(Number(a.room_info.room_id)) ?? Infinity
      const indexB = roomIndexMap.get(Number(b.room_info.room_id)) ?? Infinity
      return indexA - indexB
    })
  }

  return filtered
}

async function getLikeMedalClickCount(api: BiliApi, medal: FansMedal): Promise<number> {
  const logger = createLogger('LikeMedalTask')
  const res = await api.live.activatedMedalInfo(medal.medal.target_id)

  if (res.code !== 0) {
    logger.warn(`点赞任务信息获取失败: ${medal.medal.medal_name} ${res.message || res.msg}`)
    return 0
  }

  const likeTask = res.data.task_info.find((info) => info.jump_type === 'like')

  if (!likeTask) {
    logger.warn(`未找到点赞任务信息: ${medal.medal.medal_name}`)
    return 0
  }

  if (likeTask.is_done) return 0

  const progress = likeTask.sub_title.match(/(\d+)\s*\/\s*(\d+)/)

  if (!progress) {
    logger.warn(`点赞任务进度解析失败: ${medal.medal.medal_name} sub_title=${likeTask.sub_title}`)
    return 0
  }

  const current = Number(progress[1])
  const total = Number(progress[2])
  const needCount = Math.max(total - current, 0)

  return needCount * 30 + randomBetween(0, 10)
}

async function getAreaInfo(api: BiliApi, medal: FansMedal): Promise<[number, number]> {
  try {
    if (medal.room_info.url) {
      const url = new URL(medal.room_info.url)
      const areaId = Number(url.searchParams.get('area_id'))
      const parentAreaId = Number(url.searchParams.get('parent_area_id'))

      if (areaId > 0 && parentAreaId > 0) {
        return [areaId, parentAreaId]
      }
    }
  } catch {}

  const res = await api.live.getInfoByRoom(medal.room_info.room_id)

  if (res.code === 0) {
    return [res.data.room_info.area_id, res.data.room_info.parent_area_id]
  }

  return [-1, -1]
}
