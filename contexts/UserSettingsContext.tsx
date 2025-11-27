"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { secureDB } from '@/lib/db/secure-db';
import { CryptoVault } from '@/lib/crypto/vault';
import { backendApi, type User } from '@/lib/services/backend-api';
import { useWallet } from './WalletContext';
import { useBiometric } from '@/contexts/BiometricContext';

export interface UserProfile {
  name: string;
  username: string;
  email?: string;
  sessionTimeout: number; // in minutes
  requireAuthOnReload: boolean; // whether to require biometric auth on every reload
}

export interface UserSettingsContextType {
  profile: UserProfile | null;
  backendUser: User | null;
  isLoading: boolean;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  loadProfile: () => Promise<void>;
  syncWithBackend: () => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [backendUser, setBackendUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cryptoVault] = useState(() => new CryptoVault());
  const { wallet } = useWallet();
  const { getBiometricPublicKey, isAppUnlocked } = useBiometric();

  const loadProfile = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      // IMPORTANT: Backend is single source of truth
      // First, try to load from backend if wallet is available AND app is unlocked
      if (wallet?.address && isAppUnlocked) {
        try {
          const biometricPublicKey = await getBiometricPublicKey();
          if (biometricPublicKey) {
            const user = await backendApi.getUserProfile(wallet.address, biometricPublicKey);
            setBackendUser(user);
            
            // Extract profile from backend user
            const backendProfile: UserProfile = {
              name: user.name || '',
              username: user.username || '',
              email: user.email,
              sessionTimeout: user.sessionTimeout || 20,
              requireAuthOnReload: user.requireAuthOnReload ?? true,
            };
            
            setProfile(backendProfile);
            
            // Store sessionTimeout and requireAuthOnReload in localStorage for BiometricContext to access
            try {
              localStorage.setItem('zet_session_timeout', backendProfile.sessionTimeout.toString());
              localStorage.setItem('zet_require_auth_reload', backendProfile.requireAuthOnReload.toString());
            } catch (error) {
              console.warn('Failed to save settings to localStorage:', error);
            }
            
            // Update local storage with backend data
            await secureDB.init();
            const masterKey = await cryptoVault.generateMasterKey();
            const encryptedData = await cryptoVault.encryptData(masterKey, JSON.stringify(backendProfile));
            const wrappedKey = await cryptoVault.exportKey(masterKey);

            await secureDB.set('user-profile', {
              wrappedKey,
              iv: encryptedData.iv,
              encryptedData: encryptedData.encryptedData,
              updatedAt: Date.now()
            });
            
            return; // Backend data loaded successfully
          }
        } catch (error: any) {
          // If user doesn't exist (401), we'll fall through to local data or create new
          if (!(error?.status === 401 || error?.message?.includes('401'))) {
            console.error('Error loading from backend:', error);
          }
        }
      }
      
      // Fallback: Load from local storage only if backend is not available
      // Ensure SecureDB is initialized
      await secureDB.init();
      
      const encryptedProfile = await secureDB.get('user-profile');
      
