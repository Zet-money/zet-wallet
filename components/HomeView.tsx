"use client";

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Send, Download, X, TrendingUp, TrendingDown, ArrowRightLeft, Banknote, History, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import BaseLogo from './BaseLogo';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ReceiveFlow from './ReceiveFlow';
import SellCryptoModal from './SellCryptoModal';
import SendFlowSecure from './SendFlowSecure';

interface HomeViewProps {
  wallet: any;
  network: 'mainnet' | 'testnet';
  balances: Record<string, string>;
  loadingBalances: boolean;
  prices: Record<string, number>;
  networkTokens: any[];
  onNavigateToTransactions: () => void;
}

export default function HomeView({
  wallet,
  network,
  balances,
  loadingBalances,
  prices,
  networkTokens,
  onNavigateToTransactions,
}: HomeViewProps) {
  const router = useRouter();
  const isMainnet = network === 'mainnet';
  const [searchQuery, setSearchQuery] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showReceiveAssetSelector, setShowReceiveAssetSelector] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSendFlow, setShowSendFlow] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [selectedReceiveAsset, setSelectedReceiveAsset] = useState<any>(null);

  const filteredAssets = networkTokens.filter(asset => 
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: non-zero balances first (keep original order within groups)
  const displayedAssets = useMemo(() => {
    const annotated = filteredAssets.map((asset, idx) => ({ asset, idx }))
    annotated.sort((left, right) => {
      const lb = parseFloat(balances[left.asset.symbol] ?? '0')
      const rb = parseFloat(balances[right.asset.symbol] ?? '0')
      const lval = Number.isFinite(lb) ? lb : 0
      const rval = Number.isFinite(rb) ? rb : 0
      const lNonZero = lval > 0
      const rNonZero = rval > 0
      if (lNonZero === rNonZero) return left.idx - right.idx
      return lNonZero ? -1 : 1
    })
    return annotated.map(x => x.asset)
  }, [filteredAssets, balances])

  return (
    <div className="pb-20">
      {/* Base Chain Display */}
      <div className="mb-6">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center space-x-3">
            <BaseLogo size={24} className="flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-sm">Base Network</h3>
              <p className="text-xs text-muted-foreground">Only supported chain for sending. More chains coming soon.</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            Active
          </Badge>
        </div>
      </div>

      {/* Total Portfolio Value */}
      <Card className="mb-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20 p-0">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
            <Badge 
              variant="secondary" 
              className="cursor-pointer hover:bg-blue-500/20 transition-colors flex items-center gap-1 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 hover:scale-105"
              onClick={onNavigateToTransactions}
            >
              <History className="w-3 h-3" />
              <span>Transactions</span>
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-2xl sm:text-3xl font-bold gradient-text">
              {loadingBalances ? (
                <span className="inline-block h-8 w-24 bg-muted animate-pulse rounded" />
              ) : (
                (() => {
                  const total = displayedAssets.reduce((sum, asset) => {
                    const bal = balances[asset.symbol]
                    const price = prices[asset.symbol]
                    if (bal === undefined || price === undefined) return sum
                    return sum + (Number(bal) * price)
                  }, 0)
                  return `$${total.toFixed(2)}`
                })()
              )}
            </p>
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Banknote className="w-6 h-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <Button 
          onClick={() => setShowSendModal(true)}
          className="h-12 sm:h-10 flex items-center justify-center space-x-2 gradient-primary text-white"
        >
          <Send className="w-4 h-4" />
          <span>Send Crypto</span>
        </Button>
        <Button 
          onClick={() => setShowReceiveAssetSelector(true)}
          variant="outline" 
          className="h-12 sm:h-10 flex items-center justify-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Receive Crypto</span>
        </Button>
      </div>

      {/* Mainnet/Testnet Action Buttons */}
      <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4 mb-6">
        {/* Sell and Buy on same row on mobile */}
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button 
                  onClick={() => setShowSellModal(true)}
                  variant="outline" 
                  className="h-12 sm:h-10 flex items-center justify-center space-x-2 w-full"
                  disabled={!isMainnet}
                >
                  <TrendingDown className="w-4 h-4" />
                  <span>Sell Crypto</span>
                </Button>
              </div>
            </TooltipTrigger>
            {!isMainnet && (
              <TooltipContent side="bottom" className="max-w-xs">
                <p>Selling crypto is only available on Mainnet. Switch to Mainnet to sell your assets.</p>
              </TooltipContent>
            )}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button 
                  onClick={() => setShowBuyModal(true)}
                  variant="outline" 
                  className="h-12 sm:h-10 flex items-center justify-center space-x-2 w-full"
                  disabled={!isMainnet}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Buy Crypto</span>
                </Button>
              </div>
            </TooltipTrigger>
            {!isMainnet && (
              <TooltipContent side="bottom" className="max-w-xs">
                <p>Buying crypto is only available on Mainnet. Switch to Mainnet to purchase assets.</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Swap on separate row on mobile */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full sm:col-span-2 lg:col-span-1">
              <Button 
                variant="outline" 
                className="h-12 sm:h-10 flex items-center justify-center space-x-2 relative bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30 hover:from-purple-500/20 hover:to-blue-500/20 transition-all duration-200 w-full cursor-not-allowed"
                disabled
              >
                <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                <span className="text-purple-700 dark:text-purple-300">Swap Crypto</span>
                <Badge variant="secondary" className="absolute -top-2 -right-2 text-xs px-1 py-0 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0">
                  Soon
                </Badge>
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p>🚀 Swap feature is coming soon! We're cooking something amazing for you.</p>
          </TooltipContent>
        </Tooltip>
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
        {displayedAssets.map((asset) => (
          <Card 
            key={asset.id} 
            className="hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98] p-2 sm:p-3"
            onClick={() => router.push(`/asset/${asset.id}`)}
          >
            <CardContent>
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
                    <div className="w-8 h-8 bg-muted rounded-full items-center justify-center text-xs font-semibold hidden">
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
                  <p className="font-semibold text-sm sm:text-base">
                    {loadingBalances ? (
                      <span className="inline-block h-4 w-16 bg-muted animate-pulse rounded" />
                    ) : (
                      (() => {
                        const v = balances[asset.symbol]
                        if (v === undefined) return asset.balance
                        const num = Number(v)
                        if (!Number.isFinite(num)) return v
                        const s = num.toString()
                        const [int, dec = ''] = s.split('.')
                        if (dec.length <= 6) return s
                        return `${int}.${dec.slice(0, 6)}`
                      })()
                    )}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {loadingBalances ? (
                      <span className="inline-block h-3 w-12 bg-muted animate-pulse rounded" />
                    ) : (
                      (() => {
                        const bal = balances[asset.symbol]
                        const price = prices[asset.symbol]
                        if (bal === undefined || price === undefined) return '$0.00'
                        const usd = Number(bal) * price
                        return `$${usd.toFixed(2)}`
                      })()
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Testnet Faucet Link */}
      {!isMainnet && (
        <Card className="mt-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Need Testnet Tokens?</h3>
                  <p className="text-xs text-muted-foreground">Get free testnet tokens for testing</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://faucet.zet.money', '_blank')}
                className="flex items-center space-x-2"
              >
                <span>Get Tokens</span>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredAssets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No assets found</p>
        </div>
      )}

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
                {networkTokens.slice(0, 6).map((asset) => (
                  <Card 
                    key={asset.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setShowSendModal(false);
                      setSelectedAsset(asset);
                      setShowSendFlow(true);
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
                          <div className="w-6 h-6 bg-muted rounded-full items-center justify-center text-xs font-semibold hidden">
                            {asset.symbol}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold">{asset.symbol}</span>
                            <Badge variant="secondary" className="text-xs">{asset.chain}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {parseFloat(asset.balance).toFixed(6)} {asset.symbol}
                          </p>
                          {asset.usdValue !== '0.00' && (
                            <p className="text-xs text-muted-foreground">${asset.usdValue}</p>
                          )}
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

      {/* Receive Asset Selector Modal */}
      {showReceiveAssetSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Receive Tokens</CardTitle>
                <CardDescription>Select an asset to receive</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowReceiveAssetSelector(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {networkTokens.map((asset) => (
                  <Card 
                    key={asset.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setShowReceiveAssetSelector(false);
                      setSelectedReceiveAsset(asset);
                      setShowReceiveModal(true);
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
                          <div className="w-6 h-6 bg-muted rounded-full items-center justify-center text-xs font-semibold hidden">
                            {asset.symbol}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold">{asset.symbol}</span>
                            <Badge variant="secondary" className="text-xs">{asset.chain}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{asset.name}</p>
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
      {showReceiveModal && selectedReceiveAsset && (
        <ReceiveFlow 
          asset={selectedReceiveAsset}
          onClose={() => {
            setShowReceiveModal(false);
            setSelectedReceiveAsset(null);
          }} 
        />
      )}

      {/* Sell Crypto Modal */}
      {isMainnet && (
        <SellCryptoModal 
          isOpen={showSellModal} 
          onClose={() => setShowSellModal(false)} 
        />
      )}

      {/* Buy Crypto Modal - Placeholder */}
      {isMainnet && showBuyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Buy Crypto</CardTitle>
                <CardDescription>Coming soon</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowBuyModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Buy Crypto</h3>
                <p className="text-muted-foreground">
                  This feature is coming soon. You'll be able to buy crypto directly with your bank account.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Send Flow Modal */}
      {showSendFlow && selectedAsset && (
        <SendFlowSecure 
          asset={selectedAsset}
          onClose={() => {
            setShowSendFlow(false);
            setSelectedAsset(null);
          }}
        />
      )}
    </div>
  );
}
