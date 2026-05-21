import type { AppConfig, RewardData, TaskEnv } from '../types'
import { createLogger } from './index'

function logDailyRewardStatus(config: AppConfig, reward: RewardData): void {
  const logger = createLogger('RewardCheck')
  const main = config.DailyTasks.MainSiteTasks
  const checks: [string, boolean, boolean][] = [
    ['每日登录', main.login.enabled, reward.login],
    ['每日观看视频', main.watch.enabled, reward.watch],
    ['每日分享', main.share.enabled, reward.share],
    ['每日投币', main.coin.enabled, reward.coins >= main.coin.num * 10]
  ]

  for (const [name, enabled, done] of checks) {
    if (!enabled) continue
    if (done) {
      logger.info(`${name} 已完成`)
    } else {
      logger.warn(`${name} 未完成`)
    }
  }
}

export async function refreshDailyReward(env: TaskEnv): Promise<void> {
  const logger = createLogger('RewardCheck')

  const reward = await env.api.user.reward()
  if (reward.code !== 0 || !reward.data) {
    logger.warn('reward 获取失败，无法检查任务完成状态', reward.message || reward.msg)
    return
  }

  env.ctx.dailyRewardInfo = reward.data
  logDailyRewardStatus(env.config, reward.data)
}
