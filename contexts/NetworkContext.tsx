"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Network = 'mainnet' | 'testnet'

type Ctx = {
  network: Network
  setNetwork: (n: Network) => void
}

const NetworkContext = createContext<Ctx | undefined>(undefined)

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<Network>('testnet')

  // Load saved network on mount
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('zet.network') : null
      if (saved === 'mainnet' || saved === 'testnet') {
        setNetwork(saved)
      }
    } catch {}
  }, [])

  // Persist on change
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('zet.network', network)
      }
    } catch {}
  }, [network])

  const value = useMemo(() => ({ network, setNetwork }), [network])
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export function useNetwork() {
  const ctx = useContext(NetworkContext)
  if (!ctx) throw new Error('useNetwork must be used within NetworkProvider')
  return ctx
}


