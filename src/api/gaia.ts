import { randomBytes, randomInt } from 'node:crypto'
import type { BiliContext } from '../types'
import { getJarCookieField } from '../utils/cookie'
import { BiliRequest } from './request'

const GAIA_ACTIVATE_COOKIES_API = '/x/internal/gaia-gateway/ExClimbWuzhi'
const BILI_HOME_URL = 'https://www.bilibili.com/'
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
const PNG_FOOTER = 'AAAAAElFTkSuQmCC'

const SCREEN_RESOLUTIONS: readonly [number, number][] = [
  [1920, 1080],
  [2560, 1440],
  [1707, 1067],
  [1536, 864],
  [1440, 900],
  [1366, 768]
]

const RENDERERS = [
  'Google Inc. (AMD)~ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'Google Inc. (NVIDIA)~ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'Google Inc. (NVIDIA)~ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'Google Inc. (Intel)~ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'Google Inc. (Intel)~ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'
] as const

const BASE_FONTS = [
  'Arial',
  'Calibri',
  'Cambria',
  'Consolas',
  'Courier New',
  'Georgia',
  'Microsoft Sans Serif',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana'
]

const OPTIONAL_FONTS = [
  'Arial Black',
  'Arial Narrow',
  'Book Antiqua',
  'Bookman Old Style',
  'Century',
  'Century Gothic',
  'Comic Sans MS',
  'Courier',
  'Helvetica',
  'Impact',
  'Lucida Console',
  'Lucida Handwriting',
  'Lucida Sans Unicode',
  'MS Gothic',
  'MS PGothic',
  'Palatino Linotype',
  'Segoe Print',
  'Segoe Script',
  'Segoe UI Light',
  'Segoe UI Semibold',
  'Segoe UI Symbol',
  'Wingdings'
]

const CONCURRENCY_OPTIONS = [8, 12, 16] as const

function randomChoice<T>(list: readonly T[]): T {
  return list[randomInt(0, list.length)]
}

function randomCanvas(): string {
  return `${randomBytes(3).toString('base64').slice(0, 4)}${PNG_FOOTER}`
}

function randomWebGL(): string {
  return `${randomBytes(26).toString('base64').slice(0, 34)}${PNG_FOOTER}`
}

function randomFonts(): string[] {
  return BASE_FONTS.concat(OPTIONAL_FONTS.filter(() => Math.random() > 0.4)).sort()
}

export interface GaiaPayloadWrapper {
  payload: string
}

/**
 * 模拟浏览器环境设备指纹核心载荷（3c43）
 */
