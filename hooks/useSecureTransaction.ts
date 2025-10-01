import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { secureTransactionService } from '@/lib/services/secure-transaction';
import { transferERC20Token } from '@/lib/erc20-transfer';
import { backendApi } from '@/lib/services/backend-api';
import { useWallet } from '@/contexts/WalletContext';
import { useBiometric } from '@/contexts/BiometricContext';
import { toast } from 'sonner';

interface TransactionState {
  isExecuting: boolean;
  error: string | null;
  lastTransaction: ethers.TransactionResponse | null;
}

interface UseSecureTransactionReturn {
  // State
  isExecuting: boolean;
  error: string | null;
  lastTransaction: ethers.TransactionResponse | null;
  
  // Actions
  transferETH: (amount: string, receiver: string, rpcUrl: string, targetChain?: string, network?: string, targetTokenSymbol?: string) => Promise<ethers.TransactionResponse | null>;
  transferERC20: (amount: string, receiver: string, tokenAddress: string, rpcUrl: string, targetChain?: string, network?: string, targetTokenSymbol?: string) => Promise<ethers.TransactionResponse | null>;
  transferSameChain: (amount: string, receiver: string, tokenAddress: string, chain: string, network: string) => Promise<{ hash: string } | null>;
  executeFunction: (amount: string, receiver: string, types: string[], values: any[], rpcUrl: string, tokenAddress?: string) => Promise<ethers.TransactionResponse | null>;
  clearError: () => void;
  clearLastTransaction: () => void;
}

/**
 * Hook for secure cross-chain transactions with biometric authentication
 */
