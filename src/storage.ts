import { defaultConfig } from './config'
import { loadEnvMap, type EnvMap } from './utils/env'
import type { AppConfig } from './types'
import { getConfigPath, readJson } from './utils/file'

/** 需要从 面板/系统环境变量 中读取的所有 key */
const ENV_KEYS = ['BILI_TASK_COOKIES', 'BILI_UA'] as const
const CONFIG_PATH = getConfigPath()

function applyEnvConfig(config: AppConfig, envMap: EnvMap): AppConfig {
  // 读取 面板的环境变量/系统环境变量 回退到配置文件
  const cookie = envMap.BILI_TASK_COOKIES || config.cookie || undefined
  if (cookie) config.cookie = cookie

  const ua = envMap.BILI_UA
  if (ua) config.userAgent = ua

  return config
}

export async function loadConfig(): Promise<AppConfig> {
  const envMap = await loadEnvMap(ENV_KEYS)
  const config = readJson<AppConfig>(CONFIG_PATH, defaultConfig)
  console.log('[Storage] config:', CONFIG_PATH)
  return applyEnvConfig(config, envMap)
}
