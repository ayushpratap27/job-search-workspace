import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await api.post('/auth/login', { email, password })
      login(data.data.userId, data.data.accessToken, data.data.refreshToken)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      {/* M stripe at top */}
      <div className="fixed top-0 left-0 right-0 m-stripe" />

      <div className="w-full max-w-sm px-8">
        {/* Wordmark */}
        <div className="mb-10 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-muted mb-2">
            BMW M
          </p>
          <h1 className="text-2xl font-bold uppercase tracking-wide text-on-dark">
            Job Search Workspace
          </h1>
          <p className="text-sm text-muted mt-2 font-light">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-m block mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-m"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="label-m block mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-m"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-[#e22718] text-xs uppercase tracking-wider">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-m btn-m-primary w-full mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
