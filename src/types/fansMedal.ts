export interface FansMedal {
  medal: {
    target_id: number
    level: number
    medal_name: string
    is_lighted: number
  }
  room_info: {
    room_id: number
    living_status: number
    url?: string
  }
  anchor_info: {
    nick_name: string
  }
}

export interface FansMedalPanelData {
  list?: FansMedal[]
  special_list?: FansMedal[]
  page_info?: {
    total_page?: number
    current_page?: number
    total?: number
    page_size?: number
  }
}

export interface ActivatedMedalTaskInfo {
  title: string
  sub_title: string
  add_text: string
  jump_type: 'feedLight' | 'watchLive' | 'sendGift' | 'sendDanmu' | 'like' | string
  is_done: boolean
}

export interface ActivatedMedalGiftInfo {
  gift_id: number
  price: number
}

export interface ActivatedMedalInfoData {
  face: string
  name: string
  medal_name: string
  fans_medal_count: number
  level: number
  is_lighted: boolean
  intimacy: number
  next_intimacy: number
  task_light_days: number
  task_info: ActivatedMedalTaskInfo[]
  fans_club_gift_info?: ActivatedMedalGiftInfo
  guard_level: number
  light_source: number
  free_intimacy: number
  reach_free_intimacy_limit: boolean
}
