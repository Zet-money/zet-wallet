"use client";

import { useMemo, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNetwork } from '@/contexts/NetworkContext';
import { EVM_TOKENS, getTokensFor, type Network as TokenNetwork } from '@/lib/tokens';
import { IN_APP_RPC_MAP } from '@/lib/rpc';
import BaseLogo from './BaseLogo';
import { useSecureTransaction } from '@/hooks/useSecureTransaction';
import { useWallet } from '@/contexts/WalletContext';
import { CctxProgress, trackCrossChainConfirmations as trackCrossChainTransaction } from '@/lib/zetachain-server';
import CctxProgressComponent from '@/components/CctxProgress';
import { waitForTxConfirmation, getTxStatus } from '@/lib/zetachain';
import { explorerFor } from '@/lib/explorer';

interface SendFlowProps {
  asset: {
    id: string;
    symbol: string;
    name: string;
    balance: string;
    usdValue: string;
    chain: string;
    logo: string;
  };
  onClose: () => void;
}

function toLabel(key: string) {
  switch (key) {
    case 'bsc': return 'BNB Chain'
    case 'eth':
    case 'ethereum': return 'Ethereum'
    case 'avax':
    case 'avalanche': return 'Avalanche'
    case 'matic':
    case 'polygon': return 'Polygon'
    case 'arb':
    case 'arbitrum': return 'Arbitrum'
    case 'op':
    case 'optimism': return 'Optimism'
    case 'base': return 'Base'
    default: return key.charAt(0).toUpperCase() + key.slice(1)
  }
}

function logoSymbolForChain(key: string) {
  switch (key) {
    case 'ethereum': return 'ETH'
    case 'polygon': return 'MATIC'
    case 'bsc': return 'BNB'
    case 'avalanche': return 'AVAX'
    case 'arbitrum': return 'ARB'
    case 'optimism': return 'OP'
    case 'base': return 'BASE'
    case 'solana': return 'SOL'
    case 'zetachain': return 'ZETA'
    default: return 'ETH'
  }
}

