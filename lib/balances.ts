import { JsonRpcProvider, Contract, formatUnits } from 'ethers'
import { getEvmProvider } from './providers'
import type { Network, RpcMap } from './providers'

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
  // Ensure the token address is properly formatted (starts with 0x and is 42 characters)
  if (!tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
    throw new Error(`Invalid token address: ${tokenAddress}`)
  }
  
  // Create contract with explicit address to avoid ENS resolution
  const contract = new Contract(tokenAddress, ERC20_ABI, provider)
  let tokenDecimals = decimalsCache.get(tokenAddress)
  if (tokenDecimals === undefined) {
    try {
      const dec: number = await contract.decimals()
      console.log(`Token ${tokenAddress} has ${dec} decimals`)
      tokenDecimals = dec
      decimalsCache.set(tokenAddress, dec)
    } catch (error) {
      console.error(`Error fetching decimals for ${tokenAddress}:`, error)
      // Default to 18 decimals if we can't fetch
      tokenDecimals = 18
      decimalsCache.set(tokenAddress, 18)
    }
  }
  const raw = await contract.balanceOf(address)
  console.log(`Raw balance for ${tokenAddress}: ${raw.toString()}, decimals: ${tokenDecimals}`)
  return formatUnits(raw, tokenDecimals as number)
}

export async function fetchBalancesForChain(params: {
  chain: string
  network: Network
  address: string
  tokens: Array<{ symbol: string; address?: string | null }>
  rpcMap?: RpcMap
}) {
  const { chain, network, address, tokens, rpcMap } = params
  console.log('fetchBalancesForChain', { chain, network, address, tokens, rpcMap })
  const provider = getEvmProvider(chain as any, network, rpcMap)

  const results = await Promise.all(tokens.map(async (t) => {
    try {
      if (t.address) {
        console.log('fetching erc20 balance for', t.symbol, t.address, 'length:', t.address.length)
        const bal = await fetchErc20Balance(t.address, address, provider)
        console.log('bal', bal)
        return { symbol: t.symbol, balance: bal }
      }
      const bal = await fetchNativeBalance(address, provider)
      console.log('bal', bal)
      return { symbol: t.symbol, balance: bal }
    } catch (error) {
      console.error(`Error fetching balance for ${t.symbol} on ${chain}:`, error)
      return { symbol: t.symbol, balance: '0' }
    }
  }))

  const map: Record<string, string> = {}
  for (const r of results) map[r.symbol] = r.balance
  return map
}


