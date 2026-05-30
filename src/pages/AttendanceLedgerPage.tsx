import { useState, useEffect } from 'react'
import { Download, ChevronLeft, ChevronRight, AlertCircle, Calendar } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore'
import { db } from '../lib/firebase'

const typeStyle: Record<string, string> = {
  Lecture: 'al-type-lecture',
  Tutorial: 'al-type-lab', // Mapping tutorial to lab style
  Lab:     'al-type-lab',
  Seminar: 'al-type-seminar',
}

export default function AttendanceLedgerPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [courses, setCourses] = useState<string[]>(['All Courses'])
  const [activeCourse, setActiveCourse] = useState('All Courses')
  const [sessionType, setSessionType] = useState('All Types')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  
  const { user } = useAuth()

  useEffect(() => {
    if (!user || !db) return

    const q = query(
      collection(db, 'sessions'),
      where('lecturerId', '==', user.uid),
      orderBy('actualStartTime', 'desc'),
      limit(50)
    )

    const unsubscribe = onSnapshot(q, (querySnap) => {
      const sessionList: any[] = []
      const courseList = new Set<string>(['All Courses'])
      
      querySnap.forEach((doc) => {
        const data = doc.data()
        sessionList.push({ id: doc.id, ...data })
        courseList.add(data.course)
      })
      
      setSessions(prev => JSON.stringify(prev) === JSON.stringify(sessionList) ? prev : sessionList)
      setCourses(prev => {
        const next = Array.from(courseList)
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      })
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  const filtered = sessions.filter(s =>
    (activeCourse === 'All Courses' || s.course === activeCourse) &&
    (sessionType === 'All Types' || s.type === sessionType)
  )

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return { date: '—', time: '—' }
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
  }

  return (
    <AppLayout>
      {/* ── Header ── */}
      <div className="al-header">
        <div>
          <h2 className="al-title">Stratos Attendance Ledger</h2>
          <p className="al-subtitle">
            Complete historical ledger of all digital attendance logs. Review participation trends,
            course engagement, and session distributions.
          </p>
        </div>
        <div className="al-export-btns">
          <button className="al-export-btn"><Download size={15} /> Export PDF</button>
          <button className="al-export-btn"><Download size={15} /> Export CSV</button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="al-filters-card">
        <div className="al-filter-section">
          <p className="al-filter-label">Filter by Course</p>
          <div className="al-course-pills">
            {courses.map(c => (
              <button
                key={c}
                className={`al-pill ${activeCourse === c ? 'al-pill--active' : ''}`}
                onClick={() => setActiveCourse(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="al-filter-divider" />

        <div className="al-filter-section al-filter-section--sm">
          <p className="al-filter-label">Date Range</p>
          <div className="al-date-box">
            <Calendar size={14} color="var(--text-secondary)" />
            <span>Last 30 Days</span>
          </div>
        </div>

        <div className="al-filter-divider" />

        <div className="al-filter-section al-filter-section--sm">
          <p className="al-filter-label">Session Type</p>
          <select
            className="al-type-select"
            value={sessionType}
            onChange={e => setSessionType(e.target.value)}
          >
            <option>All Types</option>
            <option>Lecture</option>
            <option>Lab</option>
            <option>Seminar</option>
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="al-table-card">
        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ fontSize: 14 }}>Loading session records...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: '80px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Calendar size={48} color="var(--border)" />
            <h3 style={{ color: 'var(--primary)', margin: 0 }}>No Session Records Found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>Once you run attendance sessions, they will appear here in your ledger.</p>
          </div>
        ) : (
          <table className="al-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Course Name</th>
                <th>Session Type</th>
                <th>% Attendance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No sessions match your current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const { date, time } = formatDateTime(row.actualStartTime || row.createdAt)
                  const pct = row.expectedCount > 0 ? Math.round((row.presentCount / row.expectedCount) * 100) : 0
                  return (
                    <tr key={row.id} className="al-table-row">
                      <td>
                        <strong className="al-date">{date}</strong>
                        <span className="al-time">{time}</span>
                      </td>
                      <td className="al-course-name">{row.course}</td>
                      <td><span className={`al-type-badge ${typeStyle[row.type] || 'al-type-lecture'}`}>{row.type.toUpperCase()}</span></td>
                      <td>
                        <div className="al-pct-cell">
                          <div className="al-bar-wrap">
                            <div
                              className={`al-bar-fill ${pct < 50 ? 'al-bar-fill--low' : ''}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`al-pct-val ${pct < 50 ? 'al-pct-val--low' : ''}`}>{pct}%</span>
                          {pct < 50 && <AlertCircle size={15} color="#dc2626" />}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${row.status === 'active' ? 'badge-orange' : 'badge-gray'}`} style={{ fontSize: '10px' }}>
                          {row.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}

        <div className="al-table-footer">
          <span className="al-footer-count">Showing {filtered.length} of {sessions.length} recorded sessions</span>
          <div className="al-pagination">
            <button className="al-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft size={14} /></button>
            {[1].map(n => (
              <button
                key={n}
                className={`al-page-btn ${page === n ? 'al-page-btn--active' : ''}`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button className="al-page-btn" onClick={() => setPage(p => Math.min(1, p + 1))}><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

