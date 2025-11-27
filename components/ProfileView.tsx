"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  User, Mail, AtSign, Clock, Copy, Check, LogOut, Lock, 
  Eye, EyeOff, AlertTriangle, Key, Shield, Settings
} from 'lucide-react';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { useBiometric } from '@/contexts/BiometricContext';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';
import { HDNodeWallet } from 'ethers';
import { useRouter } from 'next/navigation';

export default function ProfileView() {
  const { profile, backendUser, updateProfile, isLoading, loadProfile } = useUserSettings();
  const { lockApp, unlockApp } = useBiometric();
  const { wallet } = useWallet();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    sessionTimeout: 5
  });
  const [isSaving, setIsSaving] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);

  // Security state
  const [showSecurity, setShowSecurity] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [mnemonic, setMnemonic] = useState<string>('');
  const [privateKey, setPrivateKey] = useState<string>('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copiedMnemonic, setCopiedMnemonic] = useState(false);
  const [copiedPrivateKey, setCopiedPrivateKey] = useState(false);

  // Reload profile when component mounts
  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    console.log("backendUser:", backendUser);
    console.log("profile:", profile);
    if (profile) {
      setFormData({
        name: profile.name || '',
        username: profile.username || '',
        email: profile.email || '',
        sessionTimeout: profile.sessionTimeout || 5
      });
    }
    // Also sync from backendUser if available
    if (backendUser) {
      setFormData(prev => ({
        name: backendUser.name || prev.name,
        username: backendUser.username || prev.username,
        email: backendUser.email || prev.email,
        sessionTimeout: backendUser.sessionTimeout || prev.sessionTimeout
      }));
    }
  }, [profile, backendUser]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateProfile(formData);
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      // Display the specific error message from the backend
      const errorMessage = error?.message || 'Failed to update profile';
      toast.error(errorMessage);
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const copyAddress = async () => {
    if (wallet?.address) {
      try {
        await navigator.clipboard.writeText(wallet.address);
        setCopiedAddress(true);
        toast.success('Address copied to clipboard!');
        setTimeout(() => setCopiedAddress(false), 2000);
      } catch (err) {
        toast.error('Failed to copy address');
      }
    }
  };

  const copyReferralCode = async () => {
    const referralCode = backendUser?.referralCode || wallet?.address.slice(2, 10).toUpperCase() || '';
    if (!referralCode) {
      toast.error('Referral code not available');
      return;
    }
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedReferral(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopiedReferral(false), 2000);
    } catch (err) {
      toast.error('Failed to copy referral code');
    }
  };

  const handleUnlockSecurity = async () => {
    try {
      const result = await unlockApp(1);
      if (result.success && result.mnemonic) {
        setIsUnlocked(true);
        setMnemonic(result.mnemonic);
        
        const hdWallet = HDNodeWallet.fromPhrase(result.mnemonic);
        setPrivateKey(hdWallet.privateKey);
        toast.success('Successfully unlocked!');
      } else {
        toast.error(result.error || 'Failed to unlock');
      }
    } catch (error) {
      toast.error('Failed to unlock wallet');
      console.error('Error unlocking:', error);
    }
  };

  const handleCopyMnemonic = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopiedMnemonic(true);
      toast.success('Seed phrase copied to clipboard');
      setTimeout(() => setCopiedMnemonic(false), 2000);
    } catch (error) {
      toast.error('Failed to copy seed phrase');
    }
  };

  const handleCopyPrivateKey = async () => {
    try {
      await navigator.clipboard.writeText(privateKey);
      setCopiedPrivateKey(true);
      toast.success('Private key copied to clipboard');
      setTimeout(() => setCopiedPrivateKey(false), 2000);
    } catch (error) {
      toast.error('Failed to copy private key');
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out? Make sure you have backed up your seed phrase!')) {
      // Clear biometric credentials and lock app
      const { clearBiometricCredentials } = useBiometric();
      await clearBiometricCredentials();
      toast.success('Logged out successfully');
      router.push('/');
      window.location.reload();
    }
  };

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="pb-20 space-y-6">
      {/* Profile Header */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20 py-3">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 mb-3">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold gradient-text truncate">
                {formData.name || 'Anonymous User'}
              </h2>
              <p className="text-sm text-muted-foreground">
                @{formData.username || 'username'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between space-x-2 bg-background/50 rounded-lg p-2">
            <code className="text-xs font-mono flex-1 truncate text-muted-foreground">
              {wallet?.address || 'No wallet'}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyAddress}
              className="flex-shrink-0 h-7 w-7 p-0"
            >
              {copiedAddress ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="py-3">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold gradient-text">{backendUser?.totalPoints || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Points</p>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold gradient-text">{backendUser?.referralCount || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Referrals</p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Code */}
      <Card className="border-purple-500/20 py-3">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">
              Your Referral Code
            </Label>
            <Badge variant="secondary" className="text-xs">+100 pts per referral</Badge>
          </div>
          <div className="flex items-center justify-between space-x-2">
            <code className="text-lg font-mono font-bold gradient-text">
              {backendUser?.referralCode || wallet?.address.slice(2, 10).toUpperCase() || 'LOADING...'}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={copyReferralCode}
              className="flex-shrink-0"
              disabled={!backendUser?.referralCode && !wallet?.address}
            >
              {copiedReferral ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Share with friends to earn rewards
          </p>
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card className="py-3">
        <CardContent className="p-3 space-y-4">
          <h3 className="font-semibold flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Profile Settings</span>
          </h3>

          <div className="space-y-3">
            <div>
              <Label htmlFor="name" className="text-xs">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter your name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="username" className="text-xs">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="Choose a username"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="your@email.com"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="timeout" className="text-xs">Session Timeout (minutes)</Label>
              <Input
                id="timeout"
                type="number"
                min="1"
                max="60"
                value={formData.sessionTimeout}
                onChange={(e) => handleInputChange('sessionTimeout', parseInt(e.target.value) || 5)}
                className="mt-1"
              />
            </div>

            <Button 
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="w-full gradient-primary text-white"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card className="border-amber-500/20 py-3">
        <CardContent className="p-3">
          <div className="flex items-center space-x-2 mb-4">
            <Shield className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold">Security & Backup</h3>
          </div>

          {!showSecurity ? (
            <Button
              variant="outline"
              onClick={() => setShowSecurity(true)}
              className="w-full"
            >
              <Key className="w-4 h-4 mr-2" />
              View Seed Phrase & Private Key
            </Button>
          ) : !isUnlocked ? (
            <div className="space-y-3">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Warning: Sensitive Information
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Never share your seed phrase or private key with anyone. Anyone with access can steal your funds.
                    </p>
                  </div>
                </div>
              </div>
              <Button
                variant="default"
                onClick={handleUnlockSecurity}
                className="w-full"
              >
                <Shield className="w-4 h-4 mr-2" />
                Unlock with Biometrics
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowSecurity(false)}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Seed Phrase */}
              <div>
                <Label className="text-xs font-semibold">Seed Phrase (12 words)</Label>
                <div className="mt-2 p-3 bg-muted rounded-lg relative">
                  {showMnemonic ? (
                    <p className="text-sm font-mono break-all">{mnemonic}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">••• ••• ••• ••• ••• ••• ••• ••• ••• ••• ••• •••</p>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMnemonic(!showMnemonic)}
                    className="flex-1"
                  >
                    {showMnemonic ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                    {showMnemonic ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyMnemonic}
                    className="flex-1"
                  >
                    {copiedMnemonic ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    Copy
                  </Button>
                </div>
              </div>

              {/* Private Key */}
              <div>
                <Label className="text-xs font-semibold">Private Key</Label>
                <div className="mt-2 p-3 bg-muted rounded-lg relative">
                  {showPrivateKey ? (
                    <p className="text-sm font-mono break-all">{privateKey}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••</p>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="flex-1"
                  >
                    {showPrivateKey ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                    {showPrivateKey ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPrivateKey}
                    className="flex-1"
                  >
                    {copiedPrivateKey ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    Copy
                  </Button>
                </div>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  setShowSecurity(false);
                  setIsUnlocked(false);
                  setMnemonic('');
                  setPrivateKey('');
                  setShowMnemonic(false);
                  setShowPrivateKey(false);
                }}
                className="w-full"
              >
                Close
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          variant="outline"
          onClick={lockApp}
          className="w-full"
        >
          <Lock className="w-4 h-4 mr-2" />
          Lock App
        </Button>

        <Button
          variant="destructive"
          onClick={handleLogout}
          className="w-full"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Zet.money v1.0.0 • Made with ❤️ for Web3
      </p>
    </div>
  );
}
