import { BiliRequest } from './request'
import { wbiSign } from './wbi'
import type { BiliContext, BiliResponse, LiveTraceData } from '../types'
import { nowMs } from '../utils'

export class LiveTraceApi {
  private liveTrace: BiliRequest

  constructor(private readonly ctx: BiliContext) {
    this.liveTrace = new BiliRequest(
      'https://live-trace.bilibili.com',
      'https://live.bilibili.com',
      this.ctx.cookieJar,
      this.ctx.userAgent
    )
  }

  private wbi(params: Record<string, unknown>): string {
    return wbiSign(params, this.ctx.wbiSalt)
  }

  /**
   * 初始化直播观看心跳链路，获取后续心跳上报所需参数。
   */
  e(id: number[], device: string[], ruid: number): Promise<BiliResponse<LiveTraceData>> {
    return this.liveTrace.postForm<BiliResponse<LiveTraceData>>(
      '/xlive/data-interface/v1/x25Kn/E',
      null,
      this.wbi({
        id: JSON.stringify(id),
        device: JSON.stringify(device),
        ruid,
        ts: nowMs(),
        is_patch: 0,
        heart_beat: JSON.stringify([]),
        ua: this.ctx.userAgent,
        web_location: '444.8',
        csrf: this.ctx.csrf
      })
    )
  }

  /**
   * 上报直播观看心跳，维持直播间观看状态。
   */
  x(
    s: string,
    id: number[],
    device: string[],
    ruid: number,
    ets: number,
    benchmark: string,
    time: number,
    heartbeatTs: number
  ): Promise<BiliResponse<LiveTraceData>> {
    return this.liveTrace.postForm<BiliResponse<LiveTraceData>>(
      '/xlive/data-interface/v1/x25Kn/X',
      null,
      this.wbi({
        s,
        id: JSON.stringify(id),
        device: JSON.stringify(device),
        ruid,
        ets,
        benchmark,
        time,
        ts: heartbeatTs,
        ua: this.ctx.userAgent,
        trackid: '-99998',
        web_location: '444.8',
        csrf: this.ctx.csrf
      })
    )
  }
}
