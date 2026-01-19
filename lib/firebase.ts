import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { 
  signInWithCustomToken, 
  signInAnonymously, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User 
} from "firebase/auth";

// Global variables from Canvas environment
declare global {
  var __Firebase_config: string | undefined;
  var __initial_auth_token: string | undefined;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export const initializeFirebase = (): { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage } => {
  if (app && auth && db && storage) {
    return { app, auth, db, storage };
  }

  let firebaseConfig: any = null;

  // Try to get config from Canvas environment (global variable)
  if (typeof __Firebase_config !== 'undefined' && __Firebase_config) {
    try {
      firebaseConfig = JSON.parse(__Firebase_config);
    } catch (e) {
      console.error('Failed to parse __Firebase_config:', e);
    }
  }

  // If not in Canvas environment, try to get from environment variables
  if (!firebaseConfig) {
    firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    // Check if all required fields are present
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      throw new Error(
        "Firebase configuration not found. Please set Firebase environment variables in .env.local or provide __Firebase_config global variable.\n\n" +
        "Required variables:\n" +
        "- NEXT_PUBLIC_FIREBASE_API_KEY\n" +
        "- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN\n" +
        "- NEXT_PUBLIC_FIREBASE_PROJECT_ID\n" +
        "- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET\n" +
        "- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID\n" +
        "- NEXT_PUBLIC_FIREBASE_APP_ID"
      );
    }
  }

  // Initialize Firebase
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  return { app, auth, db, storage };
};

export const authenticateUser = async (): Promise<User> => {
  const { auth } = initializeFirebase();

  // Check if user is already authenticated
  if (auth.currentUser) {
    return auth.currentUser;
  }

  // Authenticate using custom token or anonymously
  if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
    const userCredential = await signInWithCustomToken(auth, __initial_auth_token);
    return userCredential.user;
  } else {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  }
};

export const getFirestoreDb = (): Firestore => {
  if (!db) {
    const { db: firestoreDb } = initializeFirebase();
    return firestoreDb;
  }
  return db!;
};

export const getFirebaseAuth = (): Auth => {
  if (!auth) {
    const { auth: firebaseAuth } = initializeFirebase();
    return firebaseAuth;
  }
  return auth;
};

export const getFirebaseStorage = (): FirebaseStorage => {
  if (!storage) {
    try {
      const { storage: firebaseStorage } = initializeFirebase();
      return firebaseStorage;
    } catch (error) {
      console.error('Error initializing Firebase Storage:', error);
      throw new Error('Firebase Storage initialization failed. Please check your Firebase configuration and ensure Storage is enabled.');
    }
  }
  return storage;
};

// Email/Password Authentication
export const signUpWithEmail = async (email: string, password: string) => {
  const { auth } = initializeFirebase();
  return await createUserWithEmailAndPassword(auth, email, password);
};

export const signInWithEmail = async (email: string, password: string) => {
  const { auth } = initializeFirebase();
  return await signInWithEmailAndPassword(auth, email, password);
};

export const signOut = async () => {
  const { auth } = initializeFirebase();
  try {
    await firebaseSignOut(auth);
    return;
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

export const getCurrentUser = (): User | null => {
  const { auth } = initializeFirebase();
  return auth.currentUser;
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  const { auth } = initializeFirebase();
  return onAuthStateChanged(auth, callback);
};

