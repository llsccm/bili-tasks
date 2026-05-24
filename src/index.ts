import { initializeContext } from './context'
import { loadConfig } from './storage'
import { runAllTasks } from './tasks'

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

run().catch((error) => {
  console.error('[BiliTask] 执行失败', error)
  process.exitCode = 1
})
