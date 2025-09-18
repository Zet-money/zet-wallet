import { HDNodeWallet, JsonRpcProvider, Wallet, Network as EthersNetwork } from 'ethers'

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
  const rpcUrl = getRpcUrl(chain, network, rpc)
  
  // Define network configurations to avoid eth_chainId calls
  const networkConfigs: Record<SupportedEvm, Record<Network, EthersNetwork>> = {
    ethereum: {
      mainnet: EthersNetwork.from({ name: 'ethereum', chainId: 1 }),
      testnet: EthersNetwork.from({ name: 'sepolia', chainId: 11155111 })
    },
    polygon: {
      mainnet: EthersNetwork.from({ name: 'polygon', chainId: 137 }),
      testnet: EthersNetwork.from({ name: 'amoy', chainId: 80002 })
    },
    bsc: {
      mainnet: EthersNetwork.from({ name: 'bsc', chainId: 56 }),
      testnet: EthersNetwork.from({ name: 'bsc-testnet', chainId: 97 })
    },
    avalanche: {
      mainnet: EthersNetwork.from({ name: 'avalanche', chainId: 43114 }),
      testnet: EthersNetwork.from({ name: 'fuji', chainId: 43113 })
    },
    arbitrum: {
      mainnet: EthersNetwork.from({ name: 'arbitrum', chainId: 42161 }),
      testnet: EthersNetwork.from({ name: 'arbitrum-sepolia', chainId: 421614 })
    },
    optimism: {
      mainnet: EthersNetwork.from({ name: 'optimism', chainId: 10 }),
      testnet: EthersNetwork.from({ name: 'optimism-sepolia', chainId: 11155420 })
    },
    base: {
      mainnet: EthersNetwork.from({ name: 'base', chainId: 8453 }),
      testnet: EthersNetwork.from({ name: 'base-sepolia', chainId: 84532 })
    },
    zetachain: {
      mainnet: EthersNetwork.from({ name: 'zetachain', chainId: 7000 }),
      testnet: EthersNetwork.from({ name: 'zetachain-athens', chainId: 7001 })
    }
  }
  
  const networkConfig = networkConfigs[chain][network]
  const provider = new JsonRpcProvider(rpcUrl, networkConfig, {
    staticNetwork: true
  })
  
  // Disable ENS resolution for testnets to avoid errors
  if (network === 'testnet') {
    provider.disableCcipRead = true
  }
  return provider
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


