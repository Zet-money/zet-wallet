"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useBiometric } from '@/contexts/BiometricContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { toast } from 'sonner';
import ThemeToggle from './ThemeToggle';
import { useNetwork } from '@/contexts/NetworkContext';
import { getTokensFor } from '@/lib/tokens';
import { fetchBalancesForChain } from '@/lib/balances';
import { IN_APP_RPC_MAP } from '@/lib/rpc';
import { getTokenPriceUSD, getTokenChangeUSD24h } from '@/lib/prices';
import { NotificationPermissionBanner } from './NotificationPermissionBanner';
import HomeView from './HomeView';
import RewardsView from './RewardsView';
import ProfileView from './ProfileView';
import TransactionsView from './TransactionsView';
import BottomNavigation from './BottomNavigation';

export default function Dashboard() {
  const { wallet } = useWallet();
  const { lockApp, isEncrypted } = useBiometric();
  const { profile } = useUserSettings();
  const { network, setNetwork } = useNetwork();
  
  // View state management
  const [activeView, setActiveView] = useState<'home' | 'rewards' | 'profile' | 'transactions'>('home');

  // Balance and price state
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [changes, setChanges] = useState<Record<string, number>>({})

  const chainKey = 'base' // Only Base chain supported
  const baseTokens = getTokensFor(chainKey, network)
  const networkTokens = baseTokens.map((t, idx) => {
    const balance = balances[t.symbol] || '0';
    const price = prices[t.symbol] || 0;
    const usdValue = balance !== '0' && price > 0 ? (parseFloat(balance) * price).toFixed(2) : '0.00';
    
    return {
      id: `${chainKey}-${t.symbol}-${idx}`,
      symbol: t.symbol,
      name: t.name,
      balance: balance,
      usdValue: usdValue,
      chain: 'Base',
      logo: `${t.symbol === 'cNGN' ? '/cngn.svg' : `https://assets.parqet.com/logos/crypto/${t.logo || t.symbol}?format=png`}`,
    };
  })

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
                  <h1 className="font-semibold text-sm sm:text-base gradient-text">Zet.money</h1>
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
              
              <Select value={network} onValueChange={(v) => setNetwork(v as any)}>
                <SelectTrigger className="w-26 sm:w-30">
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

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Render active view */}
        {activeView === 'home' && (
          <HomeView 
            wallet={wallet}
            network={network}
            balances={balances}
            loadingBalances={loadingBalances}
            prices={prices}
            networkTokens={networkTokens}
            onNavigateToTransactions={() => setActiveView('transactions')}
          />
        )}
        
        {activeView === 'rewards' && <RewardsView />}
        
        {activeView === 'profile' && <ProfileView />}
        
        {activeView === 'transactions' && <TransactionsView onBack={() => setActiveView('home')} />}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation 
        activeView={activeView === 'transactions' ? 'home' : activeView}
        onViewChange={(view) => setActiveView(view)}
      </div>
    </div>
  );
}
