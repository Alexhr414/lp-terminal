import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchV4TransferIds } from './v4TransferIds'
const manager = '0x58daec3116aae6D93017bAAea7749052E8a04fA7'
const user = '0x2699c6BFc0662CbfB7937729aB9C5c0F2b8fC447'
const item = (id: string, address = manager) => ({ token: { address_hash: address }, total: { token_id: id } })

test('discovers minted and transferred NFTs across pages; filters contracts and deduplicates', async () => {
  let calls = 0
  const request = (async (url: string) => {
    const u = new URL(url)
    assert.equal(u.searchParams.get('token'), manager)
    assert.equal(u.searchParams.get('filter'), 'to')
    if (calls++ === 0) return Response.json({ items: [item('1812863'), item('5', user)], next_page_params: { index: 7 } })
    assert.equal(u.searchParams.get('index'), '7')
    return Response.json({ items: [item('1812863'), item('1809751')], next_page_params: null })
  }) as typeof fetch
  assert.deepEqual(await fetchV4TransferIds('https://example.org', manager, user, request), [1812863n, 1809751n])
})

test('an unavailable or malformed index is not an empty portfolio', async () => {
  for (const response of [new Response('', { status: 503 }), Response.json({}), Response.json({ items: [item('bad')] })]) {
    await assert.rejects(fetchV4TransferIds('https://example.org', manager, user, (async () => response) as typeof fetch))
  }
})

test('repeated pagination fails instead of silently truncating', async () => {
  await assert.rejects(fetchV4TransferIds('https://example.org', manager, user,
    (async () => Response.json({ items: [item('1812863')], next_page_params: { index: 7 } })) as typeof fetch), /stalled/)
})
