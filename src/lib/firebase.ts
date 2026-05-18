import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously as firebaseSignInAnonymously, signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, enableIndexedDbPersistence, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { OperationType } from '../types';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings for better performance and persistence
export const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
}, firebaseConfig.firestoreDatabaseId);

// Enable persistence to reduce read quotas and support offline mode
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time.
    console.warn('Firestore persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // The current browser does not support all of the features required to enable persistence
    console.warn('Firestore persistence failed: Browser not supported');
  }
});

export const auth = getAuth(app);

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  isQuotaExceeded?: boolean;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isQuotaExceeded = errorMessage.includes('Quota limit exceeded') || 
                          errorMessage.includes('quota limit exceeded') ||
                          errorMessage.includes('Quota exceeded');
  
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    isQuotaExceeded,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }

  if (isQuotaExceeded) {
    console.warn(`[Firestore Quota] Limit exceeded for ${operationType} on ${path}. App will switch to offline mode.`);
  } else {
    console.error(`[Firestore Error] ${operationType} failed on ${path}:`, errorMessage);
  }

  throw new Error(JSON.stringify(errInfo));
}

export const loginAnonymously = async () => {
  try {
    const result = await firebaseSignInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error("Firebase Login Error:", error);
    throw error;
  }
};

export const loginWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    // Prefer popup as it works better in the iFrame environment
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Google Login Error:", error);
    throw error;
  }
};

export const logout = () => firebaseSignOut(auth);
