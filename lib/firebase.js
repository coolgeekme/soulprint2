'use client';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// Check if Firebase is properly configured
const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId;

// Validate Firebase config - warn if env vars are missing (don't throw)
if (typeof window !== 'undefined' && !isFirebaseConfigured) {
  console.warn('Firebase config incomplete - check NEXT_PUBLIC_FIREBASE_* environment variables. Auth features may not work.');
}

// Initialize Firebase (singleton pattern) - only if configured
let app = null;
let auth = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
}

// Google Sign-In
export async function signInWithGoogle() {
  if (!auth || !googleProvider) {
    return { user: null, idToken: null, error: 'Firebase not configured' };
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    return { user: result.user, idToken, error: null };
  } catch (error) {
    console.error('Google sign-in error:', error);
    return { user: null, idToken: null, error: error.message };
  }
}

// Email/Password Sign-In
export async function signInWithEmail(email, password) {
  if (!auth) {
    return { user: null, idToken: null, error: 'Firebase not configured' };
  }
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await result.user.getIdToken();
    return { user: result.user, idToken, error: null };
  } catch (error) {
    console.error('Email sign-in error:', error);
    return { user: null, idToken: null, error: error.message };
  }
}

// Email/Password Sign-Up
export async function signUpWithEmail(email, password) {
  if (!auth) {
    return { user: null, idToken: null, error: 'Firebase not configured' };
  }
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const idToken = await result.user.getIdToken();
    return { user: result.user, idToken, error: null };
  } catch (error) {
    console.error('Email sign-up error:', error);
    return { user: null, idToken: null, error: error.message };
  }
}

// Sign Out
export async function firebaseSignOut() {
  if (!auth) {
    return { error: 'Firebase not configured' };
  }
  try {
    await signOut(auth);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}

// Password Reset
export async function resetPassword(email) {
  if (!auth) {
    return { error: 'Firebase not configured' };
  }
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}

// Get current user's ID token
export async function getIdToken() {
  if (!auth) return null;
  const user = auth.currentUser;
  if (user) {
    return await user.getIdToken();
  }
  return null;
}

// Auth state listener
export function onAuthChange(callback) {
  if (!auth) {
    // Call callback with null user if Firebase not configured
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export { auth };
