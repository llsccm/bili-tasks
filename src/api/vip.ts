import { BiliRequest } from './request'
import type {
  BiliContext,
  BiliResponse,
  VipExperienceData,
  VipPrivilegeData,
  VipReceivePrivilegeData
} from '../types'

export class VipApi {
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
   * 获取当前大会员可领取的权益信息。
   */
  myPrivilege(): Promise<BiliResponse<VipPrivilegeData>> {
    return this.main.get<BiliResponse<VipPrivilegeData>>(
      '/x/vip/privilege/my',
      { web_location: '333.33' },
      { Referer: 'https://account.bilibili.com/', Origin: 'https://account.bilibili.com' }
    )
  }

  /**
   * 领取指定类型的大会员权益。
   */
  receivePrivilege(type: number): Promise<BiliResponse<VipReceivePrivilegeData>> {
    return this.main.postForm<BiliResponse<VipReceivePrivilegeData>>(
      '/x/vip/privilege/receive',
      {
        type,
        platform: 'web',
        csrf: this.ctx.csrf
      },
      undefined,
      {
        Referer: 'https://account.bilibili.com/',
        Origin: 'https://account.bilibili.com'
      }
    )
  }

  /**
   * 增加大会员成长经验。
   */
  addExperience(): Promise<BiliResponse<VipExperienceData>> {
    return this.main.postForm<BiliResponse<VipExperienceData>>(
      '/x/vip/experience/add',
      {
        mid: this.ctx.userInfo?.mid || 0,
        buvid: this.ctx.buvid3 || '',
        csrf: this.ctx.csrf
      },
      undefined,
      { Referer: 'https://account.bilibili.com/', Origin: 'https://account.bilibili.com' }
    )
  }
}
