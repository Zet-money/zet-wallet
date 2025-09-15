import { JsonRpcProvider, Contract, formatUnits } from 'ethers'
import { getEvmProvider } from './providers'
import type { Network } from './providers'

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
]

export async function fetchNativeBalance(address: string, provider: JsonRpcProvider): Promise<string> {
  const wei = await provider.getBalance(address)
  return formatUnits(wei, 18)
}

const decimalsCache = new Map<string, number>()

export async function fetchErc20Balance(tokenAddress: string, address: string, provider: JsonRpcProvider): Promise<string> {
  const contract = new Contract(tokenAddress, ERC20_ABI, provider)
  let tokenDecimals = decimalsCache.get(tokenAddress)
  if (tokenDecimals === undefined) {
    const dec: number = await contract.decimals()
    tokenDecimals = dec
    decimalsCache.set(tokenAddress, dec)
  }
  const raw = await contract.balanceOf(address)
  return formatUnits(raw, tokenDecimals as number)
}

export async function fetchBalancesForChain(params: {
  chain: string
  network: Network
  address: string
  tokens: Array<{ symbol: string; address?: string | null }>
  rpcMap?: Record<string, string>
}) {
  const { chain, network, address, tokens, rpcMap } = params
  const provider = getEvmProvider(chain as any, network, rpcMap)

  const results = await Promise.all(tokens.map(async (t) => {
    try {
      if (t.address) {
        const bal = await fetchErc20Balance(t.address, address, provider)
        return { symbol: t.symbol, balance: bal }
      }
      const bal = await fetchNativeBalance(address, provider)
      return { symbol: t.symbol, balance: bal }
    } catch {
      return { symbol: t.symbol, balance: '0' }
    }
  }))

  const map: Record<string, string> = {}
  for (const r of results) map[r.symbol] = r.balance
  return map
}


