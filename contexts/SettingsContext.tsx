"use client";

import React, { createContext, useContext, useMemo, useState } from 'react'
import type { Network, RpcMap, SupportedEvm } from '@/lib/providers'

type SettingsContextType = {
  network: Network
  setNetwork: (n: Network) => void
  rpc: RpcMap
  setRpc: (r: RpcMap) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<Network>('testnet')
  const [rpc, setRpc] = useState<RpcMap>({})

  const value = useMemo(() => ({ network, setNetwork, rpc, setRpc }), [network, rpc])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}

export const evmNameToKey: Record<string, SupportedEvm> = {
  ethereum: 'ethereum',
  polygon: 'polygon',
  bsc: 'bsc',
  avalanche: 'avalanche',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  base: 'base',
}


