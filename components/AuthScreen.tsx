// Auth Screen Component
import React, { useState } from "react"
import { Mail, Lock, Eye, EyeOff, ArrowRight, Zap, AlertCircle } from "lucide-react"

// Google icon (SVG as component)
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

// Apple icon (SVG as component)
const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
)

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void
  onSkip?: () => void
}

export function AuthScreen({ onAuthSuccess, onSkip }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setLoading(true)
    setError('')
    try {
      // TODO: Integrate with Supabase
      // For now, simulate OAuth flow
      const authUrl = provider === 'google' 
        ? 'https://accounts.google.com/o/oauth2/v2/auth'
        : 'https://appleid.apple.com/auth/authorize'
      
      // In production, this would open a popup or redirect
      console.log(`OAuth with ${provider}`)
      
      // Simulate success for demo
      setTimeout(() => {
        onAuthSuccess({ email: `user@${provider}.com`, provider })
      }, 1000)
    } catch (err: any) {
      setError(err.message || `${provider} login failed`)
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    setError('')

    try {
      // TODO: Integrate with Supabase
      // For now, simulate email auth
      console.log(`${mode} with email: ${email}`)
      
      // Simulate success for demo
      setTimeout(() => {
        onAuthSuccess({ email, provider: 'email' })
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-header">
        <div className="auth-logo">
          <Zap size={24} />
        </div>
        <h1>ClearMetric</h1>
        <p>Dashboard Analysis Tool</p>
      </div>

      <div className="auth-content">
        <h2>{mode === 'signin' ? 'Welcome back' : 'Create account'}</h2>
        <p className="auth-subtitle">
          {mode === 'signin' 
            ? 'Sign in to access your account' 
            : 'Get started with ClearMetric'}
        </p>

        {/* OAuth Buttons */}
        <div className="auth-oauth">
          <button 
            className="auth-oauth-btn"
            onClick={() => handleOAuthLogin('google')}
            disabled={loading}
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>

          <button 
            className="auth-oauth-btn"
            onClick={() => handleOAuthLogin('apple')}
            disabled={loading}
          >
            <AppleIcon />
            <span>Continue with Apple</span>
          </button>
        </div>

        <div className="auth-divider">
          <span>or</span>
        </div>

        {/* Email Form */}
        <form className="auth-form" onSubmit={handleEmailAuth}>
          <div className="auth-input-group">
            <Mail size={18} className="auth-input-icon" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="auth-input-group">
            <Lock size={18} className="auth-input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <button 
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <div className="auth-error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <div className="auth-spinner" />
            ) : (
              <>
                <span>{mode === 'signin' ? 'Sign in' : 'Create account'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <button onClick={() => setMode('signup')}>Sign up</button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('signin')}>Sign in</button>
            </>
          )}
        </p>

        {onSkip && (
          <button className="auth-skip" onClick={onSkip}>
            Continue without account
          </button>
        )}
      </div>

      <div className="auth-footer">
        <p>By continuing, you agree to our Terms of Service and Privacy Policy</p>
      </div>
    </div>
  )
}

export default AuthScreen
