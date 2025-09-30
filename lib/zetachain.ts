import { type SupportedEvm, type Network, type RpcMap } from './providers'
// import { ZETPROTOCOL_ADDRESS } from './zetprotocol'
// import { solanaMnemonicToKeypairForRetrieval } from './solana'
import { solanaDepositAndCallServer } from './solana-deposit-server'
import { JsonRpcProvider } from 'ethers'



export type Erc20Token = {
  symbol: string
  address: string
  decimals?: number
}

export type EvmDepositParams = {
  originChain: SupportedEvm
  amount: string
  receiver: string // receiver on ZetaChain
  token?: Erc20Token | string // token object or address for convenience
  mnemonicPhrase: string
  network: Network
  rpc?: RpcMap
}

// Enhanced parameters for ZetProtocol transfers
export type ZetProtocolTransferParams = {
  originChain: SupportedEvm
  targetChain: SupportedEvm
  amount: string
  tokenSymbol: string // source token symbol (e.g., USDC)
  sourceTokenAddress: string // ERC-20 on origin chain
  targetTokenAddress: string // ZRC-20 on Zeta for destination asset/chain
  recipient: string
  mnemonicPhrase: string
  network: Network
  rpc?: RpcMap
}

// /**
//  * Smart cross-chain transfer using ZetProtocol
//  * Automatically detects transfer type and executes appropriate function
//  */
// export async function smartCrossChainTransfer(params: ZetProtocolTransferParams): Promise<{ hash: string }> {
//   const { originChain, targetChain, amount, tokenSymbol, sourceTokenAddress, targetTokenAddress, recipient, mnemonicPhrase, network, rpc } = params
//   if ((originChain as any) === 'solana') {
//     console.log('[ZETA][SOL] Starting solanaDepositAndCall', {
//       amount,
//       tokenSymbol,
//       targetZrc20: targetTokenAddress,
//       recipient,
//       network
//     })
//     // Use server-side function to avoid client fs issues
//     const types = ['address', 'bytes', 'bool']
//     const recipientBytes = recipient.startsWith('0x') ? recipient : `0x${recipient}`
//     const values = [targetTokenAddress, recipientBytes, true]
//     const tokenMintAddress = sourceTokenAddress && sourceTokenAddress.startsWith('0x') ? undefined : sourceTokenAddress
//     const signature = await solanaDepositAndCallServer({
//       amount,
//       receiver: ZETPROTOCOL_ADDRESS,
//       token: tokenMintAddress,
//       types,
//       values,
//       revertOptions: {
//         callOnRevert: false,
//         revertMessage: 'ZetProtocol: Cross-chain transfer failed',
//         revertAddress: undefined,
//         abortAddress: undefined,
//         onRevertGasLimit: '500000'
//       },
//       mnemonicPhrase,
//       network
//     })
//     console.log('[ZETA][SOL] Submitted solanaDepositAndCall signature', signature)
//     return { hash: signature }
//   }
  
//   // Detect transfer type
//   const transferType = await detectTransferType(tokenSymbol, originChain, targetChain)
  
//   console.log('Smart Transfer Detection:', {
//     tokenSymbol,
//     sourceTokenAddress,
//     targetTokenAddress,
//     originChain,
//     targetChain,
//     transferType: TransferType[transferType as unknown as keyof typeof TransferType]
//   })
  
//   // Execute based on transfer type
//   switch (transferType) {
//     case TransferType.DIRECT_TRANSFER: {
//       const tx = await performDirectTransfer({
//         originChain,
//         amount,
//         targetChain,
//         tokenSymbol,
//         sourceTokenAddress,
//         targetTokenAddress,
//         recipient,
//         mnemonicPhrase,
//         network,
//         rpc
//       })
//       console.log('Direct Transfer:', { tx })
//       return { hash: tx.hash }
//     }
      
//     case TransferType.CROSS_CHAIN_SWAP: {
//       const tx = await performCrossChainSwap({
//         originChain,
//         amount,
//         targetChain,
//         tokenSymbol,
//         sourceTokenAddress,
//         targetTokenAddress,
//         recipient,
//         mnemonicPhrase,
//         network,
//         rpc
//       })
//       return { hash: tx.hash }
//     }
      
//     case TransferType.SAME_CHAIN_SWAP: {
//       const tx = await performSameChainSwap({
//         originChain,
//         amount,
//         targetChain,
//         tokenSymbol,
//         sourceTokenAddress,
//         targetTokenAddress,
//         recipient,
//         mnemonicPhrase,
//         network,
//         rpc
//       })
//       return { hash: tx.hash }
//     }
      
//     default:
//       throw new Error(`Unsupported transfer type: ${transferType}`)
//   }
// }

