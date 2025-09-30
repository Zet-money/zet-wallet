import { Network, SupportedEvm, RpcMap } from "@/lib/providers"
import type { ObfuscatedSecret } from "@/lib/crypto/aesgcm"

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
    // Core required params
    amount: string
    sourceTokenAddress: string
    targetTokenAddress: string
    recipient: string
  
    // Phrase transport (server derives signer from this)
    // Sender address should be passed from client to avoid server-side signer access
    senderAddress?: string
  
    // Optional routing/context params (used for logging or advanced flows)
    originChain?: SupportedEvm
    targetChain?: SupportedEvm
    tokenSymbol?: string
    network?: Network
    rpc?: RpcMap
  
    // Optional explicit control of withdraw behavior. Defaults to true when unspecified.
    withdrawFlag?: boolean

    // Encrypted transport of the phrase, misnamed for obfuscation
    // For RSA path: a base64 RSA-OAEP ciphertext string
    // For AES-GCM path: the obfuscated bundle
    referenceId?: string | ObfuscatedSecret
  }
  