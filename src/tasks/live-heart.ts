import { hmacHex, sleep, nowMs, uuid } from '../utils'
import type { BiliApi } from '../api'
import type { AppConfig, BiliContext } from '../types'

interface SpyderData {
  benchmark: string
  device: string
  ets: number
  id: string
  time: number
  ts: number
  ua: string
}

const HASH_ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha224', 'sha512', 'sha384']

function spyder(str: string, rule: number[]): string {
  const data = JSON.parse(str) as SpyderData
  const [parent_id, area_id, seq_id, room_id] = JSON.parse(data.id) as number[]
  // deviceUuid
  const [buvid, uuid] = JSON.parse(data.device) as string[]

  const payload = {
    platform: 'web',
    parent_id,
    area_id,
    seq_id,
    room_id,
    buvid,
    uuid,
    ets: data.ets,
    time: data.time,
    ts: data.ts
  }

  let hashResult = JSON.stringify(payload)

  for (const r of rule) {
    const algorithm = HASH_ALGORITHMS[r] || 'md5'
    hashResult = hmacHex(algorithm, hashResult, data.benchmark)
  }

  return hashResult
}

export class RoomHeart {
  private seq = 0
  private readonly deviceUuid = uuid()
  private interval = 0
  private secretKey = ''
  private secretRule: number[] = []
  private timestamp = 0
  private watchedSeconds = 0

  constructor(
    private readonly api: BiliApi,
    private readonly ctx: BiliContext,
    private readonly config: AppConfig['DailyTasks']['LiveTasks']['medalTasks']['watch'],
    private readonly roomID: number,
    private readonly areaID: number,
    private readonly parentID: number,
    private readonly ruid: number
  ) {}

  private get id(): number[] {
    return [this.parentID, this.areaID, this.seq, this.roomID]
  }

  private get device(): string[] {
    return [this.ctx.liveBuvid || '', this.deviceUuid]
  }

  async start(): Promise<void> {
    if (!this.ctx.liveBuvid) {
      console.warn(`[RoomHeart] 缺少 LIVE_BUVID，跳过直播间 ${this.roomID}`)
      return
    }

    const res = await this.api.liveTrace.e(this.id, this.device, this.ruid)
    if (res.code !== 0) {
      console.error(`[RoomHeart] E 心跳失败 room=${this.roomID}`, res.message)
      return
    }

    this.seq += 1
    this.interval = res.data.heartbeat_interval
    this.secretKey = res.data.secret_key
    this.secretRule = res.data.secret_rule
    this.timestamp = res.data.timestamp

    await sleep(this.interval * 1000)
    await this.loopX()
  }

  private async loopX(): Promise<void> {
    while (this.watchedSeconds < this.config.time * 60) {
      const now = nowMs()

      const spyderData: SpyderData = {
        id: JSON.stringify(this.id),
        device: JSON.stringify(this.device),
        ets: this.timestamp,
        benchmark: this.secretKey,
        time: this.interval,
        ts: now,
        ua: this.ctx.userAgent
      }

      const s = spyder(JSON.stringify(spyderData), this.secretRule)

      const res = await this.api.liveTrace.x(
        s,
        this.id,
        this.device,
        this.ruid,
        this.timestamp,
        this.secretKey,
        this.interval,
        now
      )

      if (res.code !== 0) {
        console.error(`[RoomHeart] X 心跳失败 room=${this.roomID}`, res.message)
        return
      }

      this.seq += 1
      this.watchedSeconds += this.interval
      this.interval = res.data.heartbeat_interval
      this.secretKey = res.data.secret_key
      this.secretRule = res.data.secret_rule
      this.timestamp = res.data.timestamp

      await sleep(this.interval * 1000)
    }
  }
}
