/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, enableMultiTabIndexedDbPersistence, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase using the configuration file generated during setup
const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying the firestoreDatabaseId
export const db = initializeFirestore(app, { 
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
}, firebaseConfig.firestoreDatabaseId);

// You can also optionally setup persistence gracefully
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("Persistence failed-precondition: Multiple tabs open.");
  } else if (err.code === 'unimplemented') {
    console.warn("Persistence unimplemented in this browser.");
  }
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Standard auth triggers
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

// Error Management structure required by the Firebase Integration standard
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
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
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  };
  
  if (errInfo.error.includes('offline') || errInfo.error.includes('unavailable')) {
    console.warn('Firestore is currently offline. Operating from cache.', errInfo.error);
    return;
  }
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Only log, do not throw, to prevent unhandled promise rejections crashing the app.
}

// Connectivity confirmation test run
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or connection. Device is offline.");
    }
  }
}

testConnection();
