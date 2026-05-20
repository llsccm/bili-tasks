import qrcode from 'qrcode-terminal'
import { PassportApi } from './api/passport'
import { defaultConfig } from './config'
import type { AppConfig } from './types'
import { createLogger, qinglongApi, random32Hash, sleep, uuid } from './utils'
import {
  createCookieJar,
  exportCookieString,
  getJarCookieField,
  setJarCookieFields
} from './utils/cookie'
import { getConfigPath, readJson, writeJson } from './utils/file'

const logger = createLogger('Login')
const COOKIE_ENV_NAME = 'BILI_TASK_COOKIES'
const POLL_INTERVAL_MS = 15_000
const DEFAULT_MAX_WAIT_MS = 180_000

/**
 * 生成 b_lsid cookie 值。
 * 格式：8位大写十六进制 + _ + 时间戳(毫秒)的十六进制大写。
 */
function generateBLsid(): string {
  const upper = random32Hash().slice(0, 8).toUpperCase()
  const lower = Date.now().toString(16).toUpperCase()
  return `${upper}_${lower}`
  // return 'E1CCDA9F_19E3C784F0A'
}

/**
 * 生成 _uuid cookie 值。
 * 格式类似 UUID 但末尾追加 6 位随机数字和 "infoc" 后缀。
 */
function generateUuid(): string {
  const id = uuid().toUpperCase()
  const suffix = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
  return `${id}${suffix}infoc`
  // return 'FCEEA510B-3528-DB4B-86C5-857E1077442A878064infoc'
}

/**
 * 生成 buvid_fp cookie 值（32 位十六进制字符串）。
 */
function generateBuvidFp(): string {
  // return random32Hash()
  return random32Hash()
}

function printQrCode(url: string): void {
  qrcode.generate(url, { small: true }, (code: string) => {
    console.log(code)
    logger.info('请使用哔哩哔哩客户端扫码登录：', url)
  })
}

async function writeQinglongCookie(cookie: string): Promise<boolean> {
  const api = qinglongApi()
  if (!api?.getEnvs || !api.createEnv || !api.updateEnv) return false

  const envs = await api.getEnvs({ searchValue: COOKIE_ENV_NAME })
  if (envs.code !== 200) {
    logger.warn('青龙变量查询失败，回退写入配置文件：', envs.message)
    return false
  }

  const existed = envs?.data?.find((item) => item.name === COOKIE_ENV_NAME)

  if (existed) {
    const res = await api.updateEnv({
      env: {
        ...existed,
        name: COOKIE_ENV_NAME,
        value: cookie,
        remarks: existed.remarks || 'BiliTask 登录 Cookie'
      }
    })

    if (res.code !== 200) {
      throw new Error(`更新青龙变量失败：${res.message || res.code}`)
    }

    logger.info(`已更新青龙变量 ${COOKIE_ENV_NAME}`)
    return true
  }

  const res = await api.createEnv({
    envs: [
      {
        name: COOKIE_ENV_NAME,
        value: cookie,
        remarks: 'BiliTask 登录 Cookie'
      }
    ]
  })

  if (res.code !== 200) {
    throw new Error(`创建青龙变量失败：${res.message || res.code}`)
  }

  logger.info(`已创建青龙变量 ${COOKIE_ENV_NAME}`)
  return true
}

function writeConfigCookie(cookie: string): void {
  const configPath = getConfigPath()
  const config = readJson<AppConfig>(configPath, defaultConfig)
  config.cookie = cookie
  writeJson(configPath, config)
  logger.info(`已写入本地配置文件：${configPath}`)
}

async function saveCookie(cookie: string): Promise<void> {
  const savedToQinglong = await writeQinglongCookie(cookie)
  if (!savedToQinglong) {
    writeConfigCookie(cookie)
  }
}

async function login(): Promise<void> {
  const jar = createCookieJar()
  const passport = new PassportApi(jar, defaultConfig.userAgent)

  // 1. 获取首页 cookie（buvid3、b_nut 等）
  await passport.fetchHomeCookie()
  const buvid3 = getJarCookieField(jar, 'buvid3')
  if (!buvid3) {
    throw new Error('访问 bilibili 首页响应头 Cookie 缺少 buvid3')
  }

  // 2. 补充浏览器指纹类 cookie（b_lsid、_uuid、buvid_fp）
  setJarCookieFields(jar, {
    b_lsid: generateBLsid(),
    _uuid: generateUuid(),
    buvid_fp: generateBuvidFp()
  })

  // 3. 获取 buvid4
  const finger = await passport.getFingerSpi()
  setJarCookieFields(jar, { buvid4: finger.b_4 })

  // 4. 获取 bili_ticket
  const biliTicket = await passport.fetchBiliTicket()
  setJarCookieFields(jar, {
    bili_ticket: biliTicket.ticket,
    bili_ticket_expires: String(biliTicket.created_at + biliTicket.ttl)
  })

  logger.info('Cookie 环境准备完成，开始申请登录二维码')

  // 5. 申请二维码
  const qrCode = await passport.generateQrCode()
  printQrCode(qrCode.url)

  // 6. 轮询扫码状态
  const startedAt = Date.now()

  while (Date.now() - startedAt <= DEFAULT_MAX_WAIT_MS) {
    logger.info(`等待 ${POLL_INTERVAL_MS / 1000} 秒后查询二维码状态`)
    await sleep(POLL_INTERVAL_MS)

    const result = await passport.pollQrCode(qrCode.qrcode_key)
    const data = result.data

    if (result.code !== 0 || !data) {
      throw new Error(`查询二维码状态失败：${result.message || result.msg || result.code}`)
    }

    if (data.code === 0) {
      logger.info(`登录成功：${data.message || '已确认'}`)

      // 补全 LIVE_BUVID
      const liveBuvid = await passport.fetchLiveBuvid()
      setJarCookieFields(jar, { LIVE_BUVID: liveBuvid })

      // 从 jar 导出为字符串存储
      const cookie = exportCookieString(jar)
      await saveCookie(cookie)
      return
    }

    if (data.code === 86038) {
      throw new Error('二维码已失效，请重新运行登录流程')
    }

    if (data.code === 86090) {
      logger.info('二维码已扫码，等待确认')
      continue
    }

    if (data.code === 86101) {
      logger.info('二维码未扫码')
      continue
    }

    logger.warn(`二维码状态：${data.code} ${data.message || result.message || ''}`)
  }

  throw new Error('等待扫码登录超时，请重新运行登录流程')
}

login().catch((error) => {
  console.error('[Login] 登录失败', error)
  process.exitCode = 1
})
