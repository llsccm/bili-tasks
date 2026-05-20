import { BiliRequest } from './request'
import type { BiliContext, BiliResponse, NavData, RewardData } from '../types'

export class UserApi {
  private main: BiliRequest

  constructor(private readonly ctx: BiliContext) {
    this.main = new BiliRequest(
      'https://api.bilibili.com',
      'https://www.bilibili.com',
      this.ctx.cookieJar,
      this.ctx.userAgent
    )
  }

  /**
   * 获取当前登录账号的导航栏信息，包括用户基础信息、会员状态等。
   */
  nav(): Promise<BiliResponse<NavData>> {
    return this.main.get<BiliResponse<NavData>>('/x/web-interface/nav')
  }

  /**
   * 获取每日经验奖励完成情况。
   */
  reward(web_location = '333.33'): Promise<BiliResponse<RewardData>> {
    return this.main.get<BiliResponse<RewardData>>('/x/member/web/exp/reward', { web_location })
  }
}
