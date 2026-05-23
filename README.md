# bili-tasks

Bilibili 每日任务脚本，使用 TypeScript 编写并通过 esbuild 打包。

## 青龙使用

1. **拉取脚本**：在青龙面板中添加订阅，拉取 `releases` 分支
2. **填写 UA 和 buvid_fp**: 获取浏览器 UA 和 对应的 buvid_fp, 填写在青龙环境变量 `BILI_UA` 和 `BILI_BUVID_FP` 中
3. **登录并设置 Cookie**
   - **扫码登录**：~~在青龙面板中运行 `login.mjs`，扫描控制台输出的二维码。登录成功后，脚本会自动将 Cookie 添加到青龙环境变量 `BILI_TASK_COOKIES` 中~~ 目前分享视频还会风控 (除非使用 TV 接口)
   - **本地扫码**: 拉取分支到本地中，填写环境变量到 `.env` 中, 执行 `npm run login` 扫码后复制 Cookie 填到面板中
   - **手动设置**：如果不方便扫码，也可以从浏览器获取 Bilibili 的完整 Cookie，并在青龙环境变量中添加 `BILI_TASK_COOKIES`，值为你的 Cookie

## 自定义配置

扫码登录后，会在青龙目录下创建 `bilitask.config.json` 文件。或者自行在青龙脚本管理目录下创建。

### 配置示例

```json
{
  "DailyTasks": {
    "MainSiteTasks": {
      "login": {
        "enabled": true
      },
      "watch": {
        "enabled": true
      },
      "share": {
        "enabled": true
      },
      "coin": {
        "enabled": false,
        "num": 1,
        "dryRun": true
      }
    },
    "LiveTasks": {
      "medalTasks": {
        "light": {
          "enabled": false,
          "maxRooms": 3,
          "danmuPerRoom": 10
        },
        "like": {
          "enabled": true,
          "maxRooms": 5
        },
        "watch": {
          "enabled": true,
          "time": 16,
          "maxRooms": 5
        },
        "isWhiteList": true,
        "roomidList": [],
        "danmuList": [
          "[dog]",
          "[花]",
          "[妙]",
          "[哇]",
          "[爱]",
          "[比心]",
          "[笑哭]",
          "[捂脸]",
          "[喝彩]",
          "[大笑]",
          "[惊喜]",
          "[OK]",
          "[墨镜]",
          "[牛]"
        ]
      }
    },
    "OtherTasks": {
      "silverToCoin": {
        "enabled": false,
        "dryRun": true
      },
      "coinToSilver": {
        "enabled": false,
        "num": 1,
        "dryRun": true
      },
      "getYearVipPrivilege": {
        "enabled": false,
        "dryRun": true
      }
    }
  }
}
```

### 主要配置项说明

| 配置项                           | 说明                                                            | 默认值 |
| :------------------------------- | :-------------------------------------------------------------- | :----- |
| `MainSiteTasks.coin`             | 每日投币任务。`num` 为投币数量，`dryRun` 为 `true` 时不真实扣币 | 关闭   |
| `LiveTasks.medalTasks.light`     | 粉丝勋章点亮（发弹幕）                                          | 关闭   |
| `OtherTasks.silverToCoin`        | 银瓜子兑换硬币                                                  | 关闭   |
| `OtherTasks.getYearVipPrivilege` | 大会员权益领取                                                  | 关闭   |

> **注意**：涉及资产变动的任务（如投币、兑换）默认带有 `dryRun: true`，需手动改为 `false` 才会真实执行

## 默认安全策略

- 默认仅启用低风险的主站登录、观看、分享任务
- 投币等任务暂时没有启用
- 发送弹幕，点赞和直播观看带有 `maxRooms` 限制，避免一次处理过多直播间

## 参考项目

- [bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)
- [BLTH](https://github.com/andywang425/BLTH)
- [BiliBiliToolPro](https://github.com/RayWangQvQ/BiliBiliToolPro)
