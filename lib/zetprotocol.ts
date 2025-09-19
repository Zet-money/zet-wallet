import { evmDepositAndCall } from '@zetachain/toolkit/chains'
import { getFees } from '@zetachain/toolkit/query'
import { ContractTransactionResponse } from 'ethers'
import { getEvmSignerFromPhrase, type SupportedEvm, type Network, type RpcMap } from './providers'

// ZetProtocol contract address on ZetaChain testnet
export const ZETPROTOCOL_ADDRESS = '0x7689b1a47fb4c5F16aBA476E4D315b8421CAebD2'

// Transfer types matching the Solidity enum
export enum TransferType {
  DIRECT_TRANSFER = 0,
  CROSS_CHAIN_SWAP = 1,
  SAME_CHAIN_SWAP = 2
}

// Message structure for ZetProtocol
export type ZetProtocolMessage = {
  targetToken: string
  recipient: string
  withdrawFlag: boolean
  targetChainId: number
  transferType: TransferType
}

// Enhanced deposit parameters for ZetProtocol
export type ZetProtocolDepositParams = {
  originChain: SupportedEvm
  targetChain: SupportedEvm
  amount: string
  tokenSymbol: string
  sourceTokenAddress: string
  targetTokenAddress: string
  recipient: string
  mnemonicPhrase: string
  network: Network
  rpc?: RpcMap
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
export async function performCrossChainTransfer({
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
}: ZetProtocolDepositParams): Promise<ContractTransactionResponse> {
  const signer = getEvmSignerFromPhrase(mnemonicPhrase, originChain, network, rpc)
  
  // Detect transfer type
  const transferType = await detectTransferType(tokenSymbol, originChain, targetChain)
  
  // Prepare ABI params expected by the deployed Universal/Swap contract: (address targetTokenZRC20, bytes recipient, bool withdraw)
  const withdrawFlag = transferType !== TransferType.SAME_CHAIN_SWAP
  const types = ['address', 'bytes', 'bool']
  const recipientBytes = recipient.startsWith('0x') ? recipient : `0x${recipient}`
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
  
  // Call ZetProtocol contract
  const senderAddress = await signer.getAddress()
  
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
      revertAddress: senderAddress,
      abortAddress: senderAddress,
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
    
    return tx
  } catch (error) {
    console.error('Error in evmDepositAndCall:', error)
    // If the error is related to token contract calls, provide more specific error message
    if (error instanceof Error && error.message.includes('missing revert data')) {
      throw new Error(`Token contract call failed. The token contract at ${sourceTokenAddress} may not exist or may not be a valid ERC-20 token on this network. Please verify the token address and network.`)
    }
    throw error
  }
}

/**
 * Performs a direct transfer (same token, different chains)
 */
export async function performDirectTransfer(params: ZetProtocolDepositParams): Promise<ContractTransactionResponse> {
  return await performCrossChainTransfer(params)
}

/**
 * Performs a cross-chain swap (different tokens, different chains)
 */
export async function performCrossChainSwap(params: ZetProtocolDepositParams): Promise<ContractTransactionResponse> {
  return await performCrossChainTransfer(params)
}

/**
 * Performs a same-chain swap (different tokens, same chain)
 */
export async function performSameChainSwap(params: ZetProtocolDepositParams): Promise<ContractTransactionResponse> {
  return await performCrossChainTransfer(params)
}
