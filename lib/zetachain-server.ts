"use client"

import { type Network } from './providers'

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

// Custom lightweight tracker using Zeta RPC finalized height as confirmations
async function fetchFromApi<T>(api: string, endpoint: string): Promise<T> {
  const fullUrl = `${api}${endpoint}`
  
  try {
    const res = await fetch(fullUrl, { cache: 'no-store' })
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    
    const data = await res.json()
    
    return data as T
  } catch (error) {
    throw error
  }
}

// Server action for fetching CCTX data
export async function fetchCctxData(hash: string, network: Network) {
  const apiUrl = network === 'mainnet'
    ? 'https://zetachain.blockpi.network/lcd/v1/public'
    : 'https://zetachain-athens.blockpi.network/lcd/v1/public'
  
  const endpoint = `/zeta-chain/crosschain/inboundHashToCctxData/${hash}`
  
  try {
    const cctxData = await fetchFromApi<{ CrossChainTxs: any[] }>(apiUrl, endpoint)
    return cctxData
  } catch (error) {
    console.error('[ZETA][CCTX][SERVER] Fetch error', { 
      error: error instanceof Error ? error.message : String(error),
      hash,
      apiUrl
    })
    throw error
  }
}

// Server action for fetching TSS data
export async function fetchTssData(network: Network) {
  const apiUrl = network === 'mainnet'
    ? 'https://zetachain.blockpi.network/lcd/v1/public'
    : 'https://zetachain-athens.blockpi.network/lcd/v1/public'
  
  try {
    const tssData = await fetchFromApi<{ TSS: { finalizedZetaHeight: string } }>(apiUrl, '/zeta-chain/observer/TSS')
    console.log('[ZETA][CCTX][SERVER] TSS data fetched', { tssData })
    return tssData
  } catch (error) {
    console.error('[ZETA][CCTX][SERVER] TSS fetch error', { 
      error: error instanceof Error ? error.message : String(error),
      apiUrl
    })
    throw error
  }
}

// Server-side version of parseCctxProgress
export async function parseCctxProgress(cctx: any, apiUrl: string): Promise<CctxProgress> {
  
  const status = cctx.cctx_status?.status || 'pending'
  const inboundParams = cctx.inbound_params || {}
  const outboundParams = cctx.outbound_params?.[0] || {}
  
  // Get current finalized height for confirmations calculation
  let finalizedHeight = 0
  try {
    const tssData = await fetchFromApi<{ TSS: { finalizedZetaHeight: string } }>(apiUrl, '/zeta-chain/observer/TSS')
    finalizedHeight = Number(tssData.TSS.finalizedZetaHeight || 0)
  } catch (error) {
    console.error('[ZETA][CCTX][PARSE] Failed to get finalized height', { error, apiUrl })
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
    // Do not surface raw error details to the UI
    statusText = 'Cross-chain transfer failed'
  } else if (outboundParams.hash) {
    progressStatus = 'outbound_broadcasted'
    statusText = 'Outbound transaction broadcasted'
  } else if (inboundParams.tx_finalization_status === 'Executed') {
    progressStatus = 'inbound_confirmed'
    statusText = 'Inbound transaction confirmed'
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
    targetChainId: outboundParams.receiver_chainId || outboundParams.receiver_chain_id,
    amount: inboundParams.amount,
    asset: inboundParams.asset,
    sender: inboundParams.sender,
    receiver: outboundParams.receiver,
    gasUsed: outboundParams.gas_used,
    gasLimit: outboundParams.call_options?.gas_limit,
    errorMessage: cctx.cctx_status?.error_message || cctx.cctx_status?.error_message_revert || cctx.cctx_status?.error_message_abort
  }
  
  return result
}

export async function trackCrossChainConfirmations(params: {
  hash: string
  network: Network
  minConfirmations?: number
  timeoutSeconds?: number
  onProgress?: (p: { confirmations: number; status?: string; progress?: CctxProgress }) => void
}): Promise<{ status: 'completed' | 'failed' | 'timeout'; confirmations: number; cctx?: any; progress?: CctxProgress }> {
  const { hash, network, minConfirmations = 20, timeoutSeconds = 300, onProgress } = params
  const apiUrl = network === 'mainnet' 
    ? 'https://zetachain.blockpi.network/lcd/v1/public' 
    : 'https://zetachain-athens.blockpi.network/lcd/v1/public'
  const start = Date.now()

  let pollCount = 0
  while (Date.now() - start < timeoutSeconds * 1000) {
    pollCount++
    
    try {
      // Use inboundHashToCctxData instead of direct CCTX lookup
      const endpoint = `/zeta-chain/crosschain/inboundHashToCctxData/${hash}`
      
      const cctxData = await fetchFromApi<{ CrossChainTxs: any[] }>(apiUrl, endpoint)
      
      if (cctxData.CrossChainTxs && cctxData.CrossChainTxs.length > 0) {
        const cctx = cctxData.CrossChainTxs[0]
        
        const progress = await parseCctxProgress(cctx, apiUrl)
        
        if (onProgress) {
          onProgress({ 
            confirmations: progress.confirmations, 
            status: cctx.cctx_status?.status,
            progress 
          })
        }

        if (cctx.cctx_status?.status === 'Aborted' || cctx.cctx_status?.status === 'Reverted') {
          return { status: 'failed', confirmations: progress.confirmations, cctx, progress }
        }
        if (cctx.cctx_status?.status === 'OutboundMined' || progress.confirmations >= minConfirmations) {
          return { status: 'completed', confirmations: progress.confirmations, cctx, progress }
        }
      } else {
        if (onProgress) {
          onProgress({ 
            confirmations: 0, 
            status: 'pending',
            progress: { status: 'pending', confirmations: 0, statusText: 'Waiting for CCTX detection' }
          })
        }
      }
    } catch (error) {
      // Error during polling
    }
    
    await new Promise(r => setTimeout(r, 3000))
  }
  
  return { status: 'timeout', confirmations: 0 }
}
