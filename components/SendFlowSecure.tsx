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
  const { transferETH, transferERC20, isExecuting, error: transactionError } = useSecureTransaction();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [destinationChain, setDestinationChain] = useState('');
  const [destinationToken, setDestinationToken] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txPhase, setTxPhase] = useState<'idle' | 'pending' | 'confirmed' | 'failed' | 'completed'>('idle');
  const [transactionAmount, setTransactionAmount] = useState<string>('');

  // Destination chains
  const destinationChains = useMemo(() => {
    return Object.keys(EVM_TOKENS).map((key) => {
      const symbol = logoSymbolForChain(key);
      const icon = key === 'base' ? 'base-logo' : `https://assets.parqet.com/logos/crypto/${symbol}?format=png`;
      return { value: key, label: toLabel(key), icon };
    });
  }, []);

  // Get available tokens for the selected destination chain
  const destinationTokens = useMemo(() => {
    if (!destinationChain) return [];
    
    const networkKey = (network === 'mainnet' ? 'mainnet' : 'testnet') as TokenNetwork;
    const tokens = getTokensFor(destinationChain, networkKey);
    
    // If source token is USDC, only show USDC as destination token
    if (asset.symbol === 'USDC') {
      // Find USDC token with appropriate symbol for the destination chain
      let usdcToken = tokens.find(token => token.symbol === 'USDC');
      
      // For ZetaChain, look for USDC with the source chain suffix
      if (!usdcToken && destinationChain === 'zetachain') {
        // Map source chains to their USDC symbols on ZetaChain
        const usdcSymbolMap: { [key: string]: string } = {
          'base': 'USDC.BASE',
          'bsc': 'USDC.BSC',
          'ethereum': 'USDC.ETH',
          'polygon': 'USDC.POL',
          'arbitrum': 'USDC.ARB',
          'optimism': 'USDC.OP',
          'avalanche': 'USDC.AVAX'
        };
        
        const usdcSymbol = usdcSymbolMap[asset.chain] || 'USDC.BASE'; // Default to BASE if not found
        usdcToken = tokens.find(token => token.symbol === usdcSymbol);
      }
      
      if (usdcToken) {
        return [{
          value: usdcToken.symbol,
          label: usdcToken.symbol,
          name: usdcToken.name,
          logo: usdcToken.symbol === 'ETH' ? 'base-logo' : `https://assets.parqet.com/logos/crypto/${usdcToken.logo || usdcToken.symbol}?format=png`
        }];
      }
    }
    
    return tokens.map((token) => ({
      value: token.symbol,
      label: token.symbol,
      name: token.name,
      logo: token.symbol === 'ETH' ? 'base-logo' : `https://assets.parqet.com/logos/crypto/${token.logo || token.symbol}?format=png`
    }));
  }, [destinationChain, network, asset.symbol]);

  // Auto-select USDC as destination token when source is USDC
  useEffect(() => {
    if (asset.symbol === 'USDC' && destinationChain) {
      // For ZetaChain, use the appropriate USDC symbol based on source chain
      if (destinationChain === 'zetachain') {
        const usdcSymbolMap: { [key: string]: string } = {
          'base': 'USDC.BASE',
          'bsc': 'USDC.BSC',
          'ethereum': 'USDC.ETH',
          'polygon': 'USDC.POL',
          'arbitrum': 'USDC.ARB',
          'optimism': 'USDC.OP',
          'avalanche': 'USDC.AVAX'
        };
        const usdcSymbol = usdcSymbolMap[asset.chain] || 'USDC.BASE';
        setDestinationToken(usdcSymbol);
      } else {
        setDestinationToken('USDC');
      }
    }
  }, [asset.symbol, destinationChain, asset.chain]);

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
      // Get RPC URL for Base chain
      const rpcUrl = IN_APP_RPC_MAP['base']?.[network];
      if (!rpcUrl) {
        throw new Error(`RPC URL not available for Base ${network}`);
      }

      // Determine if this is a native ETH transfer or ERC20 transfer
      const isNativeToken = asset.symbol === 'ETH';
      
      let tx;
      if (isNativeToken) {
        // Native ETH transfer to ZetaChain
        console.log('[UI][SEND] Executing native ETH transfer');
        tx = await transferETH(amount, recipientAddress, rpcUrl);
      } else {
        // ERC20 token transfer to ZetaChain
        console.log('[UI][SEND] Executing ERC20 token transfer');
        
        // Get token address for the asset
        const networkKey = (network === 'mainnet' ? 'mainnet' : 'testnet') as TokenNetwork;
        const baseTokens = getTokensFor('base', networkKey);
        const tokenInfo = baseTokens.find(t => t.symbol.toUpperCase() === asset.symbol.toUpperCase());
        const tokenAddress = tokenInfo?.addressByNetwork?.[networkKey];
        
        if (!tokenAddress) {
          throw new Error(`Token address not found for ${asset.symbol}`);
        }
        
        tx = await transferERC20(amount, recipientAddress, tokenAddress, rpcUrl);
      }

      if (tx) {
        setTxHash(tx.hash);
        setTxPhase('pending');
        setTransactionAmount(amount);
        
        toast.success('Transaction submitted successfully!', {
          description: `Transaction ${tx.hash} has been submitted. Please wait for confirmation.`,
          duration: 5000
        });
      }
    } catch (error) {
      console.error('[UI][SEND] Transfer error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Transfer failed: ${errorMessage}`);
      setTxPhase('failed');
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
            <CardTitle>Send {asset.symbol}</CardTitle>
            <CardDescription>Transfer to another chain</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {/* Destination Chain */}
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

          {/* Destination Token */}
          {destinationChain && (
            <div className="space-y-2">
              <Label htmlFor="destinationToken">Destination Token</Label>
              <Select 
                value={destinationToken} 
                onValueChange={setDestinationToken}
                disabled={asset.symbol === 'USDC'}
              >
                <SelectTrigger className={asset.symbol === 'USDC' ? 'opacity-50 cursor-not-allowed' : ''}>
                  <SelectValue placeholder="Select destination token" />
                </SelectTrigger>
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
              {asset.symbol === 'USDC' && (
                <p className="text-sm text-muted-foreground">
                  Destination token is automatically set to USDC
                </p>
              )}
            </div>
          )}

          {/* Transaction Status */}
          {txHash && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Transaction Status</span>
                <Badge variant={txPhase === 'completed' ? 'default' : txPhase === 'failed' ? 'destructive' : 'secondary'}>
                  {txPhase}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground break-all">
                {txHash}
              </div>
            </div>
          )}

          {/* Error Display */}
          {transactionError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive">{transactionError}</span>
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
