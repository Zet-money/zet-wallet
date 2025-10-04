"use client";

import { useNotificationListener } from '@/hooks/useNotificationListener';
import { NotificationContainer } from '@/components/NotificationContainer';

export function GlobalNotificationHandler() {
  // This hook sets up the notification listener globally
  useNotificationListener();
  
  // This renders all notifications
  return <NotificationContainer />;
}
