"use client";

import { Home, Gift, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavigationProps {
  activeView: 'home' | 'rewards' | 'profile';
  onViewChange: (view: 'home' | 'rewards' | 'profile') => void;
}

export default function BottomNavigation({ activeView, onViewChange }: BottomNavigationProps) {
  const navItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'rewards' as const, label: 'Rewards', icon: Gift },
    { id: 'profile' as const, label: 'Profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t shadow-lg">
      <nav className="container mx-auto max-w-4xl">
        <div className="grid grid-cols-3 gap-1 px-2 py-2 sm:py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center space-y-1 py-2 px-3 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-purple-500/10 to-blue-500/10"
                    : "hover:bg-muted/50 active:scale-95"
                )}
              >
                <div className={cn(
                  "relative",
                  isActive && "transform scale-110"
                )}>
                  <Icon 
                    className={cn(
                      "w-5 h-5 sm:w-6 sm:h-6 transition-colors",
                      isActive 
                        ? "text-purple-600 dark:text-purple-400" 
                        : "text-muted-foreground"
                    )} 
                  />
                  {isActive && (
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full blur-sm opacity-30 -z-10" />
                  )}
                </div>
                <span 
                  className={cn(
                    "text-xs font-medium transition-colors",
                    isActive 
                      ? "gradient-text font-semibold" 
                      : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
