"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { secureDB } from '@/lib/db/secure-db';
import { CryptoVault } from '@/lib/crypto/vault';

export interface UserProfile {
  name: string;
  username: string;
  email?: string;
  sessionTimeout: number; // in minutes
}

export interface UserSettingsContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  loadProfile: () => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cryptoVault] = useState(() => new CryptoVault());

  const loadProfile = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
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
        sessionTimeout: 5, // default 5 minutes
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
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update profile');
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  return (
    <UserSettingsContext.Provider
      value={{
        profile,
        isLoading,
        updateProfile,
        loadProfile,
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
