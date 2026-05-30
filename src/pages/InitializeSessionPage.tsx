import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode, MapPin, Shield, Smartphone } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import { collection, addDoc, serverTimestamp, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

export default function InitializeSessionPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [course, setCourse] = useState('CS-402: Distributed Systems')
  const [sessionType, setSessionType] = useState('Lecture')
  const [dateTime, setDateTime] = useState(new Date().toISOString().slice(0, 16))
  const [location, setLocation] = useState('Hall A-12')
  const [qrExpiry, setQrExpiry] = useState(15)
  const [geofence, setGeofence] = useState(true)
  const [deviceBinding, setDeviceBinding] = useState(false)
  const [expectedCount, setExpectedCount] = useState(45)
  const [notes, setNotes] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleStartSession = async () => {
    if (!user || !db) return
    
    setIsCreating(true)
    try {
      // Check for existing active sessions
      const activeQuery = query(
        collection(db, 'sessions'),
        where('lecturerId', '==', user.uid),
        where('status', '==', 'active'),
        limit(1)
      )
      const activeSnap = await getDocs(activeQuery)
      
      if (!activeSnap.empty) {
        const existingSession = activeSnap.docs[0]
        alert("A session for '" + existingSession.data().course + "' is already running. Please end it before starting a new one.")
        navigate(`/live-session/${existingSession.id}`)
        return
      }

      const sessionData = {
        lecturerId: user.uid,
        course,
        type: sessionType,
        startTime: dateTime, // Could be serverTimestamp() if immediate, but user can pick
        actualStartTime: serverTimestamp(),
        location,
        qrExpiry,
        geofence,
        deviceBinding,
        status: 'active',
        expectedCount: expectedCount,
        presentCount: 0,
        notes: notes,
        createdAt: serverTimestamp(),
      }

      const docRef = await addDoc(collection(db, 'sessions'), sessionData)
      navigate(`/live-session/${docRef.id}`)
    } catch (error: any) {
      console.error("Error creating session:", error)
      const msg = error?.code === 'permission-denied'
        ? "Permission denied. Please check your Firestore Security Rules in the Firebase Console."
        : `Failed to create session: ${error?.message || 'Unknown error'}`
      alert(msg)
    } finally {
      setIsCreating(false)
    }
  }

  const formatBlueprintDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
             ' • ' + 
             date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return 'Invalid Date'
    }
  }

  return (
    <AppLayout>
      <div>
        <p className="is-breadcrumb">New Initiative <span>›</span> Session Setup</p>
        <h1 className="page-title">Initialize Attendance Session</h1>
        <p className="is-subtitle">
          Set up your Stratos Attendance session for today. Configure course parameters,
          location verification, and dynamic QR expiry to ensure institutional integrity.
        </p>
      </div>

      <div className="is-body">
        {/* ── Left: Form ── */}
        <div className="is-form">
          {/* Section 1 */}
          <div className="is-section">
            <div className="is-section-header">
              <span className="is-step">1</span>
              <h3>Course Identity</h3>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Course Selection</label>
                <select className="plain-input" value={course} onChange={e => setCourse(e.target.value)}>
                  <option value="CS-402: Distributed Systems">CS-402: Distributed Systems</option>
                  <option value="ADV-402: Advanced Macroeconomics">ADV-402: Advanced Macroeconomics</option>
                  <option value="MKT-301: Digital Marketing Ethics">MKT-301: Digital Marketing Ethics</option>
                </select>
              </div>
              <div className="form-group">
                <label>Session Type</label>
                <select className="plain-input" value={sessionType} onChange={e => setSessionType(e.target.value)}>
                  <option>Lecture</option>
                  <option>Tutorial</option>
                  <option>Lab</option>
                  <option>Seminar</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div className="is-section">
            <div className="is-section-header">
              <span className="is-step">2</span>
              <h3>Temporal &amp; Spatial</h3>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Date &amp; Start Time</label>
                <input className="plain-input" type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Location / Room</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="plain-input"
                    style={{ paddingRight: 36 }}
                    type="text"
                    placeholder="e.g. Hall A-12 or Virtual"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                  />
                  <MapPin size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="is-section">
            <div className="is-section-header">
              <span className="is-step">3</span>
              <h3>Security &amp; Verification</h3>
            </div>
            <div className="is-slider-group">
              <div className="is-slider-row">
                <label>QR Code Expiry Duration</label>
                <span className="is-slider-val">{qrExpiry}m</span>
              </div>
              <input type="range" min="5" max="60" step="5" value={qrExpiry}
                onChange={e => setQrExpiry(Number(e.target.value))} className="is-slider" />
              <p className="is-slider-note">
                QR code will regenerate automatically every {qrExpiry} minutes to prevent session sharing.
              </p>
            </div>
            <div className="is-toggle-item">
              <div className="is-toggle-left">
                <Shield size={16} color={geofence ? "var(--primary)" : "var(--text-secondary)"} />
                <div>
                  <strong>Geofence Verification</strong>
                  <span style={{ color: geofence ? "var(--primary)" : "var(--text-secondary)" }}>
                    {geofence ? "Active: Students must be within 50m." : "Inactive: No location restriction."}
                  </span>
                </div>
              </div>
              <label className="is-toggle-switch">
                <input type="checkbox" checked={geofence} onChange={e => setGeofence(e.target.checked)} />
                <span className="is-toggle-track"><span className="is-toggle-thumb" /></span>
              </label>
            </div>
            <div className="is-toggle-item">
              <div className="is-toggle-left">
                <Smartphone size={16} color={deviceBinding ? "var(--primary)" : "var(--text-secondary)"} />
                <div>
                  <strong>Device Binding</strong>
                  <span style={{ color: deviceBinding ? "var(--primary)" : "var(--text-secondary)" }}>
                    {deviceBinding ? "Active: One device per student ID." : "Inactive: Multiple devices allowed."}
                  </span>
                </div>
              </div>
              <label className="is-toggle-switch">
                <input type="checkbox" checked={deviceBinding} onChange={e => setDeviceBinding(e.target.checked)} />
                <span className="is-toggle-track"><span className="is-toggle-thumb" /></span>
              </label>
            </div>

            <div className="is-slider-group" style={{ marginTop: '24px' }}>
              <div className="is-slider-row">
                <label>Expected Student Count</label>
                <span className="is-slider-val">{expectedCount}</span>
              </div>
              <input type="range" min="1" max="500" step="1" value={expectedCount}
                onChange={e => setExpectedCount(Number(e.target.value))} className="is-slider" />
              <p className="is-slider-note">
                Total number of students enrolled in this course for attendance tracking.
              </p>
            </div>
          </div>

          {/* Section 4 */}
          <div className="is-section">
            <div className="is-section-header">
              <span className="is-step">4</span>
              <h3>Session Notes</h3>
            </div>
            <div className="form-group">
              <label>Additional Context (Optional)</label>
              <textarea 
                className="plain-input" 
                style={{ minHeight: '100px', resize: 'vertical' }}
                placeholder="e.g. Topics to cover, guest speaker info, or special instructions..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Right: Blueprint Card ── */}
        <div className="is-blueprint">
          <p className="is-blueprint-label">Session Blueprint</p>
          <div className="is-blueprint-item"><span>Course</span><strong>{course.split(':')[1]?.trim() || course}</strong></div>
          <div className="is-blueprint-item"><span>Scheduled for</span><strong>{formatBlueprintDate(dateTime)}</strong></div>
          <div className="is-blueprint-item"><span>Room Configuration</span><strong>{location || 'TBD'}</strong></div>
          <div className="is-blueprint-divider" />
          <div className="is-blueprint-status">
            <div className="is-status-row">
              <span className={`is-status-dot ${isCreating ? 'pulse' : ''}`} />
              <span>{isCreating ? 'Synchronizing...' : 'Ready to Sync'}</span>
            </div>
            <QrCode size={22} color="rgba(255,255,255,0.4)" />
          </div>
          <button 
            className="is-generate-btn" 
            onClick={handleStartSession}
            disabled={isCreating}
          >
            {isCreating ? 'Synchronizing...' : 'Generate Stratos QR'}
          </button>
          <p className="is-encrypt-note">
            Tokens: {qrExpiry}m rotation • {geofence ? 'Geofenced' : 'No Geofence'} • {deviceBinding ? 'Bound' : 'Unbound'}
          </p>
          <div className="is-protip">
            <span className="is-protip-icon">ℹ</span>
            <div>
              <strong>Pro Tip</strong>
              <p>For large auditoriums, we recommend a 30-second QR refresh to maintain the highest security standard.</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
