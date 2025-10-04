"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Send, Download, Settings, Copy, Check, X, Lock, TrendingUp, TrendingDown } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useBiometric } from '@/contexts/BiometricContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import UserSettingsModal from './UserSettingsModal';
import BaseLogo from './BaseLogo';
import { useNetwork } from '@/contexts/NetworkContext';
import { getTokensFor } from '@/lib/tokens';
import { fetchBalancesForChain } from '@/lib/balances';
import { IN_APP_RPC_MAP } from '@/lib/rpc';
import { getTokenPriceUSD, getTokenChangeUSD24h } from '@/lib/prices';
import ReceiveFlow from './ReceiveFlow';
import SellCryptoModal from './SellCryptoModal';
import { useSecureTransaction } from '@/hooks/useSecureTransaction';
import { NotificationPermissionBanner } from './NotificationPermissionBanner';
import { NotificationContainer } from './NotificationContainer';
import { notificationService } from '@/lib/services/notification-service';
import { useNotifications } from '@/contexts/NotificationContext';
// Solana imports removed - only Base chain supported

// Only Base chain is supported for sending

export default function Dashboard() {
  const { wallet } = useWallet();
  const { addNotification } = useNotifications();
  const { lockApp, isEncrypted } = useBiometric();
  const { profile } = useUserSettings();
  const { network, setNetwork } = useNetwork();
  const { transferETH, transferERC20, isExecuting } = useSecureTransaction();
  const router = useRouter();
  const isMainnet = network === 'mainnet';
  const [selectedChain, setSelectedChain] = useState('base'); // Only support Base chain
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  // Chain selection is disabled - only Base is supported

  // Persist selected chain on change
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem('zet.chain', selectedChain)
    } catch {}
  }, [selectedChain])

  // Setup notification message listener
  useEffect(() => {
    if (typeof window !== 'undefined' && wallet?.address) {
      console.log('Setting up notification message listener...');
      notificationService.setupMessageListener((payload) => {
        console.log('Received notification payload:', payload);
        
        // Show notification banner instead of toast
        if (payload.notification) {
          console.log('Adding notification to context:', {
            title: payload.notification.title,
            body: payload.notification.body,
            data: payload.data,
          });
          addNotification({
            title: payload.notification.title || 'New Notification',
            body: payload.notification.body || 'You have a new notification',
            data: payload.data,
          });
          console.log('Notification added to context');
        }
      });
    }
  }, [wallet?.address, addNotification]);

  const chainKey = 'base' // Only Base chain supported
  const baseTokens = getTokensFor(chainKey, network)
  const networkTokens = baseTokens.map((t, idx) => ({
    id: `${chainKey}-${t.symbol}-${idx}`,
    symbol: t.symbol,
    name: t.name,
    balance: '—',
    usdValue: '0.00',
    chain: 'Base',
    logo: `${t.symbol === 'cNGN' ? '/cngn.svg' : `https://assets.parqet.com/logos/crypto/${t.logo || t.symbol}?format=png`}`,
  }))

  const [balances, setBalances] = useState<Record<string, string>>({})
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [changes, setChanges] = useState<Record<string, number>>({})

  useEffect(() => {
    const load = async () => {
      if (!wallet?.address) return
      setLoadingBalances(true)
      console.log('loading balances for', chainKey, network, wallet.address)
      try {
        // Only Base chain is supported
        const tokensForFetch = baseTokens.map((t) => {
          const addr = t.addressByNetwork?.[network]
          const isErc20 = Boolean(t.addressByNetwork?.mainnet || t.addressByNetwork?.testnet)
          return {
            symbol: t.symbol,
            address: isErc20 ? (addr && addr.length > 0 ? addr : undefined) : null,
          }
        })
        const map = await fetchBalancesForChain({
          chain: chainKey,
          network,
          address: wallet.address,
          tokens: tokensForFetch,
          rpcMap: IN_APP_RPC_MAP,
        })
        console.log('balances', map)
        setBalances(map)

        // Load USD prices for visible symbols
        const uniqueSymbols = Array.from(new Set(baseTokens.map(t => t.symbol)))
        const entries = await Promise.all(uniqueSymbols.map(async (sym) => {
          const [price, change] = await Promise.all([
            getTokenPriceUSD(sym),
            getTokenChangeUSD24h(sym),
          ])
          return [sym, price ?? 0, change ?? 0]
        }))
        const priceMap: Record<string, number> = {}
        const changeMap: Record<string, number> = {}
        for (const row of entries) {
          const sym = row[0] as string
          const p = row[1] as number
          const c = row[2] as number
          priceMap[sym] = p
          changeMap[sym] = c
        }
        setPrices(priceMap)
        setChanges(changeMap)
      } catch (e) {
        console.error('error loading balances', e)
      } finally {
        setLoadingBalances(false)
      }
    }
    load()
    // reload when chain/network/wallet changes
  }, [chainKey, network, wallet?.address])

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
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary">Z</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-semibold text-sm sm:text-base">Zet Wallet</h1>
                  {profile?.name && (
                    <span className="text-sm text-muted-foreground hidden sm:inline">
                      Hi, {profile.name}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <img src="https://assets.parqet.com/logos/crypto/ETH?format=png" alt="ETH" className="w-3 h-3 flex-shrink-0" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    <span className="truncate">{wallet ? truncateAddress(wallet.address) : 'No EVM wallet'}</span>
                    <button
                      onClick={async () => { if (wallet?.address) { await navigator.clipboard.writeText(wallet.address); toast.success('EVM address copied') } }}
                      className="px-1 py-0.5 border rounded text-xs flex-shrink-0"
                    >Copy</button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              {isEncrypted && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={lockApp}
                  className="flex items-center space-x-1 p-2"
                  title="Lock app"
                >
                  <Lock className="w-4 h-4" />
                  <span className="hidden sm:inline">Lock</span>
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center space-x-1 p-2"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              
              <Select value={network} onValueChange={(v) => setNetwork(v as any)}>
                <SelectTrigger className="w-16 sm:w-20">
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

      {/* Notification Permission Banner */}
      <div className="container mx-auto px-4 max-w-4xl">
        <NotificationPermissionBanner />
      </div>

      {/* Notification Container */}
      <NotificationContainer />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Base Chain Display (Only supported chain) */}
        <div className="mb-6">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center space-x-3">
              <BaseLogo size={24} className="flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Base Network</h3>
                <p className="text-xs text-muted-foreground">Only supported chain for sending</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              Active
            </Badge>
          </div>
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

        {isMainnet && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <Button 
              onClick={() => setShowSellModal(true)}
              variant="outline" 
              className="h-12 sm:h-10 flex items-center justify-center space-x-2"
            >
              <TrendingDown className="w-4 h-4" />
              <span>Sell Crypto</span>
            </Button>
            <Button 
              onClick={() => setShowBuyModal(true)}
              variant="outline" 
              className="h-12 sm:h-10 flex items-center justify-center space-x-2"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Buy Crypto</span>
            </Button>
          </div>
        )}

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
                {networkTokens.slice(0, 6).map((asset) => (
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
          asset={(networkTokens.find(t => t.symbol === 'USDC') || networkTokens[0] || {
            id: `${chainKey}-USDC-0`,
            symbol: 'USDC',
            name: 'USD Coin',
            balance: '0.00',
            usdValue: '0.00',
            chain: 'Base',
            logo: 'https://assets.parqet.com/logos/crypto/USDC?format=png'
          })}
          onClose={() => setShowReceiveModal(false)} 
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

      {/* Settings Modal */}
      <UserSettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
      />
    </div>
  );
}
