# Biometric Mnemonic Encryption System

This document describes the comprehensive biometric encryption system implemented for securing mnemonic seed phrases in the Zet Wallet application.

## Overview

The system provides client-side encryption for mnemonic seed phrases using:
- **WebAuthn API** for biometric authentication (Touch ID, Face ID, Windows Hello)
- **Web Crypto API** for AES-GCM encryption
- **IndexedDB** for secure storage
- **RSA-OAEP** for key wrapping

## Architecture

### 1. CryptoVault (`lib/crypto/vault.ts`)
Handles all encryption and decryption operations using the Web Crypto API.

**Key Features:**
- Generates AES-GCM 256-bit Master Keys
- Encrypts/decrypts mnemonic data
- Wraps/unwraps Master Keys with RSA-OAEP
- Exports/imports keys for storage

**Methods:**
- `generateMasterKey()`: Creates a new AES-GCM key
- `encryptData(key, data)`: Encrypts mnemonic with Master Key
- `decryptData(key, iv, encryptedData)`: Decrypts mnemonic
- `wrapKey(keyToWrap, wrappingPublicKey)`: Encrypts Master Key with WebAuthn public key
- `unwrapKey(wrappedKey, unwrappingPrivateKey)`: Decrypts Master Key with WebAuthn private key

### 2. BiometricAuth (`lib/auth/biometric.ts`)
Manages WebAuthn biometric authentication flow.

**Key Features:**
- Registers new biometric credentials
- Authenticates using existing credentials
- Handles platform authenticators (biometrics)
- Manages credential storage

**Methods:**
- `registerCredential(userId, username)`: Registers new biometric credential
- `authenticate(credentialId)`: Authenticates with biometrics
- `isBiometricAvailable()`: Checks biometric support

### 3. SecureDB (`lib/db/secure-db.ts`)
IndexedDB service for storing encrypted wallet data.

**Key Features:**
- Stores encrypted wallet objects
- Manages biometric credentials
- Provides secure data persistence
- Handles data migration

**Data Structures:**
```typescript
interface SecuredWallet {
  id: string; // Static ID
  credentialId: string; // WebAuthn credential ID
  wrappedMasterKey: ArrayBuffer; // Encrypted AES key
  mnemonicIV: Uint8Array; // IV for mnemonic encryption
  encryptedMnemonic: ArrayBuffer; // Encrypted mnemonic
  createdAt: number;
  updatedAt: number;
}
```

### 4. BiometricMigration (`lib/migration/biometric-migration.ts`)
Handles migration from localStorage to encrypted IndexedDB.

**Key Features:**
- Migrates unencrypted mnemonics to encrypted storage
- Manages biometric credential registration
- Handles wallet unlocking with biometrics
- Provides migration status checking

**Methods:**
- `migrateLocalStorageToBiometric()`: Migrates existing wallet to biometric encryption
- `unlockWalletWithBiometrics()`: Unlocks wallet using biometric authentication
- `getMigrationStatus()`: Returns current migration status

### 5. Updated WalletContext (`contexts/WalletContext.tsx`)
Enhanced wallet context with biometric support.

**New Features:**
- Biometric support detection
- Migration status tracking
- Encrypted wallet management
- Biometric unlock functionality

**New Methods:**
- `migrateToBiometric()`: Migrates wallet to biometric encryption
- `unlockWithBiometric()`: Unlocks wallet with biometrics
- `checkMigrationStatus()`: Updates migration status

## Security Model

### Encryption Flow
1. **Master Key Generation**: AES-GCM 256-bit key generated for each wallet
2. **Mnemonic Encryption**: Mnemonic encrypted with Master Key using AES-GCM
3. **Key Wrapping**: Master Key encrypted with WebAuthn public key using RSA-OAEP
4. **Secure Storage**: Encrypted data stored in IndexedDB

### Decryption Flow
1. **Biometric Authentication**: User authenticates with Touch ID/Face ID
2. **Key Unwrapping**: Master Key decrypted using WebAuthn private key
3. **Mnemonic Decryption**: Mnemonic decrypted using Master Key
4. **Temporary Access**: Decrypted mnemonic available in memory only

