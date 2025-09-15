"use client";

import { useState, useEffect } from 'react';
import { WalletProvider, useWallet } from '@/contexts/WalletContext';
import SplashScreen from '@/components/SplashScreen';
import WalletSetup from '@/components/WalletSetup';
import Dashboard from '@/components/Dashboard';

function AppContent() {
  const { isWalletInitialized } = useWallet();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (!isWalletInitialized) {
    return <WalletSetup />;
  }

  return <Dashboard />;
}

export default function Home() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}