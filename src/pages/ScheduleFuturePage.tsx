import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, Clock, MapPin, Plus, ChevronRight, ChevronLeft } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'

export default function ScheduleFuturePage() {
  const { user } = useAuth()
  const [view, setView] = useState<'calendar' | 'list'>('list')
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !db) return

    const q = query(
      collection(db, 'sessions'),
      where('lecturerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setUpcomingSessions(list)
      setLoading(false)
    }, () => {
      // Stop loading even if query fails (e.g. missing index)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  const formatTime = (timeStr: string) => {
    try {
      return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return '10:00 AM'
    }
  }

  const formatDate = (timeStr: string) => {
    try {
      const d = new Date(timeStr)
      return { month: d.toLocaleString('default', { month: 'short' }).toUpperCase(), day: d.getDate() }
    } catch {
      return { month: 'OCT', day: '24' }
    }
  }

  return (
    <AppLayout>
      <div className="sch-header">
        <div>
          <p className="sch-breadcrumb">Course Management <span>›</span> Schedule</p>
          <h1 className="page-title">Schedule Future Sessions</h1>
          <p className="sch-subtitle">Plan your academic calendar. Scheduled sessions will automatically appear in your dashboard blueprint.</p>
        </div>
        <button className="btn-primary">
          <Plus size={16} /> New Schedule
        </button>
      </div>

      <div className="sch-tabs">
        <button className={`sch-tab ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>Upcoming List</button>
        <button className={`sch-tab ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>Calendar View</button>
      </div>

      <div className="sch-content">
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: 0.6 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#0d3349', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ fontSize: 14, color: '#64748b' }}>Synchronizing schedule...</p>
          </div>
        ) : view === 'list' ? (
          <div className="sch-list">
            {upcomingSessions.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <CalendarIcon size={40} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                <p style={{ color: '#64748b' }}>No upcoming sessions scheduled.</p>
              </div>
            ) : (
              upcomingSessions.map((s) => {
                const { month, day } = formatDate(s.startTime || s.createdAt)
                return (
                  <div key={s.id} className="sch-card">
                    <div className="sch-card-left">
                      <div className="sch-date-icon">
                        <span className="sch-month">{month}</span>
                        <span className="sch-day">{day}</span>
                      </div>
                      <div className="sch-details">
                        <h3>{s.course}</h3>
                        <div className="sch-meta">
                          <span><Clock size={14} /> {formatTime(s.startTime)}</span>
                          <span><MapPin size={14} /> {s.location}</span>
                          <span className="badge badge-gray">{s.type}</span>
                        </div>
                      </div>
                    </div>
                    <div className="sch-card-right">
                      <div className="sch-stats">
                        <strong>{s.expectedCount || 0}</strong>
                        <span>Expected</span>
                      </div>
                      <button className="sch-edit-btn">Manage</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div className="sch-calendar-placeholder">
            <div className="sch-cal-header">
              <button className="sch-cal-nav"><ChevronLeft size={18} /></button>
              <h2>October 2023</h2>
              <button className="sch-cal-nav"><ChevronRight size={18} /></button>
            </div>
            <div className="sch-cal-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="sch-cal-day-label">{d}</div>)}
              {Array.from({ length: 31 }).map((_, i) => (
                <div key={i} className={`sch-cal-day ${i + 1 === 24 ? 'active' : ''}`}>
                  <span>{i + 1}</span>
                  {i + 1 === 24 && <div className="sch-cal-event" />}
                  {i + 1 === 30 && <div className="sch-cal-event" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .sch-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; }
        .sch-breadcrumb { font-size: 12px; color: #64748b; margin-bottom: 4px; }
        .sch-breadcrumb span { margin: 0 4px; opacity: 0.5; }
        .sch-subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
        .sch-tabs { display: flex; gap: 24px; border-bottom: 1px solid #e2e8f0; margin-bottom: 24px; }
        .sch-tab { padding: 12px 4px; font-size: 14px; font-weight: 500; color: #64748b; border-bottom: 2px solid transparent; cursor: pointer; background: none; border-top: none; border-left: none; border-right: none; }
        .sch-tab.active { color: #0d3349; border-bottom-color: #0d3349; }
        
        .sch-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; transition: all 0.2s; }
        .sch-card:hover { border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .sch-card-left { display: flex; gap: 20px; align-items: center; }
        .sch-date-icon { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; width: 60px; height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .sch-month { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #ef4444; }
        .sch-day { font-size: 20px; font-weight: 700; color: #0d3349; }
        .sch-details h3 { font-size: 16px; color: #0d3349; margin-bottom: 8px; }
        .sch-meta { display: flex; gap: 16px; align-items: center; font-size: 13px; color: #64748b; }
        .sch-meta span { display: flex; align-items: center; gap: 6px; }
        
        .sch-card-right { display: flex; gap: 32px; align-items: center; }
        .sch-stats { text-align: right; }
        .sch-stats strong { display: block; font-size: 18px; color: #0d3349; }
        .sch-stats span { font-size: 12px; color: #64748b; }
        .sch-edit-btn { padding: 8px 16px; font-size: 13px; font-weight: 500; color: #0d3349; background: #f1f5f9; border: none; border-radius: 8px; cursor: pointer; }
        
        .sch-calendar-placeholder { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; }
        .sch-cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
        .sch-cal-header h2 { font-size: 18px; color: #0d3349; }
        .sch-cal-nav { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; }
        .sch-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: #e2e8f0; border: 1px solid #e2e8f0; }
        .sch-cal-day-label { background: #f8fafc; padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; }
        .sch-cal-day { background: #fff; min-height: 100px; padding: 12px; position: relative; }
        .sch-cal-day span { font-size: 14px; color: #94a3b8; }
        .sch-cal-day.active span { color: #0d3349; font-weight: 700; }
        .sch-cal-event { margin-top: 8px; height: 6px; width: 6px; background: #ef4444; border-radius: 50%; }
      `}</style>
    </AppLayout>
  )
}
