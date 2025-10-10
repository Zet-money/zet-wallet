"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SplashContextType {
  hasShownSplash: boolean;
  setHasShownSplash: (value: boolean) => void;
  shouldShowSplash: boolean;
}

const SplashContext = createContext<SplashContextType | undefined>(undefined);

export function SplashProvider({ children }: { children: ReactNode }) {
  const [hasShownSplash, setHasShownSplashState] = useState(false);

  // Load splash state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('zet_splash_shown');
      if (stored === 'true') {
        setHasShownSplashState(true);
      }
    } catch (error) {
      console.error('Error loading splash state:', error);
    }
  }, []);

  // Save splash state to localStorage whenever it changes
  const setHasShownSplash = (value: boolean) => {
    setHasShownSplashState(value);
    try {
      localStorage.setItem('zet_splash_shown', value.toString());
    } catch (error) {
      console.error('Error saving splash state:', error);
    }
  };

  // Only show splash if it hasn't been shown before
  const shouldShowSplash = !hasShownSplash;

  return (
    <SplashContext.Provider value={{
      hasShownSplash,
      setHasShownSplash,
      shouldShowSplash
    }}>
      {children}
    </SplashContext.Provider>
  );
}

export function useSplash() {
  const context = useContext(SplashContext);
  if (context === undefined) {
    throw new Error('useSplash must be used within a SplashProvider');
  }
  return context;
}
