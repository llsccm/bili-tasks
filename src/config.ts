import type { AppConfig } from './types'

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export const defaultConfig: AppConfig = {
  cookie: '',
  userAgent: DEFAULT_UA,
  DailyTasks: {
    MainSiteTasks: {
      login: { enabled: true },
      watch: { enabled: true },
      share: { enabled: true },
      coin: {
        enabled: false,
        num: 1,
        dryRun: true
      }
    },
    LiveTasks: {
      medalTasks: {
        light: {
          enabled: false,
          maxRooms: 3,
          danmuPerRoom: 10
        },
        like: {
          enabled: false,
          maxRooms: 5
        },
        watch: {
          enabled: false,
          time: 16,
          maxRooms: 5
        },
        isWhiteList: true,
        danmuList: [
          '(⌒▽⌒)',
          '（￣▽￣）',
          '(=・ω・=)',
          '(｀・ω・´)',
          '(〜￣△￣)〜',
          '(･∀･)',
          '(°∀°)ﾉ'
        ],
        roomidList: []
      }
    },
    OtherTasks: {
      silverToCoin: { enabled: false, dryRun: true },
      coinToSilver: {
        enabled: false,
        num: 1,
        dryRun: true
      },
      getYearVipPrivilege: { enabled: false, dryRun: true }
    }
  }
}
