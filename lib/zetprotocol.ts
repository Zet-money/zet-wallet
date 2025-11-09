'use server'

import { evmDepositAndCall } from '@zetachain/toolkit/chains'
import { PublicKey } from '@solana/web3.js'
import { type Signer } from 'ethers'
import { getEvmSignerFromPhrase, type SupportedEvm, type Network, type RpcMap } from './providers'
import { ZetProtocolDepositParams, TransferType } from '@/types/server'
import { decryptMnemonicObfuscated, type PasswordParams } from '@/lib/crypto/aesgcm'
import { rsaDecryptToString } from '@/lib/crypto/rsa'
import { CHAIN_IDS_BY_NETWORK } from './zetachain'

// ZetProtocol contract address on ZetaChain testnet
const ZETPROTOCOL_ADDRESS = '0x7689b1a47fb4c5F16aBA476E4D315b8421CAebD2'

// No token address maps here; addresses are provided by callers from lib/tokens.ts

/**
 * Detects the transfer type based on source and target tokens/chains
 */
export async function detectTransferType(
  tokenSymbol: string,
  sourceChain: SupportedEvm,
  targetChain: SupportedEvm
): Promise<TransferType> {
  // Same token symbol, different chains = Direct Transfer
  if (sourceChain !== targetChain) {
    return TransferType.DIRECT_TRANSFER
  }
  
  // Different tokens, different chains = Cross-chain Swap
  // If same chain and user selected different token symbol, it's SAME_CHAIN_SWAP
  return TransferType.SAME_CHAIN_SWAP
}

/**
 * Creates a ZetProtocol message for cross-chain transfers
 * This matches the Solidity ABI encoding expected by the contract
 */
export async function createZetProtocolMessage(params: {
  targetToken: string
  recipient: string
  targetChain: SupportedEvm
  transferType: TransferType
  network: Network
}): Promise<string> {
  const { targetToken, recipient, targetChain, transferType, network } = params
  
  // Convert recipient to bytes (Ethereum address format)
  const recipientBytes = recipient.startsWith('0x') ? recipient.slice(2) : recipient
  const recipientBuffer = Buffer.from(recipientBytes, 'hex')
  
  // Create the message structure that matches the Solidity contract
  const message = {
    targetToken,
    recipient: recipientBuffer,
    withdrawFlag: transferType !== TransferType.SAME_CHAIN_SWAP,
    targetChainId: CHAIN_IDS_BY_NETWORK[network][targetChain],
    transferType
  }
  
  // For now, return a simple JSON string
  // In production, this should be properly ABI encoded
  return JSON.stringify({
    targetToken,
    recipient: recipientBytes,
    withdrawFlag: message.withdrawFlag,
    targetChainId: message.targetChainId,
    transferType
  })
}

/**
 * Performs a cross-chain transfer using ZetProtocol
 */
export async function performCrossChainTransfer(
  params: ZetProtocolDepositParams
): Promise<{ hash: string }> {
  return performCrossChainTransferWithRetry(params);
}

/**
 * Internal implementation with automatic retry logic for allowance and nonce errors
 */
async function performCrossChainTransferWithRetry(
  params: ZetProtocolDepositParams,
  attemptNumber: number = 1,
  maxAttempts: number = 5
): Promise<{ hash: string }> {
  try {
    return await performCrossChainTransferInternal(params);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    const isRetryableError = 
      errorMessage.includes('nonce') || 
      errorMessage.includes('allowance') || 
      errorMessage.includes('approval') ||
      errorMessage.includes('transfer amount exceeds') ||
      errorMessage.includes('replacement fee too low');
    
    if (isRetryableError && attemptNumber < maxAttempts) {
      console.log(`[performCrossChainTransfer] Retryable error on attempt ${attemptNumber}/${maxAttempts}: ${errorMessage}`);
      console.log(`[performCrossChainTransfer] Waiting ${attemptNumber * 2} seconds before retry...`);
      
      // Wait progressively longer between retries
      await new Promise(resolve => setTimeout(resolve, attemptNumber * 2000));
      
      console.log(`[performCrossChainTransfer] Retrying (attempt ${attemptNumber + 1}/${maxAttempts})...`);
      return performCrossChainTransferWithRetry(params, attemptNumber + 1, maxAttempts);
    }
    
    // If not retryable or max attempts reached, throw user-friendly error
    if (attemptNumber >= maxAttempts && isRetryableError) {
      throw new Error(
        `Transaction failed after ${maxAttempts} attempts. This usually happens due to network congestion or approval delays. Please wait a moment and try again. If the issue persists, contact support.`
      );
    }
    
    throw error;
  }
}

/**
 * Internal implementation of cross-chain transfer
 */
