import qrcode from 'qrcode-terminal'
import { PassportApi } from './api/passport'
import { defaultConfig } from './config'
import type { AppConfig } from './types'
import {
  createLogger,
  generateBLsid,
  generateBuvidFp,
  generateUuid,
  qinglongApi,
  sleep
} from './utils'
import {
  createCookieJar,
  exportCookieString,
  getJarCookieField,
  mergeCookieFields,
  setJarCookieFields
} from './utils/cookie'
import { getConfigPath, readJson, writeJson } from './utils/file'
import { loadQinglongEnvMap } from './storage'

/*!
 * new Env('bilibili扫码登录')
 */

const logger = createLogger('Login')
const COOKIE_ENV_NAME = 'BILI_TASK_COOKIES'
const POLL_INTERVAL_MS = 15_000
const DEFAULT_MAX_WAIT_MS = 180_000

/**
 * 从环境变量中解析 UA 和 buvid_fp。
 * - 若环境中无 BILI_UA 或 BILI_BUVID_FP，发出提示并回退到默认值。
 */
async function resolveEnvFingerprint(): Promise<{ userAgent: string; buvidFp: string }> {
  const env = await loadQinglongEnvMap(['BILI_UA', 'BILI_BUVID_FP'])

  const envUA = env.BILI_UA?.trim()
  const envBuvidFp = env.BILI_BUVID_FP?.trim()

  if (!envUA || !envBuvidFp) {
    logger.warn(
      '未检测到环境变量 BILI_UA 或 BILI_BUVID_FP，将使用默认 UA 并伪造生成 buvid_fp。' +
        '建议在环境中设置真实浏览器指纹以提高稳定性。'
    )
  }

  const userAgent = envUA || defaultConfig.userAgent
  const buvidFp = envBuvidFp || generateBuvidFp()

  logger.info('浏览器 UA:', userAgent)
  logger.info('buvid_fp:', buvidFp)

  return {
    userAgent,
    buvidFp
  }
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
  const { userAgent, buvidFp } = await resolveEnvFingerprint()

  const jar = createCookieJar()
  const passport = new PassportApi(jar, userAgent)

  // 1. 获取首页 cookie（buvid3、b_nut 等）
  await passport.fetchHomeCookie()
  const buvid3 = getJarCookieField(jar, 'buvid3')
  if (!buvid3) {
    throw new Error('访问 bilibili 首页响应头 Cookie 缺少 buvid3')
  }

  // 2. 补充浏览器指纹类 cookie（_uuid、buvid_fp）
  //    b_lsid 为 Session cookie，仅注入当次请求 jar，不写入持久化存储
  setJarCookieFields(jar, {
    b_lsid: generateBLsid(),
    _uuid: generateUuid(),
    buvid_fp: buvidFp
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

      // 从 jar 导出为字符串存储，过滤掉 b_lsid（Session cookie，不持久化）
      const rawCookie = exportCookieString(jar)
      const cookie = mergeCookieFields(rawCookie, { b_lsid: undefined })
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
