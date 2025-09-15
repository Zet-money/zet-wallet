import type { RpcMap } from './providers'

// Central in-app RPC map (overrides env when provided)
export const IN_APP_RPC_MAP: RpcMap = {
  ethereum: {
    mainnet: 'https://rpc.ankr.com/eth/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
    testnet: 'https://rpc.ankr.com/eth_sepolia/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
  },
  polygon: {
    mainnet: 'https://rpc.ankr.com/polygon/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
    testnet: 'https://rpc.ankr.com/polygon_amoy/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
  },
  bsc: {
    mainnet: 'https://rpc.ankr.com/bsc/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
    testnet: 'https://rpc.ankr.com/bsc_testnet_chapel/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
  },
  avalanche: {
    mainnet: 'https://rpc.ankr.com/avalanche-c/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
    testnet: 'https://rpc.ankr.com/avalanche_fuji-c/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
  },
  arbitrum: {
    mainnet: 'https://rpc.ankr.com/arbitrum/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
    testnet: 'https://rpc.ankr.com/arbitrum_sepolia/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
  },
  optimism: {
    mainnet: 'https://rpc.ankr.com/optimism/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
    testnet: 'https://rpc.ankr.com/optimism_sepolia/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
  },
  base: {
    mainnet: 'https://rpc.ankr.com/base/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
    testnet: 'https://rpc.ankr.com/base_sepolia/31b399592af9247199cfd9726af75d94e0a6a82b9bc3e651b93525fede17723b',
  },
}


