import { BiliRequest } from './request'
import { wbiSign } from './wbi'
import type {
  BiliContext,
  BiliResponse,
  CoinAddData,
  DynamicAllData,
  ShareData,
  VideoHeartbeatData,
  VideoRelationData,
  VideoViewData
} from '../types'
import { random32Hash, randomBetween, nowSec, getSecChUaFromUa } from '../utils'

export class VideoApi {
  private main: BiliRequest

  constructor(private readonly ctx: BiliContext) {
    this.main = new BiliRequest(
      'https://api.bilibili.com',
      'https://www.bilibili.com',
      this.ctx.cookieJar,
      this.ctx.userAgent
    )
  }

  private wbi(params: Record<string, unknown>): string {
    return wbiSign(params, this.ctx.wbiSalt)
  }

  /**
   * 获取动态页视频流列表。
   */
  dynamicAll(page = 1): Promise<BiliResponse<DynamicAllData>> {
    return this.main.get<BiliResponse<DynamicAllData>>(
      '/x/polymer/web-dynamic/v1/feed/all',
      {
        timezone_offset: -480,
        type: 'video',
        platform: 'web',
        page,
        features:
          'itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote,decorationCard,onlyfansAssetsV2,forwardListHidden,ugcDelete,onlyfansQaCard,commentsNewVersion,avatarAutoTheme,sunflowerStyle,cardsEnhance,eva3CardOpus,eva3CardVideo,eva3CardComment,eva3CardVote,eva3CardUser',
        web_location: '333.1365',
        x_bili_device_req_json: '{"platform":"web","device":"pc","spmid":"333.1365"}'
      },
      { Origin: 'https://t.bilibili.com', Referer: 'https://t.bilibili.com/?tab=video' }
    )
  }

  /**
   * 模拟打开视频 / 初始心跳上报。
   * played_time、real_played_time、realtime 均为 0，play_type 为 3，表示刚打开视频。
   */
  videoHeartbeatOpen(
    aid: number,
    bvid: string,
    cid = randomBetween(30000000000, 40000000000),
    startTs = nowSec()
  ): Promise<BiliResponse<VideoHeartbeatData>> {
    const mid = this.ctx.userInfo?.mid || 0
    const played_time = 0
    const real_played_time = 0
    const realtime = 0
    const video_duration = 180
    const last_play_progress_time = 0
    const dt = 2
    const web_location = 1315873
    return this.main.postForm<BiliResponse<VideoHeartbeatData>>(
      '/x/click-interface/web/heartbeat',
      {
        start_ts: startTs,
        mid,
        aid,
        bvid,
        cid,
        type: 3,
        sub_type: 0,
        dt,
        play_type: 3,
        realtime,
        played_time,
        real_played_time,
        refer_url: 'https://t.bilibili.com/?tab=video',
        quality: 64,
        is_auto_qn: 0,
        video_duration,
        last_play_progress_time,
        max_play_progress_time: 0,
        outer: 0,
        statistics: '{"appId":100,"platform":5,"abtest":"","version":""}',
        mobi_app: 'web',
        device: 'web',
        platform: 'web',
        cur_language_vt: '{}',
        perfer_type: '{}',
        play_mode: 1,
        spmid: '333.788.0.0',
        from_spmid: '333.1365.list.card_archive.click',
        session: random32Hash(),
        track_id: '',
        extra: `{"player_version":"4.9.76","video_dye_id":"${random32Hash()}","video_file_name":"${randomBetween(30000000000, 40000000000)}-1-${randomBetween(30000, 40000)}.m4s","play_method":1,"play_volume":1,"auto_play":0}`,
        csrf: this.ctx.csrf
      },
      this.wbi({
        w_start_ts: startTs,
        w_mid: mid,
        w_aid: aid,
        w_dt: dt,
        w_realtime: realtime,
        w_played_time: played_time,
        w_real_played_time: real_played_time,
        w_video_duration: video_duration,
        w_last_play_progress_time: last_play_progress_time,
        web_location
      })
    )
  }

