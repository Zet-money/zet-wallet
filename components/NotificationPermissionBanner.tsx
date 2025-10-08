"use client";

import { useState, useEffect } from 'react';
import { X, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notificationService } from '@/lib/services/notification-service';
import { toast } from 'sonner';
import { useWallet } from '@/contexts/WalletContext';
import { useBiometric } from '@/contexts/BiometricContext';

export function NotificationPermissionBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { wallet } = useWallet();
  const { getBiometricPublicKey } = useBiometric();

  useEffect(() => {
    console.log('NotificationPermissionBanner: Checking conditions...');
    
    // Don't show banner if wallet is not available yet
    if (!wallet?.address) {
      console.log('No wallet address available yet, not showing banner');
      return;
    }
    
    // Check if notifications are already properly enabled
    const notificationsEnabled = localStorage.getItem('notifications_enabled');
    if (notificationsEnabled === 'true') {
      console.log('Notifications already enabled, not showing banner');
      setIsVisible(false);
      return;
    }

    // Check if user has already dismissed the banner
    const dismissedData = localStorage.getItem('notification-banner-dismissed');
    console.log('Dismissed data:', dismissedData);
    
    if (dismissedData) {
      try {
        const dismissedTime = JSON.parse(dismissedData).timestamp;
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        console.log('Time since dismissed:', (now - dismissedTime) / (1000 * 60 * 60), 'hours');
        
        // If dismissed less than 24 hours ago, don't show
        if (now - dismissedTime < twentyFourHours) {
          console.log('Banner dismissed less than 24 hours ago, not showing');
          return;
        }
      } catch (error) {
        console.log('Error parsing dismissed data, treating as not dismissed');
        localStorage.removeItem('notification-banner-dismissed');
      }
    }

    // Check if notifications are supported and permission is not granted
    const isSupported = notificationService.isSupported();
    console.log('Notifications supported:', isSupported);
    
    if (isSupported) {
      const permission = notificationService.getPermissionStatus();
      console.log('Permission status:', permission);
      
      // Show banner if permission is default (not asked yet)
      if (!permission.granted && !permission.denied) {
        console.log('Permission not asked yet, setting banner visible');
        setIsVisible(true);
      } else if (permission.granted) {
        // Permission is granted - check if we have a stored FCM token
        const storedToken = localStorage.getItem('fcm_token');
        if (!storedToken) {
          console.log('Permission granted but no FCM token stored, showing banner');
          setIsVisible(true);
        } else {
          console.log('Permission granted and FCM token exists, not showing banner');
          setIsVisible(false);
        }
      } else {
        console.log('Permission denied, not showing banner');
        setIsVisible(false);
      }
    } else {
      console.log('Notifications not supported, not showing banner');
      setIsVisible(false);
    }
  }, [wallet?.address]); // Add wallet.address as dependency

  const handleEnableNotifications = async () => {
    if (!wallet?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const biometricPublicKey = await getBiometricPublicKey();
      if (!biometricPublicKey) {
        toast.error('Biometric public key not available');
        return;
      }
      
      const success = await notificationService.subscribeToNotifications(wallet.address, biometricPublicKey);
      if (success) {
        toast.success('Notifications enabled! You\'ll receive real-time updates on your transactions.');
        setIsVisible(false);
        // Clear the dismissed flag since notifications are now enabled
        localStorage.removeItem('notification-banner-dismissed');
        // Store a flag to indicate notifications are properly set up
        localStorage.setItem('notifications_enabled', 'true');
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
    // Store timestamp for 24-hour reminder
    localStorage.setItem('notification-banner-dismissed', JSON.stringify({
      timestamp: Date.now()
    }));
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 top-4 left-4 sm:top-auto sm:left-auto z-50">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-sm mx-auto sm:mx-0">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <BellRing className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Enable Notifications
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Get real-time updates on your transactions
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 h-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            onClick={handleEnableNotifications}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isLoading ? 'Enabling...' : 'Enable'}
          </Button>
        </div>
      </div>
    </div>
  );
}