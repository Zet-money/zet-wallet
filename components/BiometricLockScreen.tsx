/**
 * BiometricLockScreen - Lock screen component for biometric authentication
 * This component is shown when the app is locked and requires biometric authentication
 */

"use client";

import React, { useState } from 'react';
import { useBiometric } from '@/contexts/BiometricContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Fingerprint, Lock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export default function BiometricLockScreen() {
  const { unlockApp, isBiometricSupported, isEncrypted, migrationStatus, clearBiometricCredentials } = useBiometric();
  const { profile } = useUserSettings();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockResult, setUnlockResult] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const handleUnlock = async () => {
    try {
      setIsUnlocking(true);
      setUnlockResult(null);
      
      const timeoutMinutes = profile?.sessionTimeout || 5;
      const result = await unlockApp(timeoutMinutes);
      
      if (result.success) {
        setUnlockResult('✅ Successfully unlocked!');
      } else {
        setUnlockResult(`❌ Unlock failed: ${result.error}`);
      }
    } catch (error) {
      setUnlockResult(`❌ Unlock error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleClearCredentials = async () => {
    try {
      setIsClearing(true);
      await clearBiometricCredentials();
      setUnlockResult('✅ Passkey credentials cleared. Please set up passkey authentication again.');
    } catch (error) {
      console.error('Clear credentials error:', error);
      setUnlockResult(`❌ Failed to clear credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsClearing(false);
    }
  };

  if (!isBiometricSupported) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-red-900">Passkey Not Supported</CardTitle>
            <CardDescription className="text-red-700">
              Your device doesn't support passkey authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-600 space-y-2">
              <p>To use this app, you need a device that supports passkeys with:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Biometrics (Touch ID, Face ID, Fingerprint)</li>
                <li>Device password or PIN</li>
                <li>Windows Hello</li>
              </ul>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <p className="text-sm text-red-800">
                Please use a compatible device to access your wallet securely.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isEncrypted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-yellow-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle className="text-yellow-900">Setup Required</CardTitle>
            <CardDescription className="text-yellow-700">
              Please set up biometric authentication first
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-yellow-600">
              <p>This app requires passkey authentication for security. Please complete the setup process first.</p>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-sm text-yellow-800">
                Go back to the main app to set up your passkey authentication.
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
          <CardTitle className="text-blue-900">App Locked</CardTitle>
          <CardDescription className="text-blue-700">
            Use your device authentication to unlock
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Indicators */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-400">Passkey Support:</span>
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Supported
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-400">Encryption Status:</span>
              <Badge variant="default" className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Encrypted
              </Badge>
            </div>
          </div>

          {/* Unlock Button */}
          <Button
            onClick={handleUnlock}
            disabled={isUnlocking}
            size="lg"
            className="w-full flex items-center gap-2"
          >
            {isUnlocking ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Unlocking...
              </>
            ) : (
              <>
                <Fingerprint className="h-4 w-4" />
                Unlock with Passkey
              </>
            )}
          </Button>

          {/* Clear Credentials Button (Debug)
          <Button
            onClick={handleClearCredentials}
            disabled={isClearing}
            variant="outline"
            className="w-full mt-2"
          >
            {isClearing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Clear Biometric Credentials (Debug)
              </>
            )}
          </Button> */}

          {/* Result Message */}
          {unlockResult && (
            <div className={`p-3 rounded-lg ${
              unlockResult.includes('✅') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{unlockResult}</span>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">How to unlock:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Tap the unlock button above</li>
              <li>• Use your device's authentication method</li>
              <li>• Biometrics (Face ID, Touch ID, Fingerprint) or device password</li>
              <li>• Your wallet will be unlocked securely</li>
            </ul>
          </div>

          {/* Migration Status */}
          {migrationStatus && (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">System Status:</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  {migrationStatus.hasUnencrypted ? (
                    <CheckCircle className="h-3 w-3 text-yellow-600" />
                  ) : (
                    <XCircle className="h-3 w-3 text-gray-500" />
                  )}
                  <span className="text-gray-700">Unencrypted: {migrationStatus.hasUnencrypted ? "Present" : "None"}</span>
                </div>
                
                <div className="flex items-center gap-1">
                  {migrationStatus.hasEncrypted ? (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  ) : (
                    <XCircle className="h-3 w-3 text-gray-500" />
                  )}
                  <span className="text-gray-700">Encrypted: {migrationStatus.hasEncrypted ? "Present" : "None"}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
