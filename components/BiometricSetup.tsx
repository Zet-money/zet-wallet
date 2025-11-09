/**
 * BiometricSetup - Initial biometric setup before wallet creation
 * This component is shown before users can create or import a wallet
 */

"use client";

import React, { useState } from 'react';
import { useBiometric } from '@/contexts/BiometricContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Fingerprint, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function BiometricSetup() {
  const { setupBiometric, isBiometricSupported, checkMigrationStatus } = useBiometric();
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupResult, setSetupResult] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleSetupBiometric = async () => {
    try {
      setIsSettingUp(true);
      setSetupResult(null);
      
      const result = await setupBiometric();
      
      if (result.success) {
        setSetupResult('✅ Biometric authentication set up successfully!');
        setIsCompleted(true);
        toast.success('Biometric authentication enabled!');
        await checkMigrationStatus();
      } else {
        setSetupResult(`❌ Setup failed: ${result.error}`);
        toast.error(`Biometric setup failed: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSetupResult(`❌ Setup error: ${errorMessage}`);
      toast.error(`Biometric setup error: ${errorMessage}`);
    } finally {
      setIsSettingUp(false);
    }
  };

  // Biometric is mandatory - no skip option

  if (isCompleted) {
    return null; // This component will be unmounted after completion
  }

  if (!isBiometricSupported) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-red-900">Biometric Authentication Required</CardTitle>
            <CardDescription className="text-red-700">
              This app requires biometric authentication for security
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-600 space-y-2">
              <p>To use this app, you need a device that supports:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Touch ID or Face ID (iOS)</li>
                <li>Fingerprint or Face unlock (Android)</li>
                <li>Windows Hello (Windows)</li>
              </ul>
            </div>
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <p className="text-sm text-red-800 font-medium">
                Biometric authentication is mandatory for security. Please use a compatible device to access your wallet.
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-red-600">
                This app cannot be used without biometric authentication.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-blue-900">Secure Your Wallet</CardTitle>
          <CardDescription className="text-blue-700">
            Set up biometric authentication to protect your wallet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Benefits */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Why biometric security is required:</h4>
            <ul className="text-sm text-gray-400 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Your recovery phrase is encrypted and protected by your biometrics</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Only you can access your wallet using Touch ID, Face ID, or Windows Hello</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Your wallet automatically locks when you close the app</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>No one else can access your funds even if they have your device</span>
              </li>
            </ul>
          </div>

          {/* Setup Button */}
          <Button
            onClick={handleSetupBiometric}
            disabled={isSettingUp}
            size="lg"
            className="w-full flex items-center gap-2"
          >
            {isSettingUp ? (
              <>
                <Lock className="h-4 w-4 animate-pulse" />
                Setting up...
              </>
            ) : (
              <>
                <Fingerprint className="h-4 w-4" />
                Enable Biometric Security
              </>
            )}
          </Button>

          {/* Result Message */}
          {setupResult && (
            <div className={`p-3 rounded-lg ${
              setupResult.includes('✅') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{setupResult}</span>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Lock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold">Security Notice:</p>
                <p>Biometric authentication is mandatory for this app. Your wallet data will be encrypted and protected by your device's biometric security features.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
