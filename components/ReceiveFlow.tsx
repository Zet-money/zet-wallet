"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Copy, Check, Download } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';

interface ReceiveFlowProps {
  asset: {
    id: string;
    symbol: string;
    name: string;
    balance: string;
    usdValue: string;
    chain: string;
    logo: string;
  };
  onClose: () => void;
}

export default function ReceiveFlow({ asset, onClose }: ReceiveFlowProps) {
  const { wallet } = useWallet();
  const [copied, setCopied] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const displayAddress = wallet?.address || '';

  const copyToClipboard = async (text: string, type: 'address' | 'qr') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'address') {
        setCopiedAddress(true);
        toast.success('Address copied to clipboard!');
        setTimeout(() => setCopiedAddress(false), 2000);
      } else {
        setCopied(true);
        toast.success('QR code data copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const downloadQR = () => {
    const svg = document.getElementById('qr-code');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `zet-wallet-${asset.symbol}-address.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    }
  };

  if (!wallet) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <Card className="w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Receive {asset.symbol}</CardTitle>
            <CardDescription>Share your address to receive {asset.symbol}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Asset Info */}
          <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
            <div className="w-10 h-10 bg-background rounded-full flex items-center justify-center overflow-hidden">
              <img 
                src={asset.logo} 
                alt={asset.symbol}
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-xs font-semibold hidden">
                {asset.symbol}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-semibold">{asset.symbol}</span>
                <Badge variant="secondary" className="text-xs">{asset.chain}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{asset.name}</p>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center space-y-4">
            <div className="p-3 sm:p-4 bg-white rounded-lg">
              <QRCode
                id="qr-code"
                value={displayAddress}
                size={180}
                style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
              />
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(displayAddress, 'qr')}
                className="flex items-center space-x-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>Copy QR</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={downloadQR}
                className="flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </Button>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your {asset.symbol} Address</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(displayAddress, 'address')}
                className="flex items-center space-x-1"
              >
                {copiedAddress ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="text-xs">Copy</span>
              </Button>
            </div>
            
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-mono break-all">{displayAddress}</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">How to receive {asset.symbol}</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Share this QR code or address with the sender</li>
              <li>• Make sure the sender is sending to the correct network ({asset.chain})</li>
              <li>• The transaction will appear in your wallet once confirmed</li>
              <li>• Never share your private key or recovery phrase</li>
            </ul>
          </div>

          {/* Network Warning */}
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Important:</strong> Only send {asset.symbol} to this address on the {asset.chain} network. 
              Sending from other networks may result in permanent loss of funds.
            </p>
          </div>

          {/* Action Button */}
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
