/**
 * SecureDB - IndexedDB service for storing encrypted wallet data
 * This service manages the secure storage of encrypted mnemonics and biometric credentials
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface SecuredWallet {
  id: string; // Static ID, e.g., 'wallet-data'
  credentialId: string; // The WebAuthn credential ID
  wrappedMasterKey: ArrayBuffer; // The encrypted AES-GCM key
  mnemonicIV: Uint8Array; // IV for the mnemonic encryption
  encryptedMnemonic: ArrayBuffer; // The final encrypted mnemonic
  createdAt: number; // Timestamp when the wallet was created
  updatedAt: number; // Timestamp when the wallet was last updated
}

export interface BiometricCredential {
  id: string; // WebAuthn credential ID
  publicKey: string; // Base64 encoded public key
  counter: number; // Credential counter
  deviceType: string; // Type of authenticator
  backedUp: boolean; // Whether the credential is backed up
  transports?: string[]; // Available transports
  createdAt: number; // Timestamp when the credential was created
}

interface SecureWalletDB extends DBSchema {
  wallets: {
    key: string;
    value: SecuredWallet;
    indexes: {
      'createdAt': number;
      'updatedAt': number;
    };
  };
  credentials: {
    key: string;
    value: BiometricCredential;
    indexes: {
      'createdAt': number;
      'deviceType': string;
    };
  };
}

export class SecureDB {
  private db: IDBPDatabase<SecureWalletDB> | null = null;
  private readonly DB_NAME = 'ZetWalletSecureDB';
  private readonly DB_VERSION = 1;

  /**
   * Initialize the IndexedDB connection
   */
  async init(): Promise<void> {
    try {
      this.db = await openDB<SecureWalletDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Create wallets store
          if (!db.objectStoreNames.contains('wallets')) {
            const walletStore = db.createObjectStore('wallets', { keyPath: 'id' });
            walletStore.createIndex('createdAt', 'createdAt');
            walletStore.createIndex('updatedAt', 'updatedAt');
          }

          // Create credentials store
          if (!db.objectStoreNames.contains('credentials')) {
            const credentialStore = db.createObjectStore('credentials', { keyPath: 'id' });
            credentialStore.createIndex('createdAt', 'createdAt');
            credentialStore.createIndex('deviceType', 'deviceType');
          }
        },
      });
    } catch (error) {
      console.error('[SecureDB] Error initializing database:', error);
      throw new Error('Failed to initialize secure database');
    }
  }

  /**
   * Check if the database is initialized
   */
  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
  }

  /**
   * Store encrypted wallet data
   */
  async storeWallet(securedWallet: SecuredWallet): Promise<void> {
    try {
      this.ensureInitialized();
      
      const tx = this.db!.transaction('wallets', 'readwrite');
      await tx.objectStore('wallets').put({
        ...securedWallet,
        updatedAt: Date.now(),
      });
      await tx.done;
    } catch (error) {
      console.error('[SecureDB] Error storing wallet:', error);
      throw new Error('Failed to store encrypted wallet data');
    }
  }

  /**
   * Retrieve encrypted wallet data
   */
  async getWallet(walletId: string = 'wallet-data'): Promise<SecuredWallet | null> {
    try {
      this.ensureInitialized();
      
      const tx = this.db!.transaction('wallets', 'readonly');
      const wallet = await tx.objectStore('wallets').get(walletId);
      await tx.done;
      
      return wallet || null;
    } catch (error) {
      console.error('[SecureDB] Error retrieving wallet:', error);
      throw new Error('Failed to retrieve encrypted wallet data');
    }
  }

  /**
   * Check if a wallet exists
   */
  async hasWallet(walletId: string = 'wallet-data'): Promise<boolean> {
    try {
      const wallet = await this.getWallet(walletId);
      return wallet !== null;
    } catch (error) {
      console.error('[SecureDB] Error checking wallet existence:', error);
      return false;
    }
  }

  /**
   * Delete wallet data
   */
  async deleteWallet(walletId: string = 'wallet-data'): Promise<void> {
    try {
      this.ensureInitialized();
      
      const tx = this.db!.transaction('wallets', 'readwrite');
      await tx.objectStore('wallets').delete(walletId);
      await tx.done;
    } catch (error) {
      console.error('[SecureDB] Error deleting wallet:', error);
      throw new Error('Failed to delete wallet data');
    }
  }

  /**
   * Store biometric credential
   */
  async storeCredential(credential: BiometricCredential): Promise<void> {
    try {
      this.ensureInitialized();
      
      const tx = this.db!.transaction('credentials', 'readwrite');
      await tx.objectStore('credentials').put({
        ...credential,
        createdAt: Date.now(),
      });
      await tx.done;
    } catch (error) {
      console.error('[SecureDB] Error storing credential:', error);
      throw new Error('Failed to store biometric credential');
    }
  }

  /**
   * Retrieve biometric credential
   */
  async getCredential(credentialId: string): Promise<BiometricCredential | null> {
    try {
      this.ensureInitialized();
      
      const tx = this.db!.transaction('credentials', 'readonly');
      const credential = await tx.objectStore('credentials').get(credentialId);
      await tx.done;
      
      return credential || null;
    } catch (error) {
      console.error('[SecureDB] Error retrieving credential:', error);
      throw new Error('Failed to retrieve biometric credential');
    }
  }

  /**
   * Get all stored credentials
   */
  async getAllCredentials(): Promise<BiometricCredential[]> {
    try {
      this.ensureInitialized();
      
      const tx = this.db!.transaction('credentials', 'readonly');
      const credentials = await tx.objectStore('credentials').getAll();
      await tx.done;
      
      return credentials;
    } catch (error) {
      console.error('[SecureDB] Error retrieving all credentials:', error);
      throw new Error('Failed to retrieve biometric credentials');
    }
  }

  /**
   * Delete biometric credential
   */
  async deleteCredential(credentialId: string): Promise<void> {
    try {
      this.ensureInitialized();
      
      const tx = this.db!.transaction('credentials', 'readwrite');
      await tx.objectStore('credentials').delete(credentialId);
      await tx.done;
    } catch (error) {
      console.error('[SecureDB] Error deleting credential:', error);
      throw new Error('Failed to delete biometric credential');
    }
  }

  /**
   * Clear all data (for testing or reset purposes)
   */
  async clearAllData(): Promise<void> {
    try {
      this.ensureInitialized();
      
      const tx = this.db!.transaction(['wallets', 'credentials'], 'readwrite');
      await tx.objectStore('wallets').clear();
      await tx.objectStore('credentials').clear();
      await tx.done;
    } catch (error) {
      console.error('[SecureDB] Error clearing all data:', error);
      throw new Error('Failed to clear all data');
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{ walletCount: number; credentialCount: number }> {
    try {
      this.ensureInitialized();
      
      const tx = this.db!.transaction(['wallets', 'credentials'], 'readonly');
      const walletCount = await tx.objectStore('wallets').count();
      const credentialCount = await tx.objectStore('credentials').count();
      await tx.done;
      
      return { walletCount, credentialCount };
    } catch (error) {
      console.error('[SecureDB] Error getting stats:', error);
      throw new Error('Failed to get database statistics');
    }
  }

  /**
   * Clear only biometric credentials
   */
  async clearCredentials(): Promise<void> {
    try {
      this.ensureInitialized();
      
      const tx = this.db!.transaction('credentials', 'readwrite');
      await tx.objectStore('credentials').clear();
      await tx.done;
    } catch (error) {
      console.error('[SecureDB] Error clearing credentials:', error);
      throw new Error('Failed to clear credentials');
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    try {
      if (this.db) {
        this.db.close();
        this.db = null;
      }
    } catch (error) {
      console.error('[SecureDB] Error closing database:', error);
    }
  }
}

// Export a singleton instance
export const secureDB = new SecureDB();
