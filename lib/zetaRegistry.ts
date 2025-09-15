export type ZetaToken = {
  symbol: string
  name: string
  address: string // ZRC-20 on Zeta EVM
  origin?: string // e.g., USDC.Base → origin Base
  decimals?: number
}

// Best-effort registry fetch. Falls back to empty on unknown schema.
export async function fetchZetaTokens(network: 'mainnet' | 'testnet'): Promise<ZetaToken[]> {
  const url = network === 'mainnet'
    ? 'https://zetachain.blockpi.network/lcd/v1/public/zeta-chain/observer/foreign_coins'
    : 'https://zetachain-athens.blockpi.network/lcd/v1/public/zeta-chain/observer/foreign_coins'
  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    const data = await res.json()
    const tokens: ZetaToken[] = Array.isArray(data?.foreignCoins)
      ? data.foreignCoins.map((fc: any) => ({
          symbol: String(fc?.symbol || '').toUpperCase(),
          name: fc?.name || String(fc?.symbol || ''),
          address: fc?.zrc20_contract_address || '',
          origin: String(fc?.foreign_chain_id || ''),
          decimals: typeof fc?.decimals === 'number' ? fc.decimals : undefined,
        }))
      : []
    // If no token data present (chains-only response), return native ZETA as fallback
    if (tokens.length === 0) {
      tokens.push({ symbol: 'ZETA', name: 'ZetaChain', address: '' })
    }

    // Deduplicate by address (allow native empty once)
    const seen = new Set<string>()
    const result: ZetaToken[] = []
    for (const t of tokens) {
      const key = t.address || '__NATIVE__'
      if (seen.has(key)) continue
      seen.add(key)
      result.push(t)
    }
    return result
  } catch {
    return []
  }
}


