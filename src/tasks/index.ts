import { runLoginTask, runShareTask, runWatchVideoTask } from './dailyTask'
import { runLightMedalTask, runLikeMedalTask, runWatchLiveTask } from './liveTask'
import { runVipPrivilegeTask } from './vipTask'
import type { TaskEnv } from '../types'
import { createLogger } from '../utils'

export async function runAllTasks(env: TaskEnv): Promise<void> {
  const logger = createLogger('Runner')
  const tasks: Array<[string, (env: TaskEnv) => Promise<void>]> = [
    ['login', runLoginTask],
    ['watchVideo', runWatchVideoTask],
    ['share', runShareTask],
    ['lightMedal', runLightMedalTask],
    ['likeMedal', runLikeMedalTask],
    ['vipPrivilege', runVipPrivilegeTask],
    ['watchLive', runWatchLiveTask]
  ]

  for (const [name, task] of tasks) {
    try {
      await task(env)
    } catch (error) {
      logger.error(`任务 ${name} 执行失败`, error)
    }
  }

  // await refreshDailyReward(env)
}
