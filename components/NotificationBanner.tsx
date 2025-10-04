"use client";

import { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notificationService } from '@/lib/services/notification-service';

interface NotificationBannerProps {
  notification: {
    title: string;
    body: string;
    data?: any;
  };
  onClose: () => void;
}

export function NotificationBanner({ notification, onClose }: NotificationBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  console.log('NotificationBanner: Rendering notification', notification);

  const handleClose = () => {
    setIsVisible(false);
    onClose();
  };

  const getIcon = () => {
    if (notification.data?.isRecipient === 'true') {
      // Recipient notification
      return <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />;
    } else {
      // Sender notification
      switch (notification.data?.status) {
        case 'completed':
          return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />;
        case 'failed':
          return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />;
        case 'pending':
          return <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />;
        default:
          return <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />;
      }
    }
  };

  const getBackgroundColor = () => {
    if (notification.data?.isRecipient === 'true') {
      return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
    } else {
      switch (notification.data?.status) {
        case 'completed':
          return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
        case 'failed':
          return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
        case 'pending':
          return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800';
        default:
          return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
      }
    }
  };

  const getTextColor = () => {
    if (notification.data?.isRecipient === 'true') {
      return 'text-green-900 dark:text-green-100';
    } else {
      switch (notification.data?.status) {
        case 'completed':
          return 'text-green-900 dark:text-green-100';
        case 'failed':
          return 'text-red-900 dark:text-red-100';
        case 'pending':
          return 'text-yellow-900 dark:text-yellow-100';
        default:
          return 'text-blue-900 dark:text-blue-100';
      }
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 top-4 left-4 sm:top-auto sm:left-auto z-50">
      <div className={`border rounded-lg shadow-lg p-4 max-w-sm mx-auto sm:mx-0 ${getBackgroundColor()}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            {getIcon()}
            <div className="flex-1 min-w-0">
              <h3 className={`text-sm font-medium ${getTextColor()}`}>
                {notification.title}
              </h3>
              <p className={`text-sm mt-1 ${getTextColor().replace('900', '700').replace('100', '300')}`}>
                {notification.body}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className={`p-1 h-auto ${getTextColor().replace('900', '400').replace('100', '500')} hover:${getTextColor().replace('900', '600').replace('100', '300')}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
