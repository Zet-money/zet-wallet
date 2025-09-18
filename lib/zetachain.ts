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

// CCTX Progress tracking types
export type CctxProgress = {
  status: 'pending' | 'inbound_confirmed' | 'outbound_broadcasted' | 'completed' | 'failed' | 'error'
  confirmations: number
  statusText: string
  outboundHash?: string
  inboundHeight?: number
  finalizedHeight?: number
  targetChainId?: string
  amount?: string
  asset?: string
  sender?: string
  receiver?: string
  gasUsed?: string
  gasLimit?: string
  errorMessage?: string
}

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
    console.log('[ZETA][SOL] Starting solanaDepositAndCall', {
      amount,
      tokenSymbol,
      targetZrc20: targetTokenAddress,
      recipient,
      network
    })
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
      chainId: network === 'mainnet' ? 'Mainnet' : 'Devnet',
      signer,
    } as any))
    console.log('[ZETA][SOL] Submitted solanaDepositAndCall signature', signature)
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

/**
 * Track cross-chain transaction using correct blockpi.network RPC endpoints
 * Uses inboundHashToCctxData API with origin chain tx hash as inbound hash
 */
export async function trackCrossChainTransaction(params: {
  hash: string
  network: Network
  timeoutSeconds?: number
  onUpdate?: (args: { cctxs: any; statusText?: string; progress?: CctxProgress }) => void
}): Promise<{ 
  status: 'completed' | 'failed' | 'timeout' | 'pending'
  cctxs?: any
  error?: string
  progress?: CctxProgress
}> {
  const { hash, network, timeoutSeconds = 300, onUpdate } = params
  console.log('[ZETA][CCTX] Tracking cross-chain transaction', { hash, network, timeoutSeconds })
  
  // Use correct blockpi.network RPC endpoints
  const apiUrl = network === 'mainnet'
    ? 'https://zetachain.blockpi.network/lcd/v1/public'
    : 'https://zetachain-athens.blockpi.network/lcd/v1/public'

  return await new Promise((outerResolve) => {
    let done = false
    let intervalId: NodeJS.Timeout | undefined
    let timeoutId: NodeJS.Timeout | undefined

    const pollCctx = async () => {
      if (done) return
      
      try {
        // Use inboundHashToCctxData with origin chain tx hash
        const cctxData = await fetchFromApi<{ CrossChainTxs: any[] }>(apiUrl, `/zeta-chain/crosschain/inboundHashToCctxData/${hash}`)
        
        if (cctxData.CrossChainTxs && cctxData.CrossChainTxs.length > 0) {
          const cctx = cctxData.CrossChainTxs[0]
          const progress = await parseCctxProgress(cctx, apiUrl)
          
          console.log('[ZETA][CCTX] CCTX found', { 
            status: cctx.cctx_status?.status,
            confirmations: progress.confirmations,
            outboundHash: progress.outboundHash
          })
          
          if (onUpdate) {
            onUpdate({ 
              cctxs: cctxData.CrossChainTxs, 
              statusText: progress.statusText,
              progress 
            })
          }
          
          // Check if completed
          if (cctx.cctx_status?.status === 'OutboundMined') {
            done = true
            if (intervalId) clearInterval(intervalId)
            if (timeoutId) clearTimeout(timeoutId)
            outerResolve({ status: 'completed', cctxs: cctxData.CrossChainTxs, progress })
            return
          }
          
          // Check if failed
          if (cctx.cctx_status?.status === 'Aborted' || cctx.cctx_status?.status === 'Reverted') {
            done = true
            if (intervalId) clearInterval(intervalId)
            if (timeoutId) clearTimeout(timeoutId)
            outerResolve({ status: 'failed', cctxs: cctxData.CrossChainTxs, progress })
            return
          }
        } else {
          console.log('[ZETA][CCTX] No CCTX found yet, continuing to poll...')
          if (onUpdate) {
            onUpdate({ 
              cctxs: [], 
              statusText: 'Waiting for cross-chain transaction to be detected...',
              progress: { status: 'pending', confirmations: 0, statusText: 'Pending detection' }
            })
          }
        }
      } catch (error) {
        console.error('[ZETA][CCTX] Poll error', error)
        if (onUpdate) {
          onUpdate({ 
            cctxs: [], 
            statusText: 'Error polling cross-chain status...',
            progress: { status: 'error', confirmations: 0, statusText: 'Polling error' }
          })
        }
      }
    }

    // Start polling immediately
    pollCctx()

    // Poll every 3 seconds
    intervalId = setInterval(pollCctx, 3000)

    // Absolute timeout
    timeoutId = setTimeout(() => {
      if (done) return
      console.warn('[ZETA][CCTX] Timeout reached')
      done = true
      if (intervalId) clearInterval(intervalId)
      outerResolve({ status: 'timeout', cctxs: [] })
    }, timeoutSeconds * 1000)
  })
}

