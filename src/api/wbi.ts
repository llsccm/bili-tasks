import { md5, queryString, nowSec } from '../utils'

/**
 * 为需要 WBI 鉴权的接口参数生成签名查询串。
 */
export function wbiSign(params: Record<string, unknown>, wbiSalt: string): string {
  const wts = nowSec()
  const signedParams = { ...params, wts }
  const sortedQuery = queryString(signedParams, true)
  const wRid = md5(sortedQuery + wbiSalt)
  return `${queryString(params)}&w_rid=${wRid}&wts=${wts}`
}
