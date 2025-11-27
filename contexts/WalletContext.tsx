"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { HDNodeWallet } from 'ethers';
// Solana wallet generation removed
import { useBiometric } from '@/contexts/BiometricContext';
import { backendApi } from '@/lib/services/backend-api';
import { toast } from 'sonner';

export interface Wallet {
  address: string;
  mnemonic: string;
  isImported: boolean;
}

interface WalletContextType {
  wallet: Wallet | null;
  isWalletInitialized: boolean;
  isLoading: boolean;
  createWallet: () => void;
  importWallet: (mnemonic: string) => void;
  confirmMnemonicSaved: (referralCode?: string) => void;
  clearWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isWalletInitialized, setIsWalletInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { encryptNewMnemonic, isAppUnlocked } = useBiometric();

  // Session management functions - NO LONGER STORING SENSITIVE DATA IN LOCALSTORAGE
  const saveSession = (walletData: Wallet) => {
    // Only store non-sensitive session info in localStorage
    const sessionData = {
      hasWallet: true,
      address: walletData.address, // Only store public address
      timestamp: Date.now(),
      sessionId: `zet_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    localStorage.setItem('zet_wallet_session', JSON.stringify(sessionData));
  };

  const loadSession = (): { hasWallet: boolean; address: string; sessionId: string } | null => {
    try {
      const sessionData = localStorage.getItem('zet_wallet_session');
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        // Check if session is not older than 30 days
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        if (parsed.timestamp > thirtyDaysAgo) {
          return { 
            hasWallet: parsed.hasWallet, 
            address: parsed.address, 
            sessionId: parsed.sessionId 
          };
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

  // Load wallet from biometric system when app is unlocked
  const loadWalletFromBiometric = async () => {
    try {
      // This will be called by the biometric system when wallet is unlocked
      // For now, we'll get the address from the session
      const session = loadSession();
      if (session?.address) {
        // Create a wallet object with just the address (mnemonic stays encrypted)
        const walletData: Wallet = {
          address: session.address,
          mnemonic: '', // Never store mnemonic in memory - it's encrypted in IndexedDB
          isImported: false,
        };
        setWallet(walletData);
      }
    } catch (error) {
      console.error('Error loading wallet from biometric system:', error);
    }
  };

  // Initialize wallet from biometric system on mount
  useEffect(() => {
    const session = loadSession();
    if (session?.hasWallet) {
      // We have a wallet session, but the actual wallet data is encrypted in IndexedDB
      // The wallet will be loaded when the user unlocks with biometrics
      setIsWalletInitialized(true);
    }
    setIsLoading(false);
  }, []);

  // Load wallet when app is unlocked
  useEffect(() => {
    if (isAppUnlocked) {
      loadWalletFromBiometric();
    } else {
      // Clear wallet from memory when app is locked
      setWallet(null);
    }
  }, [isAppUnlocked]);

  const createWallet = () => {
    const hd = HDNodeWallet.createRandom();
    const baseWallet: Wallet = {
      address: hd.address,
      mnemonic: hd.mnemonic?.phrase ?? '', // Temporarily store for encryption
      isImported: false,
    };
    setWallet(baseWallet);
    // Wait for user confirmation before initializing app session
  };

  const importWallet = (mnemonic: string) => {
    const hd = HDNodeWallet.fromPhrase(mnemonic.trim());
    const baseWallet: Wallet = {
      address: hd.address,
      mnemonic: hd.mnemonic?.phrase ?? mnemonic.trim(), // Temporarily store for encryption
      isImported: true,
    };
    setWallet(baseWallet);
    // Wait for user confirmation before initializing app session
  };

  const confirmMnemonicSaved = async (referralCode?: string) => {
    if (wallet) {
      // Encrypt the mnemonic with biometric authentication
      try {
        const result = await encryptNewMnemonic(wallet.mnemonic);
        if (result.success) {
          // Create wallet object without mnemonic for session storage
          const walletForSession: Wallet = {
            address: wallet.address,
            mnemonic: '', // Never store mnemonic in memory
            isImported: wallet.isImported,
          };
          
          // Register user with backend
          try {
            const biometricPublicKey = result.biometricPublicKey;
            if (biometricPublicKey) {
              await backendApi.createUser({
                walletAddress: wallet.address,
                biometricPublicKey,
                name: '',
                email: '',
                username: '',
                sessionTimeout: 30, // Default 30 minutes
              });
              
              // Apply referral code if provided and this is a new wallet (not imported)
              if (referralCode && referralCode.trim() && !wallet.isImported) {
                try {
                  await backendApi.applyReferralCode(wallet.address, biometricPublicKey, referralCode.trim());
                  toast.success('Referral code applied successfully! You both earned rewards! 🎉');
                } catch (refError: any) {
                  // Don't block wallet creation if referral fails
                  if (refError?.message?.includes('already applied')) {
                    toast.info('Referral code was already applied');
                  } else if (refError?.message?.includes('Invalid')) {
                    toast.error('Invalid referral code');
                  } else {
                    toast.warning('Could not apply referral code');
                  }
                  console.error('Failed to apply referral code:', refError);
                }
              }
              
              toast.success('Wallet created and registered successfully!');
            } else {
              toast.warning('Wallet created but registration failed - no biometric key');
            }
          } catch (error: any) {
            // If user already exists (importing old wallet), don't show error
            if (error?.message?.includes('already exists') || error?.status === 409) {
              // User already exists - UserSettingsContext will automatically sync their data
              console.log('Existing user found, wallet imported successfully');
              toast.success('Wallet imported successfully!');
            } else if (error instanceof Error) {
              toast.error(`Registration failed: ${error.message}`);
            } else {
              toast.error('Registration failed: Unable to connect to server');
            }
            // Don't block wallet creation if backend registration fails
          }
          
          // Save session after successful encryption
          saveSession(walletForSession);
          setWallet(walletForSession); // Update wallet state without mnemonic
          setIsWalletInitialized(true);
        } else {
          console.error('Failed to encrypt mnemonic:', result.error);
          // Still save session but show error
          const walletForSession: Wallet = {
            address: wallet.address,
            mnemonic: '', // Never store mnemonic in memory
            isImported: wallet.isImported,
          };
          saveSession(walletForSession);
          setWallet(walletForSession);
          setIsWalletInitialized(true);
        }
      } catch (error) {
        console.error('Error encrypting mnemonic:', error);
        // Still save session but show error
        const walletForSession: Wallet = {
          address: wallet.address,
          mnemonic: '', // Never store mnemonic in memory
          isImported: wallet.isImported,
        };
        saveSession(walletForSession);
        setWallet(walletForSession);
        setIsWalletInitialized(true);
      }
    }
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