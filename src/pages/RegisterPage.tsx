import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, UploadCloud, Landmark, ChevronDown, AlertCircle } from 'lucide-react'
import { useAuth, getFirebaseErrorMessage } from '../context/AuthContext'
import { doc, setDoc } from 'firebase/firestore'
import { db, auth } from '../lib/firebase'

function WatermarkEmblem() {
  return (
    <svg viewBox="0 0 260 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      {/* Outer circles */}
      <circle cx="130" cy="130" r="126" stroke="white" strokeOpacity="0.08" strokeWidth="1.5" />
      <circle cx="130" cy="130" r="108" stroke="white" strokeOpacity="0.06" strokeWidth="1" />
      <circle cx="130" cy="130" r="90"  stroke="white" strokeOpacity="0.07" strokeWidth="1.5" strokeDasharray="6 4" />
      {/* Inner QR-like grid */}
      {[0,1,2,3,4,5,6].map(r =>
        [0,1,2,3,4,5,6].map(c => {
          const pattern = [
            [1,1,1,0,1,1,1],
            [1,0,1,0,1,0,1],
            [1,1,1,0,1,1,1],
            [0,0,0,0,0,0,0],
            [1,1,1,0,1,0,0],
            [1,0,0,0,0,1,0],
            [1,0,1,0,1,1,1],
          ]
          const on = pattern[r][c]
          return on ? (
            <rect
              key={`${r}-${c}`}
              x={104 + c * 8}
              y={104 + r * 8}
              width={7}
              height={7}
              rx={1}
              fill="white"
              fillOpacity="0.12"
            />
          ) : null
        })
      )}
      {/* Corner tick marks */}
      {[45, 135, 225, 315].map(angle => {
        const rad = (angle * Math.PI) / 180
        const x1 = 130 + 120 * Math.cos(rad)
        const y1 = 130 + 120 * Math.sin(rad)
        const x2 = 130 + 108 * Math.cos(rad)
        const y2 = 130 + 108 * Math.sin(rad)
        return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeOpacity="0.15" strokeWidth="2" />
      })}
    </svg>
  )
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    title: 'Professor',
    fullName: '',
    email: '',
    staffId: '',
    faculty: '',
    password: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const navigate = useNavigate()
  const { register } = useAuth()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // 1. Create the auth account
      await register(formData.email, formData.password)
      
      const user = auth?.currentUser
      
      // 2. Save profile data to Firestore
      if (user && db) {
        await setDoc(doc(db, 'users', user.uid), {
          title: formData.title,
          fullName: formData.fullName,
          email: formData.email,
          staffId: formData.staffId,
          faculty: formData.faculty,
          role: 'lecturer',
          createdAt: new Date().toISOString(),
        })
      }

      navigate('/dashboard')
    } catch (err) {
      console.error('Registration error:', err)
      setError(getFirebaseErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="register-page">
      {/* ── Navbar ── */}
      <nav className="register-navbar">
        <div className="register-nav-logo">
          <Landmark size={20} color="#0d3349" strokeWidth={2} />
          <span>Stratos Attendance</span>
        </div>
        <div className="register-nav-links">
          <a href="#">How it works</a>
          <a href="#">Academic Partners</a>
          <a href="#">Support</a>
          <button className="btn-primary" style={{ padding: '8px 20px', fontSize: 14 }} onClick={() => navigate('/login')}>
            Sign In
          </button>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className="register-body">
        {/* Left Panel */}
        <div className="register-left">
          {/* Watermark emblem */}
          <div className="register-watermark">
            <WatermarkEmblem />
          </div>
          {/* Text card at bottom */}
          <div className="register-left-card">
            <h2>Architectural Precision in Academia.</h2>
            <p>
              Join the Stratos Attendance ecosystem of institutional excellence.
              Secure, verified, and effortless attendance management for the
              modern lecturer.
            </p>
            <div className="register-left-tag">— Institutional Verification Protocol</div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="register-right">
          <p className="register-tag">Faculty Portal</p>
          <h2>Lecturer Registration</h2>
          <p className="register-right-sub">Establish your institutional digital identity.</p>

          {error && (
            <div className="error-banner" style={{ marginBottom: '20px' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form
            className="register-form"
            onSubmit={handleRegister}
          >
            <div className="form-row">
              <div className="form-group">
                <label>Academic Title</label>
                <div className="reg-select-wrap">
                  <select 
                    className="plain-input reg-select" 
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                  >
                    <option>Professor</option>
                    <option>Associate Professor</option>
                    <option>Senior Lecturer</option>
                    <option>Lecturer</option>
                    <option>Dr.</option>
                  </select>
                  <ChevronDown size={15} className="reg-select-icon" />
                </div>
              </div>
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  className="plain-input" 
                  type="text" 
                  name="fullName"
                  placeholder="Dr. Julian Stratos" 
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Institutional Email</label>
                <input 
                  className="plain-input" 
                  type="email" 
                  name="email"
                  placeholder="j.stratos@university.edu" 
                  required
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Employee / Staff ID</label>
                <input 
                  className="plain-input" 
                  type="text" 
                  name="staffId"
                  placeholder="EMP-90821-X" 
                  required
                  value={formData.staffId}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Faculty / Department</label>
              <input 
                className="plain-input" 
                type="text" 
                name="faculty"
                placeholder="Department of Computational Sciences" 
                required
                value={formData.faculty}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Secure Password</label>
              <div className="input-wrapper">
                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  style={{ paddingLeft: 14 }}
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={handleChange}
                />
                <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Institutional Verification (ID or Signature)</label>
              <div className="upload-area">
                <UploadCloud size={28} color="#94a3b8" />
                <p>Drag and drop or click to upload</p>
                <span>High-resolution PNG or PDF required for verification.</span>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary btn-full" 
              style={{ padding: '15px', fontSize: 15 }}
              disabled={isLoading}
            >
              {isLoading ? 'Establishing Identity...' : 'Create Lecturer Account'}
            </button>

            <div className="register-footer-links">
              <span style={{ fontSize: 13, color: '#64748b' }}>
                Already registered?{' '}
                <a href="#" style={{ color: '#0d3349', fontWeight: 600 }} onClick={() => navigate('/login')}>
                  Login
                </a>
              </span>
              <div className="register-footer-links-right">
                <a href="#">Privacy Protocol</a>
                <a href="#">Terms of Service</a>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="register-footer">
        <div className="register-footer-logo">
          <Landmark size={16} />
          <span>Stratos Attendance</span>
        </div>
        <div className="register-footer-nav">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Security Disclosure</a>
          <a href="#">Contact Institutional Support</a>
        </div>
        <p className="register-footer-copy">
          © 2024 Stratos Attendance System. Built for institutional excellence.
        </p>
      </footer>
    </div>
  )
}
