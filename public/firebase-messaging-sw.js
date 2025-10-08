// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase with hardcoded config (service workers can't access env vars)
firebase.initializeApp({
  apiKey: "AIzaSyDztmc3G4ohud2O7_XDUfa7Sy1R5YHctcg",
  authDomain: "zet-wallet.firebaseapp.com",
  projectId: "zet-wallet",
  storageBucket: "zet-wallet.firebasestorage.app",
  messagingSenderId: "581945039255",
  appId: "1:581945039255:web:a20510c34973de11890cd2",
});

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Zet.money';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: payload.data,
    requireInteraction: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  if (event.notification.data?.transactionId) {
    // Open the app and navigate to the transaction
    event.waitUntil(
      clients.openWindow(`/transactions/${event.notification.data.transactionId}`)
    );
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});