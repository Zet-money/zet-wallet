"use client";

import React from 'react';
import { useTheme } from 'next-themes';

interface BaseLogoProps {
  size?: number;
  className?: string;
}

export default function BaseLogo({ size = 24, className = "" }: BaseLogoProps) {
  const { theme } = useTheme();
  
  // Base logo is always a square with specific colors
  const fillColor = theme === 'dark' ? '#FFFFFF' : '#0000FF';
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        width="24"
        height="24"
        fill={fillColor}
        rx="2"
      />
    </svg>
  );
}
