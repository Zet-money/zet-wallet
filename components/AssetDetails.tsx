"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getTokenChangeUSD24h } from '@/lib/prices';
import { useRouter } from 'next/navigation';
import SendFlow from './SendFlow';
import ReceiveFlow from './ReceiveFlow';

interface AssetDetailsProps {
  asset: {
    id: string;
    symbol: string;
    name: string;
    balance: string;
    usdValue: string;
    chain: string;
    logo: string;
  };
}

export default function AssetDetails({ asset }: AssetDetailsProps) {
  const router = useRouter();
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [priceChange, setPriceChange] = useState<number | null>(null)
  const isPositive = (priceChange ?? 0) > 0;

  // Display helper: truncate without rounding to N decimal places
  function truncateBalance(value: string, decimals: number): string {
    if (!value) return '0'
    const clean = value.replace(/,/g, '')
    if (!clean.includes('.')) return clean
    const [intPart, fracPart = ''] = clean.split('.')
    if (decimals <= 0) return intPart
    const truncated = fracPart.slice(0, decimals)
    return truncated.length ? `${intPart}.${truncated}` : intPart
  }

  useEffect(() => {
    const load = async () => {
      const c = await getTokenChangeUSD24h(asset.symbol)
      setPriceChange(c)
    }
    load()
  }, [asset.symbol])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center overflow-hidden">
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
              <div>
                <h1 className="font-semibold text-lg">{asset.symbol}</h1>
                <p className="text-sm text-muted-foreground">{asset.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Balance Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div>
                <p className="text-2xl font-bold">{truncateBalance(asset.balance, 6)} {asset.symbol}</p>
                <p className="text-lg text-muted-foreground">${asset.usdValue}</p>
              </div>
              
              <div className="flex items-center justify-center space-x-2">
                <Badge variant="secondary">{asset.chain}</Badge>
                {priceChange !== null && (
                  <div className={`flex items-center space-x-1 text-sm ${
                    isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>{isPositive ? '+' : ''}{priceChange.toFixed(2)}%</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Button 
            onClick={() => setShowSend(true)}
            className="h-16"
          >
            <Send className="w-6 h-6" />
            <span>Send</span>
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowReceive(true)}
            className="h-16"
          >
            <Download className="w-6 h-6" />
            <span>Receive</span>
          </Button>
        </div>

        {/* Asset Info */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Information</CardTitle>
            <CardDescription>Details about {asset.symbol}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Symbol</span>
              <span className="font-medium">{asset.symbol}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{asset.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Network</span>
              <Badge variant="outline">{asset.chain}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Balance</span>
              <span className="font-medium">{truncateBalance(asset.balance, 6)} {asset.symbol}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">USD Value</span>
              <span className="font-medium">${asset.usdValue}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Send Flow */}
      {showSend && (
        <SendFlow 
          asset={asset} 
          onClose={() => setShowSend(false)} 
        />
      )}

      {/* Receive Flow */}
      {showReceive && (
        <ReceiveFlow 
          asset={asset} 
          onClose={() => setShowReceive(false)} 
        />
      )}
    </div>
  );
}
