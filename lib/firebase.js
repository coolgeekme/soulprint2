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

/**
 * Firebase client config, resolved at RUNTIME.
 *
 * NEXT_PUBLIC_* values are INLINED into the bundle at build time — they are not read when the
 * page runs. If the build happens without them (a build step that does not inherit the app's
 * environment, a CI runner, a fresh container), the bundle ships `undefined` and every user
 * sees "Google sign-in is currently unavailable. Please use email/passcode." with no way to
 * tell what went wrong. That is exactly what happened in production.
 *
 * So: use the inlined values when the build had them, and otherwise ask the server, which
 * reads the same variables from its own environment at request time. The build no longer
 * decides whether authentication works.
 */
const BUILD_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

let app = null;
let auth = null;
let googleProvider = null;
let initPromise = null;

const isComplete = (c) => !!(c && c.apiKey && c.authDomain && c.projectId);

async function resolveConfig() {
  if (isComplete(BUILD_CONFIG)) return BUILD_CONFIG;
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (res.ok) {
      const runtime = await res.json();
      if (isComplete(runtime)) return runtime;
    }
  } catch (e) {
    console.warn('[firebase] runtime config unavailable:', e.message);
  }
  return BUILD_CONFIG;
}

/**
 * Initialise once, lazily. Returns the initialized context, or null when no config can be
 * found by either route — callers then report a clear error instead of a silent no-op.
 */
export function ensureFirebase() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const config = await resolveConfig();
    if (!isComplete(config)) {
      if (typeof window !== 'undefined') {
        console.warn('[firebase] no client config from build or /api/config');
      }
      return null;
    }
    app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    return { app, auth, googleProvider };
  })();
  return initPromise;
}

const NOT_CONFIGURED = { user: null, idToken: null, error: 'Firebase not configured' };

// Google Sign-In
export async function signInWithGoogle() {
  const ctx = await ensureFirebase();
  if (!ctx) return NOT_CONFIGURED;
  try {
    const result = await signInWithPopup(ctx.auth, ctx.googleProvider);
    const idToken = await result.user.getIdToken();
    return { user: result.user, idToken, error: null };
  } catch (error) {
    console.error('Google sign-in error:', error);
    return { user: null, idToken: null, error: error.message };
  }
}

// Email/Password Sign-In
export async function signInWithEmail(email, password) {
  const ctx = await ensureFirebase();
  if (!ctx) return NOT_CONFIGURED;
  try {
    const result = await signInWithEmailAndPassword(ctx.auth, email, password);
    const idToken = await result.user.getIdToken();
    return { user: result.user, idToken, error: null };
  } catch (error) {
    console.error('Email sign-in error:', error);
    return { user: null, idToken: null, error: error.message };
  }
}

// Email/Password Sign-Up
export async function signUpWithEmail(email, password) {
  const ctx = await ensureFirebase();
  if (!ctx) return NOT_CONFIGURED;
  try {
    const result = await createUserWithEmailAndPassword(ctx.auth, email, password);
    const idToken = await result.user.getIdToken();
    return { user: result.user, idToken, error: null };
  } catch (error) {
    console.error('Email sign-up error:', error);
    return { user: null, idToken: null, error: error.message };
  }
}

// Sign Out
export async function firebaseSignOut() {
  const ctx = await ensureFirebase();
  if (!ctx) return { error: 'Firebase not configured' };
  try {
    await signOut(ctx.auth);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}

// Password Reset
export async function resetPassword(email) {
  const ctx = await ensureFirebase();
  if (!ctx) return { error: 'Firebase not configured' };
  try {
    await sendPasswordResetEmail(ctx.auth, email);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}

// Get current user's ID token
export async function getIdToken() {
  const ctx = await ensureFirebase();
  if (!ctx?.auth) return null;
  const user = ctx.auth.currentUser;
  if (user) {
    return await user.getIdToken();
  }
  return null;
}

// Auth state listener
export async function onAuthChange(callback) {
  const ctx = await ensureFirebase();
  if (!ctx) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(ctx.auth, callback);
}

export { auth };
