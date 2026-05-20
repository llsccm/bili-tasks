import { BiliRequest } from './request'
import type { BiliContext, BiliResponse, ExchangeData } from '../types'

export class ExchangeApi {
  private live: BiliRequest

  constructor(private readonly ctx: BiliContext) {
    this.live = new BiliRequest(
      'https://api.live.bilibili.com',
      'https://live.bilibili.com',
      this.ctx.cookieJar,
      this.ctx.userAgent
    )
  }

  /**
   * 将直播银瓜子兑换为硬币。
   */
  silver2coin(): Promise<BiliResponse<ExchangeData>> {
    return this.live.postForm<BiliResponse<ExchangeData>>('/xlive/revenue/v1/wallet/silver2coin', {
      csrf_token: this.ctx.csrf,
      csrf: this.ctx.csrf,
      visit_id: ''
    })
  }

  /**
   * 将指定数量的硬币兑换为直播银瓜子。
   */
  coin2silver(num: number): Promise<BiliResponse<ExchangeData>> {
    return this.live.postForm<BiliResponse<ExchangeData>>('/xlive/revenue/v1/wallet/coin2silver', {
      num,
      platform: 'pc',
      csrf_token: this.ctx.csrf,
      csrf: this.ctx.csrf,
      visit_id: ''
    })
  }
}
