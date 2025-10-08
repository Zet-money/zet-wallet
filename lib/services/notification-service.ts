import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../firebase';
import { backendApi } from './backend-api';

export interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

export class NotificationService {
  private static instance: NotificationService;
  private vapidKey: string;

  constructor() {
    this.vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return { granted: false, denied: true, default: false };
    }

    if (Notification.permission === 'granted') {
      return { granted: true, denied: false, default: false };
    }

    if (Notification.permission === 'denied') {
      return { granted: false, denied: true, default: false };
    }

    const permission = await Notification.requestPermission();
    return {
      granted: permission === 'granted',
      denied: permission === 'denied',
      default: permission === 'default',
    };
  }

  async getFCMToken(): Promise<string | null> {
    if (!messaging) {
      console.log('Firebase messaging not available');
      return null;
    }

    try {
      // Register service worker first
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service worker registered');
      }

      const token = await getToken(messaging, {
        vapidKey: this.vapidKey,
      });

      if (token) {
        console.log('FCM Token:', token);
        return token;
      } else {
        console.log('No registration token available.');
        return null;
      }
    } catch (error) {
      console.error('An error occurred while retrieving token:', error);
      return null;
    }
  }

  async subscribeToNotifications(walletAddress: string, biometricPublicKey: string): Promise<boolean> {
    try {
      const permission = await this.requestPermission();
      
      if (!permission.granted) {
        console.log('Notification permission not granted');
        return false;
      }

      const token = await this.getFCMToken();
      if (!token) {
        console.log('Failed to get FCM token');
        return false;
      }

      await backendApi.subscribeToNotifications(walletAddress, biometricPublicKey, token);
      console.log('Successfully subscribed to notifications');
      return true;
    } catch (error) {
      console.error('Failed to subscribe to notifications:', error);
      return false;
    }
  }

  async unsubscribeFromNotifications(walletAddress: string, biometricPublicKey: string, token?: string): Promise<boolean> {
    try {
      await backendApi.unsubscribeFromNotifications(walletAddress, biometricPublicKey, token);
      console.log('Successfully unsubscribed from notifications');
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from notifications:', error);
      return false;
    }
  }

  setupMessageListener(onMessageReceived?: (payload: any) => void): void {
    if (!messaging) {
      console.log('Firebase messaging not available');
      return;
    }

    onMessage(messaging, (payload) => {
      console.log('Message received:', payload);
      
      if (onMessageReceived) {
        onMessageReceived(payload);
      }

      // Show notification if app is in foreground
      if (payload.notification) {
        this.showNotification(
          payload.notification.title || 'Zet.money',
          payload.notification.body || 'You have a new notification',
          payload.data
        );
      }
    });
  }

  private showNotification(title: string, body: string, data?: any): void {
    if ('serviceWorker' in navigator && 'Notification' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          data,
          requireInteraction: true,
        });
      });
    }
  }

  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  getPermissionStatus(): NotificationPermission {
    if (!('Notification' in window)) {
      return { granted: false, denied: true, default: false };
    }

    return {
      granted: Notification.permission === 'granted',
      denied: Notification.permission === 'denied',
      default: Notification.permission === 'default',
    };
  }
}

export const notificationService = NotificationService.getInstance();
