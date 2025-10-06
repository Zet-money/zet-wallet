/**
 * BiometricContext - Manages app lock/unlock state with biometric authentication
 * This context wraps the entire app and controls access based on biometric authentication
 */

"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
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
          // If we have encrypted data, try to unlock automatically
          const unlockResult = await biometricMigration.unlockWalletWithBiometrics();
          if (unlockResult.success) {
            setIsAppUnlocked(true);
            startSessionTimeout();
            // Update lastActive timestamp
            await updateLastActive();
          }
        } else if (status.hasUnencrypted && !status.hasEncrypted) {
          // If we have unencrypted data but no encrypted data, unlock the app
          // This allows users to migrate to biometric encryption
          setIsAppUnlocked(true);
        }
      } catch (error) {
        console.error('Error initializing biometric system:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeBiometric();
  }, []);

  // Session timeout management
  const startSessionTimeout = (timeoutMinutes: number = 5) => {
    // Clear existing timeout
    if (sessionTimeout) {
      clearTimeout(sessionTimeout);
    }

    // Set timeout based on provided minutes
    const timeout = setTimeout(() => {
      setIsAppUnlocked(false);
      setSessionTimeout(null);
    }, timeoutMinutes * 60 * 1000);

    setSessionTimeout(timeout);
  };

  const clearSessionTimeout = () => {
    if (sessionTimeout) {
      clearTimeout(sessionTimeout);
      setSessionTimeout(null);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      clearSessionTimeout();
    };
  }, [sessionTimeout]);

  const unlockApp = async (timeoutMinutes: number = 5): Promise<UnlockResult> => {
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
        startSessionTimeout(timeoutMinutes); // Restart session timeout
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
