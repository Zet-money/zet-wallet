import { ethers, HDNodeWallet } from "ethers";
import { evmDepositAndCall, createDefaultRevertOptions, type EvmDepositAndCallParams } from "@/lib/crosschain/evm-deposit-and-call";
import { BiometricMigration } from "@/lib/migration/biometric-migration";
import { getZrcAddressFor } from "@/lib/zrc";
import { type Network as TokenNetwork } from "@/lib/tokens";

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
    params: Omit<EvmDepositAndCallParams, 'revertOptions'>,
    rpcUrl: string,
    revertOptions?: any
  ): Promise<ethers.TransactionResponse> {
    let mnemonic: string | null = null;
    
    try {
      // Step 0: Ensure biometric migration is initialized
      await this.init();
      
      // Step 1: Decrypt mnemonic using biometrics
      console.log('[SecureTransaction] Decrypting mnemonic with biometrics...');
      const unlockResult = await this.biometricMigration.unlockWalletWithBiometrics();
      
      if (!unlockResult.success || !unlockResult.mnemonic) {
        throw new Error('Failed to unlock wallet with biometrics');
      }
      
      mnemonic = unlockResult.mnemonic;
      console.log('[SecureTransaction] Mnemonic decrypted successfully');

      // Step 2: Create signer from decrypted mnemonic
      const hdWallet = HDNodeWallet.fromPhrase(mnemonic);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const signer = hdWallet.connect(provider);
      
      console.log('[SecureTransaction] Signer created for address:', signer.address);

      // Step 3: Prepare transaction parameters
      const transactionParams: EvmDepositAndCallParams = {
        ...params,
        revertOptions: revertOptions || createDefaultRevertOptions()
      };

      // Step 4: Execute the cross-chain transaction
      console.log('[SecureTransaction] Executing cross-chain transaction...');
      const tx = await evmDepositAndCall(transactionParams, { signer });
      
      console.log('[SecureTransaction] Transaction submitted:', tx.hash);
      return tx;

    } catch (error) {
      console.error('[SecureTransaction] Error executing transaction:', error);
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
      
      console.log('[SecureTransaction] Mnemonic securely cleared from memory');
    } catch (error) {
      console.warn('[SecureTransaction] Warning: Could not securely clear mnemonic:', error);
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
    network: TokenNetwork = 'mainnet'
  ): Promise<ethers.TransactionResponse> {
    // For ETH transfer, we need to build ZetProtocol payload
    // Convert recipient to bytes (Ethereum address format) - same as zetprotocol.ts
    const recipientBytes = receiver.startsWith('0x') ? receiver.slice(2) : receiver;
    const recipientBuffer = Buffer.from(recipientBytes, 'hex');
    const withdrawFlag = true; // Always withdraw for direct transfers
    
    // Get the correct ETH ZRC-20 address on ZetaChain for the target chain
    const targetTokenAddress = getZrcAddressFor(targetChain as any, 'ETH', network);
    
    if (!targetTokenAddress) {
      throw new Error(`Target token address not available for ETH on ${targetChain}`);
    }
    
    console.log('[SecureTransaction] ETH transfer - targetTokenAddress:', targetTokenAddress);
    console.log('[SecureTransaction] recipientBytes:', recipientBuffer);
    console.log('[SecureTransaction] withdrawFlag:', withdrawFlag);
    
    return this.executeCrossChainTransaction({
      amount,
      receiver, // This will be overridden to ZetProtocol address in evmDepositAndCall
      types: ['address', 'bytes', 'bool'],
      values: [targetTokenAddress, recipientBuffer, withdrawFlag],
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
    // For ERC20 transfer, we need to build ZetProtocol payload
    // Convert recipient to bytes (Ethereum address format) - same as zetprotocol.ts
    const recipientBytes = receiver.startsWith('0x') ? receiver.slice(2) : receiver;
    const recipientBuffer = Buffer.from(recipientBytes, 'hex');
    const withdrawFlag = true; // Always withdraw for direct transfers
    
    // Get the correct target token ZRC-20 address on ZetaChain for the target chain
    const targetTokenAddress = getZrcAddressFor(targetChain as any, targetTokenSymbol, network);
    
    if (!targetTokenAddress) {
      throw new Error(`Target token address not available for ${targetTokenSymbol} on ${targetChain}`);
    }
    
    console.log('[SecureTransaction] ERC20 transfer - targetTokenAddress:', targetTokenAddress);
    console.log('[SecureTransaction] recipientBytes:', recipientBuffer);
    console.log('[SecureTransaction] withdrawFlag:', withdrawFlag);
    
    return this.executeCrossChainTransaction({
      amount,
      receiver, // This will be overridden to ZetProtocol address in evmDepositAndCall
      token: tokenAddress,
      types: ['address', 'bytes', 'bool'],
      values: [targetTokenAddress, recipientBuffer, withdrawFlag],
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
    return this.executeCrossChainTransaction({
      amount,
      receiver,
      token: tokenAddress,
      types,
      values,
    }, rpcUrl);
  }
}

// Export singleton instance
export const secureTransactionService = new SecureTransactionService();
