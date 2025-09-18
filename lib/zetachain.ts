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
      if (done) {
        console.log('[ZETA][CCTX][POLL] Poll skipped - already done')
        return
      }
      
      console.log('[ZETA][CCTX][POLL] Starting poll cycle', { hash, apiUrl, done })
      
      try {
        // Use inboundHashToCctxData with origin chain tx hash
        const endpoint = `/zeta-chain/crosschain/inboundHashToCctxData/${hash}`
        console.log('[ZETA][CCTX][POLL] Fetching CCTX data', { endpoint, fullUrl: `${apiUrl}${endpoint}` })
        
        const cctxData = await fetchFromApi<{ CrossChainTxs: any[] }>(apiUrl, endpoint)
        
        console.log('[ZETA][CCTX][POLL] CCTX data received', {
          hasCrossChainTxs: !!cctxData.CrossChainTxs,
          cctxCount: cctxData.CrossChainTxs?.length || 0,
          cctxDataKeys: Object.keys(cctxData || {}),
          cctxData
        })
        
        if (cctxData.CrossChainTxs && cctxData.CrossChainTxs.length > 0) {
          const cctx = cctxData.CrossChainTxs[0]
          console.log('[ZETA][CCTX][POLL] Processing first CCTX', {
            cctxKeys: Object.keys(cctx || {}),
            cctxStatus: cctx.cctx_status,
            inboundParams: cctx.inbound_params,
            outboundParams: cctx.outbound_params
          })
          
          const progress = await parseCctxProgress(cctx, apiUrl)
          
          console.log('[ZETA][CCTX][POLL] CCTX found and parsed', { 
            status: cctx.cctx_status?.status,
            confirmations: progress.confirmations,
            outboundHash: progress.outboundHash,
            progressStatus: progress.status,
            progressStatusText: progress.statusText
          })
          
          if (onUpdate) {
            console.log('[ZETA][CCTX][POLL] Calling onUpdate callback', {
              cctxsCount: cctxData.CrossChainTxs.length,
              statusText: progress.statusText,
              progressStatus: progress.status
            })
            onUpdate({ 
              cctxs: cctxData.CrossChainTxs, 
              statusText: progress.statusText,
              progress 
            })
          }
          
          // Check if completed
          if (cctx.cctx_status?.status === 'OutboundMined') {
            console.log('[ZETA][CCTX][POLL] Status is OutboundMined - completing', { status: cctx.cctx_status.status })
            done = true
            if (intervalId) clearInterval(intervalId)
            if (timeoutId) clearTimeout(timeoutId)
            outerResolve({ status: 'completed', cctxs: cctxData.CrossChainTxs, progress })
            return
          }
          
          // Check if failed
          if (cctx.cctx_status?.status === 'Aborted' || cctx.cctx_status?.status === 'Reverted') {
            console.log('[ZETA][CCTX][POLL] Status is failed - completing', { 
              status: cctx.cctx_status.status,
              errorMessage: cctx.cctx_status.error_message
            })
            done = true
            if (intervalId) clearInterval(intervalId)
            if (timeoutId) clearTimeout(timeoutId)
            outerResolve({ status: 'failed', cctxs: cctxData.CrossChainTxs, progress })
            return
          }
          
          console.log('[ZETA][CCTX][POLL] Status is not final - continuing to poll', { 
            status: cctx.cctx_status?.status,
            progressStatus: progress.status
          })
        } else {
          console.log('[ZETA][CCTX][POLL] No CCTX found yet, continuing to poll...', {
            cctxData,
            hasCrossChainTxs: !!cctxData.CrossChainTxs,
            cctxCount: cctxData.CrossChainTxs?.length || 0
          })
          if (onUpdate) {
            console.log('[ZETA][CCTX][POLL] Calling onUpdate with pending status')
            onUpdate({ 
              cctxs: [], 
              statusText: 'Waiting for cross-chain transaction to be detected...',
              progress: { status: 'pending', confirmations: 0, statusText: 'Pending detection' }
            })
          }
        }
      } catch (error) {
        console.error('[ZETA][CCTX][POLL] Poll error occurred', { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          hash,
          apiUrl
        })
        if (onUpdate) {
          console.log('[ZETA][CCTX][POLL] Calling onUpdate with error status')
          onUpdate({ 
            cctxs: [], 
            statusText: 'Error polling cross-chain status...',
            progress: { status: 'error', confirmations: 0, statusText: 'Polling error' }
          })
        }
      }
    }

    // Start polling immediately
    console.log('[ZETA][CCTX] Starting immediate poll')
    pollCctx()

    // Poll every 3 seconds
    console.log('[ZETA][CCTX] Setting up interval poll every 3 seconds')
    intervalId = setInterval(() => {
      console.log('[ZETA][CCTX] Interval poll triggered', { done, intervalId })
      pollCctx()
    }, 3000)

    // Absolute timeout
    console.log('[ZETA][CCTX] Setting up timeout', { timeoutSeconds })
    timeoutId = setTimeout(() => {
      if (done) {
        console.log('[ZETA][CCTX] Timeout reached but already done')
        return
      }
      console.warn('[ZETA][CCTX] Timeout reached - resolving with timeout status')
      done = true
      if (intervalId) {
        console.log('[ZETA][CCTX] Clearing interval on timeout')
        clearInterval(intervalId)
      }
      outerResolve({ status: 'timeout', cctxs: [] })
    }, timeoutSeconds * 1000)
  })
}

