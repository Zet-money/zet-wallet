import { Contract, JsonRpcProvider, Wallet, formatUnits, parseUnits } from 'ethers';
import { getEvmProvider } from './providers';
import type { Network, SupportedEvm } from './providers';

// Standard ERC-20 ABI for transfer functionality
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export interface TransferParams {
  tokenAddress: string;
  recipientAddress: string;
  amount: string; // Amount in human-readable format (e.g., "100.50")
  senderPrivateKey: string;
  chain: SupportedEvm;
  network: Network;
  rpcUrl?: string;
}

export interface TransferResult {
  hash: string;
  success: boolean;
  error?: string;
}

/**
 * Generic ERC-20 token transfer function
 * Can be used to send any ERC-20 token on any supported EVM chain
 */
export async function transferERC20Token(params: TransferParams): Promise<TransferResult> {
  try {
    const {
      tokenAddress,
      recipientAddress,
      amount,
      senderPrivateKey,
      chain,
      network,
      rpcUrl
    } = params;

    // Create provider
    const provider = rpcUrl 
      ? new JsonRpcProvider(rpcUrl)
      : getEvmProvider(chain, network);

    // Create wallet from private key
    const wallet = new Wallet(senderPrivateKey, provider);

    // Create token contract instance
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet);

    // Get token decimals
    const decimals = await tokenContract.decimals();
    
    // Convert human-readable amount to wei
    const amountWei = parseUnits(amount, decimals);

    // Check balance
    const balance = await tokenContract.balanceOf(wallet.address);
    if (balance < amountWei) {
      return {
        hash: '',
        success: false,
        error: `Insufficient balance. Available: ${formatUnits(balance, decimals)}`
      };
    }

    // Execute transfer
    const tx = await tokenContract.transfer(recipientAddress, amountWei);
    
    // Wait for confirmation
    await tx.wait();

    return {
      hash: tx.hash,
      success: true
    };

  } catch (error) {
    console.error('ERC-20 transfer error:', error);
    return {
      hash: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Get ERC-20 token balance for an address
 */
export async function getERC20Balance(
  tokenAddress: string,
  walletAddress: string,
  chain: SupportedEvm,
  network: Network,
  rpcUrl?: string
): Promise<string> {
  try {
    const provider = rpcUrl 
      ? new JsonRpcProvider(rpcUrl)
      : getEvmProvider(chain, network);

    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(walletAddress);
    const decimals = await tokenContract.decimals();
    
    return formatUnits(balance, decimals);
  } catch (error) {
    console.error('Error getting ERC-20 balance:', error);
    return '0';
  }
}

/**
 * Get ERC-20 token info (name, symbol, decimals)
 */
export async function getERC20TokenInfo(
  tokenAddress: string,
  chain: SupportedEvm,
  network: Network,
  rpcUrl?: string
): Promise<{ name: string; symbol: string; decimals: number } | null> {
  try {
    const provider = rpcUrl 
      ? new JsonRpcProvider(rpcUrl)
      : getEvmProvider(chain, network);

    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
    
    const [name, symbol, decimals] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.decimals()
    ]);

    return {
      name,
      symbol,
      decimals: Number(decimals)
    };
  } catch (error) {
    console.error('Error getting ERC-20 token info:', error);
    return null;
  }
}

