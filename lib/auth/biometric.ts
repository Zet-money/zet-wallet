/**
 * BiometricAuth - Handles WebAuthn biometric authentication
 * This class manages credential registration and authentication using device biometrics
 */

import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import type { 
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON
} from '@simplewebauthn/types';

export interface BiometricCredential {
  id: string;
  publicKey: string;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports?: AuthenticatorTransport[];
}

export class BiometricAuth {
  private static readonly RP_NAME = 'Zet Wallet';
  private static readonly USER_ID = 'zet-wallet-user';

  private static getRpId(): string {
    if (typeof window !== 'undefined') {
      return window.location.hostname;
    }
    return 'localhost';
  }

  /**
   * Check if WebAuthn and biometrics are supported
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 
           'PublicKeyCredential' in window &&
           'navigator' in window &&
           'credentials' in navigator;
  }

  /**
   * Check if biometric authentication is available
   */
  static async isBiometricAvailable(): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        return false;
      }

      // Check if we can create credentials
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    } catch (error) {
      console.error('[BiometricAuth] Error checking biometric availability:', error);
      return false;
    }
  }

  /**
   * Register a new biometric credential
   */
  async registerCredential(userId: string, username: string): Promise<BiometricCredential> {
    try {
      if (!BiometricAuth.isSupported()) {
        throw new Error('WebAuthn is not supported in this browser');
      }

      const isAvailable = await BiometricAuth.isBiometricAvailable();
      if (!isAvailable) {
        throw new Error('Biometric authentication is not available on this device');
      }

      // Prepare registration options
      const registrationOptions: PublicKeyCredentialCreationOptionsJSON = {
      rp: {
        name: BiometricAuth.RP_NAME,
        id: BiometricAuth.getRpId(),
      },
        user: {
          id: userId,
          name: username,
          displayName: username,
        },
        challenge: this.generateChallenge(),
        pubKeyCredParams: [
          {
            type: 'public-key',
            alg: -7, // ES256
          },
          {
            type: 'public-key',
            alg: -257, // RS256
          },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Force platform authenticator (biometrics)
          residentKey: 'required', // Require discoverable credentials (passkeys)
          userVerification: 'required', // Require biometric verification
        },
        timeout: 60000, // 60 seconds
        attestation: 'none', // Don't require attestation
      };

      // Start the registration process
      const registrationResponse: RegistrationResponseJSON = await startRegistration({
        optionsJSON: registrationOptions
      });

      // Extract credential information
      const credential: BiometricCredential = {
        id: registrationResponse.id,
        publicKey: registrationResponse.response.publicKey || '',
        counter: 0,
        deviceType: 'platform',
        backedUp: false,
        transports: registrationResponse.response.transports as AuthenticatorTransport[],
      };

      return credential;
    } catch (error) {
      console.error('[BiometricAuth] Error registering credential:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Biometric registration was cancelled or not allowed');
        } else if (error.name === 'NotSupportedError') {
          throw new Error('Biometric authentication is not supported on this device');
        } else if (error.name === 'SecurityError') {
          throw new Error('Security error during biometric registration');
        }
      }
      throw new Error('Failed to register biometric credential');
    }
  }

  /**
   * Authenticate using an existing biometric credential
   */
  async authenticate(credentialId: string): Promise<CryptoKey> {
    try {
      if (!BiometricAuth.isSupported()) {
        throw new Error('WebAuthn is not supported in this browser');
      }

      // The credential ID is already base64 encoded, so we can use it directly
      // Prepare authentication options
      const authenticationOptions: PublicKeyCredentialRequestOptionsJSON = {
        challenge: this.generateChallenge(),
        allowCredentials: [
          {
            id: credentialId,
            type: 'public-key',
            transports: ['internal'], // Platform authenticator only
          },
        ],
        userVerification: 'required', // Require biometric verification
        timeout: 60000, // 60 seconds
        rpId: BiometricAuth.getRpId(),
      };

      // Start the authentication process
      const authenticationResponse: AuthenticationResponseJSON = await startAuthentication({
        optionsJSON: authenticationOptions
      });

      // Convert the credential to a CryptoKey for key operations
      const publicKeyCredential = await this.credentialToCryptoKey(authenticationResponse);

      return publicKeyCredential;
    } catch (error) {
      console.error('[BiometricAuth] Error authenticating:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Biometric authentication was cancelled or not allowed');
        } else if (error.name === 'NotSupportedError') {
          throw new Error('Biometric authentication is not supported on this device');
        } else if (error.name === 'SecurityError') {
          throw new Error('Security error during biometric authentication');
        }
      }
      throw new Error('Failed to authenticate with biometrics');
    }
  }

  /**
   * Convert a WebAuthn credential to a CryptoKey for cryptographic operations
   */
  private async credentialToCryptoKey(authenticationResponse: AuthenticationResponseJSON): Promise<CryptoKey> {
    try {
      // For this implementation, we need to retrieve the stored public key
      // associated with the credential ID and convert it to a CryptoKey
      
      // The authentication response contains the credential ID, but we need
      // to get the public key from our stored credential data
      const credentialId = authenticationResponse.id;
      
      // In a real implementation, you would:
      // 1. Retrieve the stored credential data using the credentialId
      // 2. Extract the public key from the stored data
      // 3. Convert it to a CryptoKey
      
      // For now, we'll create a key that represents the authenticated session
      // This is a simplified approach for demonstration purposes
      const keyData = new Uint8Array(32);
      window.crypto.getRandomValues(keyData);
      
      return await window.crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: 'AES-GCM',
        },
        false, // not extractable
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('[BiometricAuth] Error converting credential to CryptoKey:', error);
      throw new Error('Failed to process biometric credential');
    }
  }

  /**
   * Generate a random challenge for WebAuthn operations
   */
  private generateChallenge(): string {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Get the user ID for WebAuthn operations
   */
  static getUserId(): string {
    return BiometricAuth.USER_ID;
  }

}
