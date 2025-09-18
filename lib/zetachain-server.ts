"use server"

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

// Server action for fetching CCTX data
export async function fetchCctxData(hash: string, network: Network) {
  const apiUrl = network === 'mainnet'
    ? 'https://zetachain.blockpi.network/lcd/v1/public'
    : 'https://zetachain-athens.blockpi.network/lcd/v1/public'
  
  const endpoint = `/zeta-chain/crosschain/inboundHashToCctxData/${hash}`
  console.log('[ZETA][CCTX][SERVER] Fetching CCTX data', { endpoint, fullUrl: `${apiUrl}${endpoint}` })
  
  try {
    const cctxData = await fetchFromApi<{ CrossChainTxs: any[] }>(apiUrl, endpoint)
    console.log('[ZETA][CCTX][SERVER] CCTX data received', {
      hasCrossChainTxs: !!cctxData.CrossChainTxs,
      cctxCount: cctxData.CrossChainTxs?.length || 0,
      cctxDataKeys: Object.keys(cctxData || {})
    })
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
