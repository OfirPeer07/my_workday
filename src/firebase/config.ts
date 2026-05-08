import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

type FirebaseClients = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

function readEnvValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

const firebaseConfig = {
  apiKey: readEnvValue(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: readEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: readEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: readEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: readEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: readEnvValue(import.meta.env.VITE_FIREBASE_APP_ID),
};

export const isFirebaseConfigured =
  firebaseConfig.apiKey.startsWith("AIza") &&
  firebaseConfig.authDomain.endsWith(".firebaseapp.com") &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.storageBucket) &&
  /^\d+$/.test(firebaseConfig.messagingSenderId) &&
  /^\d+:/.test(firebaseConfig.appId);

let clients: FirebaseClients | null = null;

export function getFirebaseClients(): FirebaseClients | null {
  if (!isFirebaseConfigured) {
    return null;
  }

  if (!clients) {
    try {
      const app = initializeApp(firebaseConfig);
      clients = {
        app,
        auth: getAuth(app),
        db: getFirestore(app),
      };
    } catch {
      return null;
    }
  }

  return clients;
}
