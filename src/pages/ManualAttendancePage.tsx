import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Fingerprint, Search, Trash2, CloudUpload, CirclePlus } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  getDoc,
  increment,
  serverTimestamp 
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

interface StudentRecord {
  id: string
  studentName: string
  studentId: string
  timestamp: any
  method: string
}

export default function ManualAttendancePage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [session, setSession] = useState<any>(null)
  const [attendance, setAttendance] = useState<StudentRecord[]>([])
  const [matricInput, setMatricInput] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!sessionId || !db) return

    // Listen to session
    const unsubSession = onSnapshot(doc(db, 'sessions', sessionId), (docSnap) => {
      if (docSnap.exists()) setSession(docSnap.data())
    })

    // Listen to manual attendance entries
    const q = query(
      collection(db, 'attendance'), 
      where('sessionId', '==', sessionId), 
      where('method', '==', 'manual')
    )
    const unsubAtt = onSnapshot(q, (querySnap) => {
      const records: StudentRecord[] = []
      querySnap.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() } as StudentRecord)
      })
      setAttendance(records)
    })

    return () => { unsubSession(); unsubAtt(); }
  }, [sessionId])

  const handleManualAdd = async () => {
    const matric = matricInput.trim().toUpperCase()
    if (!matric) {
      setError('Please enter a matriculation number.')
      return
    }

    if (attendance.find(a => a.studentId === matric)) {
      setError('Student already recorded in manual list.')
      return
    }
    
    setIsSubmitting(true)
    setError('')
    
    try {
      // 1. Verify session is still active
      if (session?.status !== 'active') {
        setError('This session has ended. Manual attendance cannot be added.')
        setIsSubmitting(false)
        return
      }

      // 2. Verify student exists in institutional roster
      if (!db) {
        setError('Database not initialized')
        setIsSubmitting(false)
        return
      }
      const studentSnap = await getDoc(doc(db, 'student_roster', matric))
      
      if (!studentSnap.exists()) {
        setError(`Matriculation number "${matric}" not found in the official institutional roster.`)
        setIsSubmitting(false)
        return
      }

      // 3. Check for duplicates across ALL records (including QR scans)
      const qDup = query(
        collection(db!, 'attendance'),
        where('sessionId', '==', sessionId),
        where('studentId', '==', matric)
      )
      const dupSnap = await getDocs(qDup)
      if (!dupSnap.empty) {
        setError('Attendance for this student has already been recorded in this session.')
        setIsSubmitting(false)
        return
      }

      const studentData = studentSnap.data()
      const studentName = studentData.fullName || studentData.name || `Student ${matric.split('-').pop()}`

      // 4. Add attendance record (PRD §3.6.3 Schema)
      await addDoc(collection(db!, 'attendance'), {
        sessionId,
        lecturerId: user?.uid,
        studentId: matric,
        studentName: studentName,
        matricNo: matric,
        timestamp: serverTimestamp(),
        method: 'manual'
      })
      
      // 5. Atomically increment the session's presentCount
      if (sessionId) {
        await updateDoc(doc(db!, 'sessions', sessionId), {
          presentCount: increment(1)
        })
      }
      
      setMatricInput('')
    } catch (err) {
      console.error("Error adding manual entry:", err)
      setError("Failed to record attendance. Check connection.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (recordId: string) => {
    if (!db || !sessionId) return
    try {
      await deleteDoc(doc(db, 'attendance', recordId))
      await updateDoc(doc(db, 'sessions', sessionId), {
        presentCount: increment(-1)
      })
    } catch (err) {
      console.error("Error deleting entry:", err)
    }
  }

  return (
    <AppLayout>
      <div className="mae-container">
        {/* ── Page Header ── */}
        <div className="mae-header">
          <div className="mae-header-left">
            <p className="mae-breadcrumb">Course: {session?.course || 'Loading...'}</p>
            <h1 className="page-title">Manual Attendance Entry</h1>
            <p className="mae-subtitle">Record student presence for the session at {session?.location}.</p>
          </div>
          <div className="mae-stats">
            <div className="mae-stat-pill">
              <span className="mae-stat-label">Expected</span>
              <span className="mae-stat-value">{session?.expectedCount || '—'}</span>
            </div>
            <div className="mae-stat-divider" />
            <div className="mae-stat-pill">
              <span className="mae-stat-label">Manual Entries</span>
              <span className="mae-stat-value">{attendance.length}</span>
            </div>
          </div>
        </div>

        {/* ── Search Card ── */}
        <div className="mae-search-card">
          <div className="mae-search-card-title">
            <CirclePlus size={18} color="var(--primary)" strokeWidth={2} />
            <span>Add Student by Matriculation Number</span>
          </div>
          <div className="mae-search-row">
            <div className="mae-search-input-wrap">
              <Fingerprint size={18} className="mae-input-icon" />
              <input
                className="mae-search-input"
                type="text"
                placeholder="Enter Matriculation Number (e.g. 2023-ECON-042)"
                value={matricInput}
                onChange={(e) => { setMatricInput(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
                disabled={isSubmitting}
              />
            </div>
            <button className="btn-primary mae-search-btn" onClick={handleManualAdd} disabled={isSubmitting}>
              <Search size={15} /> {isSubmitting ? 'Validating...' : 'Search & Validate'}
            </button>
          </div>
          {error && <p className="mae-error">{error}</p>}
          <p className="mae-search-note">
            The system will verify the student's enrollment status before adding to the ledger.
          </p>
        </div>

        {/* ── Student List ── */}
        <div className="mae-list-card">
          <div className="mae-list-header">
            <span className="mae-list-title">Session Manual Entries ({attendance.length})</span>
            {attendance.length > 0 && (
              <button className="mae-clear-btn" onClick={() => {
                if (window.confirm('Remove all manual entries? This will also decrement the attendance count.')) {
                  attendance.forEach(a => handleDelete(a.id))
                }
              }}>
                Clear All
              </button>
            )}
          </div>

          {attendance.length === 0 ? (
            <div className="mae-empty">
              <p>No manual entries recorded yet for this session.</p>
            </div>
          ) : (
            <div className="mae-student-list">
              {attendance.map((record, idx) => (
                <div key={record.id} className={`mae-student-row ${idx < attendance.length - 1 ? 'mae-student-row--bordered' : ''}`}>
                  <div className="mae-student-left">
                    <div className="mae-avatar" style={{ background: 'var(--primary)' }}>
                      {record.studentName.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <div className="mae-student-info">
                      <strong>{record.studentName}</strong>
                      <span>
                        {record.studentId}
                        <span className="mae-validated">• Validated</span>
                      </span>
                    </div>
                  </div>
                  <div className="mae-student-right">
                    <span className="mae-added-time">
                      {record.timestamp?.toDate ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(record.timestamp.toDate()) : 'Just now'}
                    </span>
                    <button className="mae-delete-btn" onClick={() => handleDelete(record.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Bottom Action Bar ── */}
        <div className="mae-action-bar">
          <p className="mae-disclaimer">✓ Synced live with session ledger</p>
          <div className="mae-action-btns">
            <button className="mae-discard-btn" onClick={() => navigate(`/live-session/${sessionId}`)}>Return to Live Feed</button>
            <button className="btn-primary" onClick={() => navigate(`/live-session/${sessionId}`)}>
              <CloudUpload size={16} /> Finalize &amp; Sync Session
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

