import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { secureTransactionService } from '@/lib/services/secure-transaction';
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
  transferETH: (amount: string, receiver: string, rpcUrl: string) => Promise<ethers.TransactionResponse | null>;
  transferERC20: (amount: string, receiver: string, tokenAddress: string, rpcUrl: string) => Promise<ethers.TransactionResponse | null>;
  executeFunction: (amount: string, receiver: string, types: string[], values: any[], rpcUrl: string, tokenAddress?: string) => Promise<ethers.TransactionResponse | null>;
  clearError: () => void;
  clearLastTransaction: () => void;
}

/**
 * Hook for secure cross-chain transactions with biometric authentication
 */
export const useSecureTransaction = (): UseSecureTransactionReturn => {
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
    rpcUrl: string
  ): Promise<ethers.TransactionResponse | null> => {
    return executeWithErrorHandling(async () => {
      console.log('[useSecureTransaction] Transferring ETH:', { amount, receiver });
      const tx = await secureTransactionService.transferETH(amount, receiver, rpcUrl);
      
      toast.success(`ETH transfer submitted: ${tx.hash}`);
      return tx;
    });
  }, [executeWithErrorHandling]);

  const transferERC20 = useCallback(async (
    amount: string,
    receiver: string,
    tokenAddress: string,
    rpcUrl: string
  ): Promise<ethers.TransactionResponse | null> => {
    return executeWithErrorHandling(async () => {
      console.log('[useSecureTransaction] Transferring ERC20:', { amount, receiver, tokenAddress });
      const tx = await secureTransactionService.transferERC20(amount, receiver, tokenAddress, rpcUrl);
      
      toast.success(`ERC20 transfer submitted: ${tx.hash}`);
      return tx;
    });
  }, [executeWithErrorHandling]);

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
    executeFunction,
    clearError,
    clearLastTransaction,
  };
};