export function getFingerPrint(userAgent?: string): Record<string, unknown> {
  const [width, height] = randomChoice(SCREEN_RESOLUTIONS)
  const availableHeight = height - 40

  return {
    '807e': 1,
    b8ce: userAgent || DEFAULT_UA,
    '641c': 0,
    '07a4': 'zh-CN',
    '5766': 24,
    '1c57': 8,
    '0bd0': randomChoice(CONCURRENCY_OPTIONS),
    '748e': [width, height],
    d61f: [width, availableHeight],
    fc9d: -480,
    '6aa9': 'Asia/Shanghai',
    '75b8': 1,
    '3b21': 1,
    '7003': 1,
    '6527': 0,
    '8a1c': 0,
    d52f: 'not available',
    adca: 'Win32',
    '80c9': [
      [
        'PDF Viewer',
        'Portable Document Format',
        [
          ['application/pdf', 'pdf'],
          ['text/pdf', 'pdf']
        ]
      ],
      [
        'Chrome PDF Viewer',
        'Portable Document Format',
        [
          ['application/pdf', 'pdf'],
          ['text/pdf', 'pdf']
        ]
      ],
      [
        'Chromium PDF Viewer',
        'Portable Document Format',
        [
          ['application/pdf', 'pdf'],
          ['text/pdf', 'pdf']
        ]
      ],
      [
        'Microsoft Edge PDF Viewer',
        'Portable Document Format',
        [
          ['application/pdf', 'pdf'],
          ['text/pdf', 'pdf']
        ]
      ],
      [
        'WebKit built-in PDF',
        'Portable Document Format',
        [
          ['application/pdf', 'pdf'],
          ['text/pdf', 'pdf']
        ]
      ]
    ],
    '13ab': randomCanvas(),
    bfe9: randomWebGL(),
    a3c1: [
      'extensions:ANGLE_instanced_arrays;EXT_blend_minmax;EXT_clip_control;EXT_color_buffer_half_float;EXT_depth_clamp;EXT_disjoint_timer_query;EXT_float_blend;EXT_frag_depth;EXT_polygon_offset_clamp;EXT_shader_texture_lod;EXT_texture_compression_bptc;EXT_texture_compression_rgtc;EXT_texture_filter_anisotropic;EXT_texture_mirror_clamp_to_edge;EXT_sRGB;KHR_parallel_shader_compile;OES_element_index_uint;OES_fbo_render_mipmap;OES_standard_derivatives;OES_texture_float;OES_texture_float_linear;OES_texture_half_float;OES_texture_half_float_linear;OES_vertex_array_object;WEBGL_blend_func_extended;WEBGL_color_buffer_float;WEBGL_compressed_texture_s3tc;WEBGL_compressed_texture_s3tc_srgb;WEBGL_debug_renderer_info;WEBGL_debug_shaders;WEBGL_depth_texture;WEBGL_draw_buffers;WEBGL_lose_context;WEBGL_multi_draw;WEBGL_polygon_mode',
      'webgl aliased line width range:[1, 1]',
      'webgl aliased point size range:[1, 1024]',
      'webgl alpha bits:8',
      'webgl antialiasing:yes',
      'webgl blue bits:8',
      'webgl depth bits:24',
      'webgl green bits:8',
      'webgl max anisotropy:16',
      'webgl max combined texture image units:32',
      'webgl max cube map texture size:16384',
      'webgl max fragment uniform vectors:1024',
      'webgl max render buffer size:16384',
      'webgl max texture image units:16',
      'webgl max texture size:16384',
      'webgl max varying vectors:30',
      'webgl max vertex attribs:16',
      'webgl max vertex texture image units:16',
      'webgl max vertex uniform vectors:4096',
      'webgl max viewport dims:[32767, 32767]',
      'webgl red bits:8',
      'webgl renderer:WebKit WebGL',
      'webgl shading language version:WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
      'webgl stencil bits:0',
      'webgl vendor:WebKit',
      'webgl version:WebGL 1.0 (OpenGL ES 2.0 Chromium)',
      'webgl unmasked vendor:Google Inc. (AMD)',
      'webgl unmasked renderer:ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'webgl vertex shader high float precision:23',
      'webgl vertex shader high float precision rangeMin:127',
      'webgl vertex shader high float precision rangeMax:127',
      'webgl vertex shader medium float precision:23',
      'webgl vertex shader medium float precision rangeMin:127',
      'webgl vertex shader medium float precision rangeMax:127',
      'webgl vertex shader low float precision:23',
      'webgl vertex shader low float precision rangeMin:127',
      'webgl vertex shader low float precision rangeMax:127',
      'webgl fragment shader high float precision:23',
      'webgl fragment shader high float precision rangeMin:127',
      'webgl fragment shader high float precision rangeMax:127',
      'webgl fragment shader medium float precision:23',
      'webgl fragment shader medium float precision rangeMin:127',
      'webgl fragment shader medium float precision rangeMax:127',
      'webgl fragment shader low float precision:23',
      'webgl fragment shader low float precision rangeMin:127',
      'webgl fragment shader low float precision rangeMax:127',
      'webgl vertex shader high int precision:0',
      'webgl vertex shader high int precision rangeMin:31',
      'webgl vertex shader high int precision rangeMax:30',
      'webgl vertex shader medium int precision:0',
      'webgl vertex shader medium int precision rangeMin:31',
      'webgl vertex shader medium int precision rangeMax:30',
      'webgl vertex shader low int precision:0',
      'webgl vertex shader low int precision rangeMin:31',
      'webgl vertex shader low int precision rangeMax:30',
      'webgl fragment shader high int precision:0',
      'webgl fragment shader high int precision rangeMin:31',
      'webgl fragment shader high int precision rangeMax:30',
      'webgl fragment shader medium int precision:0',
      'webgl fragment shader medium int precision rangeMin:31',
      'webgl fragment shader medium int precision rangeMax:30',
      'webgl fragment shader low int precision:0',
      'webgl fragment shader low int precision rangeMin:31',
      'webgl fragment shader low int precision rangeMax:30'
    ],
    '6bc5': randomChoice(RENDERERS),
    ed31: 0,
    '72bd': 0,
    '097b': 0,
    '52cd': [0, 0, 0],
    a658: randomFonts(),
    d02f: (124.043 + Math.random() * 0.001).toFixed(14)
  }
}

