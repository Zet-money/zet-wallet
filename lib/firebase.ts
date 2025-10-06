import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyDztmc3G4ohud2O7_XDUfa7Sy1R5YHctcg",
  authDomain: "zet-wallet.firebaseapp.com",
  projectId: "zet-wallet",
  storageBucket: "zet-wallet.firebasestorage.app",
  messagingSenderId: "581945039255",
  appId: "1:581945039255:web:a20510c34973de11890cd2",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export default app;
