import { runLoginTask, runShareTask, runWatchVideoTask } from './dailyTask'
import { runLightMedalTask, runLikeMedalTask, runWatchLiveTask } from './liveTask'
import { runVipPrivilegeTask } from './vipTask'
import type { TaskEnv } from '../types'
import { createLogger, formatError } from '../utils'
import { notify } from '../utils/notify'

export async function runAllTasks(env: TaskEnv): Promise<void> {
  const logger = createLogger('Runner')
  const tasks: [string, (env: TaskEnv) => Promise<void>][] = [
    ['login', runLoginTask],
    ['watchVideo', runWatchVideoTask],
    ['lightMedal', runLightMedalTask],
    ['likeMedal', runLikeMedalTask],
    ['vipPrivilege', runVipPrivilegeTask],
    ['watchLive', runWatchLiveTask],
    ['likeMedal', runLikeMedalTask]
  ]

  const shareAfter = new Date().getDate() % 2 === 1 ? 'watchVideo' : 'watchLive'
  const shareIndex = tasks.findIndex(([name]) => name === shareAfter) + 1
  tasks.splice(shareIndex, 0, ['share', runShareTask])

  for (const [name, task] of tasks) {
    try {
      await task(env)
    } catch (error) {
      logger.error(`任务 ${name} 执行失败`, error)
      await notify('BiliTask 任务执行失败', `任务: ${name}\n错误: ${formatError(error)}`)
    }
  }

  // await refreshDailyReward(env)
}
