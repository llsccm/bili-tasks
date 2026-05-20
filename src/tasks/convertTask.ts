import type { TaskEnv } from '../types'
import { createLogger } from '../utils'

export async function runSilverToCoinTask(env: TaskEnv): Promise<void> {
  const logger = createLogger('SilverToCoinTask')
  const task = env.config.DailyTasks.OtherTasks.silverToCoin
  if (!task.enabled) return

  if (task.dryRun) {
    logger.warn('dry-run：银瓜子换硬币未实际执行')
    return
  }

  const res = await env.api.exchange.silver2coin()
  if (res.code !== 0 && res.code !== 403) {
    throw new Error(`银瓜子换硬币失败：${res.message || res.msg}`)
  }

  logger.info('银瓜子换硬币完成')
}

export async function runCoinToSilverTask(env: TaskEnv): Promise<void> {
  const logger = createLogger('CoinToSilverTask')
  const task = env.config.DailyTasks.OtherTasks.coinToSilver
  if (!task.enabled) return

  if (task.dryRun) {
    logger.warn(`dry-run：硬币换银瓜子 ${task.num} 个未实际执行`)
    return
  }

  const res = await env.api.exchange.coin2silver(task.num)
  if (res.code !== 0) {
    throw new Error(`硬币换银瓜子失败：${res.message || res.msg}`)
  }

  logger.info('硬币换银瓜子完成')
}
