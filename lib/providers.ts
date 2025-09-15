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
  | 'fantom'
  | 'gnosis'
  | 'celo'
  | 'moonbeam'
  | 'moonriver'
  | 'aurora'
  | 'linea'
  | 'mantle'
  | 'scroll'
  | 'zksync'
  | 'blast'
  | 'zora'

const chainToEnvKey: Record<SupportedEvm, string> = {
  ethereum: 'NEXT_PUBLIC_RPC_ETHEREUM',
  polygon: 'NEXT_PUBLIC_RPC_POLYGON',
  bsc: 'NEXT_PUBLIC_RPC_BSC',
  avalanche: 'NEXT_PUBLIC_RPC_AVALANCHE',
  arbitrum: 'NEXT_PUBLIC_RPC_ARBITRUM',
  optimism: 'NEXT_PUBLIC_RPC_OPTIMISM',
  base: 'NEXT_PUBLIC_RPC_BASE',
  fantom: 'NEXT_PUBLIC_RPC_FANTOM',
  gnosis: 'NEXT_PUBLIC_RPC_GNOSIS',
  celo: 'NEXT_PUBLIC_RPC_CELO',
  moonbeam: 'NEXT_PUBLIC_RPC_MOONBEAM',
  moonriver: 'NEXT_PUBLIC_RPC_MOONRIVER',
  aurora: 'NEXT_PUBLIC_RPC_AURORA',
  linea: 'NEXT_PUBLIC_RPC_LINEA',
  mantle: 'NEXT_PUBLIC_RPC_MANTLE',
  scroll: 'NEXT_PUBLIC_RPC_SCROLL',
  zksync: 'NEXT_PUBLIC_RPC_ZKSYNC',
  blast: 'NEXT_PUBLIC_RPC_BLAST',
  zora: 'NEXT_PUBLIC_RPC_ZORA',
}

export function getRpcUrl(chain: SupportedEvm): string {
  const key = chainToEnvKey[chain]
  const url = process.env[key]
  if (!url) throw new Error(`Missing env RPC for ${chain}: ${key}`)
  return url
}

export function getEvmProvider(chain: SupportedEvm) {
  return new JsonRpcProvider(getRpcUrl(chain))
}

export function getEvmSignerFromPhrase(mnemonicPhrase: string, chain: SupportedEvm) {
  const provider = getEvmProvider(chain)
  // ethers v6: derive wallet from phrase
  const wallet = Wallet.fromPhrase(mnemonicPhrase)
  return wallet.connect(provider)
}

export function getAddressFromPhrase(mnemonicPhrase: string): string {
  const hd = HDNodeWallet.fromPhrase(mnemonicPhrase)
  return hd.address
}


