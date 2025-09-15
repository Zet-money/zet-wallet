import { HDNodeWallet, JsonRpcProvider, Wallet } from 'ethers'

export type SupportedEvm = 'ethereum' | 'polygon' | 'bsc'

const chainToEnvKey: Record<SupportedEvm, string> = {
  ethereum: 'NEXT_PUBLIC_RPC_ETHEREUM',
  polygon: 'NEXT_PUBLIC_RPC_POLYGON',
  bsc: 'NEXT_PUBLIC_RPC_BSC',
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


