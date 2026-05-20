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

export function uuid(): string {
  return randomUUID()
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