export default function SendFlowSecure({ asset, onClose }: SendFlowProps) {
  const { network } = useNetwork();
  const { wallet } = useWallet();
  const { transferETH, transferERC20, transferSameChain, isExecuting, error: transactionError, updateTransactionStatus, setLastTransactionId } = useSecureTransaction();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [destinationChain, setDestinationChain] = useState('');
  const [destinationToken, setDestinationToken] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txPhase, setTxPhase] = useState<'idle' | 'pending' | 'confirmed' | 'failed' | 'timeout' | 'completed'>('idle');
  const [confirmations, setConfirmations] = useState<number>(0);
  const [gasUsed, setGasUsed] = useState<string | undefined>(undefined);
  const [blockNumber, setBlockNumber] = useState<number | undefined>(undefined);
  const [cctxs, setCctxs] = useState<any[]>([]);
  const [cctxProgress, setCctxProgress] = useState<CctxProgress | null>(null);
  const [transactionDuration, setTransactionDuration] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [transactionAmount, setTransactionAmount] = useState<string>('');
  const [transactionToken, setTransactionToken] = useState<string>('');
  const [transactionTargetChain, setTransactionTargetChain] = useState<string>('');
  const [transactionReceiver, setTransactionReceiver] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Destination chains
  const destinationChains = useMemo(() => {
    // If cNGN is selected, only show Base as destination
    if (asset?.symbol === 'cNGN') {
      return [{
        value: 'base-same',
        label: 'Base (Same Chain)',
        icon: 'base-logo'
      }];
    }
    
    const excluded = new Set(['optimism', 'bsc', 'zetachain', 'base']); // Exclude 'base' to avoid duplicate
    const chains = Object.keys(EVM_TOKENS).filter((key) => !excluded.has(key)).map((key) => {
      const symbol = logoSymbolForChain(key);
      const icon = `https://assets.parqet.com/logos/crypto/${symbol}?format=png`;
      return { value: key, label: toLabel(key), icon };
    });
    
    // Add Base as an option for same-chain transfers
    chains.unshift({
      value: 'base-same',
      label: 'Base (Same Chain)',
      icon: 'base-logo'
    });
    
    return chains;
  }, [asset?.symbol]);

  // Get available tokens for the selected destination chain
  const destinationTokens = useMemo(() => {
    if (!destinationChain) return [];
    
    // For same-chain transfers, use the source chain
    const chainForTokens = destinationChain === 'base-same' ? 'base' : destinationChain;
    const networkKey = (network === 'mainnet' ? 'mainnet' : 'testnet') as TokenNetwork;
    const tokens = getTokensFor(chainForTokens, networkKey);
    
    // If source token is USDC or cNGN, only show matching token as destination token
    if (asset.symbol === 'USDC' || asset.symbol === 'cNGN') {
      console.log('[Token Filter] Debug:', {
        destinationChain,
        assetSymbol: asset.symbol,
        assetChain: asset.chain,
        networkKey,
        availableTokens: tokens.map(t => t.symbol),
        matchingTokens: tokens.filter(t => t.symbol.includes(asset.symbol))
      });
      
      // Find matching token with appropriate symbol for the destination chain
      let matchingToken = tokens.find(token => token.symbol === asset.symbol);
      
      // For ZetaChain, look for token with the source chain suffix
      if (!matchingToken && destinationChain === 'zetachain') {
        // Map source chains to their token symbols on ZetaChain
        const tokenSymbolMap: { [key: string]: { [key: string]: string } } = {
          'USDC': {
            'base': 'USDC.BASE',
            'bsc': 'USDC.BSC',
            'ethereum': 'USDC.ETH',
            'polygon': 'USDC.POL',
            'arbitrum': 'USDC.ARB',
            'optimism': 'USDC.OP',
            'avalanche': 'USDC.AVAX'
          },
          'cNGN': {
            'base': 'cNGN.BASE' // Add cNGN mapping if it exists on ZetaChain
          }
        };
        
        const symbolMap = tokenSymbolMap[asset.symbol];
        if (symbolMap) {
          const tokenSymbol = symbolMap[asset.chain] || `${asset.symbol}.BASE`; // Default to BASE if not found
          console.log('[Token Filter] Looking for token symbol:', tokenSymbol);
          matchingToken = tokens.find(token => token.symbol === tokenSymbol);
          console.log('[Token Filter] Found token:', matchingToken);
        }
      }
      
      if (matchingToken) {
        console.log('[Token Filter] Returning token:', matchingToken.symbol);
        return [{
          value: matchingToken.symbol,
          label: matchingToken.symbol,
          name: matchingToken.name,
          logo: asset.symbol === 'cNGN' ? '/cngn.svg' : (matchingToken.symbol === 'ETH' ? 'base-logo' : `https://assets.parqet.com/logos/crypto/${matchingToken.logo || matchingToken.symbol}?format=png`)
        }];
      } else {
        console.log('[Token Filter] No matching token found, returning all tokens');
      }
    }
    
    // Filter out cNGN when sending ETH on Base
    const filteredTokens = tokens.filter(token => {
      if (asset.symbol === 'ETH' && destinationChain === 'base-same') {
        return token.symbol !== 'cNGN';
      }
      return true;
    });

    return filteredTokens.map((token) => ({
      value: token.symbol,
      label: token.symbol,
      name: token.name,
      logo: token.symbol === 'ETH' ? 'base-logo' : (token.symbol === 'cNGN' ? '/cngn.svg' : `https://assets.parqet.com/logos/crypto/${token.logo || token.symbol}?format=png`)
    }));
  }, [destinationChain, network, asset.symbol]);

  // Auto-select matching token as destination token when source is USDC or cNGN
  useEffect(() => {
    console.log('[Token Auto-select] Debug:', {
      assetSymbol: asset.symbol,
      destinationChain,
      assetChain: asset.chain,
      currentDestinationToken: destinationToken
    });
    
    if ((asset.symbol === 'USDC' || asset.symbol === 'cNGN') && destinationChain) {
      // For ZetaChain, use the appropriate token symbol based on source chain
      if (destinationChain === 'zetachain') {
        const tokenSymbolMap: { [key: string]: { [key: string]: string } } = {
          'USDC': {
            'base': 'USDC.BASE',
            'bsc': 'USDC.BSC',
            'ethereum': 'USDC.ETH',
            'polygon': 'USDC.POL',
            'arbitrum': 'USDC.ARB',
            'optimism': 'USDC.OP',
            'avalanche': 'USDC.AVAX'
          },
          'cNGN': {
            'base': 'cNGN.BASE'
          }
        };
        
        const symbolMap = tokenSymbolMap[asset.symbol];
        if (symbolMap) {
          const tokenSymbol = symbolMap[asset.chain] || `${asset.symbol}.BASE`;
          console.log('[Token Auto-select] Setting ZetaChain token symbol:', tokenSymbol);
          setDestinationToken(tokenSymbol);
        }
      } else {
        console.log('[Token Auto-select] Setting standard token for chain:', destinationChain);
        setDestinationToken(asset.symbol);
      }
    }
  }, [asset.symbol, destinationChain, asset.chain]);

  // Timer effect for tracking transaction duration
  useEffect(() => {
    if (isTimerRunning && startTimeRef.current) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
        setTransactionDuration(elapsed);
        console.log('[UI][TIMER] Transaction duration updated', { elapsed, txPhase })
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTimerRunning, txPhase]);

  const startTimer = () => {
    console.log('[UI][TIMER] Starting transaction timer')
    startTimeRef.current = Date.now();
    setTransactionDuration(0);
    setIsTimerRunning(true);
  };

  const stopTimer = () => {
    console.log('[UI][TIMER] Stopping transaction timer', { 
      finalDuration: transactionDuration,
      txPhase 
    })
    setIsTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = async () => {
    console.log('[UI][SEND] handleSend called', {
      recipientAddress,
      amount,
      destinationChain,
      destinationToken,
      assetBalance: asset.balance,
      asset
    });
    
    // Validation
    if (!recipientAddress.trim()) {
      toast.error('Please enter a recipient address');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > parseFloat(asset.balance.replace(',', ''))) {
      toast.error('Insufficient balance');
      return;
    }

    if (!destinationChain) {
      toast.error('Please select a destination chain');
      return;
    }

    if (!destinationToken) {
      toast.error('Please select a destination token');
      return;
    }

    console.log('[UI][SEND] All validations passed, starting secure transfer process');
    
    try {
      // Store transaction details for tracking
      setTransactionAmount(amount);
      setTransactionToken(asset.symbol);
      setTransactionTargetChain(destinationChain);
      setTransactionReceiver(recipientAddress);
      
      // Start transaction timer
      startTimer();
      
      // Get RPC URL for Base chain
      const rpcUrl = IN_APP_RPC_MAP['base']?.[network];
      if (!rpcUrl) {
        throw new Error(`RPC URL not available for Base ${network}`);
      }

      // Determine if this is a native ETH transfer, ERC20 transfer, or same-chain transfer
      const isNativeToken = asset.symbol === 'ETH';
      const isSameChainTransfer = destinationChain === 'base-same';
      
      let tx;
      if (isNativeToken) {
        if (isSameChainTransfer) {
          // Native ETH transfer on same chain (Base to Base)
          console.log('[UI][SEND] Executing same-chain native ETH transfer');
          // For same-chain ETH transfers, we'll use the existing transferETH function
          // but we need to modify it to handle same-chain transfers
          tx = await transferETH(amount, recipientAddress, rpcUrl, destinationChain, network, destinationToken);
        } else {
          // Native ETH transfer to ZetaChain
          console.log('[UI][SEND] Executing native ETH transfer');
          tx = await transferETH(amount, recipientAddress, rpcUrl, destinationChain, network, destinationToken);
        }
      } else {
        // ERC20 token transfer
        console.log('[UI][SEND] Executing ERC20 token transfer');
        
        // Get token address for the asset
        const networkKey = (network === 'mainnet' ? 'mainnet' : 'testnet') as TokenNetwork;
        const baseTokens = getTokensFor('base', networkKey);
        const tokenInfo = baseTokens.find(t => t.symbol.toUpperCase() === asset.symbol.toUpperCase());
        const tokenAddress = tokenInfo?.addressByNetwork?.[networkKey];
        
        if (!tokenAddress) {
          throw new Error(`Token address not found for ${asset.symbol}`);
        }
        
        if (isSameChainTransfer) {
          // Same-chain ERC20 transfer (Base to Base)
          console.log('[UI][SEND] Executing same-chain ERC20 transfer');
          
          const result = await transferSameChain(
            amount,
            recipientAddress,
            tokenAddress,
            'base',
            network
          );
          
          if (!result) {
            throw new Error('Transfer failed');
          }
          
          tx = result;
          // Store transaction ID for status updates
          if (result.transactionId) {
            setLastTransactionId(result.transactionId);
          }
        } else {
          // Cross-chain ERC20 transfer to ZetaChain
          tx = await transferERC20(amount, recipientAddress, tokenAddress, rpcUrl, destinationChain, network, destinationToken);
        }
      }

      if (tx) {
        setTxHash(tx.hash);
        setTxPhase('pending');
        
        toast.success('Transaction submitted successfully!', {
          description: `Transaction ${tx.hash} has been submitted. Please wait for confirmation.`,
          duration: 5000
        });

        // Track transaction status
        try {
          console.log('[UI][TRACKING] Starting transaction tracking', { hash: tx.hash });
          
          // Wait for transaction confirmation on origin chain
          const originConfirmed = await waitForTxConfirmation({
            originChain: 'base',
            hash: tx.hash,
            network,
            rpc: IN_APP_RPC_MAP
          });
          
          if (originConfirmed) {
            // Update transaction status to completed on origin chain
            await updateTransactionStatus('completed');
            
            // Check if this is a same-chain transfer
            if (isSameChainTransfer) {
              // Same-chain transfer completed
              console.log('[UI][SEND] Same-chain transfer completed');
              stopTimer();
              setTxPhase('completed');
              toast.success('Transfer completed!', { 
                description: `Successfully transferred ${amount} ${asset.symbol} to ${recipientAddress}`, 
                duration: 10000 
              });
            } else {
              // Cross-chain transfer - continue with CCTX tracking
              toast.success('Transaction confirmed on origin chain!', {
                description: `Now tracking cross-chain completion...`,
                duration: 5000
              });

              // Immediately show CCTX tracker UI with pending state
              console.log('[UI][CCTX] Setting up pending CCTX progress state', {
                transactionAmount,
                transactionToken,
                transactionTargetChain,
                transactionReceiver
              })
              setCctxProgress({
                status: 'pending',
                confirmations: 0,
                statusText: 'Waiting for cross-chain transaction to be detected...',
                amount: transactionAmount,
                asset: transactionToken,
                sender: '', // Will be filled when CCTX data is available
                receiver: transactionReceiver,
                targetChainId: transactionTargetChain
              })
              setTxPhase('pending')

              // Track cross-chain transaction
              try {
                console.log('[UI][CCTX] Starting trackCrossChainTransaction', { 
                  hash: tx.hash, 
                  network, 
                  destinationChain,
                  originChain: (asset.chain || 'base').toLowerCase()
                })
                
                const cctxResult = await trackCrossChainTransaction({
                  hash: tx.hash,
                  network,
                  timeoutSeconds: 300,
                  onProgress: ({ confirmations, status, progress }) => {
                    console.log('[UI][CCTX] onProgress callback triggered', {
                      hasProgress: !!progress,
                      confirmations,
                      status,
                      progressStatus: progress?.status,
                      progressConfirmations: progress?.confirmations
                    })
                    
                    if (progress) {
                      console.log('[UI][CCTX] Setting progress state', {
                        status: progress.status,
                        confirmations: progress.confirmations,
                        statusText: progress.statusText,
                        outboundHash: progress.outboundHash
                      })
                      // Always use stored transaction details instead of CCTX data
                      const updatedProgress = {
                        ...progress,
                        amount: transactionAmount,
                        asset: transactionToken,
                        targetChainId: transactionTargetChain,
                        receiver: transactionReceiver
                      }
                      setCctxProgress(updatedProgress)
                      setTxPhase(progress.status === 'completed' ? 'completed' : progress.status === 'failed' ? 'failed' : 'pending')
                      setConfirmations(progress.confirmations)
                    }
                    if (status) {
                      console.log('[UI][CCTX] Status update received:', status)
                    }
                  }
                })
                
                console.log('[UI][CCTX] trackCrossChainTransaction completed', {
                  status: cctxResult.status,
                  hasProgress: !!cctxResult.progress,
                  hasCctx: !!cctxResult.cctx,
                  progressStatus: cctxResult.progress?.status,
                  progressConfirmations: cctxResult.progress?.confirmations
                })
                
                setTxPhase(cctxResult.status as any);
                if (cctxResult.progress) {
                  console.log('[UI][CCTX] Setting final progress state', cctxResult.progress)
                  // Always use stored transaction details instead of CCTX data
                  const finalProgress = {
                    ...cctxResult.progress,
                    amount: transactionAmount,
                    asset: transactionToken,
                    targetChainId: transactionTargetChain,
                    receiver: transactionReceiver
                  }
                  setCctxProgress(finalProgress)
                }
                if (cctxResult.cctx) {
                  console.log('[UI][CCTX] Setting final CCTX state', { cctx: cctxResult.cctx })
                  setCctxs([cctxResult.cctx]);
                }
                
                if (cctxResult.status === 'completed') {
                  console.log('[UI][CCTX] Showing success toast')
                  stopTimer(); // Stop timer on completion
                  toast.success('Cross-chain transfer completed!', { description: `Successfully transferred to ${destinationChain}`, duration: 10000 });
                } else if (cctxResult.status === 'failed') {
                  console.log('[UI][CCTX] Showing failure toast')
                  stopTimer(); // Stop timer on failure
                  await updateTransactionStatus('failed', 'Cross-chain transfer failed');
                  toast.error('Cross-chain transfer failed', { description: 'The transfer could not be completed. Please check the transaction details.', duration: 10000 });
                } else if (cctxResult.status === 'timeout') {
                  console.log('[UI][CCTX] Showing timeout toast')
                  stopTimer(); // Stop timer on timeout
                  await updateTransactionStatus('failed', 'Cross-chain transfer timeout');
                  toast.warning('Cross-chain transfer timeout', { description: 'Transfer is taking longer than expected. Please check the blockchain explorer.', duration: 10000 });
                }
              } catch (cctxError) {
                console.error('[UI][CCTX] Error tracking cross-chain transaction:', {
                  error: cctxError instanceof Error ? cctxError.message : String(cctxError),
                  stack: cctxError instanceof Error ? cctxError.stack : undefined,
                  hash: tx.hash,
                  network,
                  destinationChain
                });
                setTxPhase('pending');
              }
            }
          } else if (txPhase === 'failed') {
            stopTimer(); // Stop timer on origin chain failure
            await updateTransactionStatus('failed', 'Transaction failed on origin chain');
            toast.error('Transaction failed on origin chain', {
              description: `Transaction failed on origin chain`,
              duration: 10000
            });
          } else if (txPhase === 'timeout') {
            stopTimer(); // Stop timer on origin chain timeout
            await updateTransactionStatus('failed', 'Transaction timeout on origin chain');
            toast.warning('Transaction timeout on origin chain', {
              description: 'Transaction is taking longer than expected. Please check the blockchain explorer.',
              duration: 10000
            });
          }
        } catch (error) {
          console.error('Error tracking transaction:', error);
          setTxPhase('failed');
          stopTimer(); // Stop timer on error
          await updateTransactionStatus('failed', 'Error tracking transaction');
          toast.error('Error tracking transaction', {
            description: 'Unable to track transaction status. Please check the blockchain explorer.',
            duration: 10000
          });
        }
      }
    } catch (error) {
      console.error('[UI][SEND] Transfer error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Transfer failed: ${errorMessage}`);
      setTxPhase('failed');
      stopTimer(); // Stop timer on error
    }
  };

  const maxAmount = parseFloat(asset.balance.replace(/,/g, ''));
  const assetUsd = parseFloat(asset.usdValue.replace(/,/g, ''));
  const usdAmount = amount ? (parseFloat(amount || '0') * (maxAmount > 0 ? assetUsd / maxAmount : 0)) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>{txHash ? 'Transaction Status' : `Send ${asset.symbol}`}</CardTitle>
            <CardDescription>
              {txHash ? 'Tracking your transaction. You can keep this open.' : `Transfer ${asset.symbol} to another wallet`}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {txHash ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Transaction Hash</div>
                <div className="text-xs break-all font-mono bg-muted p-2 rounded">{txHash}</div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <Badge variant={
                  txPhase === 'completed' ? 'default' :
                    txPhase === 'confirmed' ? 'default' :
                      txPhase === 'failed' ? 'destructive' :
                        txPhase === 'timeout' ? 'destructive' :
                          'secondary'
                }>
                  {txPhase === 'pending' ? 'Pending' :
                    txPhase === 'confirmed' ? 'Origin Confirmed' :
                      txPhase === 'completed' ? 'Completed' :
                        txPhase === 'failed' ? 'Failed' :
                          txPhase === 'timeout' ? 'Timeout' : 'Unknown'}
                </Badge>
              </div>

              {/* Transaction Details */}
              {(txPhase === 'pending' || txPhase === 'confirmed' || txPhase === 'completed' || txPhase === 'failed' || txPhase === 'timeout') && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Duration</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">
                      {formatDuration(transactionDuration)}
                    </span>
                    {isTimerRunning && (
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    )}
                  </div>
                </div>
              )}

              {(txPhase === 'confirmed' || txPhase === 'completed') && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confirmations:</span>
                    <span>{confirmations}</span>
                  </div>
                  {gasUsed && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gas Used:</span>
                      <span>{gasUsed}</span>
                    </div>
                  )}
                  {blockNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Block Number:</span>
                      <span>{blockNumber}</span>
                    </div>
                  )}
                </div>
              )}

              {/* CCTX Progress Component */}
              {cctxProgress && (
                <div className="mt-4">
                  <CctxProgressComponent
                    progress={cctxProgress}
                    originChain={(asset.chain || 'base').toLowerCase()}
                    targetChain={destinationChain}
                    duration={transactionDuration}
                    isTimerRunning={isTimerRunning}
                    receiver={transactionReceiver}
                    onViewExplorer={(hash, chain) => {
                      console.log('[UI][CCTX][EXPLORER] Explorer link clicked', { hash, chain })
                      const explorerUrl = explorerFor(chain)
                      console.log('[UI][CCTX][EXPLORER] Explorer URL resolved', { chain, explorerUrl })
                      if (explorerUrl) {
                        let fullUrl = `${explorerUrl}${hash}`
                        if (chain.toLowerCase() === 'solana' && network !== 'mainnet') {
                          fullUrl = `${explorerUrl}${hash}?cluster=devnet`
                        }
                        console.log('[UI][CCTX][EXPLORER] Opening explorer URL', { fullUrl })
                        window.open(fullUrl, '_blank')
                      }
                    }}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const explorerUrl = explorerFor('base');
                    if (explorerUrl) {
                      const fullUrl = `${explorerUrl}${txHash}`;
                      window.open(fullUrl, '_blank');
                    }
                  }}
                  className="flex-1"
                >
                  View on Explorer
                </Button>
                {(txPhase === 'completed' || txPhase === 'failed' || txPhase === 'timeout') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTxHash(null);
                      setTxPhase('idle');
                      setCctxProgress(null);
                      setCctxs([]);
                      setConfirmations(0);
                      setGasUsed(undefined);
                      setBlockNumber(undefined);
                      setTransactionDuration(0);
                      setIsTimerRunning(false);
                      setAmount('');
                      setRecipientAddress('');
                      setDestinationChain('');
                      setDestinationToken('');
                    }}
                    className="flex-1"
                  >
                    New Transaction
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Asset Info */}
              <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                  {asset.logo === 'base-logo' ? (
                    <BaseLogo size={24} />
                  ) : (
                    <img 
                      src={asset.logo} 
                      alt={asset.symbol}
                      className="w-6 h-6 object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{asset.symbol}</div>
                  <div className="text-sm text-muted-foreground">
                    Balance: {asset.balance} {asset.symbol}
                  </div>
                </div>
              </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-16"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAmount(maxAmount.toString())}
                  className="h-6 px-2 text-xs"
                >
                  Max
                </Button>
              </div>
            </div>
            {amount && (
              <p className="text-sm text-muted-foreground">
                ≈ ${usdAmount.toFixed(2)} USD
              </p>
            )}
          </div>

          {/* Recipient Address */}
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder="0x... or zeta1..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
            />
          </div>

          {/* Destination Chain and Token */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="destination">Destination Chain</Label>
              <Select value={destinationChain} onValueChange={(value) => {
                setDestinationChain(value);
                setDestinationToken(''); // Reset destination token when chain changes
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination chain" />
                </SelectTrigger>
                <SelectContent>
                  {destinationChains.map((chain) => (
                    <SelectItem key={chain.value} value={chain.value}>
                      <div className="flex items-center space-x-2">
                        {chain.icon === 'base-logo' ? (
                          <BaseLogo size={16} />
                        ) : (
                          <img
                            src={chain.icon}
                            alt={chain.label}
                            className="w-4 h-4 object-contain"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        )}
                        <span>{chain.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {destinationChain && (
              <div className="space-y-2">
                <Label htmlFor="destinationToken">Destination Token</Label>
                <Select 
                  value={destinationToken} 
                  onValueChange={setDestinationToken}
                  disabled={asset.symbol === 'USDC' || asset.symbol === 'cNGN'}
                >
                  <SelectTrigger className={(asset.symbol === 'USDC' || asset.symbol === 'cNGN') ? 'opacity-50 cursor-not-allowed' : ''}>
                    <SelectValue placeholder="Select destination token" />
                  </SelectTrigger>
                  {(asset.symbol === 'USDC' || asset.symbol === 'cNGN') && (
                    <p className="text-xs text-muted-foreground mt-1">
                      You will be able to select destination tokens soon
                    </p>
                  )}
                  <SelectContent>
                    {destinationTokens.map((token) => (
                      <SelectItem key={token.value} value={token.value}>
                        <div className="flex items-center space-x-2">
                          {token.logo === 'base-logo' ? (
                            <BaseLogo size={16} />
                          ) : (
                            <img
                              src={token.logo}
                              alt={token.label}
                              className="w-4 h-4 object-contain"
                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                          )}
                          <div className="flex flex-col">
                            <span className="font-medium">{token.label}</span>
                            <span className="text-xs text-muted-foreground">{token.name}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

              {(asset.symbol === 'USDC' || asset.symbol === 'cNGN') && destinationChain && (
                <p className="text-sm text-muted-foreground">
                  Destination token is automatically set to {asset.symbol}
                </p>
              )}
            </>
          )}

          {/* Error Display */}
          {transactionError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive">An error occurred. Transaction failed.</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isExecuting || !recipientAddress || !amount || !destinationChain || !destinationToken}
              className="flex-1"
            >
              {isExecuting ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  Send
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
