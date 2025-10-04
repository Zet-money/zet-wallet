import { ethers } from 'ethers';

/**
 * Detect if input is ENS/Base name, Ethereum address, or Solana address
 */
export function detectAddressType(input: string): 'address' | 'ens' | 'basename' | 'solana' | 'invalid' {
  // Check if it's a valid Ethereum address first
  if (ethers.isAddress(input)) {
    return 'address';
  }
  
  // Ensure input is a string for string operations
  const inputStr = String(input);
  
  // Check if it's ENS (.eth)
  if (inputStr.endsWith('.eth') && inputStr.length > 4) {
    return 'ens';
  }
  
  // Check if it's Base name (.base.eth)
  if (inputStr.endsWith('.base.eth') && inputStr.length > 9) {
    return 'basename';
  }
  
  // Check if it's a Solana address (base58, 32-44 characters, starts with letters/numbers)
  if (isSolanaAddress(inputStr)) {
    return 'solana';
  }
  
  return 'invalid';
}

/**
 * Check if input looks like a Solana address
 */
function isSolanaAddress(input: string): boolean {
  // Solana addresses are base58 encoded, typically 32-44 characters
  // They contain only base58 characters: 1-9, A-H, J-N, P-Z, a-k, m-z
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  
  // Additional checks for Solana address characteristics
  if (!base58Regex.test(input)) {
    return false;
  }
  
  // Solana addresses are typically 32-44 characters
  if (input.length < 32 || input.length > 44) {
    return false;
  }
  
  return true;
}

/**
 * Resolve ENS/Base name to address
 */
export async function resolveToAddress(
  name: string, 
  provider: ethers.Provider
): Promise<string | null> {
  try {
    const address = await provider.resolveName(name);
    return address;
  } catch (error) {
    console.error(`Failed to resolve ${name}:`, error);
    return null;
  }
}

/**
 * Main resolver function - detects type and resolves if needed
 */
export async function resolveRecipient(
  input: string,
  provider: ethers.Provider
): Promise<{ address: string; originalInput: string; type: string }> {
  const type = detectAddressType(input);
  
  if (type === 'address') {
    return { address: input, originalInput: input, type: 'address' };
  }
  
  if (type === 'solana') {
    return { address: input, originalInput: input, type: 'solana' };
  }
  
  if (type === 'ens' || type === 'basename') {
    const resolvedAddress = await resolveToAddress(input, provider);
    if (resolvedAddress) {
      return { address: resolvedAddress, originalInput: input, type };
    } else {
      throw new Error(`${type.toUpperCase()} name not found: ${input}`);
    }
  }
  
  throw new Error('Invalid address or name format');
}