      if (encryptedProfile) {
        // Decrypt the profile data
        const masterKey = await cryptoVault.importKey(encryptedProfile.wrappedKey);
        const decryptedData = await cryptoVault.decryptData(
          masterKey,
          encryptedProfile.iv,
          encryptedProfile.encryptedData
        );
        
        const userProfile = JSON.parse(decryptedData) as UserProfile;
        setProfile(userProfile);
        
        // Store sessionTimeout and requireAuthOnReload in localStorage for BiometricContext to access
        try {
          localStorage.setItem('zet_session_timeout', userProfile.sessionTimeout.toString());
          localStorage.setItem('zet_require_auth_reload', (userProfile.requireAuthOnReload ?? true).toString());
        } catch (error) {
          console.warn('Failed to save settings to localStorage:', error);
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (newProfile: Partial<UserProfile>): Promise<void> => {
    try {
      // Ensure SecureDB is initialized
      await secureDB.init();
      
      const updatedProfile: UserProfile = {
        name: '',
        username: '',
        sessionTimeout: 20, // default 20 minutes
        requireAuthOnReload: true, // default true
        ...profile,
        ...newProfile
      };

      // Encrypt the profile data
      const masterKey = await cryptoVault.generateMasterKey();
      const encryptedData = await cryptoVault.encryptData(masterKey, JSON.stringify(updatedProfile));
      const wrappedKey = await cryptoVault.exportKey(masterKey);

      // Store encrypted profile
      await secureDB.set('user-profile', {
        wrappedKey,
        iv: encryptedData.iv,
        encryptedData: encryptedData.encryptedData,
        updatedAt: Date.now()
      });

      setProfile(updatedProfile);

      // Store sessionTimeout and requireAuthOnReload in localStorage for BiometricContext to access
      try {
        localStorage.setItem('zet_session_timeout', updatedProfile.sessionTimeout.toString());
        localStorage.setItem('zet_require_auth_reload', updatedProfile.requireAuthOnReload.toString());
      } catch (error) {
        console.warn('Failed to save settings to localStorage:', error);
      }

      // Sync with backend if wallet is available
      if (wallet?.address) {
        try {
          const biometricPublicKey = await getBiometricPublicKey();
          if (biometricPublicKey) {
            await backendApi.updateUserProfile(wallet.address, biometricPublicKey, {
              name: updatedProfile.name,
              email: updatedProfile.email,
              username: updatedProfile.username,
              sessionTimeout: updatedProfile.sessionTimeout,
              requireAuthOnReload: updatedProfile.requireAuthOnReload,
            });
          }
        } catch (error: any) {
          // If user doesn't exist (401), create them automatically
          if (error?.status === 401 || error?.message?.includes('401')) {
            try {
              const biometricPublicKey = await getBiometricPublicKey();
              if (biometricPublicKey) {
                await backendApi.createUser({
                  walletAddress: wallet.address,
                  biometricPublicKey,
                  name: updatedProfile.name,
                  email: updatedProfile.email,
                  username: updatedProfile.username,
                  sessionTimeout: updatedProfile.sessionTimeout,
                  requireAuthOnReload: updatedProfile.requireAuthOnReload,
                });
                console.log('User created automatically after 401 error');
              }
            } catch (createError) {
              console.warn('Failed to create user after 401 error:', createError);
            }
          } else if (error?.status === 409 || error?.message?.includes('already taken')) {
            // Rethrow duplicate username/email errors so the UI can show them
            throw error;
          } else {
            console.warn('Failed to sync profile with backend:', error);
          }
          // Don't throw error for other backend errors - local update succeeded
        }
      }
    } catch (error: any) {
      console.error('Error updating user profile:', error);
      // If it's a conflict error (duplicate username/email), pass the message through
      if (error?.status === 409 || error?.message?.includes('already taken')) {
        throw error;
      }
      throw new Error('Failed to update profile');
    }
  };

  const syncWithBackend = async (): Promise<void> => {
    if (!wallet?.address || !isAppUnlocked) return;

    try {
      const biometricPublicKey = await getBiometricPublicKey();
      if (!biometricPublicKey) return;

      const user = await backendApi.getUserProfile(wallet.address, biometricPublicKey);
      setBackendUser(user);

      // Update local profile with backend data if it exists
      if (user && profile) {
        const updatedProfile: UserProfile = {
          ...profile,
          name: user.name || profile.name,
          email: user.email || profile.email,
          username: user.username || profile.username,
        };

        // Only update if there are changes
        if (JSON.stringify(updatedProfile) !== JSON.stringify(profile)) {
          setProfile(updatedProfile);
          
          // Save to local storage
          await secureDB.init();
          const masterKey = await cryptoVault.generateMasterKey();
          const encryptedData = await cryptoVault.encryptData(masterKey, JSON.stringify(updatedProfile));
          const wrappedKey = await cryptoVault.exportKey(masterKey);

          await secureDB.set('user-profile', {
            wrappedKey,
            iv: encryptedData.iv,
            encryptedData: encryptedData.encryptedData,
            updatedAt: Date.now()
          });
        }
      }
    } catch (error: any) {
      // If user doesn't exist (401), create them automatically
      if (error?.status === 401 || error?.message?.includes('401')) {
        try {
          const biometricPublicKey = await getBiometricPublicKey();
          if (biometricPublicKey && profile) {
            await backendApi.createUser({
              walletAddress: wallet.address,
              biometricPublicKey,
              name: profile.name,
              email: profile.email,
              username: profile.username,
              sessionTimeout: profile.sessionTimeout,
            });
            console.log('User created automatically during sync after 401 error');
            setBackendUser({
              walletAddress: wallet.address,
              biometricPublicKey,
              name: profile.name,
              email: profile.email,
              username: profile.username,
              sessionTimeout: profile.sessionTimeout,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        } catch (createError) {
          console.warn('Failed to create user during sync after 401 error:', createError);
        }
      } else {
        console.warn('Failed to sync with backend:', error);
      }
      // Don't throw error - this is a background sync
    }
  };

  useEffect(() => {
    loadProfile();
  }, [wallet?.address, isAppUnlocked]); // Reload when wallet address changes OR when app is unlocked

  // Sync with backend when wallet becomes available (additional sync for updates)
  useEffect(() => {
    if (wallet?.address && profile && isAppUnlocked) {
      syncWithBackend();
    }
  }, [wallet?.address, profile, isAppUnlocked]);

  return (
    <UserSettingsContext.Provider
      value={{
        profile,
        backendUser,
        isLoading,
        updateProfile,
        loadProfile,
        syncWithBackend,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (context === undefined) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
}
