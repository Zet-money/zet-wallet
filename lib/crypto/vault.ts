/**
 * CryptoVault - Handles all encryption and decryption operations using Web Crypto API
 * This class manages the Master Key (AES-GCM) and key wrapping/unwrapping operations
 */

export interface EncryptedData {
  iv: Uint8Array;
  encryptedData: ArrayBuffer;
}

export class CryptoVault {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12; // 96 bits for GCM

  /**
   * Check if Web Crypto API is supported in the current environment
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 
           'crypto' in window && 
           'subtle' in window.crypto;
  }

  /**
   * Generate a new AES-GCM 256-bit Master Key for encrypting the mnemonic
   */
  async generateMasterKey(): Promise<CryptoKey> {
    try {
      return await window.crypto.subtle.generateKey(
        {
          name: CryptoVault.ALGORITHM,
          length: CryptoVault.KEY_LENGTH,
        },
        true, // extractable
        ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
      );
    } catch (error) {
      console.error('[CryptoVault] Error generating master key:', error);
      throw new Error('Failed to generate master key');
    }
  }

  /**
   * Encrypt sensitive data (mnemonic) using the Master Key
   */
  async encryptData(key: CryptoKey, data: string): Promise<EncryptedData> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      // Generate a random IV for each encryption
      const iv = window.crypto.getRandomValues(new Uint8Array(CryptoVault.IV_LENGTH));
      
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: CryptoVault.ALGORITHM,
          iv: iv,
        },
        key,
        dataBuffer
      );

      return {
        iv,
        encryptedData
      };
    } catch (error) {
      console.error('[CryptoVault] Error encrypting data:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using the Master Key and IV
   */
  async decryptData(key: CryptoKey, iv: Uint8Array, encryptedData: ArrayBuffer): Promise<string> {
    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: CryptoVault.ALGORITHM,
          iv: new Uint8Array(iv),
        },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error('[CryptoVault] Error decrypting data:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Wrap (encrypt) the Master Key using a WebAuthn public key
   * This allows the Master Key to be stored encrypted and only decrypted with biometrics
   */
  async wrapKey(keyToWrap: CryptoKey, wrappingPublicKey: CryptoKey): Promise<ArrayBuffer> {
    try {
      return await window.crypto.subtle.wrapKey(
        'raw', // format
        keyToWrap,
        wrappingPublicKey,
        {
          name: 'RSA-OAEP',
        }
      );
    } catch (error) {
      console.error('[CryptoVault] Error wrapping key:', error);
      throw new Error('Failed to wrap master key');
    }
  }

  /**
   * Unwrap (decrypt) the Master Key using a WebAuthn private key
   * This is called during biometric authentication
   */
  async unwrapKey(wrappedKey: ArrayBuffer, unwrappingPrivateKey: CryptoKey): Promise<CryptoKey> {
    try {
      return await window.crypto.subtle.unwrapKey(
        'raw', // format
        wrappedKey,
        unwrappingPrivateKey,
        {
          name: 'RSA-OAEP',
        },
        {
          name: CryptoVault.ALGORITHM,
          length: CryptoVault.KEY_LENGTH,
        },
        true, // extractable
        ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
      );
    } catch (error) {
      console.error('[CryptoVault] Error unwrapping key:', error);
      throw new Error('Failed to unwrap master key');
    }
  }

  /**
   * Convert a CryptoKey to ArrayBuffer for storage
   */
  async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    try {
      return await window.crypto.subtle.exportKey('raw', key);
    } catch (error) {
      console.error('[CryptoVault] Error exporting key:', error);
      throw new Error('Failed to export key');
    }
  }

  /**
   * Import a key from ArrayBuffer
   */
  async importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    try {
      return await window.crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: CryptoVault.ALGORITHM,
          length: CryptoVault.KEY_LENGTH,
        },
        true, // extractable
        ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
      );
    } catch (error) {
      console.error('[CryptoVault] Error importing key:', error);
      throw new Error('Failed to import key');
    }
  }

  /**
   * Generate a random string for use as user ID or other identifiers
   */
  generateRandomId(): string {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}