  /**
   * 观看视频心跳结束上报。
   * 随机生成 1~min(duration, 14) 秒的播放时间，模拟真实观看行为。
   */
  videoHeartbeatFinish(
    aid: number,
    bvid: string,
    cid = randomBetween(30000000000, 40000000000),
    duration?: number,
    startTs = nowSec()
  ): Promise<BiliResponse<VideoHeartbeatData>> {
    const mid = this.ctx.userInfo?.mid || 0
    // 若无 duration，默认 15 秒
    const effectiveDuration = duration && duration > 0 ? duration : 15
    // 最大上限不超过 15
    const max = effectiveDuration < 15 ? effectiveDuration : 15
    // 随机 1 ~ max-1（即 1~14 或更少）
    const playedTime = randomBetween(1, Math.max(1, max - 1))
    const video_duration = effectiveDuration
    const dt = 2
    const web_location = 1315873
    return this.main.postForm<BiliResponse<VideoHeartbeatData>>(
      '/x/click-interface/web/heartbeat',
      {
        start_ts: startTs,
        mid,
        aid,
        bvid,
        cid,
        type: 3,
        sub_type: 0,
        dt,
        play_type: 3,
        realtime: playedTime,
        played_time: playedTime,
        real_played_time: playedTime,
        refer_url: 'https://t.bilibili.com/?tab=video',
        quality: 64,
        is_auto_qn: 0,
        video_duration,
        last_play_progress_time: playedTime,
        max_play_progress_time: playedTime,
        outer: 0,
        statistics: '{"appId":100,"platform":5,"abtest":"","version":""}',
        mobi_app: 'web',
        device: 'web',
        platform: 'web',
        cur_language_vt: '{}',
        perfer_type: '{}',
        play_mode: 1,
        spmid: '333.788.0.0',
        from_spmid: '333.1365.list.card_archive.click',
        session: random32Hash(),
        track_id: '',
        extra: `{"player_version":"4.9.76","video_dye_id":"${random32Hash()}","video_file_name":"${randomBetween(30000000000, 40000000000)}-1-${randomBetween(30000, 40000)}.m4s","play_method":1,"play_volume":1,"auto_play":0}`,
        csrf: this.ctx.csrf
      },
      this.wbi({
        w_start_ts: startTs,
        w_mid: mid,
        w_aid: aid,
        w_dt: dt,
        w_realtime: playedTime,
        w_played_time: playedTime,
        w_real_played_time: playedTime,
        w_video_duration: video_duration,
        w_last_play_progress_time: playedTime,
        web_location
      })
    )
  }

  /**
   * 上报视频分享行为。
   *
   * eab_x: player.isPaused() ? 2 : 1
   * ramval: player.getMediaInfo()?.absolutePlayTime
   */
  share(aid: string, bvid = ''): Promise<BiliResponse<ShareData>> {
    const referer = bvid ? `https://www.bilibili.com/video/${bvid}/` : 'https://www.bilibili.com'
    const SecCHUA = getSecChUaFromUa(this.ctx.userAgent)

    return this.main.postForm<BiliResponse<ShareData>>(
      '/x/web-interface/share/add',
      {
        aid,
        eab_x: randomBetween(1, 2),
        ramval: randomBetween(3, 19),
        source: 'web_normal',
        ga: 1,
        csrf: this.ctx.csrf
      },
      undefined,
      {
        Referer: referer,
        Origin: 'https://www.bilibili.com',
        Priority: 'u=1, i',
        'Sec-CH-UA': SecCHUA,
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
      }
    )
  }

  /**
   * 查询当前账号与指定视频的互动关系，例如是否点赞、投币、收藏。
   */
  videoRelation(aid: string, bvid = ''): Promise<BiliResponse<VideoRelationData>> {
    return this.main.get<BiliResponse<VideoRelationData>>('/x/web-interface/archive/relation', {
      aid,
      bvid
    })
  }

  /**
   * 给指定视频投币。
   */
  coinAdd(aid: string, num: number): Promise<BiliResponse<CoinAddData>> {
    return this.main.postForm<BiliResponse<CoinAddData>>('/x/web-interface/coin/add', {
      aid,
      multiply: num,
      select_like: 0,
      cross_domain: true,
      from_spmid: '333.1365.list.card_archive.click',
      spmid: '333.788.0.0',
      statistics: '{"appId":100,"platform":5}',
      eab_x: 1,
      ramval: 6,
      source: 'web_normal',
      ga: 1,
      csrf: this.ctx.csrf
    })
  }

  /**
   * 获取视频详细信息（web端）。
   * 通过 aid 或 bvid 获取视频的 cid、分P列表、时长等详细信息。
   */
  videoView(params: {
    aid?: number | string
    bvid?: string
  }): Promise<BiliResponse<VideoViewData>> {
    return this.main.get<BiliResponse<VideoViewData>>('/x/web-interface/view', params)
  }
}
