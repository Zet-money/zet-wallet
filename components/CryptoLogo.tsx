"use client";

import { useState } from 'react';

interface CryptoLogoProps {
  symbol: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6', 
  lg: 'w-8 h-8'
};

export default function CryptoLogo({ symbol, size = 'md', className = '' }: CryptoLogoProps) {
  const [imageError, setImageError] = useState(false);
  
  const logoUrl = `https://assets.parqet.com/logos/crypto/${symbol}?format=png`;
  
  if (imageError) {
    return (
      <div className={`${sizeClasses[size]} bg-muted rounded-full flex items-center justify-center text-xs font-semibold ${className}`}>
        {symbol}
      </div>
    );
  }
  
  return (
    <div className={`${sizeClasses[size]} bg-muted rounded-full flex items-center justify-center overflow-hidden ${className}`}>
      <img 
        src={logoUrl} 
        alt={symbol}
        className={`${sizeClasses[size]} object-contain`}
        onError={() => setImageError(true)}
      />
    </div>
  );
}
