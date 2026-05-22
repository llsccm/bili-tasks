import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto'
import type { QinglongApi } from '../types/qlapi'

export function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

export function nowMs(): number {
  return Date.now()
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function randomBetween(min: number, max: number): number {
  return randomInt(min, max + 1)
}

export function random32Hash(): string {
  return randomBytes(16).toString('hex')
}

/**
 * 生成标准 UUID v4 字符串（用于设备标识等场景）
 */
export function uuid(): string {
  return randomUUID()
}

/**
 * 生成 _uuid cookie 值
 * 格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx{5位时间戳余数}infoc（大写十六进制）
 */
export function generateUuid(): string {
  const b = randomBytes(16)
  const hex = (start: number, len: number) =>
    b
      .subarray(start, start + len)
      .toString('hex')
      .toUpperCase()

  const part1 = hex(0, 4) // 8位
  const part2 = hex(4, 2) // 4位
  const part3 = hex(6, 2) // 4位
  const part4 = hex(8, 2) // 4位
  const part5 = hex(10, 6) // 12位

  const tsSuffix = String(Date.now() % 1e5).padStart(5, '0')

  return `${part1}-${part2}-${part3}-${part4}-${part5}${tsSuffix}infoc`
}

/**
 * 生成 b_lsid cookie 值（Session 级别，不应持久化存储）
 * 格式：8位大写十六进制 + _ + 时间戳(毫秒)的十六进制大写
 */
export function generateBLsid(): string {
  const upper = randomBytes(4).toString('hex').toUpperCase()
  const lower = Date.now().toString(16).toUpperCase()
  return `${upper}_${lower}`
}

/**
 * 生成伪造的 buvid_fp（32 位十六进制字符串）
 * 仅在环境中未提供真实值时作为回退使用。
 */
export function generateBuvidFp(): string {
  return random32Hash()
}

export function md5(value: string): string {
  return createHash('md5').update(value).digest('hex')
}

export function parseCookie(cookie: string): Record<string, string> {
  const result: Record<string, string> = {}

  for (const part of cookie.split(';')) {
    const index = part.indexOf('=')
    if (index <= 0) continue

    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key) {
      result[key] = value
    }
  }

  return result
}

const DISALLOWED_CHARS_REGEX = /[!'()*]/g

export function queryString(params: Record<string, unknown>, sort = false): string {
  const keys = Object.keys(params)
  if (sort) keys.sort()

  const parts: string[] = []

  for (const key of keys) {
    const value = params[key]

    // 过滤 null 和 undefined
    if (value !== undefined && value !== null) {
      const cleanValue = String(value).replace(DISALLOWED_CHARS_REGEX, '')
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(cleanValue)}`)
    }
  }

  return parts.join('&')
}

export function hmacHex(algorithm: string, value: string, key: string): string {
  return createHmac(algorithm, key).update(value).digest('hex')
}

export function createLogger(scope: string) {
  const getPrefix = () => `[${new Date().toLocaleString('zh-CN', { hour12: false })}][${scope}]`

  return {
    info: (...args: unknown[]) => console.log(getPrefix(), ...args),
    warn: (...args: unknown[]) => console.warn(getPrefix(), ...args),
    error: (...args: unknown[]) => console.error(getPrefix(), ...args)
  }
}

export function qinglongApi(): QinglongApi | undefined {
  const candidate = (globalThis as typeof globalThis & { QLAPI?: QinglongApi }).QLAPI
  return candidate?.getEnvs ? candidate : undefined
}

/**
 * 解析 User-Agent 字符串：若为 Chrome 则提取对应版本生成 Sec-CH-UA，其余情况一律直接兜底。
 */
export function getSecChUaFromUa(ua: string): string {
  const brandGrease = '"Not;A=Brand";v="24"'
  const defaultChromiumVersion = '128'

  // 排除 Edge (Edg/)、Opera (OPR/) 等同样包含 "Chrome/" 关键字的 Chromium 内核浏览器
  // 确保只有纯正的 Google Chrome 进入解析逻辑
  if (
    ua.includes('Chrome/') &&
    !ua.includes('Edg/') &&
    !ua.includes('OPR/') &&
    !ua.includes('Chromium/')
  ) {
    const chromeMatch = ua.match(/Chrome\/(\d+)/)
    const version = chromeMatch ? chromeMatch[1] : defaultChromiumVersion
    return `"Chromium";v="${version}", ${brandGrease}, "Google Chrome";v="${version}"`
  }

  // 其他所有浏览器（Firefox, Safari, Edge, Opera 等）或无法识别的 UA 直接进入兜底
  return `"Chromium";v="${defaultChromiumVersion}", ${brandGrease}, "Google Chrome";v="${defaultChromiumVersion}"`
}
