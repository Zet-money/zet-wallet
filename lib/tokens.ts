export type Network = 'mainnet' | 'testnet'
export type TokenInfo = {
  symbol: string
  name: string
  logo?: string
  addressByNetwork: Partial<Record<Network, string>> // empty for native
}

// Basic curated set per chain; extend as needed.
export const EVM_TOKENS: Record<string, TokenInfo[]> = {
  zetachain: [
    // Native
    { symbol: 'ZETA', name: 'ZetaChain', logo: 'ZETA', addressByNetwork: {} },
    // ZRC-20s (foreign_coins)
    { symbol: 'AVAX.AVAX', name: 'AVAX on Avalanche', logo: 'AVAX', addressByNetwork: { mainnet: '0xE8d7796535F1cd63F0fe8D631E68eACe6839869B' } },
    { symbol: 'AVAX.FUJI', name: 'AVAX on Avalanche Fuji', logo: 'AVAX', addressByNetwork: { testnet: '0xEe9CC614D03e7Dbe994b514079f4914a605B4719' } },
    { symbol: 'BNB.BSC', name: 'BNB on BSC', logo: 'BNB', addressByNetwork: { mainnet: '0x48f80608B672DC30DC7e3dbBd0343c5F02C738Eb', testnet: '0xd97B1de3619ed2c6BEb3860147E30cA8A7dC9891' } },
    { symbol: 'BTC.BTC', name: 'BTC on Bitcoin', logo: 'BTC', addressByNetwork: { mainnet: '0x13A0c5930C028511Dc02665E7285134B6d11A5f4' } },
    { symbol: 'CBBTC.BASE', name: 'cbBTC on Base', logo: 'BTC', addressByNetwork: { mainnet: '0xE80e3e8Ac1C19c744d4c2147172489BEAF23E3C5' } },
    { symbol: 'CBBTC.ETH', name: 'cbBTC on Ethereum', logo: 'BTC', addressByNetwork: { mainnet: '0x3e128c169564DD527C8e9bd85124BF6A890E5a5f' } },
    { symbol: 'CBBTC.SOL', name: 'cbBTC on Solana', logo: 'BTC', addressByNetwork: { mainnet: '0x54Bf2B1E91FCb56853097BD2545750d218E245e1' } },
    { symbol: 'DAI.ETH', name: 'DAI on Ethereum', logo: 'DAI', addressByNetwork: { mainnet: '0xcC683A782f4B30c138787CB5576a86AF66fdc31d' } },
    { symbol: 'ETH.ARB', name: 'ETH on Arbitrum', logo: 'ETH', addressByNetwork: { mainnet: '0xA614Aebf7924A3Eb4D066aDCA5595E4980407f1d' } },
    { symbol: 'ETH.ARBSEP', name: 'ETH on Arbitrum Sepolia', logo: 'ETH', addressByNetwork: { testnet: '0x1de70f3e971B62A0707dA18100392af14f7fB677' } },
    { symbol: 'ETH.BASE', name: 'ETH on Base', logo: 'ETH', addressByNetwork: { mainnet: '0x1de70f3e971B62A0707dA18100392af14f7fB677' } },
    { symbol: 'ETH.BASESEP', name: 'ETH on Base Sepolia', logo: 'ETH', addressByNetwork: { testnet: '0x236b0DE675cC8F46AE186897fCCeFe3370C9eDeD' } },
    { symbol: 'ETH.ETH', name: 'ETH on Ethereum', logo: 'ETH', addressByNetwork: { mainnet: '0xd97B1de3619ed2c6BEb3860147E30cA8A7dC9891' } },
    { symbol: 'ETH.ETHSEP', name: 'ETH on Ethereum Sepolia', logo: 'ETH', addressByNetwork: { testnet: '0x05BA149A7bd6dC1F937fA9046A9e05C05f3b18b0' } },
    { symbol: 'HanaKRW.FUJI', name: 'HanaKRW on Avalanche Fuji', logo: 'KRW', addressByNetwork: { testnet: '0xE8d7796535F1cd63F0fe8D631E68eACe6839869B' } },
    { symbol: 'KAIA.KAIROS', name: 'KAIA on Kaia Kairos', logo: 'KAI', addressByNetwork: { testnet: '0xe1A4f44b12eb72DC6da556Be9Ed1185141d7C23c' } },
    { symbol: 'KBKRW.KAIROS', name: 'KBKRW on Kaia Kairos', logo: 'KRW', addressByNetwork: { testnet: '0x2Db395976CDb9eeFCc8920F4F2f0736f1D575794' } },
    { symbol: 'NPC.ETH', name: 'NPC on Ethereum', logo: 'NPC', addressByNetwork: { mainnet: '0xe1A4f44b12eb72DC6da556Be9Ed1185141d7C23c' } },
    { symbol: 'PEPE.ETH', name: 'PEPE on Ethereum', logo: 'PEPE', addressByNetwork: { mainnet: '0x236b0DE675cC8F46AE186897fCCeFe3370C9eDeD' } },
    { symbol: 'POL.AMOY', name: 'POL on Amoy Testnet', logo: 'MATIC', addressByNetwork: { testnet: '0x777915D031d1e8144c90D025C594b3b8Bf07a08d' } },
    { symbol: 'POL.POL', name: 'POL on Polygon', logo: 'MATIC', addressByNetwork: { mainnet: '0xADF73ebA3Ebaa7254E859549A44c74eF7cff7501' } },
    { symbol: 'sBTC.BTC', name: 'sBTC on Bitcoin Signet', logo: 'BTC', addressByNetwork: { testnet: '0xdbfF6471a79E5374d771922F2194eccc42210B9F' } },
    { symbol: 'SHIB.ETH', name: 'SHIB on Ethereum', logo: 'SHIB', addressByNetwork: { mainnet: '0x777915D031d1e8144c90D025C594b3b8Bf07a08d' } },
    { symbol: 'SOL.SOL', name: 'SOL on Solana', logo: 'SOL', addressByNetwork: { mainnet: '0x4bC32034caCcc9B7e02536945eDbC286bACbA073', testnet: '0xADF73ebA3Ebaa7254E859549A44c74eF7cff7501' } },
    { symbol: 'SUI.SUI', name: 'SUI on Sui', logo: 'SUI', addressByNetwork: { mainnet: '0xEb646191FcCb5Bfc1e7A121D3847590aAc840a53', testnet: '0x3e128c169564DD527C8e9bd85124BF6A890E5a5f' } },
    { symbol: 'tBTC.BTC', name: 'tBTC on Bitcoin Testnet4', logo: 'BTC', addressByNetwork: { testnet: '0xfC9201f4116aE6b054722E10b98D904829b469c3' } },
    { symbol: 'TON.TON', name: 'TON on TON', logo: 'TON', addressByNetwork: { mainnet: '0xD45F47412073b75B7c70728aD9A45Dee0ee01bac', testnet: '0x54Bf2B1E91FCb56853097BD2545750d218E245e1' } },
    { symbol: 'TSKRW.KAIROS', name: 'TSKRW on Kaia Kairos', logo: 'KRW', addressByNetwork: { testnet: '0xEb646191FcCb5Bfc1e7A121D3847590aAc840a53' } },
    { symbol: 'ULTI.BSC', name: 'ULTI on BSC', logo: 'ULTI', addressByNetwork: { mainnet: '0xD10932EB3616a937bd4a2652c87E9FeBbAce53e5' } },
    { symbol: 'ULTI.ETH', name: 'ULTI on Ethereum', logo: 'ULTI', addressByNetwork: { mainnet: '0xe573a6e11f8506620F123DBF930222163D46BCB6' } },
    { symbol: 'UPKRW.ARBSEP', name: 'UPKRW on Arbitrum Sepolia', logo: 'KRW', addressByNetwork: { testnet: '0x0ca762FA958194795320635c11fF0C45C6412958' } },
    { symbol: 'USDC.AMOY', name: 'USDC on Polygon Amoy', logo: 'USDC', addressByNetwork: { testnet: '0xe573a6e11f8506620F123DBF930222163D46BCB6' } },
    { symbol: 'USDC.ARB', name: 'USDC on Arbitrum', logo: 'USDC', addressByNetwork: { mainnet: '0x0327f0660525b15Cdb8f1f5FBF0dD7Cd5Ba182aD' } },
    { symbol: 'USDC.ARBSEP', name: 'USDC on Arbitrum Sepolia', logo: 'USDC', addressByNetwork: { testnet: '0x4bC32034caCcc9B7e02536945eDbC286bACbA073' } },
    { symbol: 'USDC.AVAX', name: 'USDC on Avalanche', logo: 'USDC', addressByNetwork: { mainnet: '0xa52Ad01A1d62b408fFe06C2467439251da61E4a9' } },
    { symbol: 'USDC.BASE', name: 'USDC on Base', logo: 'USDC', addressByNetwork: { mainnet: '0x96152E6180E085FA57c7708e18AF8F05e37B479D' } },
    { symbol: 'USDC.BASESEP', name: 'USDC on Base Sepolia', logo: 'USDC', addressByNetwork: { testnet: '0xd0eFed75622e7AA4555EE44F296dA3744E3ceE19' } },
    { symbol: 'USDC.BSC', name: 'USDC on BSC', logo: 'USDC', addressByNetwork: { mainnet: '0x05BA149A7bd6dC1F937fA9046A9e05C05f3b18b0', testnet: '0x7c8dDa80bbBE1254a7aACf3219EBe1481c6E01d7' } },
    { symbol: 'USDC.ETH', name: 'USDC on Ethereum', logo: 'USDC', addressByNetwork: { mainnet: '0x0cbe0dF132a6c6B4a2974Fa1b7Fb953CF0Cc798a' } },
    { symbol: 'USDC.ETHSEP', name: 'USDC on Ethereum Sepolia', logo: 'USDC', addressByNetwork: { testnet: '0xcC683A782f4B30c138787CB5576a86AF66fdc31d' } },
    { symbol: 'USDC.FUJI', name: 'USDC on Avalanche Fuji C-Chain', logo: 'USDC', addressByNetwork: { testnet: '0x8344d6f84d26f998fa070BbEA6D2E15E359e2641' } },
    { symbol: 'USDC.POL', name: 'USDC on Polygon', logo: 'USDC', addressByNetwork: { mainnet: '0xfC9201f4116aE6b054722E10b98D904829b469c3' } },
    { symbol: 'USDC.SOL', name: 'USDC on Solana', logo: 'USDC', addressByNetwork: { mainnet: '0x8344d6f84d26f998fa070BbEA6D2E15E359e2641', testnet: '0xD10932EB3616a937bd4a2652c87E9FeBbAce53e5' } },
    { symbol: 'USDC.SUI', name: 'USDC on Sui', logo: 'USDC', addressByNetwork: { mainnet: '0xe134d947644F90486C8106Ee528b1CD3e54A385e', testnet: '0xE80e3e8Ac1C19c744d4c2147172489BEAF23E3C5' } },
    { symbol: 'USDT.ARB', name: 'USDT on Arbitrum', logo: 'USDT', addressByNetwork: { mainnet: '0x0ca762FA958194795320635c11fF0C45C6412958' } },
    { symbol: 'USDT.AVAX', name: 'USDT on Avalanche', logo: 'USDT', addressByNetwork: { mainnet: '0x2Db395976CDb9eeFCc8920F4F2f0736f1D575794' } },
    { symbol: 'USDT.BSC', name: 'USDT on BSC', logo: 'USDT', addressByNetwork: { mainnet: '0x91d4F0D54090Df2D81e834c3c8CE71C6c865e79F' } },
    { symbol: 'USDT.ETH', name: 'USDT on Ethereum', logo: 'USDT', addressByNetwork: { mainnet: '0x7c8dDa80bbBE1254a7aACf3219EBe1481c6E01d7' } },
    { symbol: 'USDT.POL', name: 'USDT on Polygon', logo: 'USDT', addressByNetwork: { mainnet: '0xdbfF6471a79E5374d771922F2194eccc42210B9F' } },
    { symbol: 'USDT.SOL', name: 'USDT on Solana', logo: 'USDT', addressByNetwork: { mainnet: '0xEe9CC614D03e7Dbe994b514079f4914a605B4719' } },
    { symbol: 'WBTC.ETH', name: 'WBTC on Ethereum', logo: 'WBTC', addressByNetwork: { mainnet: '0xd0eFed75622e7AA4555EE44F296dA3744E3ceE19' } },
  ],
  ethereum: [
    { symbol: 'ETH', name: 'Ether', logo: 'ETH', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', testnet: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' } }, // https://developers.circle.com/stablecoins/usdc-contract-addresses
    { symbol: 'USDT', name: 'Tether USD', logo: 'USDT', addressByNetwork: { mainnet: '0xdAC17F958D2ee523a2206206994597C13D831ec7', testnet: '' } }, // https://tether.to/ru/supported-protocols/
    { symbol: 'WETH', name: 'Wrapped Ether', logo: 'WETH', addressByNetwork: { mainnet: '0xC02aaA39b223FE8D0a0e5C4F27eAD9083C756Cc2', testnet: '' } },
  ],
  polygon: [
    { symbol: 'MATIC', name: 'Polygon', logo: 'MATIC', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', testnet: '0x41E94Eb019C0762fBfcf9Fb1E58725BfB0e7582' } }, // https://developers.circle.com/stablecoins/usdc-contract-addresses
    { symbol: 'USDT', name: 'Tether USD', logo: 'USDT', addressByNetwork: { mainnet: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', testnet: '' } },
    { symbol: 'WETH', name: 'Wrapped Ether', logo: 'WETH', addressByNetwork: { mainnet: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', testnet: '' } },
  ],
  bsc: [
    { symbol: 'BNB', name: 'BNB', logo: 'BNB', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', testnet: '' } },
    { symbol: 'USDT', name: 'Tether USD', logo: 'USDT', addressByNetwork: { mainnet: '0x55d398326f99059fF775485246999027B319755', testnet: '' } },
    { symbol: 'WETH', name: 'Wrapped Ether', logo: 'WETH', addressByNetwork: { mainnet: '', testnet: '' } },
  ],
  arbitrum: [
    { symbol: 'ETH', name: 'Ether', logo: 'ETH', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', testnet: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' } }, // https://developers.circle.com/stablecoins/usdc-contract-addresses
  ],
  optimism: [
    { symbol: 'ETH', name: 'Ether', logo: 'ETH', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', testnet: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7' } }, // https://developers.circle.com/stablecoins/usdc-contract-addresses
  ],
  base: [
    { symbol: 'ETH', name: 'Ether', logo: 'ETH', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', testnet: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' } }, // https://developers.circle.com/stablecoins/usdc-contract-addresses
  ],
  avalanche: [
    { symbol: 'AVAX', name: 'Avalanche', logo: 'AVAX', addressByNetwork: {} },
    { symbol: 'USDC', name: 'USD Coin', logo: 'USDC', addressByNetwork: { mainnet: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', testnet: '0x5425890298aed601595a70AB815c96711a31Bc65' } }, // https://developers.circle.com/stablecoins/usdc-contract-addresses
    { symbol: 'USDT', name: 'Tether USD', logo: 'USDT', addressByNetwork: { mainnet: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7', testnet: '' } }, // https://tether.to/ru/supported-protocols/
  ],
}

export function getTokensFor(chain: string, network: Network): TokenInfo[] {
  const list = EVM_TOKENS[chain?.toLowerCase?.() || ''] || []
  // filter out tokens that have no address on selected network when ERC-20 (allow native always)
  return list.filter((t) => !t.addressByNetwork.mainnet && !t.addressByNetwork.testnet ? true : !!t.addressByNetwork[network])
}