export const useSecureTransaction = (): UseSecureTransactionReturn => {
  const { unlockApp, getBiometricPublicKey } = useBiometric();
  const { wallet } = useWallet();
  const [state, setState] = useState<TransactionState>({
    isExecuting: false,
    error: null,
    lastTransaction: null,
  });

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    try {
      setState(prev => ({ ...prev, isExecuting: true, error: null }));
      
      const result = await operation();
      
      setState(prev => ({ 
        ...prev, 
        isExecuting: false, 
        lastTransaction: result as any,
        error: null 
      }));
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setState(prev => ({ 
        ...prev, 
        isExecuting: false, 
        error: errorMessage 
      }));
      
      toast.error(`Transaction failed: ${errorMessage}`);
      console.error('[useSecureTransaction] Error:', error);
      
      return null;
    }
  }, []);

  const transferETH = useCallback(async (
    amount: string,
    receiver: string,
    rpcUrl: string,
    targetChain: string = 'base',
    network: string = 'mainnet',
    targetTokenSymbol: string = 'ETH'
  ): Promise<ethers.TransactionResponse | null> => {
    return executeWithErrorHandling(async () => {
      console.log('[useSecureTransaction] Transferring ETH:', { amount, receiver, targetChain, network, targetTokenSymbol });
      const tx = await secureTransactionService.transferETH(amount, receiver, rpcUrl, targetChain, network as any, targetTokenSymbol);
      
      // Track transaction in backend
      if (wallet?.address) {
        try {
          const biometricPublicKey = await getBiometricPublicKey();
          if (biometricPublicKey) {
            await backendApi.createBlockchainTransaction({
              walletAddress: wallet.address,
              type: 'blockchain',
              amount,
              token: targetTokenSymbol,
              network,
              transactionHash: tx.hash,
              recipientAddress: receiver,
              senderAddress: wallet.address,
            });
          }
        } catch (error) {
          console.warn('Failed to track transaction in backend:', error);
        }
      }
      
      toast.success(`ETH transfer submitted: ${tx.hash}`);
      return tx;
    });
  }, [executeWithErrorHandling, wallet, getBiometricPublicKey]);

  const transferERC20 = useCallback(async (
    amount: string,
    receiver: string,
    tokenAddress: string,
    rpcUrl: string,
    targetChain: string = 'base',
    network: string = 'mainnet',
    targetTokenSymbol: string = 'USDC'
  ): Promise<ethers.TransactionResponse | null> => {
    return executeWithErrorHandling(async () => {
      console.log('[useSecureTransaction] Transferring ERC20:', { amount, receiver, tokenAddress, targetChain, network, targetTokenSymbol });
      const tx = await secureTransactionService.transferERC20(amount, receiver, tokenAddress, rpcUrl, targetChain, network as any, targetTokenSymbol);
      
      // Track transaction in backend
      if (wallet?.address) {
        try {
          const biometricPublicKey = await getBiometricPublicKey();
          if (biometricPublicKey) {
            await backendApi.createBlockchainTransaction({
              walletAddress: wallet.address,
              type: 'blockchain',
              amount,
              token: targetTokenSymbol,
              network,
              transactionHash: tx.hash,
              recipientAddress: receiver,
              senderAddress: wallet.address,
            });
          }
        } catch (error) {
          console.warn('Failed to track transaction in backend:', error);
        }
      }
      
      toast.success(`ERC20 transfer submitted: ${tx.hash}`);
      return tx;
    });
  }, [executeWithErrorHandling, wallet, getBiometricPublicKey]);

  const transferSameChain = useCallback(async (
    amount: string,
    receiver: string,
    tokenAddress: string,
    chain: string,
    network: string
  ): Promise<{ hash: string } | null> => {
    return executeWithErrorHandling(async () => {
      console.log('[useSecureTransaction] Same-chain transfer:', { amount, receiver, tokenAddress, chain, network });
      
      // Unlock app to get mnemonic temporarily
      const unlockResult = await unlockApp(5); // 5 minute timeout
      if (!unlockResult.success || !unlockResult.mnemonic) {
        throw new Error(unlockResult.error || 'Failed to unlock app for transaction');
      }
  
      try {
        // Import HDNodeWallet dynamically to avoid server-side issues
        const { HDNodeWallet } = await import('ethers');
        const hdWallet = HDNodeWallet.fromPhrase(unlockResult.mnemonic);
        
        const result = await transferERC20Token({
          tokenAddress,
          recipientAddress: receiver,
          amount,
          senderPrivateKey: hdWallet.privateKey,
          chain: chain as 'base',
          network: network as 'mainnet' | 'testnet'
        });
  
        if (!result.success) {
          throw new Error(result.error || 'Transfer failed');
        }

        // Track transaction in backend
        if (wallet?.address) {
          try {
            const biometricPublicKey = await getBiometricPublicKey();
            if (biometricPublicKey) {
              await backendApi.createBlockchainTransaction({
                walletAddress: wallet.address,
                type: 'blockchain',
                amount,
                token: 'ERC20', // Generic token type for same-chain transfers
                network,
                transactionHash: result.hash,
                recipientAddress: receiver,
                senderAddress: wallet.address,
              });
            }
          } catch (error) {
            console.warn('Failed to track transaction in backend:', error);
          }
        }
  
        toast.success(`Transfer submitted: ${result.hash}`);
        return { hash: result.hash };
      } finally {
        // Mnemonic is automatically discarded when unlockResult goes out of scope
        // The biometric session will timeout after 5 minutes
      }
    });
  }, [executeWithErrorHandling, unlockApp, wallet, getBiometricPublicKey]);

  const executeFunction = useCallback(async (
    amount: string,
    receiver: string,
    types: string[],
    values: any[],
    rpcUrl: string,
    tokenAddress?: string
  ): Promise<ethers.TransactionResponse | null> => {
    return executeWithErrorHandling(async () => {
      console.log('[useSecureTransaction] Executing function:', { amount, receiver, types, values, tokenAddress });
      const tx = await secureTransactionService.executeFunction(amount, receiver, types, values, rpcUrl, tokenAddress);
      
      toast.success(`Function execution submitted: ${tx.hash}`);
      return tx;
    });
  }, [executeWithErrorHandling]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const clearLastTransaction = useCallback(() => {
    setState(prev => ({ ...prev, lastTransaction: null }));
  }, []);

  return {
    // State
    isExecuting: state.isExecuting,
    error: state.error,
    lastTransaction: state.lastTransaction,
    
    // Actions
    transferETH,
    transferERC20,
    transferSameChain,
    executeFunction,
    clearError,
    clearLastTransaction,
  };
};
