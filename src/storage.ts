import { defaultConfig } from './config'
import type { AppConfig } from './types'
import type { QinglongEnvItem } from './types/qlapi'
import { createLogger, qinglongApi } from './utils'
import { getConfigPath, readJson } from './utils/file'

type EnvMap = Record<string, string | undefined>

/** 需要从 青龙面板/系统环境变量 中读取的所有 key */
const ENV_KEYS = ['BILI_TASK_COOKIES', 'BILI_TASK_UA'] as const

const CONFIG_PATH = getConfigPath()
const logger = createLogger('Storage')

function enabledEnvItems(items: QinglongEnvItem[] = []): QinglongEnvItem[] {
  return items.filter((item) => item.name && item.value !== undefined && item.status !== 1)
}

/**
 * 从青龙面板批量加载环境变量，以 process.env 为兜底。
 *
 * @param keys - 需要查询的环境变量名列表，每个 key 会作为 searchValue 调用一次 getEnvs
 * @returns 合并后的 EnvMap（process.env 为底层，青龙值覆盖其上）
 */
export async function loadQinglongEnvMap(keys: readonly string[]): Promise<EnvMap> {
  // 以 process.env 为基础，后续用青龙返回值覆盖
  const envMap: EnvMap = { ...process.env }

  const api = qinglongApi()
  if (!api?.getEnvs) {
    return envMap
  }

  for (const key of keys) {
    try {
      const res = await api.getEnvs({ searchValue: key })

      if (res.code !== 200 || !res.data) {
        logger.warn(`QLAPI.getEnvs("${key}") 返回异常：`, res.message)
        continue
      }

      for (const item of enabledEnvItems(res.data)) {
        if (!item.name || item.name in envMap) continue
        envMap[item.name] = item.value ?? ''
      }
    } catch (error) {
      logger.warn(`QLAPI.getEnvs("${key}") 调用失败：`, error)
    }
  }

  return envMap
}

function applyEnvConfig(config: AppConfig, envMap: EnvMap): AppConfig {
  // 读取 青龙的环境变量/系统环境变量 回退到配置文件
  const cookie = envMap.BILI_TASK_COOKIES || config.cookie || undefined
  if (cookie) config.cookie = cookie

  const ua = envMap.BILI_TASK_UA
  if (ua) config.userAgent = ua

  return config
}

export async function loadConfig(): Promise<AppConfig> {
  const envMap = await loadQinglongEnvMap(ENV_KEYS)
  const config = readJson<AppConfig>(CONFIG_PATH, defaultConfig)
  return applyEnvConfig(config, envMap)
}

export function printStoragePaths(): void {
  console.log('[Storage] config:', CONFIG_PATH)
  // console.log('[Storage] config search paths:', CONFIG_CANDIDATES.join(' | '))
}
