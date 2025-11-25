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
import { resolveRecipient } from '@/lib/utils/ens-resolver';
import { ethers } from 'ethers';
import { FirstTransactionNFTModal } from '@/components/FirstTransactionNFTModal';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { useBiometric } from '@/contexts/BiometricContext';
import { backendApi } from '@/lib/services/backend-api';

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
  const { backendUser } = useUserSettings();
  const { getBiometricPublicKey } = useBiometric();
  const { transferETH, transferERC20, transferSameChain, transferSameChainETH, isExecuting, error: transactionError, updateTransactionStatus, setLastTransactionId } = useSecureTransaction();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isResolvingENS, setIsResolvingENS] = useState(false);
  const [ensError, setEnsError] = useState<string | null>(null);
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
  const [showNFTModal, setShowNFTModal] = useState(false);
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
    
    // Block cNGN from cross-chain transfers
    if (asset.symbol === 'cNGN' && destinationChain !== 'base-same') {
      return [];
    }
    
    // For same-chain transfers, use the source chain
    const chainForTokens = destinationChain === 'base-same' ? 'base' : destinationChain;
    const networkKey = (network === 'mainnet' ? 'mainnet' : 'testnet') as TokenNetwork;
    const tokens = getTokensFor(chainForTokens, networkKey);
    
    // Filter tokens based on source token restrictions
    const filteredTokens = tokens.filter(token => {
      // When sending ETH on Base, exclude cNGN
      if (asset.symbol === 'ETH' && destinationChain === 'base-same') {
        return token.symbol !== 'cNGN';
      }
      // When sending cNGN, only allow cNGN as destination
      if (asset.symbol === 'cNGN' && destinationChain === 'base-same') {
        return token.symbol === 'cNGN';
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

  // Auto-select first available token when destination chain changes (if no token selected)
  useEffect(() => {
    if (destinationChain && !destinationToken && destinationTokens.length > 0) {
      setDestinationToken(destinationTokens[0].value);
    }
  }, [destinationChain, destinationTokens, destinationToken]);

  // Timer effect for tracking transaction duration
  useEffect(() => {
    if (isTimerRunning && startTimeRef.current) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
        setTransactionDuration(elapsed);
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
    startTimeRef.current = Date.now();
    setTransactionDuration(0);
    setIsTimerRunning(true);
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Check if user should see NFT modal for first testnet transaction
  const checkAndShowNFTModal = async () => {
    // Only show for testnet
    if (network !== 'testnet') return;
    
    // Check if already shown in local storage
    const hasShownModal = localStorage.getItem('zet_first_testnet_tx_modal_shown');
    if (hasShownModal === 'true') return;
    
    // Wait a moment for backend to process, then refetch user data
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const biometricPublicKey = await getBiometricPublicKey();
      if (biometricPublicKey && wallet?.address) {
        const updatedUser = await backendApi.getUserProfile(wallet.address, biometricPublicKey);
        
        // Check if this was their first testnet transaction
        if (updatedUser?.hasCompletedFirstTestnetTransaction) {
          setShowNFTModal(true);
          localStorage.setItem('zet_first_testnet_tx_modal_shown', 'true');
        }
      }
    } catch (error) {
      console.error('Failed to check first transaction status:', error);
    }
  };

  const handleCloseNFTModal = () => {
    setShowNFTModal(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = async () => {
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
    
    try {
      setIsResolvingENS(true);
      setEnsError(null);

      // Resolve ENS/Base name if needed
      const baseRpcUrl = IN_APP_RPC_MAP['base']?.[network];
      if (!baseRpcUrl) {
        throw new Error(`No RPC URL found for base on ${network}`);
      }

      const provider = new ethers.JsonRpcProvider(baseRpcUrl);
      const resolved = await resolveRecipient(recipientAddress, provider);

      // ENS resolution complete, now we can show "Sending..." state
      setIsResolvingENS(false);

      // Use resolved address for transaction
      const finalRecipientAddress = resolved.address;

      // Store transaction details for tracking
      setTransactionAmount(amount);
      setTransactionToken(asset.symbol);
      setTransactionTargetChain(destinationChain);
      setTransactionReceiver(finalRecipientAddress);
      
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
          const result = await transferSameChainETH(amount, finalRecipientAddress, 'base', network);
          
          if (!result) {
            throw new Error('Transfer failed');
          }
          
          tx = { hash: result.hash };
          // Store transaction ID for status updates
          if (result.transactionId) {
            setLastTransactionId(result.transactionId);
          }
        } else {
          // Native ETH transfer to ZetaChain
          tx = await transferETH(amount, finalRecipientAddress, rpcUrl, destinationChain, network, destinationToken);
        }
      } else {
        // ERC20 token transfer
        
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
          
          const result = await transferSameChain(
            amount,
            finalRecipientAddress,
            tokenAddress,
            'base',
            network,
            asset.symbol
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
          tx = await transferERC20(amount, finalRecipientAddress, tokenAddress, rpcUrl, destinationChain, network, destinationToken);
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
              stopTimer();
              setTxPhase('completed');
              toast.success('Transfer completed!', { 
                description: `Successfully transferred ${amount} ${asset.symbol} to ${resolved.originalInput}`, 
                duration: 10000 
              });
              
              // Check if this is first testnet transaction and show NFT modal
              checkAndShowNFTModal();
            } else {
              // Cross-chain transfer - continue with CCTX tracking
              toast.success('Transaction confirmed on origin chain!', {
                description: `Now tracking cross-chain completion...`,
                duration: 5000
              });

              // Immediately show CCTX tracker UI with pending state
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
                const cctxResult = await trackCrossChainTransaction({
                  hash: tx.hash,
                  network,
                  timeoutSeconds: 300,
                  onProgress: ({ confirmations, status, progress }) => {
                    if (progress) {
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
                  }
                })
                
                setTxPhase(cctxResult.status as any);
                if (cctxResult.progress) {
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
                  setCctxs([cctxResult.cctx]);
                }
                
                if (cctxResult.status === 'completed') {
                  stopTimer(); // Stop timer on completion
                  toast.success('Cross-chain transfer completed!', { description: `Successfully transferred to ${destinationChain}`, duration: 10000 });
                  
                  // Check if this is first testnet transaction and show NFT modal
                  checkAndShowNFTModal();
                } else if (cctxResult.status === 'failed') {
                  stopTimer(); // Stop timer on failure
                  await updateTransactionStatus('failed', 'Cross-chain transfer failed');
                  toast.error('Cross-chain transfer failed', { description: 'The transfer could not be completed. Please check the transaction details.', duration: 10000 });
                } else if (cctxResult.status === 'timeout') {
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
      
      // Check if it's an ENS resolution error
      if (errorMessage.includes('ENS') || errorMessage.includes('name not found')) {
        setEnsError(errorMessage);
        toast.error(`ENS Resolution Failed: ${errorMessage}`);
      } else if (errorMessage.includes('Invalid address')) {
        setEnsError('Invalid address format. Please enter a valid Ethereum address, ENS name, or Solana address.');
        toast.error('Invalid Address Format');
      } else {
        toast.error(`Transfer failed: ${errorMessage}`);
      }
      
      setTxPhase('failed');
      stopTimer(); // Stop timer on error
    } finally {
      setIsResolvingENS(false);
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
                      const explorerUrl = explorerFor(chain)
                      if (explorerUrl) {
                        let fullUrl = `${explorerUrl}${hash}`
                        if (chain.toLowerCase() === 'solana' && network !== 'mainnet') {
                          fullUrl = `${explorerUrl}${hash}?cluster=devnet`
                        }
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
            <Label htmlFor="recipient">Recipient Address, ENS Name, or Solana Address</Label>
            <div className="relative">
              <Input
                id="recipient"
                placeholder="0x..., tomiwa.eth, tomiwa.base.eth, or Solana address"
                value={recipientAddress}
                onChange={(e) => {
                  setRecipientAddress(e.target.value);
                  setEnsError(null);
                }}
                className={isResolvingENS ? 'pr-10' : ''}
                disabled={isResolvingENS}
              />
              {isResolvingENS && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                </div>
              )}
            </div>
            {ensError && (
              <div className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {ensError}
              </div>
            )}
            {recipientAddress && !ensError && (
              <div className="text-xs text-muted-foreground">
                Supported formats: Ethereum addresses (0x...), ENS names (.eth), Base names (.base.eth), Solana addresses
              </div>
            )}
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
                  disabled={asset.symbol === 'cNGN' && destinationChain !== 'base-same'}
                >
                  <SelectTrigger className={(asset.symbol === 'cNGN' && destinationChain !== 'base-same') ? 'opacity-50 cursor-not-allowed' : ''}>
                    <SelectValue placeholder="Select destination token" />
                  </SelectTrigger>
                  {(asset.symbol === 'cNGN' && destinationChain !== 'base-same') && (
                    <p className="text-xs text-muted-foreground mt-1">
                      cNGN cross-chain transfers will be supported soon
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

              {(asset.symbol === 'cNGN' && destinationChain !== 'base-same') && (
                <p className="text-sm text-muted-foreground">
                  cNGN cross-chain transfers will be supported soon
                </p>
              )}
              {(asset.symbol === 'cNGN' && destinationChain === 'base-same') && (
                <p className="text-sm text-muted-foreground">
                  ETH and USDC destination tokens for cNGN transfers will be available soon
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

          {/* Action Buttons - Only show when transaction is not completed */}
          {txPhase !== 'completed' && txPhase !== 'failed' && txPhase !== 'timeout' && (
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
                disabled={isExecuting || isResolvingENS || !recipientAddress || !amount || !destinationChain || !destinationToken}
                className="flex-1"
              >
                {isExecuting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Sending...
                  </>
                ) : isResolvingENS ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Resolving ENS...
                  </>
                ) : (
                  <>
                    Send
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* First Transaction NFT Reward Modal */}
      {wallet?.address && (
        <FirstTransactionNFTModal 
          isOpen={showNFTModal}
          onClose={handleCloseNFTModal}
          walletAddress={wallet.address}
        />
      )}
    </div>
  );
}
