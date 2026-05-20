import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

const RUNTIME_DIR = process.cwd()
const CONFIG_SEARCH_PATHS = [
  '/ql/data/scripts/bilitask.config.json',
  '../bilitask.config.json',
  '/bilitask.config.json'
]

export function configPathCandidates(): string[] {
  return CONFIG_SEARCH_PATHS.map((path) => (isAbsolute(path) ? path : resolve(RUNTIME_DIR, path)))
}

export function getConfigPath(): string {
  const candidates = configPathCandidates()
  return candidates.find((path) => existsSync(path)) || resolve(RUNTIME_DIR, 'bilitask.config.json')
}

export function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return structuredClone(fallback)
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

export function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}
