"use client";

import { NotificationBanner } from '@/components/NotificationBanner';
import { useNotifications } from '@/contexts/NotificationContext';

export function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications();

  return (
    <>
      {notifications.map((notification) => (
        <NotificationBanner
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </>
  );
}
