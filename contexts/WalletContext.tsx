"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { HDNodeWallet } from 'ethers';
import { getSolanaAddressFromMnemonic } from '@/lib/solana';

export interface Wallet {
  address: string;
  mnemonic: string;
  isImported: boolean;
  solanaAddress?: string;
}

interface WalletContextType {
  wallet: Wallet | null;
  isWalletInitialized: boolean;
  isLoading: boolean;
  createWallet: () => void;
  importWallet: (mnemonic: string) => void;
  confirmMnemonicSaved: () => void;
  clearWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isWalletInitialized, setIsWalletInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Session management functions
  const saveSession = (walletData: Wallet) => {
    const sessionData = {
      wallet: walletData,
      timestamp: Date.now(),
      sessionId: `zet_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    localStorage.setItem('zet_wallet_session', JSON.stringify(sessionData));
  };

  const loadSession = (): { wallet: Wallet; sessionId: string } | null => {
    try {
      const sessionData = localStorage.getItem('zet_wallet_session');
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        // Check if session is not older than 30 days
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        if (parsed.timestamp > thirtyDaysAgo) {
          return { wallet: parsed.wallet, sessionId: parsed.sessionId };
        } else {
          // Session expired, clear it
          localStorage.removeItem('zet_wallet_session');
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
      localStorage.removeItem('zet_wallet_session');
    }
    return null;
  };

  const clearSession = () => {
    localStorage.removeItem('zet_wallet_session');
  };

  // Initialize wallet from session on mount
  useEffect(() => {
    const session = loadSession();
    if (session) {
      const w = session.wallet as Wallet
      // Backfill solanaAddress if missing
      if (!w.solanaAddress && w.mnemonic) {
        getSolanaAddressFromMnemonic(w.mnemonic).then((addr) => {
          const updated: Wallet = { ...w, solanaAddress: addr }
          setWallet(updated)
          saveSession(updated)
          setIsWalletInitialized(true)
          setIsLoading(false)
        }).catch(() => {
          setWallet(w)
          setIsWalletInitialized(true)
          setIsLoading(false)
        })
        return
      }
      setWallet(w);
      setIsWalletInitialized(true);
    }
    setIsLoading(false);
  }, []);

  const createWallet = () => {
    const hd = HDNodeWallet.createRandom();
    const baseWallet: Wallet = {
      address: hd.address,
      mnemonic: hd.mnemonic?.phrase ?? '',
      isImported: false,
    };
    // Also derive Solana address
    if (baseWallet.mnemonic) {
      getSolanaAddressFromMnemonic(baseWallet.mnemonic).then((solAddr) => {
        setWallet({ ...baseWallet, solanaAddress: solAddr });
      }).catch(() => setWallet(baseWallet))
    } else {
      setWallet(baseWallet)
    }
    // Wait for user confirmation before initializing app session
  };

  const importWallet = (mnemonic: string) => {
    const hd = HDNodeWallet.fromPhrase(mnemonic.trim());
    const baseWallet: Wallet = {
      address: hd.address,
      mnemonic: hd.mnemonic?.phrase ?? mnemonic.trim(),
      isImported: true,
    };
    // Also derive Solana address
    getSolanaAddressFromMnemonic(baseWallet.mnemonic).then((solAddr) => {
      const newWallet: Wallet = { ...baseWallet, solanaAddress: solAddr }
      setWallet(newWallet);
      saveSession(newWallet);
      setIsWalletInitialized(true);
    }).catch(() => {
      setWallet(baseWallet);
      saveSession(baseWallet);
      setIsWalletInitialized(true);
    })
  };

  const confirmMnemonicSaved = () => {
    if (wallet) {
      saveSession(wallet);
    }
    setIsWalletInitialized(true);
  };

  const clearWallet = () => {
    setWallet(null);
    setIsWalletInitialized(false);
    clearSession();
  };

  return (
    <WalletContext.Provider
      value={{
        wallet,
        isWalletInitialized,
        isLoading,
        createWallet,
        importWallet,
        confirmMnemonicSaved,
        clearWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
