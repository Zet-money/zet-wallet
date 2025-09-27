"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { WalletProvider, useWallet } from '@/contexts/WalletContext';
import { useBiometric } from '@/contexts/BiometricContext';
import SplashScreen from '@/components/SplashScreen';
import WalletSetup from '@/components/WalletSetup';
import Dashboard from '@/components/Dashboard';
import BiometricLockScreen from '@/components/BiometricLockScreen';
import BiometricSetup from '@/components/BiometricSetup';
import PwaInstallBanner from '@/components/PwaInstallBanner';

function AppContent() {
  const { isWalletInitialized, isLoading } = useWallet();
  const { isAppUnlocked, isBiometricSupported, isEncrypted, isLoading: isBiometricLoading, needsBiometricSetup } = useBiometric();
  const searchParams = useSearchParams();
  const initParam = searchParams.get('init');
  const [showSplash, setShowSplash] = useState(() => initParam === 'false' ? false : true);

  useEffect(() => {
    if (initParam === 'false') {
      setShowSplash(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [initParam]);

  // Show splash screen first
  if (showSplash) {
    return (
      <>
        <SplashScreen onComplete={() => setShowSplash(false)} />
        <PwaInstallBanner />
      </>
    );
  }

  // Show loading while checking session and biometric status
  if (isLoading || isBiometricLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 mx-auto bg-primary/10 rounded-lg flex items-center justify-center">
            <span className="text-lg font-bold text-primary">Z</span>
          </div>
          <p className="text-muted-foreground">Loading wallet...</p>
        </div>
        <PwaInstallBanner />
      </div>
    );
  }

  // Show biometric setup if needed (first time users)
  if (needsBiometricSetup) {
    return (
      <>
        <BiometricSetup />
        <PwaInstallBanner />
      </>
    );
  }

  // Show biometric lock screen if app is locked
  if (isEncrypted && !isAppUnlocked) {
    return (
      <>
        <BiometricLockScreen />
        <PwaInstallBanner />
      </>
    );
  }

  // Show wallet setup if no session found
  if (!isWalletInitialized) {
    return (
      <>
        <WalletSetup />
        <PwaInstallBanner />
      </>
    );
  }

  // Show dashboard if wallet is initialized
  return (
    <>
      <Dashboard />
      <PwaInstallBanner />
    </>
  );
}

export default function Home() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}