// Parse CCTX response into progress information
async function parseCctxProgress(cctx: any, apiUrl: string): Promise<CctxProgress> {
  console.log('[ZETA][CCTX][PARSE] Starting parseCctxProgress', { 
    cctxKeys: Object.keys(cctx || {}),
    apiUrl,
    hasCctxStatus: !!cctx.cctx_status,
    hasInboundParams: !!cctx.inbound_params,
    hasOutboundParams: !!cctx.outbound_params
  })
  
  const status = cctx.cctx_status?.status || 'pending'
  const inboundParams = cctx.inbound_params || {}
  const outboundParams = cctx.outbound_params?.[0] || {}
  
  console.log('[ZETA][CCTX][PARSE] Extracted basic data', {
    status,
    inboundParamsKeys: Object.keys(inboundParams),
    outboundParamsKeys: Object.keys(outboundParams),
    inboundParams,
    outboundParams
  })
  
  // Get current finalized height for confirmations calculation
  let finalizedHeight = 0
  try {
    console.log('[ZETA][CCTX][PARSE] Fetching TSS data for finalized height', { apiUrl })
    const tssData = await fetchFromApi<{ TSS: { finalizedZetaHeight: string } }>(apiUrl, '/zeta-chain/observer/TSS')
    finalizedHeight = Number(tssData.TSS.finalizedZetaHeight || 0)
    console.log('[ZETA][CCTX][PARSE] TSS data fetched', { tssData, finalizedHeight })
  } catch (error) {
    console.error('[ZETA][CCTX][PARSE] Failed to get finalized height', { error, apiUrl })
  }
  
  const inboundHeight = Number(inboundParams.finalized_zeta_height || 0)
  const confirmations = Math.max(0, finalizedHeight - inboundHeight)
  
  console.log('[ZETA][CCTX][PARSE] Height calculations', {
    finalizedHeight,
    inboundHeight,
    confirmations,
    inboundFinalizedZetaHeight: inboundParams.finalized_zeta_height
  })
  
  // Determine status and status text
  let progressStatus: CctxProgress['status'] = 'pending'
  let statusText = 'Pending'
  
  console.log('[ZETA][CCTX][PARSE] Determining status', {
    status,
    outboundHash: outboundParams.hash,
    txFinalizationStatus: inboundParams.tx_finalization_status,
    errorMessage: cctx.cctx_status?.error_message,
    statusMessage: cctx.cctx_status?.status_message
  })
  
  if (status === 'OutboundMined') {
    progressStatus = 'completed'
    statusText = 'Cross-chain transfer completed'
    console.log('[ZETA][CCTX][PARSE] Status: OutboundMined -> completed')
  } else if (status === 'Aborted' || status === 'Reverted') {
    progressStatus = 'failed'
    statusText = `Transfer ${status.toLowerCase()}: ${cctx.cctx_status?.error_message || cctx.cctx_status?.status_message || 'Unknown error'}`
    console.log('[ZETA][CCTX][PARSE] Status: Failed', { status, statusText })
  } else if (outboundParams.hash) {
    progressStatus = 'outbound_broadcasted'
    statusText = 'Outbound transaction broadcasted'
    console.log('[ZETA][CCTX][PARSE] Status: Outbound broadcasted', { outboundHash: outboundParams.hash })
  } else if (inboundParams.tx_finalization_status === 'Executed') {
    progressStatus = 'inbound_confirmed'
    statusText = 'Inbound transaction confirmed'
    console.log('[ZETA][CCTX][PARSE] Status: Inbound confirmed')
  } else {
    console.log('[ZETA][CCTX][PARSE] Status: Pending (default)')
  }
  
  const result = {
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
  
  console.log('[ZETA][CCTX][PARSE] Final parsed result', result)
  return result
}

// Custom lightweight tracker using Zeta RPC finalized height as confirmations
async function fetchFromApi<T>(api: string, endpoint: string): Promise<T> {
  const fullUrl = `${api}${endpoint}`
  console.log('[ZETA][CCTX][FETCH] Making API request', { api, endpoint, fullUrl })
  
  try {
    const res = await fetch(fullUrl, { cache: 'no-store' })
    console.log('[ZETA][CCTX][FETCH] Response received', { 
      status: res.status, 
      statusText: res.statusText, 
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries())
    })
    
    if (!res.ok) {
      console.error('[ZETA][CCTX][FETCH] HTTP error', { status: res.status, statusText: res.statusText, fullUrl })
      throw new Error(`HTTP ${res.status}`)
    }
    
    const data = await res.json()
    console.log('[ZETA][CCTX][FETCH] JSON parsed successfully', { 
      dataKeys: Object.keys(data || {}),
      dataType: typeof data,
      dataLength: Array.isArray(data) ? data.length : 'not array'
    })
    
    return data as T
  } catch (error) {
    console.error('[ZETA][CCTX][FETCH] Fetch error', { error, fullUrl, api, endpoint })
    throw error
  }
}


