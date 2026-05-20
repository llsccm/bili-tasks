import type { BiliContext } from '../types'
import { UserApi } from './user'
import { VideoApi } from './video'
import { LiveApi } from './live'
import { LiveTraceApi } from './live-trace'
import { ExchangeApi } from './exchange'
import { VipApi } from './vip'

export class BiliApi {
  readonly user: UserApi
  readonly video: VideoApi
  readonly live: LiveApi
  readonly liveTrace: LiveTraceApi
  readonly exchange: ExchangeApi
  readonly vip: VipApi

  constructor(ctx: BiliContext) {
    this.user = new UserApi(ctx)
    this.video = new VideoApi(ctx)
    this.live = new LiveApi(ctx)
    this.liveTrace = new LiveTraceApi(ctx)
    this.exchange = new ExchangeApi(ctx)
    this.vip = new VipApi(ctx)
  }
}

export { PassportApi } from './passport'
