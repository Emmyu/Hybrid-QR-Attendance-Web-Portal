import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import type { User, AuthError } from 'firebase/auth'
import { auth, firebaseReady } from '../lib/firebase'

// ─── Types ─────────────────────────────────────────────────────────────────

interface UserProfile {
  fullName: string
  title: string
  staffId: string
  faculty: string
  role: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

// ─── Context ───────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null)

// ─── Provider ──────────────────────────────────────────────────────────────

import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Listen for Firebase auth state changes
  useEffect(() => {
    if (!firebaseReady || !auth) {
      setLoading(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      
      if (firebaseUser && db) {
        try {
          const docSnap = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile)
          }
        } catch (error) {
          console.error("Error fetching profile in AuthProvider:", error)
        }
      } else {
        setProfile(null)
      }
      
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase is not configured. Please add your credentials to src/lib/firebase.ts')
    await signInWithEmailAndPassword(auth, email, password)
  }

  const register = async (email: string, password: string): Promise<User> => {
    if (!auth) throw new Error('Firebase is not configured. Please add your credentials to src/lib/firebase.ts')
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    return credential.user
  }

  const logout = async () => {
    if (!auth) return
    await signOut(auth)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

// ─── Helper: Human-readable Firebase error messages ────────────────────────

export function getFirebaseErrorMessage(error: unknown): string {
  const code = (error as AuthError)?.code ?? ''
  const map: Record<string, string> = {
    'auth/user-not-found':       'No account found with this email address.',
    'auth/wrong-password':       'Incorrect password. Please try again.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/invalid-credential':   'Invalid credentials. Check your email and password.',
    'auth/too-many-requests':    'Too many failed attempts. Please try again later.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
  }
  return map[code] ?? 'An unexpected error occurred. Please try again.'
}
