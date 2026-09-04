import type { Address } from 'viem'

/** Discover candidates only. The caller must verify ownerOf and liquidity. */
export async function fetchV4TransferIds(
  explorer: string,
  manager: Address,
  user: Address,
  request: typeof fetch = fetch,
): Promise<bigint[]> {
  const ids = new Set<bigint>()
  const seen = new Set<string>()
  let cursor: Record<string, string | number> = {}
  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({
      ...Object.fromEntries(Object.entries(cursor).map(([k, v]) => [k, String(v)])),
      type: 'ERC-721', token: manager, filter: 'to',
    })
    const res = await request(`${explorer}/api/v2/addresses/${user}/token-transfers?${query}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`v4 discovery: Blockscout ${res.status}`)
    const body = await res.json() as {
      items?: { token?: { address_hash?: string; address?: string }; total?: { token_id?: string } }[]
      next_page_params?: Record<string, string | number> | null
    }
    if (!Array.isArray(body.items)) throw new Error('v4 discovery: malformed response')
    for (const item of body.items) {
      if ((item.token?.address_hash ?? item.token?.address)?.toLowerCase() !== manager.toLowerCase()) continue
      const id = item.total?.token_id
      if (typeof id !== 'string' || !/^\d+$/.test(id)) throw new Error('v4 discovery: missing NFT id')
      ids.add(BigInt(id))
    }
    if (!body.next_page_params) return [...ids]
    const key = JSON.stringify(body.next_page_params)
    if (!body.items.length || seen.has(key)) throw new Error('v4 discovery: stalled pagination')
    seen.add(key)
    cursor = body.next_page_params
  }
  // Never represent a truncated scan as a complete portfolio.
  throw new Error('v4 discovery: transfer history exceeds scan limit')
}
