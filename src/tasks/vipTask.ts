import type { TaskEnv } from '../types'
import { createLogger, sleep, randomBetween } from '../utils'

const VIP_BLACK_TYPES = new Set([8, 14, 18, 19, 20, 21, 24, 25, 26, 27, 200])

export async function runVipPrivilegeTask(env: TaskEnv): Promise<void> {
  const logger = createLogger('VipPrivilegeTask')
  const task = env.config.DailyTasks.OtherTasks.getYearVipPrivilege
  if (!task.enabled) return

  if (!(env.ctx.userInfo?.vip?.status === 1 && env.ctx.userInfo?.vip?.type === 2)) {
    logger.info('非年度大会员，跳过权益领取')
    return
  }

  const privilege = await env.api.vip.myPrivilege()
  if (privilege.code !== 0) {
    throw new Error(`获取大会员权益失败：${privilege.message || privilege.msg}`)
  }

  for (const item of privilege.data?.list || []) {
    if (VIP_BLACK_TYPES.has(item.type) || item.state !== 0) continue

    if (task.dryRun) {
      logger.warn(`dry-run：权益 ${item.name || item.type} 未实际领取`)
      continue
    }

    const res =
      item.type === 9
        ? await env.api.vip.addExperience()
        : await env.api.vip.receivePrivilege(item.type)
    if (res.code === 0) {
      logger.info(`领取权益成功：${item.name || item.type}`)
    } else {
      logger.warn(`领取权益失败：${item.name || item.type}`, res.message || res.msg)
    }

    await sleep(randomBetween(1000, 3000))
  }
}
