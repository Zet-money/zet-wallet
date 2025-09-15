type CachedPrice = { price: number; timestamp: number }

export const tokenToCoingeckoId: { [symbol: string]: string } = {
  ETH: 'ethereum',
  MATIC: 'matic-network',
  POL: 'matic-network',
  AVAX: 'avalanche-2',
  USDC: 'usd-coin',
  USDT: 'tether',
  SOL: 'solana',
  BNB: 'binancecoin',
  ARB: 'arbitrum',
  OP: 'optimism',
  BASE: 'base-protocol',
}

const priceCache: Record<string, CachedPrice> = {}

export async function getTokenPriceUSD(tokenSymbol: string): Promise<number | null> {
  const symbol = tokenSymbol.toUpperCase()
  const cached = priceCache[symbol]
  if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
    return cached.price
  }

  try {
    const coingeckoIds = Array.from(new Set(Object.values(tokenToCoingeckoId))).join(',')
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds}&vs_currencies=usd`, {
      headers: {
        'x-cg-demo-api-key': 'CG-13fTWkgsW6GkmVdg9mm6eqU7',
      },
      next: { revalidate: 3600 },
    })
    const data = await res.json()

    for (const [sym, cgId] of Object.entries(tokenToCoingeckoId)) {
      const price = data?.[cgId]?.usd
      if (typeof price === 'number') {
        priceCache[sym] = { price, timestamp: Date.now() }
      }
    }

    return priceCache[symbol]?.price ?? null
  } catch (error) {
    console.error('Failed to fetch token prices:', error)
    return null
  }
}


