"use client";

import React, { createContext, useContext, useMemo, useState } from 'react'

export type Network = 'mainnet' | 'testnet'

type Ctx = {
  network: Network
  setNetwork: (n: Network) => void
}

const NetworkContext = createContext<Ctx | undefined>(undefined)

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<Network>('testnet')
  const value = useMemo(() => ({ network, setNetwork }), [network])
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export function useNetwork() {
  const ctx = useContext(NetworkContext)
  if (!ctx) throw new Error('useNetwork must be used within NetworkProvider')
  return ctx
}


