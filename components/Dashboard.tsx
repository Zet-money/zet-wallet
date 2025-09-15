"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Send, Download, Settings, Copy, Check, X } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import { useNetwork } from '@/contexts/NetworkContext';
import { getTokensFor } from '@/lib/tokens';
import SendFlow from './SendFlow';
import ReceiveFlow from './ReceiveFlow';

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
    logo: 'https://assets.parqet.com/logos/crypto/ETH?format=png'
  },
  {
    id: '2',
    symbol: 'USDC',
    name: 'USD Coin',
    balance: '1,250.00',
    usdValue: '1,250.00',
    chain: 'Ethereum',
    logo: 'https://assets.parqet.com/logos/crypto/USDC?format=png'
  },
  {
    id: '3',
    symbol: 'SOL',
    name: 'Solana',
    balance: '15.8',
    usdValue: '2,340.20',
    chain: 'Solana',
    logo: 'https://assets.parqet.com/logos/crypto/SOL?format=png'
  },
  {
    id: '4',
    symbol: 'SUI',
    name: 'Sui',
    balance: '500.0',
    usdValue: '125.00',
    chain: 'Sui',
    logo: 'https://assets.parqet.com/logos/crypto/SUI?format=png'
  },
  {
    id: '5',
    symbol: 'TON',
    name: 'Toncoin',
    balance: '25.5',
    usdValue: '89.25',
    chain: 'TON',
    logo: 'https://assets.parqet.com/logos/crypto/TON?format=png'
  }
];

const chains = [
  { value: 'ethereum', label: 'Ethereum', icon: 'https://assets.parqet.com/logos/crypto/ETH?format=png' },
  { value: 'solana', label: 'Solana', icon: 'https://assets.parqet.com/logos/crypto/SOL?format=png' },
  { value: 'sui', label: 'Sui', icon: 'https://assets.parqet.com/logos/crypto/SUI?format=png' },
  { value: 'ton', label: 'TON', icon: 'https://assets.parqet.com/logos/crypto/TON?format=png' },
  { value: 'polygon', label: 'Polygon', icon: 'https://assets.parqet.com/logos/crypto/MATIC?format=png' },
  { value: 'bsc', label: 'BSC', icon: 'https://assets.parqet.com/logos/crypto/BNB?format=png' }
];

export default function Dashboard() {
  const { wallet } = useWallet();
  const { network, setNetwork } = useNetwork();
  const router = useRouter();
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  const chainKey = selectedChain as any
  const networkTokens = getTokensFor(chainKey, network).map((t, idx) => ({
    id: `${chainKey}-${t.symbol}-${idx}`,
    symbol: t.symbol,
    name: t.name,
    balance: '0.00',
    usdValue: '0.00',
    chain: chains.find(c => c.value === selectedChain)?.label || 'Ethereum',
    logo: `https://assets.parqet.com/logos/crypto/${t.logo || t.symbol}?format=png`,
  }))

  const filteredAssets = networkTokens.filter(asset => 
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
        <div className="container mx-auto px-4 py-4 max-w-4xl">
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
              
              <Select value={network} onValueChange={(v) => setNetwork(v as any)}>
                <SelectTrigger className="w-20 sm:w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mainnet">Mainnet</SelectItem>
                  <SelectItem value="testnet">Testnet</SelectItem>
                </SelectContent>
              </Select>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
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
                    <img 
                      src={chain.icon} 
                      alt={chain.label}
                      className="w-4 h-4 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <span>{chain.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          <Button 
            onClick={() => setShowSendModal(true)}
            className="h-12 sm:h-10 flex items-center justify-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </Button>
          <Button 
            onClick={() => setShowReceiveModal(true)}
            variant="outline" 
            className="h-12 sm:h-10 flex items-center justify-center space-x-2"
          >
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
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
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

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Send Tokens</CardTitle>
                <CardDescription>Select an asset to send</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowSendModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockAssets.slice(0, 3).map((asset) => (
                  <Card 
                    key={asset.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setShowSendModal(false);
                      router.push(`/asset/${asset.id}`);
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                          <img 
                            src={asset.logo} 
                            alt={asset.symbol}
                            className="w-6 h-6 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-semibold hidden">
                            {asset.symbol}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold">{asset.symbol}</span>
                            <Badge variant="secondary" className="text-xs">{asset.chain}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{asset.balance} {asset.symbol}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <ReceiveFlow 
          asset={{
            id: '1',
            symbol: 'ETH',
            name: 'Ethereum',
            balance: '2.45',
            usdValue: '4,890.50',
            chain: 'Ethereum',
            logo: 'https://assets.parqet.com/logos/crypto/ETH?format=png'
          }}
          onClose={() => setShowReceiveModal(false)} 
        />
      )}
    </div>
  );
}