// /**
//  * Direct transfer (same token, different chains)
//  */
// export async function directTransfer(params: ZetProtocolTransferParams): Promise<{ hash: string }> {
//   const tx = await performDirectTransfer(params)
//   return { hash: tx.hash }
// }

// /**
//  * Cross-chain swap (different tokens, different chains)
//  */
// export async function crossChainSwap(params: ZetProtocolTransferParams): Promise<{ hash: string }> {
//   const tx = await performCrossChainSwap(params)
//   return { hash: tx.hash }
// }

// /**
//  * Same-chain swap (different tokens, same chain)
//  */
// export async function sameChainSwap(params: ZetProtocolTransferParams): Promise<{ hash: string }> {
//   const tx = await performSameChainSwap(params)
//   return { hash: tx.hash }
// }

export async function getTxStatus(params: {
  originChain: SupportedEvm
  hash: string
  network: Network
  rpc?: RpcMap
}): Promise<{ status: 'pending' | 'confirmed' | 'failed'; confirmations: number; blockNumber?: number; gasUsed?: string }> {
  const { originChain, hash, network, rpc } = params
  const rpcUrl = rpc?.[originChain]
  console.log('[ZETA][EVM] Getting tx status', { originChain, network, rpc: rpcUrl?.[network], hash })
  if (!rpcUrl) {
    return { status: 'pending', confirmations: 0 }
  }
  
  try {
    const provider = new JsonRpcProvider(rpcUrl[network])
    console.log('[ZETA][EVM] Checking tx status via RPC', { originChain, network, rpc: rpcUrl[network], hash })
    
    // First check if transaction exists
    const tx = await provider.getTransaction(hash)
    if (!tx) {
      console.log('[ZETA][EVM] Tx not found yet')
      return { status: 'pending', confirmations: 0 }
    }
    
    // Check if transaction is mined
    const receipt = await provider.getTransactionReceipt(hash)
    if (!receipt) {
      console.log('[ZETA][EVM] Receipt not found yet')
      return { status: 'pending', confirmations: 0 }
    }
    
    // Transaction is mined, check status
    if (receipt.status === 0) {
      console.log('[ZETA][EVM] Tx failed')
      return { 
        status: 'failed', 
        confirmations: 0, 
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString()
      }
    }
    
    // Get current block to calculate confirmations
    const latestBlock = await provider.getBlockNumber()
    const confirmations = Math.max(0, latestBlock - Number(receipt.blockNumber) + 1)
    
    const res: { status: 'confirmed'; confirmations: number; blockNumber: number; gasUsed: string } = { 
      status: 'confirmed', 
      confirmations, 
      blockNumber: Number(receipt.blockNumber),
      gasUsed: receipt.gasUsed.toString()
    }
    console.log('[ZETA][EVM] Tx confirmed', res)
    return res
  } catch (error) {
    console.error('Error checking transaction status:', error)
    return { status: 'pending', confirmations: 0 }
  }
}

export async function waitForTxConfirmation(params: {
  originChain: SupportedEvm
  hash: string
  network: Network
  rpc?: RpcMap
  requiredConfirmations?: number
  timeoutMs?: number
}): Promise<{ status: 'confirmed' | 'failed' | 'timeout'; confirmations: number; blockNumber?: number; gasUsed?: string }> {
  const { originChain, hash, network, rpc, requiredConfirmations = 1, timeoutMs = 300000 } = params // 5 min default timeout
  
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeoutMs) {
    const status = await getTxStatus({ originChain, hash, network, rpc })
    
    if (status.status === 'confirmed' && status.confirmations >= requiredConfirmations) {
      return { status: 'confirmed', confirmations: status.confirmations, blockNumber: status.blockNumber, gasUsed: status.gasUsed }
    }
    
    if (status.status === 'failed') {
      return { status: 'failed', confirmations: 0, blockNumber: status.blockNumber, gasUsed: status.gasUsed }
    }
    
    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  return { status: 'timeout', confirmations: 0 }
}


// Chain ID mappings by network
export const CHAIN_IDS_BY_NETWORK: Record<Network, Record<SupportedEvm, number>> = {
  mainnet: {
    ethereum: 1,
    polygon: 137,
    base: 8453,
    arbitrum: 42161,
    avalanche: 43114,
    zetachain: 7000,
    bsc: 56,
    optimism: 10,
  },
  testnet: {
    ethereum: 11155111, // Sepolia
    polygon: 80002, // Amoy
    base: 84532, // Base Sepolia
    arbitrum: 421614, // Arbitrum Sepolia
    avalanche: 43113, // Fuji
    zetachain: 7001,
    bsc: 97,
    optimism: 11155420,
  },
}
