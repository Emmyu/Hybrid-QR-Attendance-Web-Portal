import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, ClipboardList, Calendar,
  BarChart2, Settings, LogOut, Bell, HelpCircle, Search, Landmark,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { db } from '../lib/firebase'
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, logout } = useAuth()
  const [activeSession, setActiveSession] = useState<any>(null)

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
  
  const navItems = [
    { icon: <LayoutDashboard size={17} />, label: 'Dashboard',              key: 'dashboard', path: '/dashboard' },
    { icon: <BookOpen size={17} />,       label: 'Course Management',       key: 'courses',   path: '/session/new' },
    { icon: <Calendar size={17} />,       label: 'Schedule',                key: 'schedule',  path: '/schedule' },
    { icon: <BarChart2 size={17} />,      label: 'Analytics',               key: 'analytics', path: '/analytics' },
  ]
  
  const getActiveKey = (path: string) => {
    if (path.startsWith('/dashboard')) return 'dashboard'
    if (path.startsWith('/manual-attendance')) return 'manual'
    if (path.startsWith('/session/new') || path.startsWith('/live-session')) return 'courses'
    if (path.startsWith('/reports')) return 'reports'
    if (path.startsWith('/schedule')) return 'schedule'
    if (path.startsWith('/analytics')) return 'analytics'
    return ''
  }

  const activeKey = getActiveKey(location.pathname)
  const [searchVal, setSearchVal] = useState('')

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  const userInitials = profile?.fullName 
    ? profile.fullName.split(' ').map(n => n[0]).join('').toUpperCase()
    : (user?.email ? user.email.charAt(0).toUpperCase() : 'L')

  return (
    <div className="dashboard-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Landmark size={18} color="#fff" strokeWidth={2} />
          </div>
          <div className="sidebar-logo-text">
            <strong>Stratos Attendance</strong>
            <span>Lecturer Portal</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeKey === item.key ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="sidebar-cta" onClick={() => {
            if (activeSession) {
              navigate(`/live-session/${activeSession.id}`)
            } else {
              navigate('/session/new')
            }
          }}>
            {activeSession ? 'Return to Live Session' : 'Start Active Session'}
          </button>
          <button className="nav-item"><Settings size={17} /> Settings</button>
          <button className="nav-item" onClick={handleLogout}>
            <LogOut size={17} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <span className="header-brand">Stratos Attendance</span>

          <div className="header-tabs">
            {[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Sessions',  path: '/session/details' },
              { label: 'Reports',   path: '/reports' },
            ].map(tab => (
              <button
                key={tab.label}
                className={`header-tab ${location.pathname === tab.path ? 'active' : ''}`}
                onClick={() => navigate(tab.path)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="header-search">
            <Search size={14} color="#94a3b8" />
            <input
              placeholder="Search records..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
            />
          </div>

          <div className="header-actions">
            <button className="header-icon-btn"><Bell size={16} /></button>
            <button className="header-icon-btn"><HelpCircle size={16} /></button>
            <div className="header-avatar" title={user?.email || ''}>{userInitials}</div>
          </div>
        </header>

        {/* Page Content */}
        <main className="dashboard-content">
          {children}
        </main>
      </div>
    </div>
  )
}
