import type { CookieJar } from 'tough-cookie'
import type { BiliApi } from '../api'
import type { FansMedal } from './fansMedal'
import type { NavData } from './nav'

export type { ActivatedMedalInfoData, FansMedal, FansMedalPanelData } from './fansMedal'
export type { NavData } from './nav'

export interface BiliResponse<T = any> {
  code: number
  message?: string
  msg?: string
  ttl?: number
  data: T
}

export interface MainTaskConfig {
  enabled: boolean
}

export interface CoinTaskConfig extends MainTaskConfig {
  num: number
  dryRun: boolean
}

export interface MedalLightConfig extends MainTaskConfig {
  maxRooms: number
  danmuPerRoom: number
}

export interface MedalLikeConfig extends MainTaskConfig {
  maxRooms: number
}

export interface MedalWatchConfig extends MainTaskConfig {
  time: number
  maxRooms: number
}

export interface ExchangeTaskConfig extends MainTaskConfig {
  dryRun: boolean
}

export interface CoinToSilverTaskConfig extends MainTaskConfig {
  num: number
  dryRun: boolean
}

export interface VipPrivilegeConfig {
  enabled: boolean
  dryRun: boolean
}

export interface AppConfig {
  cookie: string
  userAgent: string
  DailyTasks: {
    MainSiteTasks: {
      login: MainTaskConfig
      watch: MainTaskConfig
      share: MainTaskConfig
      coin: CoinTaskConfig
    }
    LiveTasks: {
      medalTasks: {
        light: MedalLightConfig
        like: MedalLikeConfig
        watch: MedalWatchConfig
        isWhiteList: boolean
        roomidList: number[]
        danmuList: string[]
      }
    }
    OtherTasks: {
      silverToCoin: ExchangeTaskConfig
      coinToSilver: CoinToSilverTaskConfig
      getYearVipPrivilege: VipPrivilegeConfig
    }
  }
}

export interface RewardData {
  login: boolean
  watch: boolean
  coins: number
  share: boolean
  email: boolean
  tel: boolean
  safe_question: boolean
  identify_card: boolean
}

export interface DynamicArchive {
  aid?: number | string
  bvid?: string
  title?: string
}

export interface DynamicItem {
  modules?: {
    module_author?: {
      mid?: number
    }
    module_dynamic?: {
      major?: {
        archive?: DynamicArchive
      }
    }
  }
}

export interface DynamicAllData {
  items?: DynamicItem[]
  offset?: string
  has_more?: boolean
  update_baseline?: string
  update_num?: number
}

export interface DynamicVideo {
  aid: string
  bvid: string
  title?: string
  authorMid?: number
}

export interface BiliContext {
  cookieJar: CookieJar
  csrf: string
  liveBuvid?: string
  buvid3?: string
  userAgent: string
  userInfo?: NavData
  wbiSalt: string
  dailyRewardInfo?: RewardData
  dynamicVideos: DynamicVideo[]
  fansMedals: FansMedal[]
}

export interface VideoHeartbeatData {
  aid?: number
  cid?: number
  all?: number
}

export interface ShareData {
  aid?: number | string
}

export interface VideoRelationData {
  coin: number
  favorite?: boolean
  like?: boolean
  dislike?: boolean
}

export interface CoinAddData {
  like?: boolean
}

export interface SendMsgData {
  mode_info?: Record<string, unknown>
}

export interface LikeReportData {
  toast?: string
}

export interface LiveRoomInfoData {
  room_info: {
    room_id: number
    area_id: number
    parent_area_id: number
    live_status?: number
    title?: string
  }
}

export interface ExchangeData {
  gold?: number
  silver?: number
  tid?: string
}

export interface LiveTraceData {
  heartbeat_interval: number
  secret_key: string
  secret_rule: number[]
  timestamp: number
}

export interface VipPrivilegeItem {
  type: number
  state: number
  name?: string
  period_end_unix: number
}

export interface VipPrivilegeData {
  list?: VipPrivilegeItem[]
}

export interface VipReceivePrivilegeData {
  type?: number
}

export interface VipExperienceData {
  experience?: number
}

export type TaskEnv = {
  config: AppConfig
  ctx: BiliContext
  api: BiliApi
}

export interface FingerSpiData {
  b_3: string
  b_4: string
}

export interface BiliTicketData {
  ticket: string
  created_at: number
  ttl: number
}

export interface GenerateQrCodeData {
  url: string
  qrcode_key: string
}

export interface PollQrCodeData {
  url?: string
  refresh_token?: string
  timestamp?: number
  code: number
  message?: string
}
