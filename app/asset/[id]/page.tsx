"use client";

import { useParams } from 'next/navigation';
import AssetDetails from '@/components/AssetDetails';

// Mock asset data - in a real app this would come from an API
const mockAssets = [
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

export default function AssetPage() {
  const params = useParams();
  const assetId = params.id as string;
  
  const asset = mockAssets.find(a => a.id === assetId);
  
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
