"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      onComplete();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800 flex items-center justify-center">
      <div className="text-center space-y-8">
        <div className="space-y-4">
          <div className="w-24 h-24 mx-auto bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-4xl font-bold text-white">Z</span>
          </div>
          <h1 className="text-4xl font-bold text-white">Zet Wallet</h1>
          <p className="text-white/80 text-lg">Cross-chain DeFi made simple</p>
        </div>
        
        {isLoading && (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
            <span className="text-white/80">Initializing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
