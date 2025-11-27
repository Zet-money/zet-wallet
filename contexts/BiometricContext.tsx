/**
 * BiometricContext - Manages app lock/unlock state with biometric authentication
 * This context wraps the entire app and controls access based on biometric authentication
 */

"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { biometricMigration, type MigrationResult, type UnlockResult } from '@/lib/migration/biometric-migration';
import { secureDB } from '@/lib/db/secure-db';
import { backendApi } from '@/lib/services/backend-api';
import { useWallet } from './WalletContext';

export interface BiometricContextType {
  isAppUnlocked: boolean;
  isBiometricSupported: boolean;
  isEncrypted: boolean;
  isLoading: boolean;
  needsBiometricSetup: boolean;
  needsWalletCreation: boolean;
  migrationStatus: {
    hasUnencrypted: boolean;
    hasEncrypted: boolean;
    biometricSupported: boolean;
  } | null;
  unlockApp: (timeoutMinutes?: number) => Promise<UnlockResult>;
  lockApp: () => void;
  setupBiometric: () => Promise<MigrationResult>;
  encryptNewMnemonic: (mnemonic: string) => Promise<MigrationResult>;
  clearBiometricCredentials: () => Promise<void>;
  checkMigrationStatus: () => Promise<void>;
  getBiometricPublicKey: () => Promise<string | null>;
}

const BiometricContext = createContext<BiometricContextType | undefined>(undefined);

