import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PenSquare, StopCircle, AlertCircle, FileText, Download, CheckCircle2 } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import { QRCodeSVG } from 'qrcode.react'
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../lib/firebase'

interface AttendanceRecord {
  id: string
  studentName: string
  studentId: string
  timestamp: any
  method: string
}

interface SessionData {
  id?: string
  lecturerId?: string
  course: string
  location: string
  type: string
  expectedCount?: number
  presentCount?: number
  status: string
  qrExpiry?: number
  geofence?: boolean
  deviceBinding?: boolean
  notes?: string
  [key: string]: any
}

export default function LiveSessionPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [session, setSession] = useState<SessionData | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [qrSeconds, setQrSeconds] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')

  // 1. Listen to Session Details
  useEffect(() => {
    if (!sessionId || !db) return

    const unsubscribe = onSnapshot(doc(db!, 'sessions', sessionId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SessionData
        setSession(data)
        setNoteDraft(data.notes || '')
        setLoading(false)
      } else {
        setError("Session not found.")
        setLoading(false)
      }
    }, (err) => {
      console.error("Session listener error:", err)
      setError("Failed to connect to session.")
      setLoading(false)
    })

    return () => unsubscribe()
  }, [sessionId])

  // 2. Listen to Attendance Feed
  useEffect(() => {
    if (!sessionId || !db) return

    console.log(`LiveSessionPage: Querying attendance for session ID: "${sessionId}"`);

    const q = query(
      collection(db!, 'attendance'),
      where('sessionId', '==', sessionId)
    )
    
    // Check if sessionId is valid
    if (!sessionId || sessionId === ':sessionId') {
      console.error("LiveSessionPage: Invalid sessionId in URL params.");
    }

    const unsubscribe = onSnapshot(q, (querySnap) => {
      console.log(`LiveSessionPage: Received snapshot with ${querySnap.size} docs`);
      const records: AttendanceRecord[] = []
      querySnap.forEach((doc) => {
        const data = doc.data();
        console.log("Record data:", data);
        records.push({ id: doc.id, ...data } as AttendanceRecord)
      })
      
      // Sort in-memory to handle null/pending timestamps
      records.sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date();
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date();
        return dateB.getTime() - dateA.getTime();
      });

      setAttendance(records)
    }, (err) => {
      console.error("Attendance listener error:", err)
      // If index is missing, we can fallback to a simpler query or show an error
      if (err.message.includes('index')) {
        console.warn("Firestore Composite Index missing! Real-time sorting disabled.");
      }
    })

    return () => unsubscribe()
  }, [sessionId])

  // 3. QR Refresh Timer
  useEffect(() => {
    if (!session) return
    const interval = session.qrExpiry || 15
    setQrSeconds(interval)

    const t = setInterval(() => {
      setQrSeconds(s => (s <= 1 ? interval : s - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [session?.qrExpiry])

  const handleEndSession = async () => {
    if (!sessionId || !db) return
    if (window.confirm("Are you sure you want to end this attendance session?")) {
      try {
        await updateDoc(doc(db, 'sessions', sessionId), {
          status: 'completed',
          endTime: serverTimestamp()
        })
        navigate('/dashboard')
      } catch (err) {
        console.error("Error ending session:", err)
      }
    }
  }

  const handleSaveNotes = async () => {
    if (!sessionId || !db) return
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        notes: noteDraft
      })
      setEditingNotes(false)
    } catch (err) {
      console.error("Error saving notes:", err)
    }
  }

  const handleExportCSV = () => {
    if (!session || attendance.length === 0) return
    
    const headers = ["Student Name", "Student ID", "Method", "Timestamp"]
    const rows = attendance.map(r => [
      r.studentName,
      r.studentId,
      r.method,
      r.timestamp?.toDate ? r.timestamp.toDate().toLocaleString() : 'N/A'
    ])
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `attendance_${session.course.replace(/[^a-z0-9]/gi, '_')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) return (
    <AppLayout>
      <div className="ls-loading">Synchronizing with Stratos Ledger...</div>
    </AppLayout>
  )

  if (error || !session) return (
    <AppLayout>
      <div className="ls-error">
        <AlertCircle size={48} color="#ef4444" />
        <h2>{error || "Session Unavailable"}</h2>
        <button className="btn-primary" onClick={() => navigate('/dashboard')}>Return to Dashboard</button>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      {/* ── Header ── */}
      <div className="ls-header">
        <div>
          <p className="ls-breadcrumb">Current Live Session</p>
          <h1 className="ls-title">{session.course}</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
            <p className="ls-location">{session.location} &bull; {session.type}</p>
            {session.geofence && <span className="badge badge-green" style={{ fontSize: '10px' }}>GEOFENCE ACTIVE</span>}
            {session.deviceBinding && <span className="badge badge-orange" style={{ fontSize: '10px' }}>BOUND</span>}
          </div>
        </div>
        <div className="ls-stats">
          <div className="ls-stat">
            <span className="ls-stat-value">{attendance.length}</span>
            <span className="ls-stat-label">Students Present</span>
          </div>
          <div className="ls-stat-divider" />
          <div className="ls-stat">
            <span className="ls-stat-value">{session.expectedCount}</span>
            <span className="ls-stat-label">Expected</span>
          </div>
          <div className="ls-stat-divider" />
          <div className="ls-stat" style={{ minWidth: '100px' }}>
            <button 
              onClick={async () => {
                if (!db || !sessionId || !user) return;
                try {
                  const { setDoc, doc } = await import('firebase/firestore');
                  const testUid = `test_${Math.floor(Math.random() * 10000)}`;
                  const recordId = `${sessionId}_${testUid}`;
                  
                  await setDoc(doc(db, 'attendance', recordId), {
                    sessionId,
                    lecturerId: user.uid,
                    studentUid: testUid,
                    studentId: `STR-${Math.floor(1000 + Math.random() * 9000)}`,
                    studentName: "Diagnostic Probe",
                    matricNo: "DIAG-TEST",
                    deviceId: "web-diagnostic",
                    timestamp: new Date(),
                    method: "diagnostic"
                  });
                  
                  // Also simulate the increment that students do
                  const { updateDoc, increment } = await import('firebase/firestore');
                  await updateDoc(doc(db, 'sessions', sessionId), {
                    presentCount: increment(1)
                  });
                } catch (e) {
                  console.error("Diagnostic scan failed:", e);
                }
              }}
              className="btn-outline"
              style={{ padding: '6px 10px', fontSize: '10px' }}
            >
              DIAGNOSTIC SYNC
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="ls-body">
        {/* QR Card */}
        <div className="ls-qr-card">
          <p className="ls-qr-top-label">DYNAMIC STRATOS TOKEN</p>
          <div className="ls-qr-wrapper">
            <div style={{ background: '#fff', padding: '16px', borderRadius: '12px' }}>
              <QRCodeSVG 
                value={JSON.stringify({ 
                  sessionId, 
                  courseCode: session.course,
                  lecturerId: session.lecturerId,
                  t: Math.floor(Date.now() / 1000 / 60) * 60 // Current minute Unix timestamp
                })} 
                size={220}
                level="H"
              />
            </div>
          </div>
          <p className="ls-qr-caption">Secure Verification</p>
          <div className="ls-qr-refresh">
            <span className="ls-refresh-dot" />
            QR Token Rotating in 0:{String(qrSeconds).padStart(2, '0')}
          </div>
          <p className="ls-qr-note">Students must scan this code using the Stratos Mobile App.</p>
        </div>

        {/* Right Panel */}
        <div className="ls-right">
          <div className="ls-action-row">
            <button className="ls-manual-btn" onClick={() => navigate(`/manual-attendance/${sessionId}`)}>
              <PenSquare size={15} /> Manual Entry
            </button>
            <button className="ls-manual-btn" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }} onClick={handleExportCSV}>
              <Download size={15} /> Export CSV
            </button>
            <button className="ls-end-btn" onClick={handleEndSession}>
              <StopCircle size={15} /> End Session
            </button>
          </div>

          <div className="ls-feed-card" style={{ marginBottom: '20px' }}>
            <div className="ls-feed-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--primary)" />
                <h3 style={{ margin: 0 }}>Session Notes</h3>
              </div>
              {!editingNotes ? (
                <button 
                  onClick={() => setEditingNotes(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Edit Notes
                </button>
              ) : (
                <button 
                  onClick={handleSaveNotes}
                  style={{ background: 'var(--primary)', border: 'none', color: '#fff', fontSize: '10px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <CheckCircle2 size={12} /> Save
                </button>
              )}
            </div>
            <div style={{ padding: '15px' }}>
              {editingNotes ? (
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  style={{ width: '100%', minHeight: '80px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
                  placeholder="Add session notes or instructions..."
                />
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6', fontStyle: noteDraft ? 'normal' : 'italic' }}>
                  {noteDraft || 'No notes added for this session.'}
                </p>
              )}
            </div>
          </div>

          <div className="ls-feed-card">
            <div className="ls-feed-header">
              <h3>Live Check-in Feed</h3>
              <span className="ls-realtime-badge">Real-Time</span>
            </div>
            <div className="ls-feed-list">
              {attendance.length === 0 ? (
                <div className="ls-empty-feed">
                  <p>Awaiting first student scan...</p>
                </div>
              ) : (
                attendance.map((record) => (
                  <div key={record.id} className="ls-feed-item">
                    <div className="ls-feed-left">
                      <div className="ls-feed-avatar" style={{ background: 'var(--primary)' }}>
                        {record.studentName.split(' ').map(n => n[0]).join('').toUpperCase()}
                        <span className="ls-online-dot" />
                      </div>
                      <div>
                        <strong>{record.studentName}</strong>
                        <span>ID: {record.studentId} &bull; {record.method.toUpperCase()}</span>
                      </div>
                    </div>
                    <span className="ls-feed-time">
                      {record.timestamp?.toDate ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(record.timestamp.toDate()) : 'Just now'}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="ls-awaiting">
              <span className="ls-await-dots">• • •</span>
              <span>Encrypted Ledger Syncing</span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

