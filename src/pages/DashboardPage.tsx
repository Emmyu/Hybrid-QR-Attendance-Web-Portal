import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { TrendingUp, BookMarked, Clock, Plus, PenSquare, StopCircle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell,
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  limit,
  updateDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../lib/firebase'

export default function DashboardPage() {
  const [chartView, setChartView] = useState<'weekly' | 'monthly'>('monthly')
  const [recentSessions, setRecentSessions] = useState<any[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [activeSession, setActiveSession] = useState<any>(null)
  const [stats, setStats] = useState({
    totalCourses: 0,
    upcoming: 0,
    avgAttendance: 0
  })
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  useEffect(() => {
    if (!user || !db) return

    // 1. Fetch ALL sessions to calculate trends and stats
    const qAll = query(
      collection(db, 'sessions'),
      where('lecturerId', '==', user.uid),
      orderBy('actualStartTime', 'desc')
    )

    const unsubscribe = onSnapshot(qAll, (querySnap) => {
      const allSessions: any[] = []
      const courses = new Set()
      let totalAtt = 0
      let totalExpected = 0
      
      const monthlyAggr: Record<string, { total: number, count: number }> = {}
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

      querySnap.forEach((doc) => {
        const data = doc.data()
        allSessions.push({ id: doc.id, ...data })
        courses.add(data.course)
        
        if (data.status === 'completed') {
          totalAtt += data.presentCount || 0
          totalExpected += data.expectedCount || 1
          
          // Monthly trend calculation
          const date = data.actualStartTime?.toDate ? data.actualStartTime.toDate() : new Date(data.actualStartTime)
          const monthName = months[date.getMonth()]
          if (!monthlyAggr[monthName]) monthlyAggr[monthName] = { total: 0, count: 0 }
          monthlyAggr[monthName].total += (data.presentCount / data.expectedCount) * 100
          monthlyAggr[monthName].count += 1
        }
      })

      // Prepare Chart Data (Last 6 months)
      const currentMonth = new Date().getMonth()
      const last6Months = []
      for (let i = 5; i >= 0; i--) {
        const mIdx = (currentMonth - i + 12) % 12
        const mName = months[mIdx]
        last6Months.push({
          month: mName,
          value: monthlyAggr[mName] ? Math.round(monthlyAggr[mName].total / monthlyAggr[mName].count) : 0
        })
      }

      setChartData(last6Months)
      setRecentSessions(allSessions.slice(0, 5))
      setStats(prev => ({
        ...prev,
        totalCourses: courses.size,
        avgAttendance: totalExpected > 0 ? (totalAtt / totalExpected) * 100 : 0
      }))
    })

    return () => unsubscribe()
  }, [user])

  // Real-time active session watcher
  useEffect(() => {
    if (!user || !db) return
    const q = query(
      collection(db, 'sessions'),
      where('lecturerId', '==', user.uid),
      where('status', '==', 'active'),
      limit(1)
    )
    const unsub = onSnapshot(q, (snap) => {
      setActiveSession(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() })
    })
    return () => unsub()
  }, [user])

  const handleEndSession = async () => {
    if (!activeSession || !db) return
    if (window.confirm(`End session for '${activeSession.course}'?`)) {
      await updateDoc(doc(db, 'sessions', activeSession.id), {
        status: 'completed',
        endTime: serverTimestamp()
      })
    }
  }

  const greetingName = profile ? `${profile.title} ${profile.fullName.split(' ')[0]}` : 'Professor'

  return (
    <AppLayout>
      {/* Greeting */}
      <div>
        <p className="greeting">Good Morning, {greetingName}</p>
        <h1 className="page-title">Academy Overview</h1>
      </div>

      {/* Stats Cards */}
      <div className="stats-row">
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-card-header">
            <div className="stat-icon"><BookMarked size={18} /></div>
            <span className="badge badge-green">Active</span>
          </div>
          <div>
            <p className="stat-label">Enrolled Courses</p>
            <p className="stat-value">{stats.totalCourses || '—'}</p>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-card-header">
            <div className="stat-icon" style={{ color: '#f59e0b' }}><Clock size={18} /></div>
            <span className="badge badge-orange">Next 24H</span>
          </div>
          <div>
            <p className="stat-label">Upcoming Sessions</p>
            <p className="stat-value">0</p>
          </div>
        </div>

        <div className="stat-card dark">
          <div className="stat-card-header">
            <div className="stat-icon"><TrendingUp size={18} /></div>
            <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
              Avg. Attendance
            </span>
          </div>
          <p className="stat-value">{stats.avgAttendance.toFixed(1)}%</p>
          <div className="stat-progress">
            <div className="stat-progress-bar" style={{ width: `${stats.avgAttendance}%` }} />
          </div>
          <p className="stat-vs">Based on completed sessions</p>
        </div>
      </div>

      {/* Middle Row */}
      <div className="middle-row">
        <div className="chart-card">
          <div className="chart-card-header">
            <h3>Attendance Trends</h3>
            <div className="chart-toggle">
              <button className={`toggle-btn ${chartView === 'weekly' ? 'active' : ''}`} onClick={() => setChartView('weekly')}>Weekly</button>
              <button className={`toggle-btn ${chartView === 'monthly' ? 'active' : ''}`} onClick={() => setChartView('monthly')}>Monthly</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Inter' }} />
              <YAxis hide />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => {
                  const currentMonthLabel = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][new Date().getMonth()]
                  return <Cell key={index} fill={entry.value > 0 ? (entry.month === currentMonthLabel ? 'var(--primary)' : '#8fb3db') : '#e2e8f0'} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="sessions-card">
          <h3>Recent Sessions</h3>
          {recentSessions.length === 0 ? (
            <div className="ls-empty-feed" style={{ padding: '40px 0', textAlign: 'center', opacity: 0.5 }}>
              <p>No sessions recorded yet.</p>
            </div>
          ) : (
            recentSessions.map((s, i) => (
              <div key={i} className="session-item" style={{ cursor: 'pointer' }} onClick={() => navigate(s.status === 'active' ? `/live-session/${s.id}` : `/session/details?sessionId=${s.id}`)}>
                <div className="session-border">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{s.course}</strong>
                    {s.status === 'active' && <span className="ls-online-dot" style={{ position: 'relative', right: 0, top: 0 }} />}
                  </div>
                  <time>{s.location} &bull; {s.type}</time>
                  <span className={`badge ${s.status === 'active' ? 'badge-orange' : 'badge-green'}`}>
                    {s.status === 'active' ? 'LIVE NOW' : `${Math.round((s.presentCount / s.expectedCount) * 100)}% Present`}
                  </span>
                </div>
              </div>
            ))
          )}
          <div className="view-all"><a href="#" onClick={e => { e.preventDefault(); navigate('/reports') }}>View Full Ledger →</a></div>
        </div>
      </div>

      {/* CTA Banner */}
      <div className="cta-banner">
        <div className="cta-banner-text">
          {activeSession ? (
            <>
              <h3>Session in progress: {activeSession.course}</h3>
              <p>A live session is currently running. You can add manual entries or end it when done.</p>
            </>
          ) : (
            <>
              <h3>Ready for your next lecture?</h3>
              <p>Instant check-ins via biometric or QR sync. Your logs will automatically sync with the institutional ledger.</p>
            </>
          )}
        </div>
        <div className="cta-banner-actions">
          {activeSession ? (
            <>
              <button className="btn-primary" onClick={() => navigate(`/manual-attendance/${activeSession.id}`)}>
                <PenSquare size={16} /> Manual Entry
              </button>
              <button className="btn-outline" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={handleEndSession}>
                <StopCircle size={16} /> End Session
              </button>
            </>
          ) : (
            <>
              <button className="btn-primary" onClick={() => navigate('/session/new')}>
                <Plus size={16} /> Start New Session
              </button>
              <button className="btn-outline" onClick={() => navigate('/schedule')}>View Schedule</button>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

