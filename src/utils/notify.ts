import baihu from 'baihu'
import { createLogger, qinglongApi } from './index'
import { detectEnvironment } from './env'

const logger = createLogger('Notify')

async function notifyQinglong(title: string, content: string): Promise<void> {
  const api = qinglongApi()

  if (!api?.systemNotify) {
    logger.warn('青龙 QLAPI.systemNotify 不可用，跳过通知')
    return
  }

  const res = await api.systemNotify({ title, content })

  if (res.code !== 200) {
    throw new Error(`青龙通知发送失败：${res.message || res.code}`)
  }

  logger.info('青龙通知发送成功')
}

async function notifyBaihu(title: string, content: string): Promise<void> {
  await baihu.notify(title, content)
  logger.info('白虎通知发送请求已提交')
}

export async function notify(title: string, content: string): Promise<void> {
  try {
    const environment = detectEnvironment()

    if (environment === 'qinglong') {
      await notifyQinglong(title, content)
      return
    }

    if (environment === 'baihu') {
      await notifyBaihu(title, content)
      return
    }

    logger.info('当前为普通 Node 环境，跳过通知发送')
  } catch (error) {
    logger.warn('通知发送失败，已跳过：', error)
  }
}
