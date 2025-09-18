"use client";

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNetwork } from '@/contexts/NetworkContext';
// Call server API; avoid importing server-only toolkit client-side
import type { SupportedEvm } from '@/lib/providers';
import { EVM_TOKENS, getTokensFor, type Network as TokenNetwork, type TokenInfo } from '@/lib/tokens';
import { smartCrossChainTransfer, getTxStatus, waitForTxConfirmation, trackCrossChainTransaction } from '@/lib/zetachain';
import { waitForSolTxConfirmation } from '@/lib/solana';
import { getZrcAddressFor } from '@/lib/zrc';

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
    default: return 'ETH'
  }
}

export default function SendFlow({ asset, onClose }: SendFlowProps) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [destinationChain, setDestinationChain] = useState('');
  const [destinationToken, setDestinationToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txPhase, setTxPhase] = useState<'idle' | 'pending' | 'confirmed' | 'failed' | 'timeout' | 'completed'>('idle');
  const [confirmations, setConfirmations] = useState<number>(0);
  const [gasUsed, setGasUsed] = useState<string | undefined>(undefined);
  const [blockNumber, setBlockNumber] = useState<number | undefined>(undefined);
  const [cctxs, setCctxs] = useState<any[]>([]);
  const { network } = useNetwork();
  const explorerFor = (chain: string) => {
    const net = network === 'mainnet'
    switch (chain.toLowerCase()) {
      case 'ethereum': return net ? 'https://etherscan.io/tx/' : 'https://sepolia.etherscan.io/tx/'
      case 'polygon': return net ? 'https://polygonscan.com/tx/' : 'https://www.oklink.com/amoy/tx/'
      case 'bsc': return net ? 'https://bscscan.com/tx/' : 'https://testnet.bscscan.com/tx/'
      case 'avalanche': return net ? 'https://snowtrace.io/tx/' : 'https://testnet.snowtrace.io/tx/'
      case 'arbitrum': return net ? 'https://arbiscan.io/tx/' : 'https://sepolia.arbiscan.io/tx/'
      case 'optimism': return net ? 'https://optimistic.etherscan.io/tx/' : 'https://sepolia-optimistic.etherscan.io/tx/'
      case 'base': return net ? 'https://basescan.org/tx/' : 'https://sepolia.basescan.org/tx/'
      case 'solana': return net ? 'https://solscan.io/tx/' : 'https://solscan.io/tx/?cluster=devnet'
      default: return ''
    }
  }
  const destinationChains = useMemo(() => {
    // Use keys of EVM_TOKENS to represent supported EVM chains
    return Object.keys(EVM_TOKENS).map((key) => {
      const symbol = logoSymbolForChain(key)
      const icon = `https://assets.parqet.com/logos/crypto/${symbol}?format=png`
      return { value: key, label: toLabel(key), icon }
    })
  }, [])

  // Get available tokens for the selected destination chain
  const destinationTokens = useMemo(() => {
    if (!destinationChain) return []
    
    const networkKey = (network === 'mainnet' ? 'mainnet' : 'testnet') as TokenNetwork
    
    // For ZetaChain, show ZRC-20 tokens
    if (destinationChain === 'zetachain') {
      const tokens = getTokensFor('zetachain', networkKey)
      return tokens.map((token) => ({
        value: token.symbol,
        label: token.symbol,
        name: token.name,
        logo: `https://assets.parqet.com/logos/crypto/${token.logo || token.symbol}?format=png`
      }))
    }
    
    // For other chains, show native tokens and ERC-20s
    const tokens = getTokensFor(destinationChain, networkKey)
    
    return tokens.map((token) => ({
      value: token.symbol,
      label: token.symbol,
      name: token.name,
      logo: `https://assets.parqet.com/logos/crypto/${token.logo || token.symbol}?format=png`
    }))
  }, [destinationChain, network])

  const handleSend = async () => {
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

    setIsLoading(true);
    try {
      // Determine transfer type and target token
      const originChain = (asset.chain || 'ethereum').toLowerCase() as SupportedEvm;
      const isSolanaOrigin = (asset.chain || '').toLowerCase() === 'solana'
      const targetChain = destinationChain as SupportedEvm;

      // Resolve token addresses from tokens.ts
      const networkKey = (network === 'mainnet' ? 'mainnet' : 'testnet') as TokenNetwork;

      // Source token: ERC-20 on origin chain (or zero address for native tokens)
      const originTokens = getTokensFor(originChain, networkKey);
      const originTokenInfo = originTokens.find(t => t.symbol.toUpperCase() === asset.symbol.toUpperCase());
      // For Solana origin, use SPL mint for tokens (USDC/USDT), undefined for SOL
      const sourceTokenAddress = isSolanaOrigin
        ? (originTokenInfo?.addressByNetwork?.[networkKey] || '')
        : (originTokenInfo?.addressByNetwork?.[networkKey] || '0x0000000000000000000000000000000000000000');

      // Target token: ZRC-20 on ZetaChain representing the destination asset/chain
      console.log('Resolving target token:', { targetChain, destinationToken, networkKey })
      const targetTokenAddress = getZrcAddressFor(targetChain, destinationToken, networkKey)
      console.log('Target token address resolved:', targetTokenAddress)

      if (!targetTokenAddress) {
        throw new Error(`Target token address not available: target=${targetTokenAddress}`);
      }

      // Load mnemonic from session (support nested wallet key)
      const sessionRaw = typeof window !== 'undefined' ? localStorage.getItem('zet_wallet_session') : null;
      const session = sessionRaw ? (() => { try { return JSON.parse(sessionRaw) } catch { return {} } })() : {} as any;
      const sessionMnemonic: string | undefined =
        session?.wallet?.mnemonicPhrase ||
        session?.wallet?.mnemonic ||
        session?.wallet?.seedPhrase;
      if (!sessionMnemonic || typeof sessionMnemonic !== 'string' || sessionMnemonic.trim().length === 0) {
        throw new Error('Wallet session not found. Please restore or create a wallet.');
      }

      console.log('Transfer Parameters:', {
        originChain,
        targetChain,
        amount,
        sourceTokenSymbol: asset.symbol,
        destinationTokenSymbol: destinationToken,
        sourceTokenAddress,
        targetTokenAddress,
        recipient: recipientAddress,
        network,
        isNativeToken: !originTokenInfo?.addressByNetwork?.[networkKey]
      })

      const tx = await smartCrossChainTransfer({
        originChain,
        targetChain,
        amount,
        tokenSymbol: destinationToken,
        sourceTokenAddress,
        targetTokenAddress,
        recipient: recipientAddress,
        mnemonicPhrase: sessionMnemonic,
        network,
      });
      setTxHash(tx.hash);
      setTxPhase('pending');

      // First wait for origin chain confirmation
      try {
        const originResult = isSolanaOrigin
          ? await (async () => {
              const sol = await waitForSolTxConfirmation({ signature: tx.hash, network })
              if (sol.status === 'finalized') {
                return { status: 'confirmed', confirmations: 1 }
              }
              if (sol.status === 'failed') {
                return { status: 'failed', confirmations: 0 }
              }
              return { status: 'timeout', confirmations: 0 }
            })()
          : await waitForTxConfirmation({
              originChain,
              hash: tx.hash,
              network,
              requiredConfirmations: 1,
              timeoutMs: 120000 // 2 minutes for origin chain
            });

        setTxPhase(originResult.status as any);
        setConfirmations(originResult.confirmations);
        if ('gasUsed' in originResult) setGasUsed((originResult as any).gasUsed);
        if ('blockNumber' in originResult) setBlockNumber((originResult as any).blockNumber);

        if (originResult.status === 'confirmed') {
          toast.success('Transaction confirmed on origin chain!', {
            description: `Now tracking cross-chain completion...`,
            duration: 5000
          });

          if (!isSolanaOrigin) {
            // Track only for EVM origins for now
            try {
              const cctxResult = await trackCrossChainTransaction({
                hash: tx.hash,
                network,
                timeoutSeconds: 300
              });
              setTxPhase(cctxResult.status);
              setCctxs(cctxResult.cctxs || []);
              if (cctxResult.status === 'completed') {
                toast.success('Cross-chain transfer completed!', { description: `Successfully transferred to ${destinationChain}`, duration: 10000 });
              } else if (cctxResult.status === 'failed') {
                toast.error('Cross-chain transfer failed', { description: cctxResult.error || 'Transfer failed during cross-chain processing', duration: 10000 });
              } else if (cctxResult.status === 'timeout') {
                toast.warning('Cross-chain transfer timeout', { description: 'Transfer is taking longer than expected. Please check the blockchain explorer.', duration: 10000 });
              }
            } catch (cctxError) {
              console.error('Error tracking cross-chain transaction:', cctxError);
              setTxPhase('pending');
            }
          }
        } else if (originResult.status === 'failed') {
          toast.error('Transaction failed on origin chain', {
            description: `Transaction failed on origin chain`,
            duration: 10000
          });
        } else if (originResult.status === 'timeout') {
          toast.warning('Transaction timeout on origin chain', {
            description: 'Transaction is taking longer than expected. Please check the blockchain explorer.',
            duration: 10000
          });
        }
      } catch (error) {
        console.error('Error tracking transaction:', error);
        setTxPhase('failed');
        toast.error('Error tracking transaction', {
          description: 'Unable to track transaction status. Please check the blockchain explorer.',
          duration: 10000
        });
      }
    } catch (e: any) {
      console.error('Transfer error:', e);
      toast.error(e?.message || 'Failed to send transfer');
    } finally {
      setIsLoading(false);
    }
  };

  const maxAmount = parseFloat(asset.balance.replace(/,/g, ''));
  const assetUsd = parseFloat(asset.usdValue.replace(/,/g, ''));
  const usdAmount = amount ? (parseFloat(amount || '0') * (maxAmount > 0 ? assetUsd / maxAmount : 0)) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <Card className="w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
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

              {(txPhase === 'confirmed' || txPhase === 'completed') && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confirmations:</span>
                    <span>{confirmations}</span>
                  </div>
                  {blockNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Block Number:</span>
                      <span>{blockNumber.toLocaleString()}</span>
                    </div>
                  )}
                  {gasUsed && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gas Used:</span>
                      <span>{parseInt(gasUsed).toLocaleString()}</span>
                    </div>
                  )}
                  {txPhase === 'completed' && cctxs.length > 0 && (
                    <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <div className="text-xs font-medium text-green-800 dark:text-green-200">
                        Cross-chain transfers completed: {cctxs.length}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {txPhase === 'pending' && (
                <div className="space-y-2">
                  <div className="text-sm">Confirmations: {confirmations}</div>
                  <div className="text-xs text-muted-foreground">
                    Waiting for origin chain confirmation. Cross-chain transfers typically take 1-3 minutes total.
                  </div>
                </div>
              )}

              {txPhase === 'confirmed' && (
                <div className="space-y-2">
                  <div className="text-sm">Origin chain confirmed</div>
                  <div className="text-xs text-muted-foreground">
                    Now processing cross-chain transfer to {destinationChains.find(c => c.value === destinationChain)?.label}...
                  </div>
                </div>
              )}

              {txPhase === 'timeout' && (
                <div className="text-xs text-muted-foreground">
                  Transaction is taking longer than expected. This can happen during network congestion.
                  Please check the blockchain explorer for the latest status.
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Asset Info */}
              <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                <div className="w-10 h-10 bg-background rounded-full flex items-center justify-center overflow-hidden">
                  <img
                    src={asset.logo}
                    alt={asset.symbol}
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="w-8 h-8 bg-muted rounded-full items-center justify-center text-xs font-semibold hidden">
                    {asset.symbol}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">{asset.symbol}</span>
                    <Badge variant="secondary" className="text-xs">{asset.chain}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Balance: {asset.balance} {asset.symbol}</p>
                </div>
              </div>

              {/* Recipient Address */}
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Address</Label>
                <Input
                  id="recipient"
                  placeholder="Enter wallet address"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className="font-mono"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="space-y-2">
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="0.000001"
                  />
                  {amount && (
                    <p className="text-sm text-muted-foreground">
                      ≈ ${usdAmount.toFixed(2)} USD
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(asset.balance.replace(',', ''))}
                    className="w-full"
                  >
                    Max: {asset.balance} {asset.symbol}
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-start gap-5">
                {/* Destination Chain */}
                <div className="space-y-2">
                  <Label htmlFor="destination">Destination Chain</Label>
                  <Select value={destinationChain} onValueChange={(value) => {
                    setDestinationChain(value)
                    setDestinationToken('') // Reset destination token when chain changes
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination chain" />
                    </SelectTrigger>
                    <SelectContent>
                      {destinationChains.map((chain) => (
                        <SelectItem key={chain.value} value={chain.value}>
                          <div className="flex items-center space-x-2">
                            <img
                              src={chain.icon}
                              alt={chain.label}
                              className="w-4 h-4 object-contain"
                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                            <span>{chain.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Destination Token */}
                {destinationChain && (
                  <div className="space-y-2">
                    <Label htmlFor="destinationToken">Destination Token</Label>
                    <Select value={destinationToken} onValueChange={setDestinationToken}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination token" />
                      </SelectTrigger>
                      <SelectContent>
                        {destinationTokens.map((token) => (
                          <SelectItem key={token.value} value={token.value}>
                            <div className="flex items-center space-x-2">
                              <img
                                src={token.logo}
                                alt={token.label}
                                className="w-4 h-4 object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                              />
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

              {/* Cross-chain Warning */}
              {destinationChain && destinationChain !== asset.chain.toLowerCase() && (
                <div className="flex items-start space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">
                      Cross-chain Transfer
                    </p>
                    <p className="text-yellow-700 dark:text-yellow-300">
                      This will transfer {asset.symbol} from {asset.chain} to {destinationChains.find(c => c.value === destinationChain)?.label} and receive {destinationToken}.
                    </p>
                  </div>
                </div>
              )}

              {/* Transaction Summary */}
              {amount && recipientAddress && destinationChain && destinationToken && (
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold">Transaction Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span>{amount} {asset.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">From:</span>
                      <span>{asset.chain}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">To:</span>
                      <span>{destinationChains.find(c => c.value === destinationChain)?.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Receive:</span>
                      <span>{destinationToken}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Network Fee:</span>
                      <span>~$5.00</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Total:</span>
                      <span>{amount} {asset.symbol}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  {txHash ? 'Close' : 'Cancel'}
                </Button>
                {!txHash && (
                  <Button
                    onClick={handleSend}
                    disabled={isLoading || !amount || !recipientAddress || !destinationChain || !destinationToken}
                    className="flex-1 flex items-center space-x-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <span>Send</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
