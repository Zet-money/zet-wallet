"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Send, Download, Settings, Copy, Check } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

interface Asset {
  id: string;
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  chain: string;
  logo: string;
}

const mockAssets: Asset[] = [
  {
    id: '1',
    symbol: 'ETH',
    name: 'Ethereum',
    balance: '2.45',
    usdValue: '4,890.50',
    chain: 'Ethereum',
    logo: '🔷'
  },
  {
    id: '2',
    symbol: 'USDC',
    name: 'USD Coin',
    balance: '1,250.00',
    usdValue: '1,250.00',
    chain: 'Ethereum',
    logo: '💵'
  },
  {
    id: '3',
    symbol: 'SOL',
    name: 'Solana',
    balance: '15.8',
    usdValue: '2,340.20',
    chain: 'Solana',
    logo: '☀️'
  },
  {
    id: '4',
    symbol: 'SUI',
    name: 'Sui',
    balance: '500.0',
    usdValue: '125.00',
    chain: 'Sui',
    logo: '🔵'
  },
  {
    id: '5',
    symbol: 'TON',
    name: 'Toncoin',
    balance: '25.5',
    usdValue: '89.25',
    chain: 'TON',
    logo: '💎'
  }
];

const chains = [
  { value: 'ethereum', label: 'Ethereum', icon: '🔷' },
  { value: 'solana', label: 'Solana', icon: '☀️' },
  { value: 'sui', label: 'Sui', icon: '🔵' },
  { value: 'ton', label: 'TON', icon: '💎' },
  { value: 'polygon', label: 'Polygon', icon: '🟣' },
  { value: 'bsc', label: 'BSC', icon: '🟡' }
];

export default function Dashboard() {
  const { wallet } = useWallet();
  const router = useRouter();
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredAssets = mockAssets.filter(asset => 
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyAddress = async () => {
    if (wallet?.address) {
      try {
        await navigator.clipboard.writeText(wallet.address);
        setCopied(true);
        toast.success('Address copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast.error('Failed to copy address');
      }
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="text-sm font-bold text-primary">Z</span>
              </div>
              <div>
                <h1 className="font-semibold">Zet Wallet</h1>
                <p className="text-xs text-muted-foreground">
                  {wallet ? truncateAddress(wallet.address) : 'No wallet'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={copyAddress}
                className="flex items-center space-x-1 p-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">Copy</span>
              </Button>
              
              <Select defaultValue="mainnet">
                <SelectTrigger className="w-20 sm:w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mainnet">Mainnet</SelectItem>
                  <SelectItem value="testnet">Testnet</SelectItem>
                </SelectContent>
              </Select>
              
              <ThemeToggle />
              
              <Button variant="ghost" size="sm" className="p-2">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Chain Selector */}
        <div className="mb-6">
          <Select value={selectedChain} onValueChange={setSelectedChain}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a chain" />
            </SelectTrigger>
            <SelectContent>
              {chains.map((chain) => (
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

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          <Button className="h-12 sm:h-10 flex items-center justify-center space-x-2">
            <Send className="w-4 h-4" />
            <span>Send</span>
          </Button>
          <Button variant="outline" className="h-12 sm:h-10 flex items-center justify-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Receive</span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Assets List */}
        <div className="space-y-3">
          {filteredAssets.map((asset) => (
            <Card 
              key={asset.id} 
              className="hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]"
              onClick={() => router.push(`/asset/${asset.id}`)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-lg flex-shrink-0">
                      {asset.logo}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-semibold truncate">{asset.symbol}</h3>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {asset.chain}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{asset.name}</p>
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-semibold text-sm sm:text-base">{asset.balance}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">${asset.usdValue}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredAssets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No assets found</p>
          </div>
        )}
      </div>
    </div>
  );
}
