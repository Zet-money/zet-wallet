"use client";

import { useState, useEffect } from 'react';
import { X, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { notificationService } from '@/lib/services/notification-service';
import { useWallet } from '@/contexts/wallet-context';
import { toast } from 'sonner';

export function NotificationPermissionBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { wallet } = useWallet();

  useEffect(() => {
    // Check if user has already dismissed the banner
    const dismissed = localStorage.getItem('notification-banner-dismissed');
    if (dismissed) {
      return;
    }

    // Check if notifications are supported and permission is not granted
    if (notificationService.isSupported()) {
      const permission = notificationService.getPermissionStatus();
      if (!permission.granted && !permission.denied) {
        setIsVisible(true);
      }
    }
  }, []);

  const handleEnableNotifications = async () => {
    if (!wallet?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const success = await notificationService.subscribeToNotifications(wallet.address);
      if (success) {
        toast.success('Notifications enabled! You\'ll receive real-time updates on your transactions.');
        setIsVisible(false);
        localStorage.setItem('notification-banner-dismissed', 'true');
      } else {
        toast.error('Failed to enable notifications. Please try again.');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast.error('Failed to enable notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('notification-banner-dismissed', 'true');
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Enable Notifications
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Get real-time updates on your transactions. We'll notify you when:
              </p>
              <ul className="text-xs text-blue-600 dark:text-blue-400 mt-2 space-y-1">
                <li>• Your transactions are confirmed</li>
                <li>• Transactions fail and need attention</li>
                <li>• Cross-chain transfers complete</li>
              </ul>
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <Button
              size="sm"
              onClick={handleEnableNotifications}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? 'Enabling...' : 'Enable'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
