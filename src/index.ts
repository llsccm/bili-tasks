import { initializeContext } from './context'
import { loadConfig } from './storage'
import { runAllTasks } from './tasks'
import { formatError } from './utils'
import { notify } from './utils/notify'

/*!
 * new Env('bilibili任务')
 */

async function run(): Promise<void> {
  const config = await loadConfig()
  const { ctx, api } = await initializeContext(config)
  await runAllTasks({
    config,
    ctx,
    api
  })
}

run().catch(async (error) => {
  console.error('[BiliTask] 执行失败', error)
  await notify('BiliTask 执行失败', formatError(error))
  process.exitCode = 1
})
