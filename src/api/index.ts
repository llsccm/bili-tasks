import type { BiliContext } from '../types'
import { GaiaApi } from './gaia'
import { UserApi } from './user'
import { VideoApi } from './video'
import { LiveApi } from './live'
import { LiveTraceApi } from './live-trace'
import { ExchangeApi } from './exchange'
import { VipApi } from './vip'

export class BiliApi {
  readonly gaia: GaiaApi
  readonly user: UserApi
  readonly video: VideoApi
  readonly live: LiveApi
  readonly liveTrace: LiveTraceApi
  readonly exchange: ExchangeApi
  readonly vip: VipApi

  constructor(ctx: BiliContext) {
    this.gaia = new GaiaApi(ctx)
    this.user = new UserApi(ctx)
    this.video = new VideoApi(ctx)
    this.live = new LiveApi(ctx)
    this.liveTrace = new LiveTraceApi(ctx)
    this.exchange = new ExchangeApi(ctx)
    this.vip = new VipApi(ctx)
  }

  activateCookies(fingerprint?: Record<string, unknown>): Promise<unknown> {
    return this.gaia.activateCookies(fingerprint)
  }

  getFingerPrint(userAgent?: string): Record<string, unknown> {
    return this.gaia.getFingerPrint(userAgent)
  }
}

export { GaiaApi, getFingerPrint } from './gaia'
export { PassportApi } from './passport'
