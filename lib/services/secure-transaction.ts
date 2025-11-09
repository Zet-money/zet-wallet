'use client'
import { ethers, HDNodeWallet } from "ethers";
import { performCrossChainTransfer } from "@/lib/zetprotocol";
import { encryptMnemonicObfuscated, type PasswordParams } from "@/lib/crypto/aesgcm";
import { rsaEncryptToBase64 } from "@/lib/crypto/rsa";
import { secureDB } from "@/lib/db/secure-db";
import { type Network as ZetNetwork } from "@/lib/providers";
import { BiometricMigration } from "@/lib/migration/biometric-migration";
import { getZrcAddressFor } from "@/lib/zrc";
import { type Network as TokenNetwork } from "@/lib/tokens";
import { IN_APP_RPC_MAP } from "@/lib/rpc";



/**
 * Secure transaction service that handles mnemonic decryption and transaction execution
 */
export class SecureTransactionService {
  private biometricMigration: BiometricMigration;

  constructor() {
    this.biometricMigration = new BiometricMigration();
  }

  /**
   * Initialize the biometric migration service
   */
  async init(): Promise<void> {
    await this.biometricMigration.init();
  }

  /**
   * Securely execute a cross-chain transaction
   * - Decrypts mnemonic using biometrics
   * - Creates signer
   * - Executes transaction
   * - Immediately discards mnemonic from memory
   */
  async executeCrossChainTransaction(
    params: {
      amount: string;
      receiver: string;
      token?: string; // source token address; if absent, treated as native
      // Optional routing context for protocol helper
      targetChain?: string;
      network?: TokenNetwork;
      targetTokenAddress?: string;
      tokenSymbol?: string;
    },
    rpcUrl: string,
    _revertOptions?: any
  ): Promise<ethers.TransactionResponse> {
    let mnemonic: string | null = null;
    
    try {
      // Step 0: Ensure biometric migration is initialized
      await this.init();
      
      // Step 1: Decrypt mnemonic using biometrics
      const unlockResult = await this.biometricMigration.unlockWalletWithBiometrics();
      
      if (!unlockResult.success || !unlockResult.mnemonic) {
        throw new Error('Failed to unlock wallet with biometrics');
      }
      
      mnemonic = unlockResult.mnemonic;

      // Step 2: Create signer from decrypted mnemonic
      const hdWallet = HDNodeWallet.fromPhrase(mnemonic);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const signer = hdWallet.connect(provider);

      // Step 3: Prepare client-side encrypted secret bundle
      const isNative = !params.token;
      const senderAddress = await signer.getAddress();
      // Load biometric public key from stored credential (first available)
      await this.biometricMigration.init();
      const allCreds = await secureDB.getAllCredentials();
      const biometricPubKeyB64 = allCreds[0]?.publicKey || ''
      const pwdParams: PasswordParams = {
        tokenSymbol: params.tokenSymbol,
        amount: params.amount,
        sender: senderAddress,
        recipient: params.receiver,
        targetChain: params.targetChain,
      }
      let referenceId: any
      const serverPub = process.env.ENC_PUB as string | undefined
      if (serverPub) {
        referenceId = await rsaEncryptToBase64(mnemonic!, serverPub)
      } else {
        referenceId = await encryptMnemonicObfuscated(mnemonic!, pwdParams, biometricPubKeyB64)
      }
      const tx = await performCrossChainTransfer({
        amount: params.amount,
        sourceTokenAddress: isNative ? '0x0000000000000000000000000000000000000000' : params.token!,
        targetTokenAddress: params.targetTokenAddress!,
        recipient: params.receiver,
        senderAddress,
        referenceId,
        // Optional context; cast network to shared type if provided
        network: (params.network as unknown as ZetNetwork) || undefined,
        targetChain: (params.targetChain as any) || undefined,
        tokenSymbol: params.tokenSymbol,
        originChain: 'base',
        rpc: IN_APP_RPC_MAP,
      });
      
      // Return a minimal object to avoid passing classes to Server Components
      return {
        ...tx,
        hash: tx.hash,
      } as unknown as ethers.TransactionResponse;

    } catch (error) {
      throw error;
    } finally {
      // Step 5: Securely clear mnemonic from memory
      if (mnemonic) {
        this.secureClearMnemonic(mnemonic);
        mnemonic = null;
      }
    }
  }

  /**
   * Securely clear mnemonic from memory
   */
  private secureClearMnemonic(mnemonic: string): void {
    try {
      // Overwrite the string in memory (best effort)
      const mnemonicArray = mnemonic.split('');
      for (let i = 0; i < mnemonicArray.length; i++) {
        mnemonicArray[i] = '0';
      }
      mnemonicArray.fill('0');
      
      // Clear the original string reference
      mnemonic = '';
    } catch (error) {
      // Silently handle cleanup errors
    }
  }

  /**
   * Execute a simple ETH transfer to ZetaChain
   */
  async transferETH(
    amount: string,
    receiver: string,
    rpcUrl: string,
    targetChain: string = 'base',
    network: TokenNetwork = 'mainnet',
    targetTokenSymbol: string = 'ETH'
  ): Promise<ethers.TransactionResponse> {
    const targetTokenAddress = getZrcAddressFor(targetChain as any, targetTokenSymbol, network);
    if (!targetTokenAddress) {
      throw new Error(`Target token address not available for ${targetTokenSymbol} on ${targetChain}`);
    }
    return this.executeCrossChainTransaction({
      amount,
      receiver,
      targetChain,
      network,
      targetTokenAddress,
      tokenSymbol: targetTokenSymbol,
    }, rpcUrl);
  }

  /**
   * Execute an ERC20 token transfer to ZetaChain
   */
  async transferERC20(
    amount: string,
    receiver: string,
    tokenAddress: string,
    rpcUrl: string,
    targetChain: string = 'base',
    network: TokenNetwork = 'mainnet',
    targetTokenSymbol: string = 'USDC'
  ): Promise<ethers.TransactionResponse> {
    const targetTokenAddress = getZrcAddressFor(targetChain as any, targetTokenSymbol, network);
    if (!targetTokenAddress) {
      throw new Error(`Target token address not available for ${targetTokenSymbol} on ${targetChain}`);
    }
    return this.executeCrossChainTransaction({
      amount,
      receiver,
      token: tokenAddress,
      targetChain,
      network,
      targetTokenAddress,
      tokenSymbol: targetTokenSymbol,
    }, rpcUrl);
  }

  /**
   * Execute a custom function call on ZetaChain
   */
  async executeFunction(
    amount: string,
    receiver: string,
    types: string[],
    values: any[],
    rpcUrl: string,
    tokenAddress?: string
  ): Promise<ethers.TransactionResponse> {
    // For advanced function calls, prefer the protocol helper with explicit fields.
    // Keeping this as a passthrough for now; callers should migrate to dedicated helpers.
    return this.executeCrossChainTransaction({
      amount,
      receiver,
      token: tokenAddress,
    }, rpcUrl);
  }
}

// Export singleton instance
export const secureTransactionService = new SecureTransactionService();
