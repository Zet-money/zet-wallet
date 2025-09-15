"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

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

const destinationChains = [
  { value: 'ethereum', label: 'Ethereum', icon: '🔷' },
  { value: 'solana', label: 'Solana', icon: '☀️' },
  { value: 'sui', label: 'Sui', icon: '🔵' },
  { value: 'ton', label: 'TON', icon: '💎' },
  { value: 'polygon', label: 'Polygon', icon: '🟣' },
  { value: 'bsc', label: 'BSC', icon: '🟡' }
];

export default function SendFlow({ asset, onClose }: SendFlowProps) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [destinationChain, setDestinationChain] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

    setIsLoading(true);
    
    // Simulate transaction processing
    setTimeout(() => {
      setIsLoading(false);
      toast.success('Transaction sent successfully!');
      onClose();
    }, 2000);
  };

  const maxAmount = parseFloat(asset.balance.replace(/,/g, ''));
  const assetUsd = parseFloat(asset.usdValue.replace(/,/g, ''));
  const usdAmount = amount ? (parseFloat(amount || '0') * (maxAmount > 0 ? assetUsd / maxAmount : 0)) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <Card className="w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Send {asset.symbol}</CardTitle>
            <CardDescription>Transfer {asset.symbol} to another wallet</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
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
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-xs font-semibold hidden">
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

          {/* Destination Chain */}
          <div className="space-y-2">
            <Label htmlFor="destination">Destination Chain</Label>
            <Select value={destinationChain} onValueChange={setDestinationChain}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination chain" />
              </SelectTrigger>
              <SelectContent>
                {destinationChains.map((chain) => (
                  <SelectItem key={chain.value} value={chain.value}>
                    <div className="flex items-center space-x-2">
                      <span>{chain.icon}</span>
                      <span>{chain.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  This will transfer {asset.symbol} from {asset.chain} to {destinationChains.find(c => c.value === destinationChain)?.label}.
                </p>
              </div>
            </div>
          )}

          {/* Transaction Summary */}
          {amount && recipientAddress && destinationChain && (
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
              Cancel
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={isLoading || !amount || !recipientAddress || !destinationChain}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