### Security Benefits
- **No Plain Text Storage**: Mnemonic never stored unencrypted
- **Biometric Protection**: Access requires device biometrics
- **Key Separation**: Master Key and mnemonic encrypted separately
- **Secure Enclave**: WebAuthn private keys protected by device hardware

## Usage

### 1. Check Biometric Support
```typescript
const { isBiometricSupported, migrationStatus } = useWallet();

if (isBiometricSupported) {
  // Biometric authentication available
}
```

### 2. Migrate to Biometric Encryption
```typescript
const { migrateToBiometric } = useWallet();

const result = await migrateToBiometric();
if (result.success) {
  // Migration successful
}
```

### 3. Unlock with Biometrics
```typescript
const { unlockWithBiometric } = useWallet();

const result = await unlockWithBiometric();
if (result.success && result.mnemonic) {
  // Wallet unlocked, mnemonic available
}
```

### 4. Check Migration Status
```typescript
const { migrationStatus } = useWallet();

if (migrationStatus?.hasUnencrypted && migrationStatus?.biometricSupported) {
  // Can migrate to biometric encryption
}
```

## Testing

### Test Page
Visit `/biometric-test` to test the biometric mnemonic system.

### Test Features
- Biometric support detection
- Migration status display
- Migration to biometric encryption
- Biometric unlock testing
- Error handling demonstration

## Browser Compatibility

### Required Features
- **WebAuthn API**: For biometric authentication
- **Web Crypto API**: For encryption operations
- **IndexedDB**: For secure storage
- **HTTPS**: Required for WebAuthn in production

### Supported Browsers
- Chrome 67+
- Firefox 60+
- Safari 14+
- Edge 79+

### Platform Support
- **iOS**: Touch ID, Face ID
- **Android**: Fingerprint, Face unlock
- **Windows**: Windows Hello
- **macOS**: Touch ID

## Implementation Notes

### WebAuthn Configuration
- **User Verification**: Required for biometric authentication
- **Resident Keys**: Required for discoverable credentials
- **Platform Authenticators**: Only platform authenticators supported
- **Attestation**: Disabled for privacy

### Error Handling
- Comprehensive try/catch blocks throughout
- User-friendly error messages
- Graceful fallbacks to localStorage
- Detailed logging for debugging

### Performance Considerations
- Lazy initialization of services
- Efficient IndexedDB operations
- Minimal memory footprint
- Fast biometric authentication

## Security Considerations

### Best Practices
- Never log sensitive data
- Use secure random number generation
- Validate all inputs
- Handle errors securely

### Threat Model
- **Device Compromise**: Biometric authentication provides protection
- **Browser Compromise**: IndexedDB provides some protection
- **Network Attacks**: All operations are client-side
- **Physical Access**: Biometric authentication required

## Future Enhancements

### Potential Improvements
- Multiple biometric credentials support
- Backup and recovery mechanisms
- Cross-device synchronization
- Hardware security module integration
- Advanced key derivation functions

### Monitoring
- Biometric authentication success rates
- Migration completion rates
- Error frequency and types
- Performance metrics

## Troubleshooting

### Common Issues
1. **Biometric Not Supported**: Check browser and device compatibility
2. **Migration Fails**: Ensure existing wallet data is valid
3. **Unlock Fails**: Verify biometric credentials are valid
4. **Storage Errors**: Check IndexedDB support and permissions

### Debug Information
- Check browser console for detailed error messages
- Verify WebAuthn and Web Crypto API support
- Test IndexedDB functionality
- Validate biometric authentication setup

## Conclusion

The biometric mnemonic encryption system provides a secure, user-friendly way to protect wallet seed phrases using device biometrics. The implementation follows security best practices and provides comprehensive error handling and user feedback.

The system is designed to be:
- **Secure**: Multiple layers of encryption and biometric protection
- **User-Friendly**: Simple migration and unlock processes
- **Robust**: Comprehensive error handling and fallbacks
- **Future-Proof**: Extensible architecture for enhancements
