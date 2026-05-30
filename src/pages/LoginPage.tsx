import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Landmark, AlertCircle } from 'lucide-react'
import { useAuth, getFirebaseErrorMessage } from '../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [keepSigned, setKeepSigned] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      console.error('Login error:', err)
      setError(getFirebaseErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* ── Left Panel ── */}
        <div className="login-left">
          <div className="login-logo">
            <Landmark size={22} strokeWidth={2} />
            <span>Stratos Attendance</span>
          </div>

          <div className="login-hero">
            <h1>Manage institutional presence with precision.</h1>
            <p>
              Access the professional attendance dashboard designed for
              high-performance lecturing environments.
            </p>
          </div>

          <div className="login-testimonial">
            <p>
              "The Digital Ledger provides an unwavering record of academic
              engagement, ensuring administrative excellence at every level."
            </p>
            <div className="testimonial-author">
              <div className="testimonial-initials">AV</div>
              <div>
                <strong>Dr. Alistair Vance</strong>
                <span>Senior Faculty Member</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="login-right">
          <div className="login-form-wrapper">
            <h2>Lecturer Portal</h2>
            <p>Please enter your credentials to manage sessions.</p>

            {error && (
              <div className="error-banner">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form
              className="login-form"
              onSubmit={handleLogin}
            >
              <div className="form-group">
                <label>Institutional Email</label>
                <div className="input-wrapper">
                  <Mail size={16} className="input-icon" />
                  <input 
                    type="email" 
                    placeholder="lecturer@institution.edu" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="label-row">
                  <label>Password</label>
                  <a href="#" className="forgot-link">Forgot Password?</a>
                </div>
                <div className="input-wrapper">
                  <Lock size={16} className="input-icon" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPass(!showPass)}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="checkbox-row">
                <input
                  type="checkbox"
                  id="keep"
                  checked={keepSigned}
                  onChange={(e) => setKeepSigned(e.target.checked)}
                />
                <label htmlFor="keep">Keep me signed in on this device</label>
              </div>

              <button 
                type="submit" 
                className="btn-primary btn-full"
                disabled={isLoading}
              >
                {isLoading ? 'Verifying...' : 'Sign In →'}
              </button>
            </form>

            <p className="trouble-text">
              Don't have an account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/register') }}>
                Register here
              </a>
            </p>
          </div>
        </div>
      </div>

      <p className="login-footer">
        Powered by Stratos Attendance Systems © 2024
      </p>
    </div>
  )
}
