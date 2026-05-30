import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, FileText, ChevronRight, Download, CheckCircle2 } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  updateDoc
} from 'firebase/firestore'
import { db } from '../lib/firebase'

const statusStyle: Record<string, { badge: string; border: string }> = {
  qr:     { badge: 'sd-badge-present', border: '#0d3349' },
  manual: { badge: 'sd-badge-manual',  border: '#94a3b8' },
  late:   { badge: 'sd-badge-late',    border: '#f59e0b' },
  absent: { badge: 'sd-badge-absent',  border: '#dc2626' },
}

export default function SessionDetailsPage() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const [session, setSession] = useState<any>(null)
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingNotes, setEditingNotes] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')

  // Use ?sessionId=... param OR fall back to most recent session
  const sessionIdFromParam = searchParams.get('sessionId')

  useEffect(() => {
    if (!user || !db) return

    if (sessionIdFromParam) {
      // Load specific session
      const unsubSession = onSnapshot(doc(db, 'sessions', sessionIdFromParam), (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() }
          setSession(data)
          setNoteDraft(data.notes || '')
        }
        setLoading(false)
      })

      const qAtt = query(
        collection(db, 'attendance'),
        where('sessionId', '==', sessionIdFromParam),
        orderBy('timestamp', 'desc')
      )
      const unsubAtt = onSnapshot(qAtt, (snap) => {
        const records: any[] = []
        snap.forEach(d => records.push({ id: d.id, ...d.data() }))
        setAttendance(records)
      })

      return () => { unsubSession(); unsubAtt() }
    } else {
      // Load the most recent session for this lecturer
      const qSession = query(
        collection(db, 'sessions'),
        where('lecturerId', '==', user.uid),
        orderBy('actualStartTime', 'desc'),
        limit(1)
      )

      let unsubAtt: (() => void) | null = null

      const unsubSession = onSnapshot(qSession, (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0]
          const data = { id: d.id, ...d.data() }
          setSession(data)
          setNoteDraft(data.notes || '')
          setLoading(false)

          // Now subscribe to attendance for this session
          if (unsubAtt) unsubAtt()
          const qAtt = query(
            collection(db, 'attendance'),
            where('sessionId', '==', d.id),
            orderBy('timestamp', 'desc')
          )
          unsubAtt = onSnapshot(qAtt, (attSnap) => {
            const records: any[] = []
            attSnap.forEach(doc => records.push({ id: doc.id, ...doc.data() }))
            setAttendance(records)
          })
        } else {
          setLoading(false)
        }
      })

      return () => { unsubSession(); if (unsubAtt) unsubAtt() }
    }
  }, [user, sessionIdFromParam])

  const filtered = attendance.filter(s =>
    (s.studentName?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (s.studentId || '').includes(search)
  )

  const attendancePct = session?.expectedCount > 0
    ? Math.round((attendance.length / session.expectedCount) * 100)
    : 0

  const formatSessionDate = (ts: any) => {
    if (!ts?.toDate) return '—'
    return ts.toDate().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
  }

  const handleSaveNotes = async () => {
    if (!session?.id || !db) return
    try {
      await updateDoc(doc(db, 'sessions', session.id), {
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
      r.method || 'qr',
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

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div className="sd-breadcrumb">
        <span onClick={() => navigate('/session/new')} className="sd-bc-link">Course Management</span>
        <ChevronRight size={13} />
        <span className="sd-bc-link" onClick={() => navigate('/dashboard')}>Sessions</span>
        <ChevronRight size={13} />
        <span>{session?.course || 'Details'}</span>
      </div>

      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#0d3349', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ fontSize: 14 }}>Loading session records...</p>
        </div>
      ) : !session ? (
        <div style={{ padding: '80px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 56, opacity: 0.2 }}>📋</div>
          <h3 style={{ color: '#0d3349', margin: 0 }}>No Session Records Yet</h3>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>You haven't run any sessions. Start your first one to see attendance records here.</p>
          <button className="btn-primary" style={{ marginTop: 8 }} onClick={() => navigate('/session/new')}>Start Your First Session</button>
        </div>
      ) : (
        <div className="sd-body">
          {/* ── Left ── */}
          <div className="sd-left">
            <h1 className="sd-title">{session.course}</h1>
            <p className="sd-datetime">
              {formatSessionDate(session.actualStartTime)} &bull; {session.location} &bull; {session.type}
            </p>

            {/* Roster Card */}
            <div className="sd-roster-card">
              <div className="sd-roster-header">
                <h3>Student Roster ({attendance.length} checked in)</h3>
                <div className="sd-roster-tools">
                  <div className="sd-search-wrap">
                    <Search size={14} color="#94a3b8" />
                    <input
                      placeholder="Search students..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="sd-search-input"
                    />
                  </div>
                  <button className="sd-filter-btn"><SlidersHorizontal size={14} /> Filter</button>
                </div>
              </div>

              <div className="sd-student-list">
                {filtered.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    {attendance.length === 0 ? 'No attendance recorded for this session yet.' : 'No students match your search.'}
                  </div>
                ) : (
                  filtered.map((s) => {
                    const method = s.method || 'qr'
                    const style = statusStyle[method] || statusStyle['qr']
                    const initials = s.studentName?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '??'
                    const timeStr = s.timestamp?.toDate
                      ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(s.timestamp.toDate())
                      : 'Just now'

                    return (
                      <div key={s.id} className="sd-student-row" style={{ borderLeft: `4px solid ${style.border}` }}>
                        <div className="sd-student-left">
                          <div className="sd-avatar" style={{ background: style.border }}>{initials}</div>
                          <div>
                            <strong>{s.studentName}</strong>
                            <span>ID: {s.studentId}</span>
                          </div>
                        </div>
                        <div className="sd-student-mid">
                          <span className="sd-time-label">{method === 'manual' ? 'Manual Entry' : 'QR Scan Time'}</span>
                          <span className="sd-time-val">{timeStr}</span>
                        </div>
                        <span className={`sd-status-badge ${style.badge}`}>{method === 'manual' ? 'Manual' : 'QR'}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── Right ── */}
          <div className="sd-right">
            {/* Attendance Status */}
            <div className="sd-status-card">
              <div className="sd-status-header">
                <span className="sd-status-label">Attendance Status</span>
                <span className={`sd-finalized-badge`}>{session.status === 'active' ? '🔴 Live' : 'Finalized'}</span>
              </div>
              <div className="sd-status-body">
                <span className="sd-pct">{attendancePct}%</span>
                <div>
                  <p className="sd-present-count">{attendance.length}/{session.expectedCount} Present</p>
                  <p className="sd-avg">QR + Manual combined</p>
                </div>
              </div>
              <div className="sd-status-bar">
                <div className="sd-status-bar-fill" style={{ width: `${attendancePct}%` }} />
              </div>
            </div>

            {/* Session Notes */}
            <div className="sd-notes-card">
              <div className="sd-notes-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={15} /> <h3>Session Notes</h3>
                </div>
                {editingNotes ? (
                  <button 
                    onClick={handleSaveNotes}
                    style={{ background: '#0d3349', border: 'none', color: '#fff', fontSize: '10px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <CheckCircle2 size={12} /> Save
                  </button>
                ) : (
                  <button 
                    onClick={() => setEditingNotes(true)}
                    style={{ background: 'none', border: 'none', color: '#0d3349', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                )}
              </div>
              <div style={{ marginTop: '12px' }}>
                {editingNotes ? (
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    style={{ width: '100%', minHeight: '100px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
                    placeholder="Add session notes or instructions..."
                  />
                ) : (
                  <>
                    <p className="sd-notes-text">
                      {noteDraft || `${session.type} session for ${session.course}. Location: ${session.location}.`}
                    </p>
                    <p className="sd-notes-italic">
                      Security: Geofence {session.geofence ? 'enabled' : 'disabled'} &bull; Device binding {session.deviceBinding ? 'enabled' : 'disabled'}.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Session Actions */}
            <div className="sd-actions-card">
              <p className="sd-actions-label">Session Actions</p>
              <div className="sd-qr-block" onClick={handleExportCSV} style={{ cursor: 'pointer' }}>
                <div className="sd-qr-icon-area">
                  <div className="sd-qr-logo" style={{ background: '#0d3349', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Download size={20} color="#fff" />
                  </div>
                  <p className="sd-qr-brand">STRATOS<br />EXPORT</p>
                </div>
                <div className="sd-qr-export-label">Export Attendance (CSV)</div>
              </div>
              {session.status === 'active' && (
                <button className="btn-primary" style={{ width: '100%', marginBottom: '10px' }}
                  onClick={() => navigate(`/live-session/${session.id}`)}>
                  → Return to Live Session
                </button>
              )}
              <button className="sd-notify-btn" onClick={() => alert("Notification service is being prepared. This will notify all absent students via the Stratos Mobile App.")}>
                ✉ Notify Absent Students
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

