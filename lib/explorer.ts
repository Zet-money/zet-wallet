/**
 * Blockchain explorer URL utilities
 */

export function explorerFor(chain: string): string | null {
  switch (chain.toLowerCase()) {
    case 'ethereum':
    case 'eth':
      return 'https://etherscan.io/tx/';
    case 'polygon':
    case 'matic':
      return 'https://polygonscan.com/tx/';
    case 'bsc':
    case 'bnb':
      return 'https://bscscan.com/tx/';
    case 'avalanche':
    case 'avax':
      return 'https://snowtrace.io/tx/';
    case 'arbitrum':
    case 'arb':
      return 'https://arbiscan.io/tx/';
    case 'optimism':
    case 'op':
      return 'https://optimistic.etherscan.io/tx/';
    case 'base':
      return 'https://basescan.org/tx/';
    case 'solana':
    case 'sol':
      return 'https://solscan.io/tx/';
    case 'zetachain':
    case 'zeta':
      return 'https://explorer.zetachain.com/cc/tx/';
    default:
      return null;
  }
}
