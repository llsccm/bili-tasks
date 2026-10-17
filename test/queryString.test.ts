import assert from 'node:assert/strict'
import test from 'node:test'
import { queryString } from '../src/utils'

test('queryString 保留 UA 括号并将空格编码为 +', () => {
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

  const query = queryString({ ua })

  assert.equal(
    query,
    'ua=Mozilla%2F5.0+(Windows+NT+10.0%3B+Win64%3B+x64)+AppleWebKit%2F537.36+(KHTML%2C+like+Gecko)+Chrome%2F128.0.0.0+Safari%2F537.36'
  )
})
