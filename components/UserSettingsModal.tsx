"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Save, User, Clock, Mail, Settings, Key, Copy, Check, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { useBiometric } from '@/contexts/BiometricContext';
import { toast } from 'sonner';
import { HDNodeWallet } from 'ethers';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserSettingsModal({ isOpen, onClose }: UserSettingsModalProps) {
  const { profile, updateProfile, isLoading } = useUserSettings();
  const { unlockApp } = useBiometric();
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    sessionTimeout: 5
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('preferences');
  
  // Security tab state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [mnemonic, setMnemonic] = useState<string>('');
  const [privateKey, setPrivateKey] = useState<string>('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copiedMnemonic, setCopiedMnemonic] = useState(false);
  const [copiedPrivateKey, setCopiedPrivateKey] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        username: profile.username || '',
        email: profile.email || '',
        sessionTimeout: profile.sessionTimeout || 5
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateProfile(formData);
      toast.success('Profile updated successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to update profile');
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

  const handleUnlockSecurity = async () => {
    try {
      const result = await unlockApp(1); // 1 minute timeout for viewing sensitive data
      if (result.success && result.mnemonic) {
        setIsUnlocked(true);
        setMnemonic(result.mnemonic);
        
        // Derive private key from mnemonic
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

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Reset security state when switching away from security tab
    if (value !== 'security') {
      setIsUnlocked(false);
      setMnemonic('');
      setPrivateKey('');
      setShowMnemonic(false);
      setShowPrivateKey(false);
    }
  };

  const handleClose = () => {
    // Reset security state when closing modal
    setIsUnlocked(false);
    setMnemonic('');
    setPrivateKey('');
    setShowMnemonic(false);
    setShowPrivateKey(false);
    setActiveTab('preferences');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              User Settings
            </CardTitle>
            <CardDescription>
              Manage your personal information and preferences
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Full Name
            </Label>
            <Input
              id="name"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Username
            </Label>
            <Input
              id="username"
              placeholder="Enter your username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email (Optional)
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionTimeout" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Session Timeout (minutes)
            </Label>
            <Input
              id="sessionTimeout"
              type="number"
              min="1"
              max="60"
              placeholder="5"
              value={formData.sessionTimeout}
              onChange={(e) => handleInputChange('sessionTimeout', parseInt(e.target.value) || 5)}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              How long to keep the app unlocked before requiring biometric authentication again
            </p>
          </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4 mt-4">
              {!isUnlocked ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      You need to unlock with biometrics to view your seed phrase and private key
                    </p>
                  </div>
                  
                  <Button 
                    onClick={handleUnlockSecurity} 
                    className="w-full gradient-primary text-white"
                    size="lg"
                  >
                    <Key className="w-5 h-5 mr-2" />
                    Unlock with Biometrics
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Seed Phrase Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 text-base font-semibold">
                        <Key className="w-5 h-5" />
                        Seed Phrase
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowMnemonic(!showMnemonic)}
                        >
                          {showMnemonic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyMnemonic}
                        >
                          {copiedMnemonic ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-muted rounded-lg border-2 border-dashed">
                      {showMnemonic ? (
                        <p className="text-sm font-mono break-all">{mnemonic}</p>
                      ) : (
                        <div className="flex items-center justify-center py-2">
                          <div className="flex gap-1">
                            {Array.from({ length: 12 }).map((_, i) => (
                              <div key={i} className="w-2 h-2 bg-foreground rounded-full" />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-800 dark:text-red-200">
                        Never share your seed phrase with anyone. Anyone with access to it can control your wallet.
                      </p>
                    </div>
                  </div>

                  {/* Private Key Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex Items-center gap-2 text-base font-semibold">
                        <Key className="w-5 h-5" />
                        Private Key
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPrivateKey(!showPrivateKey)}
                        >
                          {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyPrivateKey}
                        >
                          {copiedPrivateKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-muted rounded-lg border-2 border-dashed">
                      {showPrivateKey ? (
                        <p className="text-xs font-mono break-all">{privateKey}</p>
                      ) : (
                        <div className="flex items-center justify-center py-2">
                          <div className="flex gap-1">
                            {Array.from({ length: 20 }).map((_, i) => (
                              <div key={i} className="w-1.5 h-1.5 bg-foreground rounded-full" />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-800 dark:text-red-200">
                        Keep your private key secure. Losing it means losing access to your wallet.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={handleClose}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
