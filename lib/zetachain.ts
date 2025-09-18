"use server"
import { type SupportedEvm, type Network, type RpcMap } from './providers'
import { 
  performDirectTransfer, 
  performCrossChainSwap, 
  performSameChainSwap,
  TransferType,
  detectTransferType
} from './zetprotocol'
import { solanaDepositAndCall } from '@zetachain/toolkit/chains'
import { ZETPROTOCOL_ADDRESS } from './zetprotocol'
import { solanaMnemonicToKeypairForRetrieval } from './solana'
import { JsonRpcProvider } from 'ethers'
import { pollTransactions } from '@zetachain/toolkit/utils'

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

/**
 * Smart cross-chain transfer using ZetProtocol
 * Automatically detects transfer type and executes appropriate function
 */
export async function smartCrossChainTransfer(params: ZetProtocolTransferParams): Promise<{ hash: string }> {
  const { originChain, targetChain, amount, tokenSymbol, sourceTokenAddress, targetTokenAddress, recipient, mnemonicPhrase, network, rpc } = params
  if ((originChain as any) === 'solana') {
    // Build Solana signer from mnemonic via helper
    const { keypair: signer } = await solanaMnemonicToKeypairForRetrieval(mnemonicPhrase)

    const types = ['address', 'bytes', 'bool']
    const recipientBytes = recipient.startsWith('0x') ? recipient : `0x${recipient}`
    const values = [targetTokenAddress, recipientBytes, true]

    const tokenMintAddress = sourceTokenAddress && sourceTokenAddress.startsWith('0x') ? undefined : sourceTokenAddress

    const signature = await solanaDepositAndCall({
      amount,
      receiver: ZETPROTOCOL_ADDRESS,
      token: tokenMintAddress, // undefined for SOL
      types,
      values,
      revertOptions: {
        callOnRevert: false,
        revertMessage: 'ZetProtocol: Cross-chain transfer failed',
        revertAddress: signer.publicKey.toBase58(),
        abortAddress: signer.publicKey.toBase58(),
        onRevertGasLimit: '500000',
      }
    }, ({
      chainId: network === 'mainnet' ? 'Mainnet' : 'Testnet',
      signer,
    } as any))
    return { hash: signature }
  }
  
  // Detect transfer type
  const transferType = await detectTransferType(tokenSymbol, originChain, targetChain)
  
  console.log('Smart Transfer Detection:', {
    tokenSymbol,
    sourceTokenAddress,
    targetTokenAddress,
    originChain,
    targetChain,
    transferType: TransferType[transferType as unknown as keyof typeof TransferType]
  })
  
  // Execute based on transfer type
  switch (transferType) {
    case TransferType.DIRECT_TRANSFER: {
      const tx = await performDirectTransfer({
        originChain,
        amount,
        targetChain,
        tokenSymbol,
        sourceTokenAddress,
        targetTokenAddress,
        recipient,
        mnemonicPhrase,
        network,
        rpc
      })
      console.log('Direct Transfer:', { tx })
      return { hash: tx.hash }
    }
      
    case TransferType.CROSS_CHAIN_SWAP: {
      const tx = await performCrossChainSwap({
        originChain,
        amount,
        targetChain,
        tokenSymbol,
        sourceTokenAddress,
        targetTokenAddress,
        recipient,
        mnemonicPhrase,
        network,
        rpc
      })
      return { hash: tx.hash }
    }
      
    case TransferType.SAME_CHAIN_SWAP: {
      const tx = await performSameChainSwap({
        originChain,
        amount,
        targetChain,
        tokenSymbol,
        sourceTokenAddress,
        targetTokenAddress,
        recipient,
        mnemonicPhrase,
        network,
        rpc
      })
      return { hash: tx.hash }
    }
      
    default:
      throw new Error(`Unsupported transfer type: ${transferType}`)
  }
}

/**
 * Direct transfer (same token, different chains)
 */
export async function directTransfer(params: ZetProtocolTransferParams): Promise<{ hash: string }> {
  const tx = await performDirectTransfer(params)
  return { hash: tx.hash }
}

/**
 * Cross-chain swap (different tokens, different chains)
 */
export async function crossChainSwap(params: ZetProtocolTransferParams): Promise<{ hash: string }> {
  const tx = await performCrossChainSwap(params)
  return { hash: tx.hash }
}

/**
 * Same-chain swap (different tokens, same chain)
 */
export async function sameChainSwap(params: ZetProtocolTransferParams): Promise<{ hash: string }> {
  const tx = await performSameChainSwap(params)
  return { hash: tx.hash }
}

export async function getTxStatus(params: {
  originChain: SupportedEvm
  hash: string
  network: Network
  rpc?: RpcMap
}): Promise<{ status: 'pending' | 'confirmed' | 'failed'; confirmations: number; blockNumber?: number; gasUsed?: string }> {
  const { originChain, hash, network, rpc } = params
  const rpcUrl = rpc?.[originChain]
  if (!rpcUrl) {
    return { status: 'pending', confirmations: 0 }
  }
  
  try {
    const provider = new JsonRpcProvider(rpcUrl[network])
    
    // First check if transaction exists
    const tx = await provider.getTransaction(hash)
    if (!tx) return { status: 'pending', confirmations: 0 }
    
    // Check if transaction is mined
    const receipt = await provider.getTransactionReceipt(hash)
    if (!receipt) return { status: 'pending', confirmations: 0 }
    
    // Transaction is mined, check status
    if (receipt.status === 0) {
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
    
    return { 
      status: 'confirmed', 
      confirmations, 
      blockNumber: Number(receipt.blockNumber),
      gasUsed: receipt.gasUsed.toString()
    }
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

/**
 * Track cross-chain transaction using ZetaChain Toolkit's built-in tracking
 */
export async function trackCrossChainTransaction(params: {
  hash: string
  network: Network
  timeoutSeconds?: number
}): Promise<{ 
  status: 'completed' | 'failed' | 'timeout' | 'pending'
  cctxs?: any[]
  error?: string
}> {
  const { hash, network, timeoutSeconds = 300 } = params
  
  try {
    // Use ZetaChain's API endpoint based on network
    const apiUrl = network === 'mainnet' 
      ? 'https://api.zetachain.network' 
      : 'https://api.athens.zetachain.network'
    
    const tss = network === 'mainnet' 
      ? 'https://tss.zetachain.network' 
      : 'https://tss.athens.zetachain.network'
    
    // Create initial state for polling
    const initialState = {
      cctxs: [] as any,
      pendingNonces: [] as any,
      pollCount: 0,
      spinners: {}
    }
    
    // Track the cross-chain transaction using pollTransactions
    const result = await new Promise<any>((resolve, reject) => {
      pollTransactions({
        api: apiUrl,
        hash,
        tss,
        state: initialState,
        emitter: null,
        json: true,
        timeoutSeconds,
        resolve,
        reject
      })
    })
    
    if (result && result.length > 0) {
      // Check if all CCTXs are completed
      const allCompleted = result.every((cctx: any) => cctx.status === 'completed')
      const anyFailed = result.some((cctx: any) => cctx.status === 'failed')
      
      if (allCompleted) {
        return { status: 'completed', cctxs: result }
      } else if (anyFailed) {
        return { status: 'failed', cctxs: result }
      } else {
        return { status: 'pending', cctxs: result }
      }
    }
    
    return { status: 'timeout' }
  } catch (error) {
    console.error('Error tracking cross-chain transaction:', error)
    return { 
      status: 'failed', 
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

