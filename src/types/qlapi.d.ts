// NotificationMode 联合类型
type NotificationMode =
  | 'gotify'
  | 'goCqHttpBot'
  | 'serverChan'
  | 'pushDeer'
  | 'bark'
  | 'chat'
  | 'telegramBot'
  | 'dingtalkBot'
  | 'weWorkBot'
  | 'weWorkApp'
  | 'aibotk'
  | 'iGot'
  | 'pushPlus'
  | 'wePlusBot'
  | 'email'
  | 'pushMe'
  | 'feishu'
  | 'webhook'
  | 'chronocat'
  | 'ntfy'
  | 'wxPusherBot'

// 基础数据结构
interface EnvItem {
  id?: number
  name?: string
  value?: string
  remarks?: string
  status?: number
  position?: number
}

interface NotificationInfo {
  type: NotificationMode
  gotifyUrl?: string
  gotifyToken?: string
  gotifyPriority?: number
  goCqHttpBotUrl?: string
  goCqHttpBotToken?: string
  [key: string]: any
}

// 通用响应结构
interface BaseResponse {
  code: number
  message: string
}

interface EnvResponse extends BaseResponse {
  data: EnvItem
}

interface EnvsResponse extends BaseResponse {
  data: EnvItem[]
}

// QLAPI 接口定义
interface IQLAPI {
  getEnvs(params: { searchValue: string }): Promise<EnvsResponse>
  createEnv(params: { envs: EnvItem[] }): Promise<EnvsResponse>
  updateEnv(params: { env: EnvItem }): Promise<EnvResponse>
  deleteEnvs(params: { ids: number[] }): Promise<BaseResponse>
  moveEnv(params: { id: number; fromIndex: number; toIndex: number }): Promise<EnvResponse>
  disableEnvs(params: { ids: number[] }): Promise<BaseResponse>
  enableEnvs(params: { ids: number[] }): Promise<BaseResponse>
  updateEnvNames(params: { ids: number[]; name: string }): Promise<BaseResponse>
  getEnvById(params: { id: number }): Promise<EnvResponse>
  systemNotify(params: {
    title: string
    content: string
    notificationInfo?: NotificationInfo
  }): Promise<BaseResponse>
}

// 注入全局变量
declare global {
  const QLAPI: IQLAPI
}

export type QinglongApi = IQLAPI
export type QinglongEnvItem = EnvItem
