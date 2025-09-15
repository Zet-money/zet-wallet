export type ZetaToken = {
  symbol: string
  name: string
  address: string // ZRC-20 on Zeta EVM
  origin?: string // e.g., USDC.Base → origin Base
}

// Best-effort registry fetch. Falls back to empty on unknown schema.
export async function fetchZetaTokens(network: 'mainnet' | 'testnet'): Promise<ZetaToken[]> {
  const url = network === 'mainnet'
    ? 'https://zetachain.blockpi.network/lcd/v1/public/zeta-chain/observer/supportedChains'
    : 'https://zetachain-athens.blockpi.network/lcd/v1/public/zeta-chain/observer/supportedChains'
  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    const data = await res.json()
    // Try common shapes
    // If API includes assets/tokens arrays with zrc20Address fields, map them.
    const tokens: ZetaToken[] = []
    const pushToken = (t: any) => {
      const addr = t?.zrc20Address || t?.zrc20_address || t?.address
      const symbol = t?.symbol || t?.ticker
      const name = t?.name || symbol
      if (addr && symbol) tokens.push({ symbol, name, address: addr, origin: t?.origin })
    }
    if (Array.isArray(data?.chains)) {
      for (const ch of data.chains) {
        const arr = ch?.assets || ch?.tokens || []
        if (Array.isArray(arr)) arr.forEach(pushToken)
      }
    } else if (Array.isArray(data?.assets)) {
      data.assets.forEach(pushToken)
    } else if (Array.isArray(data?.tokens)) {
      data.tokens.forEach(pushToken)
    }
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


