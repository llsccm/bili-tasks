import assert from 'node:assert/strict'
import test from 'node:test'
import { BiliApi, getFingerPrint } from '../src/api'
import type { BiliContext } from '../src/types'
import { createCookieJar } from '../src/utils/cookie'

function createContext(cookie: string): BiliContext {
  return {
    cookieJar: createCookieJar(cookie),
    csrf: 'csrf-token',
    buvid3: 'buvid3-value',
    userAgent: 'Test Browser/1.0',
    wbiSalt: '',
    dynamicVideos: [],
    fansMedals: []
  }
}

test('activateCookies POSTs nested Gaia payload with jar cookies and configured UA', async () => {
  const api = new BiliApi(
    createContext('_uuid=test-uuid; buvid3=test-buvid3; SESSDATA=test-sessdata')
  )
  const originalFetch = globalThis.fetch
  let requestUrl = ''
  let requestInit: RequestInit | undefined

  globalThis.fetch = (async (input, init) => {
    requestUrl = String(input)
    requestInit = init
    return new Response(JSON.stringify({ code: 0, message: 'ok' }), { headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const response = await api.activateCookies()

    assert.deepEqual(response, { code: 0, message: 'ok' })
    assert.equal(
      requestUrl,
      'https://api.bilibili.com/x/internal/gaia-gateway/ExClimbWuzhi'
    )
    assert.equal(requestInit?.method, 'POST')

    const headers = new Headers(requestInit?.headers)
    assert.equal(headers.get('Content-Type'), 'application/json;charset=UTF-8')
    assert.equal(headers.get('Origin'), 'https://www.bilibili.com')
    assert.equal(headers.get('Referer'), 'https://www.bilibili.com/')
    assert.equal(headers.get('User-Agent'), 'Test Browser/1.0')
    assert.match(headers.get('Cookie') || '', /_uuid=test-uuid/)
    assert.match(headers.get('Cookie') || '', /SESSDATA=test-sessdata/)

    const wrapper = JSON.parse(String(requestInit?.body)) as { payload: string }
    assert.deepEqual(Object.keys(wrapper), ['payload'])
    const payload = JSON.parse(wrapper.payload) as Record<string, unknown>
    const inner = payload['3c43'] as Record<string, unknown>
    assert.equal(payload['39c8'], '333.1007.fp.risk')
    assert.equal(payload['df35'], 'test-uuid')
    assert.match(String(payload['5062']), /^\d{13}$/)
    assert.equal(inner['b8ce'], 'Test Browser/1.0')
    assert.equal(inner['641c'], 0)
    assert.equal(inner['807e'], 1)
    assert.match(String(inner['13ab']), /^[A-Za-z0-9+/]{4}AAAAAElFTkSuQmCC$/)
    assert.match(String(inner['bfe9']), /^[A-Za-z0-9+/]{34}AAAAAElFTkSuQmCC$/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('activateCookies rejects when CookieJar has no _uuid', () => {
  const api = new BiliApi(createContext('buvid3=test-buvid3'))

  assert.throws(() => api.activateCookies(), /Cookie 缺少 _uuid/)
})

test('activateCookies reuses provided fingerprint instead of generating new random values', async () => {
  const api = new BiliApi(
    createContext('_uuid=test-uuid; buvid3=test-buvid3; SESSDATA=test-sessdata')
  )
  const originalFetch = globalThis.fetch
  let requestInit: RequestInit | undefined

  globalThis.fetch = (async (_input, init) => {
    requestInit = init
    return new Response(JSON.stringify({ code: 0, message: 'ok' }), { headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const customFp: Record<string, unknown> = {
      '807e': 1,
      b8ce: 'OldUA/1.0',
      '13ab': 'fixedCanvasBase64==',
      '748e': [1920, 1080],
      d61f: [1920, 1040]
    }
    await api.activateCookies(customFp)

    const wrapper = JSON.parse(String(requestInit?.body)) as { payload: string }
    const payload = JSON.parse(wrapper.payload) as Record<string, unknown>
    const inner = payload['3c43'] as Record<string, unknown>

    assert.equal(inner['13ab'], 'fixedCanvasBase64==')
    assert.equal(inner['b8ce'], 'Test Browser/1.0')
    assert.equal(payload['6e7c'], '1920x1040')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('getFingerPrint returns simulated browser environment fingerprint payload with randomized values', () => {
  const fp1 = getFingerPrint('CustomUA/1.0')
  const fp2 = getFingerPrint('CustomUA/1.0')

  assert.equal(fp1['b8ce'], 'CustomUA/1.0')
  assert.equal(fp1['641c'], 0)
  assert.equal(fp1['807e'], 1)
  assert.equal(fp1['07a4'], 'zh-CN')
  assert.equal(fp1['adca'], 'Win32')
  assert.match(String(fp1['13ab']), /^[A-Za-z0-9+/]{4}AAAAAElFTkSuQmCC$/)
  assert.match(String(fp1['bfe9']), /^[A-Za-z0-9+/]{34}AAAAAElFTkSuQmCC$/)
  assert.equal(Array.isArray(fp1['748e']), true)
  assert.equal(Array.isArray(fp1['a658']), true)
  assert.notEqual(fp1['13ab'], fp2['13ab'])
})