function buildActivateCookiesPayload(
  uuid: string,
  userAgent: string,
  fingerprint?: Record<string, unknown>
): GaiaPayloadWrapper {
  const timestamp = Date.now().toString()
  const innerMsg = fingerprint
    ? { ...fingerprint, b8ce: userAgent || fingerprint.b8ce || DEFAULT_UA }
    : getFingerPrint(userAgent)
  const [width] = (innerMsg['748e'] as [number, number]) || [1920, 1080]
  const availableHeight = ((innerMsg.d61f as [number, number]) || [1920, 1040])[1]
  const outerBody = {
    '3064': 1,
    '5062': timestamp,
    '03bf': encodeURIComponent(BILI_HOME_URL).slice(0, 1000),
    '39c8': '333.1007.fp.risk',
    '34f1': '',
    d402: '',
    '654a': '',
    '6e7c': `${width}x${availableHeight}`,
    '3c43': innerMsg,
    '54ef': JSON.stringify({
      b_ut: '5',
      home_version: 'V8',
      in_new_ab: true,
      ab_version: { for_ai_home_version: 'V8', rcmd_timeout_config: '550' },
      ab_split_num: { for_ai_home_version: 124, rcmd_timeout_config: 78 },
      uniq_page_id: `${Date.now()}${Math.floor(Math.random() * 1e6)}`,
      is_modern: true
    }),
    '8b94': '',
    df35: uuid,
    '07a4': 'zh-CN',
    '5f45': null,
    db46: 0
  }

  return { payload: JSON.stringify(outerBody) }
}

export class GaiaApi {
  private readonly main: BiliRequest

  constructor(private readonly ctx: Pick<BiliContext, 'cookieJar' | 'userAgent'>) {
    this.main = new BiliRequest(
      'https://api.bilibili.com',
      'https://www.bilibili.com',
      this.ctx.cookieJar,
      this.ctx.userAgent
    )
  }

  /**
   * 获取模拟浏览器设备指纹
   */
  getFingerPrint(userAgent?: string): Record<string, unknown> {
    return getFingerPrint(userAgent ?? this.ctx.userAgent)
  }

  /**
   * 上报 Gaia 设备信息并激活当前 Cookie。
   * 支持传入持久化的设备指纹以保持环境特征一致。
   */
  activateCookies(fingerprint?: Record<string, unknown>): Promise<unknown> {
    const uuid = getJarCookieField(this.ctx.cookieJar, '_uuid')
    if (!uuid) {
      throw new Error('Cookie 缺少 _uuid，无法上报 Gaia 设备信息')
    }

    return this.main.postJson<unknown>(
      GAIA_ACTIVATE_COOKIES_API,
      buildActivateCookiesPayload(uuid, this.ctx.userAgent, fingerprint),
      undefined,
      { Referer: BILI_HOME_URL }
    )
  }
}
