export interface VideoViewPage {
  cid: number
  page: number
  from: string
  part: string
  duration: number
  vid: string
  weblink: string
  dimension?: {
    width: number
    height: number
    rotate: number
  }
}

export interface VideoViewOwner {
  mid: number
  name: string
  face: string
}

export interface VideoViewStat {
  aid: number
  view: number
  danmaku: number
  reply: number
  favorite: number
  coin: number
  share: number
  now_rank: number
  his_rank: number
  like: number
  dislike: number
  evaluation: string
  vt: number
}

export interface VideoViewData {
  bvid: string
  aid: number
  videos: number
  tid: number
  tname: string
  copyright: number
  pic: string
  title: string
  pubdate: number
  ctime: number
  desc: string
  state: number
  duration: number
  mission_id?: number
  redirect_url?: string
  owner: VideoViewOwner
  stat: VideoViewStat
  dynamic?: string
  cid: number
  dimension?: {
    width: number
    height: number
    rotate: number
  }
  pages?: VideoViewPage[]
  no_cache?: boolean
  is_story?: boolean
  is_upower_exclusive?: boolean
}
