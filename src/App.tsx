import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { firebaseReady } from './lib/firebase'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ManualAttendancePage from './pages/ManualAttendancePage'
import InitializeSessionPage from './pages/InitializeSessionPage'
import LiveSessionPage from './pages/LiveSessionPage'
import SessionDetailsPage from './pages/SessionDetailsPage'
import AttendanceLedgerPage from './pages/AttendanceLedgerPage'
import './index.css'

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs 
} from 'firebase/firestore'
import { db } from './lib/firebase'
import ScheduleFuturePage from './pages/ScheduleFuturePage'
import AnalyticsPage from './pages/AnalyticsPage'

/**
 * A wrapper for routes that require authentication.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Verifying Identity...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

/**
 * A wrapper for auth routes (login/register) to redirect logged-in users.
 */
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

/**
 * Redirects /manual-attendance to the most recent session
 */
function ManualAttendanceRedirect() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(false)

  useEffect(() => {
    const findLatestSession = async () => {
      if (!user || !db) return
      try {
        const q = query(
          collection(db, 'sessions'),
          where('lecturerId', '==', user.uid),
          orderBy('actualStartTime', 'desc'),
          limit(1)
        )
        const snap = await getDocs(q)
        if (!snap.empty) {
          navigate(`/manual-attendance/${snap.docs[0].id}`, { replace: true })
        } else {
          setError(true)
        }
      } catch (err) {
        console.error(err)
        setError(true)
      }
    }
    findLatestSession()
  }, [user, navigate])

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h3>No active sessions found.</h3>
        <p>Please start a session first to enter manual attendance.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary" style={{ marginTop: '20px' }}>
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="loading-container">
      <div className="loader"></div>
      <p>Locating Latest Session...</p>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      {!firebaseReady && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#f59e0b', color: '#1c1917', padding: '10px 20px',
          fontSize: 13, fontWeight: 600, textAlign: 'center',
          fontFamily: 'Inter, sans-serif', letterSpacing: '0.01em',
        }}>
          ⚠️ Firebase is not configured. Open{' '}
          <code style={{ background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: 4 }}>
            src/lib/firebase.ts
          </code>{' '}
          and replace the <code style={{ background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: 4 }}>YOUR_*</code> placeholders with your real Firebase credentials.
        </div>
      )}
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Public/Auth Routes */}
          <Route path="/login" element={
            <AuthRoute>
              <LoginPage />
            </AuthRoute>
          } />
          <Route path="/register" element={
            <AuthRoute>
              <RegisterPage />
            </AuthRoute>
          } />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/manual-attendance" element={
            <ProtectedRoute>
              <ManualAttendanceRedirect />
            </ProtectedRoute>
          } />
          <Route path="/manual-attendance/:sessionId" element={
            <ProtectedRoute>
              <ManualAttendancePage />
            </ProtectedRoute>
          } />
          <Route path="/session/new" element={
            <ProtectedRoute>
              <InitializeSessionPage />
            </ProtectedRoute>
          } />
          <Route path="/live-session/:sessionId" element={
            <ProtectedRoute>
              <LiveSessionPage />
            </ProtectedRoute>
          } />
          <Route path="/session/details" element={
            <ProtectedRoute>
              <SessionDetailsPage />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute>
              <AttendanceLedgerPage />
            </ProtectedRoute>
          } />
          <Route path="/schedule" element={
            <ProtectedRoute>
              <ScheduleFuturePage />
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  )
}


export default App
