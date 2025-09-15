"use client";

import { useParams } from 'next/navigation';
import AssetDetails from '@/components/AssetDetails';
import { useNetwork } from '@/contexts/NetworkContext';
import { getTokensFor } from '@/lib/tokens';
import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { fetchBalancesForChain } from '@/lib/balances';
import { IN_APP_RPC_MAP } from '@/lib/rpc';
import { getTokenPriceUSD } from '@/lib/prices';
import { fetchZetaTokens } from '@/lib/zetaRegistry';

export default function AssetPage() {
  const params = useParams();
  const assetId = params.id as string;
  const { network } = useNetwork();
  const { wallet } = useWallet();
  
  // Expect id format: `${chain}-${symbol}-${index}` from Dashboard
  const [chainKey, symbolFromId] = assetId.split('-');
  const [zetaTokens, setZetaTokens] = useState<any[]>([])
  useEffect(() => {
    const load = async () => {
      if (chainKey !== 'zetachain') return
      const list = await fetchZetaTokens(network)
      setZetaTokens(list.map((t) => ({ symbol: t.symbol.toUpperCase(), name: t.name, logo: t.symbol.toUpperCase(), addressByNetwork: { [network]: t.address } })))
    }
    load()
  }, [chainKey, network])
  const tokens = chainKey === 'zetachain' ? zetaTokens : getTokensFor(chainKey, network);
  const token = tokens.find(t => t.symbol.toLowerCase() === (symbolFromId || '').toLowerCase());
  const [balance, setBalance] = useState<string>('—')
  const [usdValue, setUsdValue] = useState<string>('0.00')
  const [loading, setLoading] = useState<boolean>(false)

  const tokenAddress = useMemo(() => token?.addressByNetwork?.[network] || '', [token, network])

  useEffect(() => {
    const run = async () => {
      if (!wallet?.address || !token) return
      setLoading(true)
      try {
        const map = await fetchBalancesForChain({
          chain: chainKey,
          network,
          address: wallet.address,
          tokens: [{ symbol: token.symbol, address: tokenAddress || undefined }],
          rpcMap: IN_APP_RPC_MAP as any,
        })
        const bal = map[token.symbol]
        if (bal !== undefined) {
          setBalance(Number(bal).toFixed(4))
          const price = await getTokenPriceUSD(token.symbol)
          if (price !== null) setUsdValue((Number(bal) * price).toFixed(2))
        }
      } catch (e) {
        setBalance('0')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [wallet?.address, tokenAddress, token?.symbol, chainKey, network])
  
  const asset = token ? {
    id: assetId,
    symbol: token.symbol,
    name: token.name,
    balance: loading ? '—' : balance,
    usdValue: loading ? '0.00' : usdValue,
    chain: chainKey,
    logo: `https://assets.parqet.com/logos/crypto/${token.logo || token.symbol}?format=png`,
  } : null;
  
  if (!asset) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Asset not found</h1>
          <p className="text-muted-foreground">The requested asset could not be found.</p>
        </div>
      </div>
    );
  }

  return <AssetDetails asset={asset} />;
}
