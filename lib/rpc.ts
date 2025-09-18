import type { RpcMap } from './providers'

// Central in-app RPC map (overrides env when provided)
export const IN_APP_RPC_MAP: RpcMap = {
  ethereum: {
    mainnet: 'https://eth.llamarpc.com',
    testnet: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  },
  polygon: {
    mainnet: 'https://polygon.llamarpc.com',
    testnet: 'https://rpc-amoy.polygon.technology',
  },
  bsc: {
    mainnet: 'https://bsc-dataseed.binance.org',
    testnet: 'https://data-seed-prebsc-1-s1.binance.org:8545',
  },
  avalanche: {
    mainnet: 'https://avalanche-c-chain.publicnode.com',
    testnet: 'https://avax-fuji.g.alchemy.com/v2/OdGfAJzOcimvQbvwlzgPFKM2tMO-1fvx',
  },
  arbitrum: {
    mainnet: 'https://arb1.arbitrum.io/rpc',
    testnet: 'https://sepolia-rollup.arbitrum.io/rpc',
  },
  optimism: {
    mainnet: 'https://mainnet.optimism.io',
    testnet: 'https://sepolia.optimism.io',
  },
  base: {
    mainnet: 'https://mainnet.base.org',
    testnet: 'https://sepolia.base.org',
  },
  zetachain: {
    // ZetaChain public endpoints
    mainnet: 'https://zetachain-evm.blockpi.network/v1/rpc/public',
    testnet: 'https://zetachain-athens-evm.blockpi.network/v1/rpc/public',
  },
}


