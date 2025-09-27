/**
 * BiometricStatus - Shows biometric authentication status in the dashboard
 */

"use client";

import React from 'react';
import { useBiometric } from '@/contexts/BiometricContext';
import { Badge } from '@/components/ui/badge';
import { Shield, Fingerprint, Lock, Unlock } from 'lucide-react';

export default function BiometricStatus() {
  const { isAppUnlocked, isBiometricSupported, isEncrypted } = useBiometric();

  if (!isBiometricSupported) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>Biometric not supported</span>
      </div>
    );
  }

  if (!isEncrypted) {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-600">
        <Shield className="h-4 w-4" />
        <span>Not encrypted</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isAppUnlocked ? (
        <Badge variant="default" className="flex items-center gap-1">
          <Unlock className="h-3 w-3" />
          Unlocked
        </Badge>
      ) : (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Locked
        </Badge>
      )}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Fingerprint className="h-3 w-3" />
        <span>Biometric</span>
      </div>
    </div>
  );
}
