const DEFAULT_BAIHU_OPENAPI_BASE_URL = 'http://localhost:8052/open2api/v1'

export interface BaihuResponse<T> {
  code: number
  data: T
  msg?: string
}

export interface BaihuEnvItem {
  id: string
  name: string
  value: string
  remark?: string
  type?: string
  enabled?: boolean
  hidden?: boolean
  created_at?: string
  updated_at?: string
}

export interface BaihuEnvPayload {
  name: string
  value: string
  remark?: string
  type?: string
  enabled?: boolean
  hidden?: boolean
}

export class BaihuOpenApiClient {
  private readonly baseUrl: string
  private readonly token: string

  constructor(options?: { baseUrl?: string; token?: string }) {
    const token = options?.token || process.env.BH_SECRET_TOKEN
    if (!token) {
      throw new Error('缺少白虎开放接口 Token: 请设置环境变量 BH_SECRET_TOKEN')
    }

    this.token = token
    this.baseUrl = (
      options?.baseUrl ||
      process.env.BH_OPENAPI_BASE_URL ||
      DEFAULT_BAIHU_OPENAPI_BASE_URL
    ).replace(/\/+$/, '')
  }

  getAllEnvs(): Promise<BaihuEnvItem[]> {
    return this.request<BaihuEnvItem[]>('/env/all', { method: 'GET' })
  }

  updateEnv(id: string, payload: Partial<BaihuEnvPayload>): Promise<BaihuEnvItem> {
    return this.request<BaihuEnvItem>(`/env/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
  }

  createEnv(payload: BaihuEnvPayload): Promise<BaihuEnvItem> {
    return this.request<BaihuEnvItem>('/env', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: this.token,
        'Content-Type': 'application/json',
        ...(init.headers || {})
      }
    })

    const text = await response.text()
    let body: BaihuResponse<T> | undefined

    try {
      body = text ? (JSON.parse(text) as BaihuResponse<T>) : undefined
    } catch {
      throw new Error(
        `白虎接口响应不是合法 JSON: HTTP ${response.status} ${response.statusText} ${path}`
      )
    }

    if (!response.ok || body?.code !== 1) {
      throw new Error(
        `白虎接口调用失败: HTTP ${response.status} ${response.statusText} ${path} ${body?.msg || body?.code || ''}`.trim()
      )
    }

    return body.data
  }
}
