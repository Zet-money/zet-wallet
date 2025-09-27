"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Eye, EyeOff, Check, Shield } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';

export default function WalletSetup() {
  const { createWallet, importWallet, confirmMnemonicSaved, wallet } = useWallet();
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [importMnemonic, setImportMnemonic] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreateWallet = () => {
    createWallet();
    toast.success('Wallet created successfully!');
  };

  const handleImportWallet = () => {
    if (!importMnemonic.trim()) {
      toast.error('Please enter a valid mnemonic phrase');
      return;
    }
    
    const words = importMnemonic.trim().split(/\s+/);
    if (words.length !== 12) {
      toast.error('Mnemonic phrase must contain exactly 12 words');
      return;
    }
    
    importWallet(importMnemonic.trim());
    toast.success('Wallet imported successfully!');
  };


  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  if (wallet && !wallet.isImported) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Your Recovery Phrase</CardTitle>
            <CardDescription>
              Write down these 12 words in the exact order shown. Store them in a safe place.
              Never share your recovery phrase with anyone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-lg">
              {!showMnemonic && (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">Click "Show Phrase" to reveal your recovery phrase</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-sm">
                {wallet.mnemonic.split(' ').map((word, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span className="text-muted-foreground w-6">{index + 1}.</span>
                    <span className="font-mono">
                      {showMnemonic ? word : '••••••••'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setShowMnemonic(!showMnemonic)}
                className="flex items-center space-x-2"
              >
                {showMnemonic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{showMnemonic ? 'Hide' : 'Show'} Phrase</span>
              </Button>
              
              <Button
                onClick={() => copyToClipboard(wallet.mnemonic)}
                disabled={!showMnemonic}
                className="flex items-center space-x-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </Button>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Important:</strong> If you lose your recovery phrase, you will lose access to your wallet forever. 
                Make sure to store it in a secure location.
              </p>
            </div>

            {/* Biometric security is already set up before reaching this point */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900 dark:text-green-100">
                    Biometric Security Enabled
                  </h4>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Your wallet is protected by biometric authentication. Your recovery phrase is encrypted and secure.
                  </p>
                </div>
              </div>
            </div>
            
            <Button onClick={confirmMnemonicSaved} className="w-full">
              I've saved my recovery phrase
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-primary">Z</span>
          </div>
          <CardTitle className="text-2xl">Welcome to Zet Wallet</CardTitle>
          <CardDescription>
            Create a new wallet or import an existing one to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create Wallet</TabsTrigger>
              <TabsTrigger value="import">Import Wallet</TabsTrigger>
            </TabsList>
            
            <TabsContent value="create" className="space-y-4">
              <div className="text-center space-y-2">
                <h3 className="font-semibold">Create New Wallet</h3>
                <p className="text-sm text-muted-foreground">
                  Generate a new 12-word recovery phrase for your wallet
                </p>
              </div>
              <Button onClick={handleCreateWallet} className="w-full">
                Create New Wallet
              </Button>
            </TabsContent>
            
            <TabsContent value="import" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mnemonic">Recovery Phrase</Label>
                <Input
                  id="mnemonic"
                  placeholder="Enter your 12-word recovery phrase"
                  value={importMnemonic}
                  onChange={(e) => setImportMnemonic(e.target.value)}
                  className="h-20"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 12 words separated by spaces
                </p>
              </div>
              <Button onClick={handleImportWallet} className="w-full">
                Import Wallet
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
