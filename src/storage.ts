import { defaultConfig } from './config'
import type { AppConfig } from './types'
import type { QinglongEnvItem } from './types/qlapi'
import { qinglongApi } from './utils'
import { getConfigPath, readJson } from './utils/file'

type EnvMap = Record<string, string | undefined>
const COOKIE_ENV_NAME = 'BILI_TASK_COOKIES'
const CONFIG_PATH = getConfigPath()

function enabledEnvItems(items: QinglongEnvItem[] = []): QinglongEnvItem[] {
  return items.filter((item) => item.name && item.value !== undefined && item.status !== 1)
}

async function loadQinglongEnvMap(): Promise<EnvMap> {
  const api = qinglongApi()
  // 1. 如果没有可用的 API 实例，直接回退
  if (!api?.getEnvs) {
    return process.env
  }

  try {
    const res = await api.getEnvs({ searchValue: COOKIE_ENV_NAME })
    if (res.code !== 200 || !res.data) {
      console.warn('[Storage] QLAPI.getEnvs 返回异常，回退到系统环境变量：', res.message)
      return process.env
    }

    const envMap: EnvMap = {}

    for (const item of enabledEnvItems(res.data)) {
      // 确保有 key 且该 key 之前未被写入过（保留第一个有效值）
      if (!item.name || item.name in envMap) continue
      envMap[item.name] = item.value ?? ''
    }

    return envMap
  } catch (error) {
    console.warn('[Storage] QLAPI.getEnvs 调用失败，回退到系统环境变量：', error)
    return process.env
  }
}

function readCookies(envMap: EnvMap, config: AppConfig): string | undefined {
  return envMap.BILI_TASK_COOKIES || config.cookie || undefined
}

function applyEnvConfig(config: AppConfig, envMap: EnvMap): AppConfig {
  const cookie = readCookies(envMap, config)
  if (cookie) config.cookie = cookie

  return config
}

export async function loadConfig(): Promise<AppConfig> {
  const envMap = await loadQinglongEnvMap()
  const config = readJson<AppConfig>(CONFIG_PATH, defaultConfig)
  return applyEnvConfig(config, envMap)
}

export function printStoragePaths(): void {
  console.log('[Storage] config:', CONFIG_PATH)
  // console.log('[Storage] config search paths:', CONFIG_CANDIDATES.join(' | '))
}