// Parse CCTX response into progress information
async function parseCctxProgress(cctx: any, apiUrl: string): Promise<CctxProgress> {
  const status = cctx.cctx_status?.status || 'pending'
  const inboundParams = cctx.inbound_params || {}
  const outboundParams = cctx.outbound_params?.[0] || {}
  
  // Get current finalized height for confirmations calculation
  let finalizedHeight = 0
  try {
    const tssData = await fetchFromApi<{ TSS: { finalizedZetaHeight: string } }>(apiUrl, '/zeta-chain/observer/TSS')
    finalizedHeight = Number(tssData.TSS.finalizedZetaHeight || 0)
  } catch (error) {
    console.error('[ZETA][CCTX] Failed to get finalized height', error)
  }
  
  const inboundHeight = Number(inboundParams.finalized_zeta_height || 0)
  const confirmations = Math.max(0, finalizedHeight - inboundHeight)
  
  // Determine status and status text
  let progressStatus: CctxProgress['status'] = 'pending'
  let statusText = 'Pending'
  
  if (status === 'OutboundMined') {
    progressStatus = 'completed'
    statusText = 'Cross-chain transfer completed'
  } else if (status === 'Aborted' || status === 'Reverted') {
    progressStatus = 'failed'
    statusText = `Transfer ${status.toLowerCase()}: ${cctx.cctx_status?.error_message || cctx.cctx_status?.status_message || 'Unknown error'}`
  } else if (outboundParams.hash) {
    progressStatus = 'outbound_broadcasted'
    statusText = 'Outbound transaction broadcasted'
  } else if (inboundParams.tx_finalization_status === 'Executed') {
    progressStatus = 'inbound_confirmed'
    statusText = 'Inbound transaction confirmed'
  }
  
  return {
    status: progressStatus,
    confirmations,
    statusText,
    outboundHash: outboundParams.hash,
    inboundHeight,
    finalizedHeight,
    targetChainId: outboundParams.receiver_chainId,
    amount: inboundParams.amount,
    asset: inboundParams.asset,
    sender: inboundParams.sender,
    receiver: outboundParams.receiver,
    gasUsed: outboundParams.gas_used,
    gasLimit: outboundParams.call_options?.gas_limit,
    errorMessage: cctx.cctx_status?.error_message || cctx.cctx_status?.error_message_revert || cctx.cctx_status?.error_message_abort
  }
}

// Custom lightweight tracker using Zeta RPC finalized height as confirmations
async function fetchFromApi<T>(api: string, endpoint: string): Promise<T> {
  const res = await fetch(`${api}${endpoint}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}


export async function trackCrossChainConfirmations(params: {
  hash: string
  network: Network
  minConfirmations?: number
  timeoutSeconds?: number
  onProgress?: (p: { confirmations: number; status?: string; progress?: CctxProgress }) => void
}): Promise<{ status: 'completed' | 'failed' | 'timeout'; confirmations: number; cctx?: any; progress?: CctxProgress }> {
  console.log({ params })
  const { hash, network, minConfirmations = 20, timeoutSeconds = 300, onProgress } = params
  const apiUrl = network === 'mainnet' 
    ? 'https://zetachain.blockpi.network/lcd/v1/public' 
    : 'https://zetachain-athens.blockpi.network/lcd/v1/public'
  const start = Date.now()
  console.log('[ZETA][CCTX][CONF] Start', { hash, minConfirmations, timeoutSeconds })

  while (Date.now() - start < timeoutSeconds * 1000) {
    try {
      // Use inboundHashToCctxData instead of direct CCTX lookup
      const cctxData = await fetchFromApi<{ CrossChainTxs: any[] }>(apiUrl, `/zeta-chain/crosschain/inboundHashToCctxData/${hash}`)
      
      if (cctxData.CrossChainTxs && cctxData.CrossChainTxs.length > 0) {
        const cctx = cctxData.CrossChainTxs[0]
        const progress = await parseCctxProgress(cctx, apiUrl)
        
        if (onProgress) onProgress({ 
          confirmations: progress.confirmations, 
          status: cctx.cctx_status?.status,
          progress 
        })
        
        console.log('[ZETA][CCTX][CONF] tick', { 
          finalized: progress.finalizedHeight, 
          inboundHeight: progress.inboundHeight, 
          confirmations: progress.confirmations, 
          status: cctx.cctx_status?.status 
        })

        if (cctx.cctx_status?.status === 'Aborted' || cctx.cctx_status?.status === 'Reverted') {
          return { status: 'failed', confirmations: progress.confirmations, cctx, progress }
        }
        if (cctx.cctx_status?.status === 'OutboundMined' || progress.confirmations >= minConfirmations) {
          return { status: 'completed', confirmations: progress.confirmations, cctx, progress }
        }
      } else {
        console.log('[ZETA][CCTX][CONF] No CCTX found yet')
        if (onProgress) {
          onProgress({ 
            confirmations: 0, 
            status: 'pending',
            progress: { status: 'pending', confirmations: 0, statusText: 'Waiting for CCTX detection' }
          })
        }
      }
    } catch (error) {
      console.error('[ZETA][CCTX][CONF] Poll error', error)
    }
    
    await new Promise(r => setTimeout(r, 3000))
  }
  console.warn('[ZETA][CCTX][CONF] timeout')
  return { status: 'timeout', confirmations: 0 }
}