async function performCrossChainTransferInternal({
  originChain,
  amount,
  targetChain,
  tokenSymbol,
  sourceTokenAddress,
  targetTokenAddress,
  recipient,
  senderAddress,
  referenceId,
  network,
  rpc,
  withdrawFlag: explicitWithdrawFlag,
}: ZetProtocolDepositParams): Promise<{ hash: string }> {
  let signer: Signer
  if ((referenceId) && originChain && network) {
    let phrase: string | undefined
    if (referenceId) {
      if (typeof referenceId === 'string') {
        // RSA path: decrypt with server private key from env
        const priv = process.env.SERVER_ENC_PRIV as string | undefined
        if (!priv) throw new Error('Missing SERVER_ENC_PRIV for RSA decryption')
        phrase = await rsaDecryptToString(referenceId, priv)
      } else {
        // AES-GCM obfuscated path
        const passwordParams: PasswordParams = {
          tokenSymbol: tokenSymbol || '',
          amount,
          sender: senderAddress || '',
          recipient,
          targetChain: (targetChain as unknown as string) || '',
        }
        phrase = await decryptMnemonicObfuscated(referenceId, passwordParams)
      }
    }
    if (!phrase) throw new Error('Missing mnemonic phrase for signer derivation')
    signer = getEvmSignerFromPhrase(phrase, originChain, network, rpc)
  } else {
    throw new Error('performCrossChainTransfer: referenceId with (originChain, network) must be provided')
  }
  
  // Detect transfer type
  let transferType = TransferType.DIRECT_TRANSFER
  try {
    if (tokenSymbol && originChain && targetChain) {
      transferType = await detectTransferType(tokenSymbol, originChain, targetChain)
    }
  } catch (_) {
    // noop - fallback to default
  }
  
  // Prepare ABI params expected by the deployed Universal/Swap contract: (address targetTokenZRC20, bytes recipient, bool withdraw)
  const withdrawFlag = typeof explicitWithdrawFlag === 'boolean' ? explicitWithdrawFlag : (transferType !== TransferType.SAME_CHAIN_SWAP)
  const types = ['address', 'bytes', 'bool']
  // Encode recipient according to target chain requirements:
  // - Solana: encode the base58 string as UTF-8 bytes (some observers expect string-bytes)
  //           fallback is raw 32-byte pubkey if utf-8 route fails
  // - EVM: ensure 0x-prefixed hex string
  let recipientBytes: string
  if ((targetChain as any) === 'solana') {
    try {
      const utf8Bytes = Buffer.from(recipient, 'utf8')
      recipientBytes = `0x${utf8Bytes.toString('hex')}`
      console.log('[ZetProtocol] Solana recipient encoded (utf8 bytes)', { len: utf8Bytes.length })
    } catch (e) {
      const pkBytes = Buffer.from(new PublicKey(recipient).toBytes())
      recipientBytes = `0x${pkBytes.toString('hex')}`
      console.log('[ZetProtocol] Solana recipient encoded (pubkey bytes fallback)', { len: pkBytes.length })
    }
  } else {
    recipientBytes = recipient.startsWith('0x') ? recipient : `0x${recipient}`
  }
  const values = [
    targetTokenAddress, // ZRC-20 on ZetaChain representing the destination asset/chain
    recipientBytes,
    withdrawFlag,
  ]
  
  console.log('ZetProtocol Transfer Details:', {
    originChain,
    targetChain,
    sourceTokenAddress,
    targetTokenAddress,
    amount,
    recipient,
    transferType: TransferType[transferType as unknown as keyof typeof TransferType],
    network,
    withdrawFlag
  })
  
  // Sender address is provided from client to avoid server-side access to signer
  const resolvedSender = senderAddress || '0x0000000000000000000000000000000000000000'
  
  // Check if this is a native token (zero address)
  const isNativeToken = sourceTokenAddress === '0x0000000000000000000000000000000000000000'
  
  // Prepare the deposit parameters
  const depositParams: any = {
    amount,
    receiver: ZETPROTOCOL_ADDRESS, // Send to ZetProtocol contract
    types,
    values,
    revertOptions: {
      callOnRevert: false,
      revertMessage: 'ZetProtocol: Cross-chain transfer failed',
      revertAddress: resolvedSender,
      abortAddress: resolvedSender,
      onRevertGasLimit: '500000',
    }
  }
  
  // Only include token parameter for ERC-20 tokens, not native tokens
  if (!isNativeToken) {
    depositParams.token = sourceTokenAddress
  }
  
  console.log('Deposit parameters:', {
    isNativeToken,
    sourceTokenAddress,
    depositParams
  })
  
  try {
    const tx = await evmDepositAndCall(depositParams, { signer })
    return { hash: tx.hash }
  } catch (error) {
    console.error('Error in evmDepositAndCall:', error)
    // If the error is related to token contract calls, provide more specific error message
    if (error instanceof Error && error.message.includes('missing revert data')) {
      throw new Error(`Token contract call failed. The token contract at ${sourceTokenAddress} may not exist or may not be a valid ERC-20 token on this network. Please verify the token address and network.`)
    }
    // Handle Avalanche RPC compatibility issues
    if (error instanceof Error && error.message.includes('eth_getTransactionCount')) {
      throw new Error(`RPC compatibility issue with Avalanche. The RPC endpoint may not support all required Ethereum methods. Please try again or contact support if the issue persists.`)
    }
    throw error
  }
}

/**
 * Performs a direct transfer (same token, different chains)
 */
export async function performDirectTransfer(params: ZetProtocolDepositParams): Promise<{ hash: string }> {
  return await performCrossChainTransfer(params)
}

/**
 * Performs a cross-chain swap (different tokens, different chains)
 */
export async function performCrossChainSwap(params: ZetProtocolDepositParams): Promise<{ hash: string }> {
  return await performCrossChainTransfer(params)
}

/**
 * Performs a same-chain swap (different tokens, same chain)
 */
export async function performSameChainSwap(params: ZetProtocolDepositParams): Promise<{ hash: string }> {
  return await performCrossChainTransfer(params)
}
