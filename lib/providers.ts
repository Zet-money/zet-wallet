import { HDNodeWallet, JsonRpcProvider, Wallet } from 'ethers'

// Expandable list of EVM chains connected to ZetaChain
export type SupportedEvm =
  | 'ethereum'
  | 'polygon'
  | 'bsc'
  | 'avalanche'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'zetachain'

const chainToEnvKey: Record<SupportedEvm, string> = {
  ethereum: 'NEXT_PUBLIC_RPC_ETHEREUM',
  polygon: 'NEXT_PUBLIC_RPC_POLYGON',
  bsc: 'NEXT_PUBLIC_RPC_BSC',
  avalanche: 'NEXT_PUBLIC_RPC_AVALANCHE',
  arbitrum: 'NEXT_PUBLIC_RPC_ARBITRUM',
  optimism: 'NEXT_PUBLIC_RPC_OPTIMISM',
  base: 'NEXT_PUBLIC_RPC_BASE',
  zetachain: 'NEXT_PUBLIC_RPC_ZETACHAIN',
}

export type RpcMap = Partial<Record<SupportedEvm, { mainnet?: string; testnet?: string }>>

export function getRpcUrl(chain: SupportedEvm, network: Network, rpc?: RpcMap): string {
  const candidate = rpc?.[chain]?.[network]
  if (candidate) return candidate
  const key = network === 'testnet' ? `${chainToEnvKey[chain]}_TESTNET` : chainToEnvKey[chain]
  const url = process.env[key]
  if (!url) {
    // Surface helpful diagnostics in development
    if (typeof window !== 'undefined') {
      console.error(`[RPC] Missing env ${key}. Ensure NEXT_PUBLIC vars are set and dev server restarted.`)
    }
  }
  if (!url) throw new Error(`Missing RPC for ${chain} (${network}). Provide via in-app RPC map or env ${key}`)
  return url
}

export function getEvmProvider(chain: SupportedEvm, network: Network, rpc?: RpcMap) {
  return new JsonRpcProvider(getRpcUrl(chain, network, rpc))
}

export function getEvmSignerFromPhrase(mnemonicPhrase: string, chain: SupportedEvm, network: Network, rpc?: RpcMap) {
  const provider = getEvmProvider(chain, network, rpc)
  const wallet = Wallet.fromPhrase(mnemonicPhrase)
  return wallet.connect(provider)
}

export function getAddressFromPhrase(mnemonicPhrase: string): string {
  const hd = HDNodeWallet.fromPhrase(mnemonicPhrase)
  return hd.address
}

// ---- Network helpers (mainnet / testnet) ----
export type Network = 'mainnet' | 'testnet'

// Note: prefer passing network from in-app settings; env fallback remains for dev only