export function BiometricProvider({ children }: { children: React.ReactNode }) {
  const [isAppUnlocked, setIsAppUnlocked] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [migrationStatus, setMigrationStatus] = useState<{
    hasUnencrypted: boolean;
    hasEncrypted: boolean;
    biometricSupported: boolean;
  } | null>(null);
  const [sessionTimeout, setSessionTimeout] = useState<NodeJS.Timeout | null>(null);
  const [needsBiometricSetup, setNeedsBiometricSetup] = useState(false);
  const [needsWalletCreation, setNeedsWalletCreation] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
  
  // Use refs to track activity time and timeout (avoids stale closure issues)
  const lastActivityRef = useRef<number>(Date.now());
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to get session timeout from user settings
  const getSessionTimeoutMinutes = async (): Promise<number> => {
    try {
      // Try to get from localStorage first
      const profileData = localStorage.getItem('zet_session_timeout');
      if (profileData) {
        return parseInt(profileData, 10) || 20;
      }
      return 20; // Default 20 minutes
    } catch (error) {
      return 20;
    }
  };

  // Helper function to check if user requires auth on reload
  const getRequireAuthOnReload = (): boolean => {
    try {
      const requireAuth = localStorage.getItem('zet_require_auth_reload');
      return requireAuth === 'true';
    } catch (error) {
      return false; // Default false - don't require auth on reload
    }
  };

  // Helper function to save last unlock time
  const saveLastUnlockTime = () => {
    try {
      localStorage.setItem('zet_last_unlock', Date.now().toString());
    } catch (error) {
      console.error('Failed to save last unlock time:', error);
    }
  };

  // Helper function to check if session has expired
  const checkSessionExpiry = async (): Promise<boolean> => {
    try {
      const lastUnlock = localStorage.getItem('zet_last_unlock');
      if (!lastUnlock) return true; // No record, consider expired

      const timeoutMinutes = await getSessionTimeoutMinutes();
      const lastUnlockTime = parseInt(lastUnlock, 10);
      const now = Date.now();
      const elapsed = now - lastUnlockTime;
      const timeoutMs = timeoutMinutes * 60 * 1000;

      return elapsed >= timeoutMs;
    } catch (error) {
      console.error('Error checking session expiry:', error);
      return true; // On error, require unlock
    }
  };

  // Helper function to update lastActive timestamp
  const updateLastActive = async () => {
    try {
      const wallet = JSON.parse(localStorage.getItem('zet_wallet_session') || '{}');
      if (wallet?.address) {
        const biometricPublicKey = await getBiometricPublicKey();
        if (biometricPublicKey) {
          await backendApi.updateLastActive(wallet.address, biometricPublicKey);
        }
      }
    } catch (error) {
      console.warn('Failed to update lastActive timestamp:', error);
    }
  };

  // Helper function to check if encrypted wallet has actual mnemonic data
  const checkWalletHasMnemonic = async (): Promise<boolean> => {
    try {
      const securedWallet = await secureDB.getWallet();
      if (!securedWallet) return false;
      
      // Check if the wallet has actual encrypted mnemonic data (not empty)
      return securedWallet.encryptedMnemonic.byteLength > 0;
    } catch (error) {
      console.error('Error checking wallet mnemonic:', error);
      return false;
    }
  };

  // Initialize biometric system
  useEffect(() => {
    const initializeBiometric = async () => {
      try {
        await biometricMigration.init();
        const status = await biometricMigration.getMigrationStatus();
        setMigrationStatus(status);
        setIsBiometricSupported(status.biometricSupported);
        setIsEncrypted(status.hasEncrypted);

        // Check if user needs biometric setup (no wallet data at all) or if biometric is not supported
        if (!status.hasUnencrypted && !status.hasEncrypted) {
          if (status.biometricSupported) {
            setNeedsBiometricSetup(true);
          } else {
            // If biometric is not supported, show error state
            setNeedsBiometricSetup(true);
          }
        } else if (status.hasEncrypted && status.biometricSupported) {
          // Check if the encrypted wallet has actual mnemonic data
          const hasMnemonic = await checkWalletHasMnemonic();
          if (hasMnemonic) {
            // Check user's preference for auth on reload
            const requireAuthOnReload = getRequireAuthOnReload();
            
            if (requireAuthOnReload) {
              // User wants to authenticate on every reload - leave app locked
              // isAppUnlocked stays false, user must unlock manually
            } else {
              // Check if session has expired
              const sessionExpired = await checkSessionExpiry();
              
              if (!sessionExpired) {
                // Session is still valid, auto-unlock
                const unlockResult = await biometricMigration.unlockWalletWithBiometrics();
                if (unlockResult.success) {
                  setIsAppUnlocked(true);
                  const now = Date.now();
                  setLastActivityTime(now);
                  lastActivityRef.current = now;
                  const timeoutMinutes = await getSessionTimeoutMinutes();
                  startSessionTimeout(timeoutMinutes);
                  // Update lastActive timestamp
                  await updateLastActive();
                }
              }
              // If session expired, leave app locked (isAppUnlocked stays false)
            }
          } else {
            // If we have encrypted data but no mnemonic, user needs to create wallet
            setNeedsWalletCreation(true);
            setIsAppUnlocked(true); // Allow access to wallet creation
            const now = Date.now();
            setLastActivityTime(now);
            lastActivityRef.current = now;
            saveLastUnlockTime();
          }
        } else if (status.hasUnencrypted && !status.hasEncrypted) {
          // If we have unencrypted data but no encrypted data, unlock the app
          // This allows users to migrate to biometric encryption
          setIsAppUnlocked(true);
          const now = Date.now();
          setLastActivityTime(now);
          lastActivityRef.current = now;
          saveLastUnlockTime();
        }
      } catch (error) {
        console.error('Error initializing biometric system:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeBiometric();
  }, []);

  // Session timeout management - only locks on inactivity
  const startSessionTimeout = (timeoutMinutes: number = 20) => {
    // Clear existing timeout
    if (sessionTimeoutRef.current) {
      clearInterval(sessionTimeoutRef.current);
    }

    // Reset activity time immediately when starting timeout
    const now = Date.now();
    setLastActivityTime(now);
    lastActivityRef.current = now;

    // Set timeout to check inactivity periodically
    const timeout = setInterval(() => {
      const currentTime = Date.now();
      const inactiveTime = currentTime - lastActivityRef.current;
      const timeoutMs = timeoutMinutes * 60 * 1000;
      
      // Only lock if user has been inactive for the timeout period
      if (inactiveTime >= timeoutMs) {
        setIsAppUnlocked(false);
        clearInterval(timeout);
        sessionTimeoutRef.current = null;
        setSessionTimeout(null);
      }
    }, 1000); // Check every second

    sessionTimeoutRef.current = timeout;
    setSessionTimeout(timeout);
  };

  const clearSessionTimeout = () => {
    if (sessionTimeoutRef.current) {
      clearInterval(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
      setSessionTimeout(null);
    }
  };

  // Track user activity
  const updateActivity = () => {
    const now = Date.now();
    setLastActivityTime(now);
    lastActivityRef.current = now;
  };

  // Set up activity listeners when app is unlocked
  useEffect(() => {
    if (!isAppUnlocked) return;

    // Add event listeners for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
    };
  }, [isAppUnlocked]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (sessionTimeoutRef.current) {
        clearInterval(sessionTimeoutRef.current);
      }
    };
  }, []); // Empty deps - only cleanup on unmount

  const unlockApp = async (timeoutMinutes?: number): Promise<UnlockResult> => {
    try {
      if (!isEncrypted) {
        return {
          success: false,
          error: 'No encrypted data found. Please set up biometric authentication first.'
        };
      }

      const result = await biometricMigration.unlockWalletWithBiometrics();
      if (result.success) {
        setIsAppUnlocked(true);
        const now = Date.now();
        setLastActivityTime(now);
        lastActivityRef.current = now;
        saveLastUnlockTime(); // Save unlock time to localStorage
        
        // Get timeout from user settings or use provided value
        const timeout = timeoutMinutes || await getSessionTimeoutMinutes();
        startSessionTimeout(timeout);
        
        // Update lastActive timestamp
        await updateLastActive();
      }
      return result;
    } catch (error) {
      console.error('Error unlocking app:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during unlock'
      };
    }
  };

  const lockApp = () => {
    setIsAppUnlocked(false);
    clearSessionTimeout();
  };

  const setupBiometric = async (): Promise<MigrationResult> => {
    try {
      const result = await biometricMigration.migrateLocalStorageToBiometric();
      if (result.success) {
        setIsEncrypted(true);
        setIsAppUnlocked(true);
        setNeedsBiometricSetup(false);
        setLastActivityTime(Date.now()); // Reset activity time after setup
        
        // Check if we need wallet creation after biometric setup
        const hasMnemonic = await checkWalletHasMnemonic();
        if (!hasMnemonic) {
          setNeedsWalletCreation(true);
        }
        
        startSessionTimeout(); // Start session timeout after setup
        await checkMigrationStatus();
      }
      return result;
    } catch (error) {
      console.error('Error setting up biometric:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during biometric setup'
      };
    }
  };

  const encryptNewMnemonic = async (mnemonic: string): Promise<MigrationResult> => {
    try {
      const result = await biometricMigration.encryptNewMnemonic(mnemonic);
      if (result.success) {
        setIsEncrypted(true);
        setNeedsWalletCreation(false); // Wallet creation is now complete
        await checkMigrationStatus();
      }
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during encryption'
      };
    }
  };

  const clearBiometricCredentials = async (): Promise<void> => {
    try {
      await biometricMigration.clearBiometricCredentials();
      await checkMigrationStatus();
    } catch (error) {
      console.error('Error clearing biometric credentials:', error);
    }
  };

  const checkMigrationStatus = async (): Promise<void> => {
    try {
      const status = await biometricMigration.getMigrationStatus();
      setMigrationStatus(status);
      setIsBiometricSupported(status.biometricSupported);
      setIsEncrypted(status.hasEncrypted);
    } catch (error) {
      console.error('Error checking migration status:', error);
    }
  };

  const getBiometricPublicKey = async (): Promise<string | null> => {
    try {
      const credentials = await secureDB.getAllCredentials();
      if (credentials && credentials.length > 0) {
        return credentials[0].publicKey;
      }
      return null;
    } catch (error) {
      console.error('[BiometricContext] Error getting biometric public key:', error);
      return null;
    }
  };

  return (
    <BiometricContext.Provider
      value={{
        isAppUnlocked,
        isBiometricSupported,
        isEncrypted,
        isLoading,
        needsBiometricSetup,
        needsWalletCreation,
        migrationStatus,
        unlockApp,
        lockApp,
        setupBiometric,
        encryptNewMnemonic,
        clearBiometricCredentials,
        checkMigrationStatus,
        getBiometricPublicKey,
      }}
    >
      {children}
    </BiometricContext.Provider>
  );
}

export function useBiometric() {
  const context = useContext(BiometricContext);
  if (context === undefined) {
    throw new Error('useBiometric must be used within a BiometricProvider');
  }
  return context;
}
