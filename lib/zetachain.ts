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
 * Track cross-chain transaction using ZetaChain Toolkit's built-in tracking
 */
export async function trackCrossChainTransaction(params: {
  hash: string
  network: Network
  timeoutSeconds?: number
  onUpdate?: (args: { cctxs: any; statusText?: string }) => void
}): Promise<{ 
  status: 'completed' | 'failed' | 'timeout' | 'pending'
  cctxs?: any
  error?: string
}> {
  const { hash, network, timeoutSeconds = 300, onUpdate } = params
  console.log('[ZETA][CCTX] Tracking cross-chain transaction', { hash, network, timeoutSeconds })
  

  // Endpoints
  const apiUrl = network === 'mainnet'
    ? 'https://api.zetachain.network'
    : 'https://api.athens.zetachain.network'
  const tss = network === 'mainnet'
    ? 'https://tss.zetachain.network'
    : 'https://tss.athens.zetachain.network'

  // Toolkit transaction state shape
  type TransactionState = {
    cctxs: Record<string, any[]>
    pendingNonces: any[]
    pollCount: number
    spinners: Record<string, boolean>
  }

  const state: TransactionState = {
    cctxs: {},
    pendingNonces: [],
    pollCount: 0,
    spinners: {},
  }

  return await new Promise((outerResolve) => {
    let done = false
    let intervalId: NodeJS.Timeout | undefined
    let timeoutId: NodeJS.Timeout | undefined

    // Minimal emitter to surface updates to UI
    const emitter = {
      emit: (event: string, payload: any) => {
        try {
          if (event && payload?.text) {
            console.log('[ZETA][CCTX][EMIT]', event, payload.text)
          }
          if (onUpdate) {
            const statusText = typeof payload?.text === 'string' ? payload.text : undefined
            onUpdate({ cctxs: state.cctxs, statusText })
          }
        } catch {}
      }
    } as any

    const resolve = (cctxs: any) => {
      console.log('[ZETA][CCTX] Completed with success')
      if (done) return
      done = true
      if (intervalId) clearInterval(intervalId)
      if (timeoutId) clearTimeout(timeoutId)
      outerResolve({ status: 'completed', cctxs })
    }
    const reject = (err: Error) => {
      console.error('[ZETA][CCTX] Failed', err?.message)
      if (done) return
      done = true
      if (intervalId) clearInterval(intervalId)
      if (timeoutId) clearTimeout(timeoutId)
      outerResolve({ status: 'failed', error: err.message })
    }

    // Kickoff immediate poll
    console.log('[ZETA][CCTX] Start polling', { apiUrl, tss, hash, timeoutSeconds })
    pollTransactions({
      api: apiUrl,
      hash,
      tss,
      state,
      emitter,
      json: true,
      timeoutSeconds,
      resolve,
      reject,
      intervalId,
      timeoutId,
    })

    // Interval poll every 3s
    intervalId = setInterval(() => {
      if (done) return
      // increment poll count for elapsed time calculation inside toolkit
      state.pollCount += 1
      console.log('[ZETA][CCTX] Tick', { pollCount: state.pollCount })
      pollTransactions({
        api: apiUrl,
        hash,
        tss,
        state,
        emitter,
        json: true,
        timeoutSeconds,
        resolve,
        reject,
        intervalId,
        timeoutId,
      })
    }, 3000)

    // Absolute timeout
    timeoutId = setTimeout(() => {
      if (done) return
      console.warn('[ZETA][CCTX] Timeout reached')
      done = true
      if (intervalId) clearInterval(intervalId)
      outerResolve({ status: 'timeout', cctxs: state.cctxs })
    }, timeoutSeconds * 1000)
  })
}

// Custom lightweight tracker using Zeta RPC finalized height as confirmations
async function fetchFromApi<T>(api: string, endpoint: string): Promise<T> {
  const res = await fetch(`${api}${endpoint}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

type TssResponse = { TSS: { finalizedZetaHeight: string } }
type CrossChainTxResponse = { CrossChainTx: any }

async function getFinalizedHeight(api: string): Promise<number | null> {
  try {
    const data = await fetchFromApi<TssResponse>(api, `/zeta-chain/observer/TSS`)
    return Number(data.TSS.finalizedZetaHeight || 0)
  } catch {
    return null
  }
}

async function getCctx(api: string, hash: string): Promise<any | null> {
  try {
    const data = await fetchFromApi<CrossChainTxResponse>(api, `/zeta-chain/crosschain/cctx/${hash}`)
    return data.CrossChainTx
  } catch {
    return null
  }
}

export async function trackCrossChainConfirmations(params: {
  hash: string
  network: Network
  minConfirmations?: number
  timeoutSeconds?: number
  onProgress?: (p: { confirmations: number; status?: string }) => void
}): Promise<{ status: 'completed' | 'failed' | 'timeout'; confirmations: number; cctx?: any }> {
  const { hash, network, minConfirmations = 20, timeoutSeconds = 300, onProgress } = params
  const apiUrl = network === 'mainnet' ? 'https://api.zetachain.network' : 'https://api.athens.zetachain.network'
  const start = Date.now()
  console.log('[ZETA][CCTX][CONF] Start', { hash, minConfirmations, timeoutSeconds })

  while (Date.now() - start < timeoutSeconds * 1000) {
    const [finalized, cctx] = await Promise.all([
      getFinalizedHeight(apiUrl),
      getCctx(apiUrl, hash),
    ])
    if (!cctx || finalized == null) {
      await new Promise(r => setTimeout(r, 3000))
      continue
    }
    const inboundHeight = Number(cctx?.inbound_params?.finalized_zeta_height || 0)
    const confirmations = Math.max(0, finalized - inboundHeight)
    const status: string | undefined = cctx?.cctx_status?.status
    if (onProgress) onProgress({ confirmations, status })
    console.log('[ZETA][CCTX][CONF] tick', { finalized, inboundHeight, confirmations, status })

    if (status === 'Aborted' || status === 'Reverted') {
      return { status: 'failed', confirmations, cctx }
    }
    if (status === 'OutboundMined' || confirmations >= minConfirmations) {
      return { status: 'completed', confirmations, cctx }
    }
    await new Promise(r => setTimeout(r, 3000))
  }
  console.warn('[ZETA][CCTX][CONF] timeout')
  return { status: 'timeout', confirmations: 0 }
}

