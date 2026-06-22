import { LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { isSupabaseConfigured, supabaseConfigError } from '../services/supabaseClient.js'

function LoginPage() {
  const { session, signIn, error } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState('')

  if (!isSupabaseConfigured) {
    return (
      <div className="login-page">
        <EmptyState
          title="Supabase connection required"
          description={supabaseConfigError}
        />
      </div>
    )
  }

  if (session) return <Navigate to={location.state?.from || '/dashboard'} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setLocalError('')
    const result = await signIn(email, password)
    setSaving(false)
    if (result.error) {
      setLocalError(result.error)
      return
    }
    navigate(location.state?.from || '/dashboard', { replace: true })
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-mark">OH</div>
        <div>
          <p className="eyebrow">OmniHealth</p>
          <h1>Sign in</h1>
        </div>

        <label className="field-group">
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>

        <label className="field-group">
          <span>Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>

        {localError || error ? <div className="notice error">{localError || error}</div> : null}

        <button type="submit" className="primary-button" disabled={saving}>
          <LockKeyhole size={16} />
          {saving ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}

export default LoginPage
