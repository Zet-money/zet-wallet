import { getTokensFor, type Network as TokenNetwork, type TokenInfo } from './tokens'

export type SupportedEvm = 'ethereum' | 'polygon' | 'base' | 'arbitrum' | 'avalanche' | 'bsc' | 'optimism' | 'zetachain' | 'solana'

const MAINNET_SUFFIX: Record<Exclude<SupportedEvm, 'zetachain'>, string> = {
  ethereum: 'ETH',
  polygon: 'POL',
  base: 'BASE',
  arbitrum: 'ARB',
  avalanche: 'AVAX',
  bsc: 'BSC',
  optimism: 'OP',
  solana: 'SOL',
}

const TESTNET_SUFFIX: Record<Exclude<SupportedEvm, 'zetachain'>, string> = {
  ethereum: 'ETHSEP',
  polygon: 'AMOY',
  base: 'BASESEP',
  arbitrum: 'ARBSEP',
  avalanche: 'FUJI',
  bsc: 'BSC',
  optimism: 'OP',
  solana: 'SOL',
}

export function getZrcSymbolFor(targetChain: SupportedEvm, tokenSymbol: string, network: TokenNetwork): string | undefined {
  if (targetChain === 'zetachain') return tokenSymbol.toUpperCase()
  const suffix = network === 'mainnet' ? MAINNET_SUFFIX[targetChain as Exclude<SupportedEvm, 'zetachain'>] : TESTNET_SUFFIX[targetChain as Exclude<SupportedEvm, 'zetachain'>]
  if (!suffix) return undefined
  console.log('suffix', suffix)
  console.log('tokenSymbol', tokenSymbol)
  console.log('targetChain', targetChain)
  console.log('network', network)
  
  // Special case: MATIC on Polygon maps to POL.POL (mainnet) or POL.AMOY (testnet)
  if (targetChain === 'polygon' && tokenSymbol.toUpperCase() === 'MATIC') {
    return network === 'mainnet' ? 'POL.POL' : 'POL.AMOY'
  }
  
  return `${tokenSymbol.toUpperCase()}.${suffix}`
}

export function getZrcAddressFor(targetChain: SupportedEvm, tokenSymbol: string, network: TokenNetwork): string | undefined {
  const zrcSymbol = getZrcSymbolFor(targetChain, tokenSymbol, network)
  console.log('zrcSymbol', zrcSymbol)
  if (!zrcSymbol) return undefined
  const zetaTokens: TokenInfo[] = getTokensFor('zetachain', network)
  const info = zetaTokens.find(t => t.symbol.toUpperCase() === zrcSymbol)
  return info?.addressByNetwork?.[network]
}


