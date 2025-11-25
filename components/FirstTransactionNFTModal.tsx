"use client";

import { useEffect, useState } from 'react';
import { X, PartyPopper, Gift, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';

interface FirstTransactionNFTModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

export function FirstTransactionNFTModal({ isOpen, onClose, walletAddress }: FirstTransactionNFTModalProps) {
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);

  useEffect(() => {
    if (isOpen && !hasTriggeredConfetti) {
      // Trigger confetti animation
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      setHasTriggeredConfetti(true);

      return () => clearInterval(interval);
    }
  }, [isOpen, hasTriggeredConfetti]);

  const handleClaimNFT = () => {
    // Open reward.zet.money in a new tab
    window.open('https://reward.zet.money', '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleClose = () => {
    setHasTriggeredConfetti(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-purple-950/20 dark:via-background dark:to-blue-950/20">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="sr-only">Congratulations!</DialogTitle>
            <button
              onClick={handleClose}
              className="ml-auto rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center text-center space-y-6 py-6">
          {/* Party Icon */}
          <div className="relative">
            <div className="absolute inset-0 animate-ping bg-purple-500/30 rounded-full" />
            <div className="relative bg-gradient-to-br from-purple-500 to-blue-500 p-6 rounded-full">
              <PartyPopper className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Main Message */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Congratulations! 🎉
            </h2>
            <p className="text-lg font-semibold text-foreground">
              You've completed your first testnet transaction!
            </p>
          </div>

          {/* NFT Reward Description */}
          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-6 space-y-3 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-center gap-2">
              <Gift className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-lg">Your NFT Reward Awaits!</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              As a reward for being an early adopter and completing your first transaction, 
              you're now eligible to mint an exclusive Zet NFT!
            </p>
            <div className="pt-2">
              <p className="text-xs font-mono bg-purple-100 dark:bg-purple-900/30 p-2 rounded text-purple-800 dark:text-purple-300 break-all">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Your wallet has been whitelisted ✓
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <Button 
            onClick={handleClaimNFT}
            size="lg"
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-6 text-lg group"
          >
            Claim Your NFT
            <ExternalLink className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>

          {/* Footer Note */}
          <p className="text-xs text-muted-foreground">
            This will open in a new tab. You can also claim later from the Rewards section.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