export async function trackCrossChainConfirmations(params: {
  hash: string
  network: Network
  minConfirmations?: number
  timeoutSeconds?: number
  onProgress?: (p: { confirmations: number; status?: string; progress?: CctxProgress }) => void
}): Promise<{ status: 'completed' | 'failed' | 'timeout'; confirmations: number; cctx?: any; progress?: CctxProgress }> {
  console.log('[ZETA][CCTX][CONF] Starting trackCrossChainConfirmations', { params })
  const { hash, network, minConfirmations = 20, timeoutSeconds = 300, onProgress } = params
  const apiUrl = network === 'mainnet' 
    ? 'https://zetachain.blockpi.network/lcd/v1/public' 
    : 'https://zetachain-athens.blockpi.network/lcd/v1/public'
  const start = Date.now()
  console.log('[ZETA][CCTX][CONF] Configuration', { 
    hash, 
    network, 
    minConfirmations, 
    timeoutSeconds, 
    apiUrl,
    startTime: new Date(start).toISOString()
  })

  let pollCount = 0
  while (Date.now() - start < timeoutSeconds * 1000) {
    pollCount++
    const elapsed = Date.now() - start
    console.log('[ZETA][CCTX][CONF] Poll cycle start', { 
      pollCount, 
      elapsed, 
      remaining: timeoutSeconds * 1000 - elapsed,
      hash 
    })
    
    try {
      // Use inboundHashToCctxData instead of direct CCTX lookup
      const endpoint = `/zeta-chain/crosschain/inboundHashToCctxData/${hash}`
      console.log('[ZETA][CCTX][CONF] Fetching CCTX data', { endpoint, fullUrl: `${apiUrl}${endpoint}` })
      
      const cctxData = await fetchFromApi<{ CrossChainTxs: any[] }>(apiUrl, endpoint)
      
      console.log('[ZETA][CCTX][CONF] CCTX data received', {
        hasCrossChainTxs: !!cctxData.CrossChainTxs,
        cctxCount: cctxData.CrossChainTxs?.length || 0,
        cctxDataKeys: Object.keys(cctxData || {}),
        pollCount
      })
      
      if (cctxData.CrossChainTxs && cctxData.CrossChainTxs.length > 0) {
        const cctx = cctxData.CrossChainTxs[0]
        console.log('[ZETA][CCTX][CONF] Processing CCTX', {
          cctxKeys: Object.keys(cctx || {}),
          cctxStatus: cctx.cctx_status,
          inboundParams: cctx.inbound_params,
          outboundParams: cctx.outbound_params,
          pollCount
        })
        
        const progress = await parseCctxProgress(cctx, apiUrl)
        
        console.log('[ZETA][CCTX][CONF] Progress parsed', {
          progressStatus: progress.status,
          confirmations: progress.confirmations,
          statusText: progress.statusText,
          cctxStatus: cctx.cctx_status?.status,
          pollCount
        })
        
        if (onProgress) {
          console.log('[ZETA][CCTX][CONF] Calling onProgress callback', {
            confirmations: progress.confirmations,
            status: cctx.cctx_status?.status,
            progressStatus: progress.status,
            pollCount
          })
          onProgress({ 
            confirmations: progress.confirmations, 
            status: cctx.cctx_status?.status,
            progress 
          })
        }
        
        console.log('[ZETA][CCTX][CONF] Checking completion conditions', { 
          finalized: progress.finalizedHeight, 
          inboundHeight: progress.inboundHeight, 
          confirmations: progress.confirmations, 
          status: cctx.cctx_status?.status,
          minConfirmations,
          isAborted: cctx.cctx_status?.status === 'Aborted',
          isReverted: cctx.cctx_status?.status === 'Reverted',
          isOutboundMined: cctx.cctx_status?.status === 'OutboundMined',
          hasMinConfirmations: progress.confirmations >= minConfirmations,
          pollCount
        })

        if (cctx.cctx_status?.status === 'Aborted' || cctx.cctx_status?.status === 'Reverted') {
          console.log('[ZETA][CCTX][CONF] Status is failed - returning failed', {
            status: cctx.cctx_status.status,
            confirmations: progress.confirmations,
            pollCount
          })
          return { status: 'failed', confirmations: progress.confirmations, cctx, progress }
        }
        if (cctx.cctx_status?.status === 'OutboundMined' || progress.confirmations >= minConfirmations) {
          console.log('[ZETA][CCTX][CONF] Status is completed - returning completed', {
            status: cctx.cctx_status?.status,
            confirmations: progress.confirmations,
            minConfirmations,
            isOutboundMined: cctx.cctx_status?.status === 'OutboundMined',
            hasMinConfirmations: progress.confirmations >= minConfirmations,
            pollCount
          })
          return { status: 'completed', confirmations: progress.confirmations, cctx, progress }
        }
        
        console.log('[ZETA][CCTX][CONF] Not completed yet - continuing to poll', {
          status: cctx.cctx_status?.status,
          confirmations: progress.confirmations,
          minConfirmations,
          pollCount
        })
      } else {
        console.log('[ZETA][CCTX][CONF] No CCTX found yet', {
          cctxData,
          hasCrossChainTxs: !!cctxData.CrossChainTxs,
          cctxCount: cctxData.CrossChainTxs?.length || 0,
          pollCount
        })
        if (onProgress) {
          console.log('[ZETA][CCTX][CONF] Calling onProgress with pending status', { pollCount })
          onProgress({ 
            confirmations: 0, 
            status: 'pending',
            progress: { status: 'pending', confirmations: 0, statusText: 'Waiting for CCTX detection' }
          })
        }
      }
    } catch (error) {
      console.error('[ZETA][CCTX][CONF] Poll error occurred', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        hash,
        apiUrl,
        pollCount,
        elapsed: Date.now() - start
      })
    }
    
    console.log('[ZETA][CCTX][CONF] Waiting 3 seconds before next poll', { pollCount })
    await new Promise(r => setTimeout(r, 3000))
  }
  
  console.warn('[ZETA][CCTX][CONF] Timeout reached', { 
    timeoutSeconds, 
    elapsed: Date.now() - start,
    pollCount
  })
  return { status: 'timeout', confirmations: 0 }
}

