export type Network = 'mainnet' | 'testnet'
export type TokenInfo = {
  symbol: string
  name: string
  logo?: string
  addressByNetwork: Partial<Record<Network, string>> // empty for native
}

// Basic curated set per chain; extend as needed.
export const EVM_TOKENS: Record<string, TokenInfo[]> = {
  ethereum: [
    { symbol: 'ETH', name: 'Ether', logo: 'ETH', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', testnet: '' } },
    { symbol: 'USDT', name: 'Tether USD', logo: 'USDT', addressByNetwork: { mainnet: '0xdAC17F958D2ee523a2206206994597C13D831ec7', testnet: '' } },
    { symbol: 'WETH', name: 'Wrapped Ether', logo: 'WETH', addressByNetwork: { mainnet: '0xC02aaA39b223FE8D0a0e5C4F27eAD9083C756Cc2', testnet: '' } },
  ],
  polygon: [
    { symbol: 'MATIC', name: 'Polygon', logo: 'MATIC', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', testnet: '' } },
    { symbol: 'USDT', name: 'Tether USD', logo: 'USDT', addressByNetwork: { mainnet: '0xc2132D05D31c914a87C6611C10748AaCBdA8c49B', testnet: '' } },
    { symbol: 'WETH', name: 'Wrapped Ether', logo: 'WETH', addressByNetwork: { mainnet: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', testnet: '' } },
  ],
  bsc: [
    { symbol: 'BNB', name: 'BNB', logo: 'BNB', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', testnet: '' } },
    { symbol: 'USDT', name: 'Tether USD', logo: 'USDT', addressByNetwork: { mainnet: '0x55d398326f99059fF775485246999027B3197955', testnet: '' } },
    { symbol: 'WETH', name: 'Wrapped Ether', logo: 'WETH', addressByNetwork: { mainnet: '', testnet: '' } },
  ],
  arbitrum: [
    { symbol: 'ETH', name: 'Ether', logo: 'ETH', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', testnet: '' } },
  ],
  optimism: [
    { symbol: 'ETH', name: 'Ether', logo: 'ETH', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', testnet: '' } },
  ],
  base: [
    { symbol: 'ETH', name: 'Ether', logo: 'ETH', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', testnet: '' } },
  ],
  avalanche: [
    { symbol: 'AVAX', name: 'Avalanche', logo: 'AVAX', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', testnet: '' } },
  ],
}

export function getTokensFor(chain: string, network: Network): TokenInfo[] {
  const list = EVM_TOKENS[chain?.toLowerCase?.() || ''] || []
  // filter out tokens that have no address on selected network when ERC-20 (allow native always)
  return list.filter((t) => !t.addressByNetwork.mainnet && !t.addressByNetwork.testnet ? true : !!t.addressByNetwork[network])
}


