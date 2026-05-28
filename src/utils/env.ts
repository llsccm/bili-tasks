import { BaihuOpenApiClient, type BaihuEnvPayload } from '../api/baihu'
import { defaultConfig } from '../config'
import type { AppConfig } from '../types'
import type { QinglongEnvItem } from '../types/qlapi'
import { createLogger, qinglongApi } from './index'
import { getConfigPath, readJson, writeJson } from './file'

export type RuntimeEnvironment = 'baihu' | 'qinglong' | 'node'

export type EnvMap = Record<string, string | undefined>

export interface SaveEnvOptions {
  remark?: string
  type?: string
  hidden?: boolean
  enabled?: boolean
}

const logger = createLogger('Env')

function enabledQinglongEnvItems(items: QinglongEnvItem[] = []): QinglongEnvItem[] {
  return items.filter((item) => item.name && item.value !== undefined && item.status !== 1)
}

function toBaihuPayload(
  name: string,
  value: string,
  options: SaveEnvOptions = {}
): BaihuEnvPayload {
  return {
    name,
    value,
    remark: options.remark,
    type: options.type,
    hidden: options.hidden,
    enabled: options.enabled ?? true
  }
}

export class EnvManager {
  async loadEnvMap(keys: readonly string[]): Promise<EnvMap> {
    const envMap: EnvMap = { ...process.env }
    const environment = detectEnvironment()
    if (environment !== 'qinglong') {
      return envMap
    }

    const api = qinglongApi()
    if (!api?.getEnvs) {
      return envMap
    }

    for (const key of keys) {
      try {
        const res = await api.getEnvs({ searchValue: key })

        if (res.code !== 200 || !res.data) {
          logger.warn(`QLAPI.getEnvs("${key}") 返回异常: `, res.message)
          continue
        }

        for (const item of enabledQinglongEnvItems(res.data)) {
          if (!item.name) continue
          envMap[item.name] = item.value ?? ''
        }
      } catch (error) {
        logger.warn(`QLAPI.getEnvs("${key}") 调用失败: `, error)
      }
    }

    return envMap
  }

  async getEnv(key: string): Promise<string | undefined> {
    const envMap = await this.loadEnvMap([key])
    return envMap[key]
  }

  async saveEnv(name: string, value: string, options: SaveEnvOptions = {}): Promise<void> {
    const environment = detectEnvironment()

    if (environment === 'qinglong') {
      const saved = await this.saveQinglongEnv(name, value, options)
      if (saved) return
      logger.warn(`青龙变量 ${name} 写入不可用，回退写入本地配置文件`)
    }

    if (environment === 'baihu') {
      await this.saveBaihuEnv(name, value, options)
      return
    }

    this.saveConfigEnv(name, value)
  }

  private async saveQinglongEnv(
    name: string,
    value: string,
    options: SaveEnvOptions
  ): Promise<boolean> {
    const api = qinglongApi()
    if (!api?.getEnvs || !api.createEnv || !api.updateEnv) return false

    const envs = await api.getEnvs({ searchValue: name })
    if (envs.code !== 200) {
      logger.warn('青龙变量查询失败，回退写入配置文件: ', envs.message)
      return false
    }

    const existed = envs.data?.find((item) => item.name === name)

    if (existed) {
      const res = await api.updateEnv({
        env: {
          ...existed,
          name,
          value,
          remarks: options.remark || existed.remarks
        }
      })

      if (res.code !== 200) {
        throw new Error(`更新青龙变量失败: ${res.message || res.code}`)
      }

      logger.info(`已更新青龙变量 ${name}`)
      return true
    }

    const res = await api.createEnv({
      envs: [
        {
          name,
          value,
          remarks: options.remark
        }
      ]
    })

    if (res.code !== 200) {
      throw new Error(`创建青龙变量失败: ${res.message || res.code}`)
    }

    logger.info(`已创建青龙变量 ${name}`)
    return true
  }

  private async saveBaihuEnv(name: string, value: string, options: SaveEnvOptions): Promise<void> {
    const client = new BaihuOpenApiClient()
    const envs = await client.getAllEnvs()
    const existed = envs.find((item) => item.name === name)

    if (existed) {
      await client.updateEnv(
        existed.id,
        toBaihuPayload(name, value, {
          ...options,
          remark: options.remark || existed.remark,
          enabled: options.enabled ?? existed.enabled
        })
      )
      logger.info(`已更新白虎变量 ${name}`)
      return
    }

    await client.createEnv(toBaihuPayload(name, value, options))
    logger.info(`已创建白虎变量 ${name}`)
  }

  private saveConfigEnv(name: string, value: string): void {
    if (name !== 'BILI_TASK_COOKIES') {
      process.env[name] = value
      logger.info(`已写入进程环境变量 ${name}`)
      return
    }

    const configPath = getConfigPath()
    const config = readJson<AppConfig>(configPath, defaultConfig)
    config.cookie = value
    writeJson(configPath, config)
    logger.info(`已写入本地配置文件: ${configPath}`)
  }
}

export const envManager = new EnvManager()

export function loadEnvMap(keys: readonly string[]): Promise<EnvMap> {
  return envManager.loadEnvMap(keys)
}

export function detectEnvironment(): RuntimeEnvironment {
  if (process.env.BH_SERVER_PORT) return 'baihu'
  if (process.env.QL_DIR || process.env.QL_BRANCH) return 'qinglong'
  return 'node'
}
