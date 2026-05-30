// ─── Firebase Configuration ────────────────────────────────────────────────
// ⚠️  IMPORTANT: Replace the placeholder values below with your actual
//     Firebase project credentials from the Firebase Console.
//     https://console.firebase.google.com → Project Settings → Your Apps → SDK Setup
// ──────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { getAnalytics } from 'firebase/analytics'
import type { Analytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

// ─── Safe initialization ───────────────────────────────────────────────────
let app:  FirebaseApp | null = null
let auth: Auth | null = null
let db:   Firestore | null = null
let analytics: Analytics | null = null
export let firebaseReady = false

const isPlaceholder = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('YOUR_')

if (!isPlaceholder) {
  try {
    app  = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db   = getFirestore(app)
    // Analytics only works in browser environments
    if (typeof window !== 'undefined') {
      analytics = getAnalytics(app)
    }
    firebaseReady = true
  } catch (e) {
    console.error('[Stratos] Firebase failed to initialize:', e)
  }
} else {
  console.warn('[Stratos] Firebase credentials are not set in src/lib/firebase.ts')
}

export { auth, db, analytics }
export default app

