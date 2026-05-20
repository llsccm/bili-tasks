import { BiliRequest } from './request'
import { wbiSign } from './wbi'
import type {
  ActivatedMedalInfoData,
  BiliContext,
  BiliResponse,
  FansMedalPanelData,
  LikeReportData,
  LiveRoomInfoData,
  SendMsgData
} from '../types'
import { nowSec } from '../utils'

export class LiveApi {
  private live: BiliRequest

  constructor(private readonly ctx: BiliContext) {
    this.live = new BiliRequest(
      'https://api.live.bilibili.com',
      'https://live.bilibili.com',
      this.ctx.cookieJar,
      this.ctx.userAgent
    )
  }

  private wbi(params: Record<string, unknown>): string {
    return wbiSign(params, this.ctx.wbiSalt)
  }

  /**
   * 分页获取当前账号的直播粉丝勋章面板列表。
   */
  fansMedalPanel(page: number, page_size = 10): Promise<BiliResponse<FansMedalPanelData>> {
    return this.live.get<BiliResponse<FansMedalPanelData>>(
      '/xlive/app-ucenter/v1/fansMedal/panel',
      { page, page_size }
    )
  }

  /**
   * 获取指定主播对应的粉丝勋章信息。
   */
  activatedMedalInfo(
    target_id: number,
    web_location = '444.260'
  ): Promise<BiliResponse<ActivatedMedalInfoData>> {
    return this.live.get<BiliResponse<ActivatedMedalInfoData>>(
      '/xlive/app-ucenter/v1/fansMedal/GetActivatedMedalInfo',
      {
        csrf: this.ctx.csrf,
        target_id,
        web_location
      }
    )
  }

  /**
   * 向指定直播间发送弹幕消息。
   */
  sendMsg(msg: string, roomid: number): Promise<BiliResponse<SendMsgData>> {
    return this.live.postMultipart<BiliResponse<SendMsgData>>(
      '/msg/send',
      {
        bubble: 0,
        msg,
        color: 16777215,
        mode: 1,
        room_type: 0,
        jumpfrom: 0,
        reply_mid: 0,
        reply_attr: 0,
        replay_dmid: '',
        statistics: '{"appId":100,"platform":5}',
        reply_type: 0,
        reply_uname: '',
        data_extend: '{"trackid":"-99998"}',
        fontsize: 25,
        rnd: nowSec(),
        roomid,
        csrf: this.ctx.csrf,
        csrf_token: this.ctx.csrf
      },
      this.wbi({ web_location: '444.8' })
    )
  }

  /**
   * 上报直播间点赞行为。
   */
  likeReport(
    room_id: number,
    anchor_id: number,
    click_time = 1
  ): Promise<BiliResponse<LikeReportData>> {
    return this.live.postForm<BiliResponse<LikeReportData>>(
      '/xlive/app-ucenter/v1/like_info_v3/like/likeReportV3',
      null,
      this.wbi({
        click_time,
        room_id,
        uid: this.ctx.userInfo?.mid || 0,
        anchor_id,
        web_location: '444.8',
        csrf: this.ctx.csrf
      })
    )
  }

  /**
   * 根据直播间 ID 获取直播间信息。
   */
  getInfoByRoom(room_id: number): Promise<BiliResponse<LiveRoomInfoData>> {
    return this.live.get<BiliResponse<LiveRoomInfoData>>(
      '/xlive/web-room/v1/index/getInfoByRoom',
      this.wbi({ room_id, web_location: '444.8' })
    )
  }
}
