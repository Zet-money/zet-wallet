"use client";

import { useEffect } from 'react';
import { notificationService } from '@/lib/services/notification-service';
import { useNotifications } from '@/contexts/NotificationContext';
import { useWallet } from '@/contexts/WalletContext';

export function useNotificationListener() {
  const { addNotification } = useNotifications();
  const { wallet } = useWallet();

  useEffect(() => {
    console.log('Global notification listener: useEffect running, wallet:', wallet?.address, 'addNotification:', typeof addNotification);
    
    if (typeof window !== 'undefined' && wallet?.address) {
      console.log('Setting up global notification message listener...');
      notificationService.setupMessageListener((payload) => {
        console.log('Global listener: Received notification payload:', payload);
        
        // Show notification banner
        if (payload.notification) {
          console.log('Global listener: Adding notification to context:', {
            title: payload.notification.title,
            body: payload.notification.body,
            data: payload.data,
          });
          addNotification({
            title: payload.notification.title || 'New Notification',
            body: payload.notification.body || 'You have a new notification',
            data: payload.data,
          });
          console.log('Global listener: Notification added to context');
        }
      });
    } else {
      console.log('Global listener: Conditions not met - window:', typeof window !== 'undefined', 'wallet:', wallet?.address);
    }
  }, [wallet?.address, addNotification]);
}
