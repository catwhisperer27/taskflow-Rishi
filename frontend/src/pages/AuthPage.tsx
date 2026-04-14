import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { Input, ErrorMsg, Spinner } from '../components/ui'
import { Layers } from 'lucide-react'

interface AuthPageProps {
  mode: 'login' | 'register'
}

export default function AuthPage({ mode }: AuthPageProps) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'login'
        ? authApi.login({ email: form.email, password: form.password })
        : authApi.register({ name: form.name, username: form.username, email: form.email, password: form.password }),
    onSuccess: ({ data }) => {
      login(data.token, data.user)
      navigate('/')
    },
    onError: (err: any) => {
      const data = err.response?.data
      if (data?.fields) setErrors(data.fields)
      else setErrors({ _: data?.error || 'Something went wrong' })
    },
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (mode === 'register') {
      if (!form.name.trim()) e.name = 'Name is required'
      if (!form.username.trim()) e.username = 'Username is required'
    }
    if (!form.email.trim()) e.email = 'Email is required'
    if (form.password.length < 8) e.password = 'At least 8 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) mutation.mutate()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center">
          <Layers size={16} className="text-white" />
        </div>
        <span className="text-base font-semibold text-[#e5e7eb] tracking-tight">TaskFlow</span>
      </div>

      <div className="w-full max-w-sm">
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-6">
          <div className="mb-6">
            <h1 className="text-base font-semibold text-[#e5e7eb]">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </h1>
            <p className="text-xs text-[#6b7280] mt-0.5">
              {mode === 'login' ? 'Welcome back' : 'Get started with TaskFlow'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {errors._ && <ErrorMsg message={errors._} />}

            {mode === 'register' && (
              <>
                <Input label="Full name" type="text" placeholder="Your name"
                  value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  error={errors.name} autoComplete="name" />
                <Input label="Username" type="text" placeholder="e.g. johndoe"
                  value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  error={errors.username} autoComplete="username" />
              </>
            )}

            <Input label="Email" type="email" placeholder="you@example.com"
              value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              error={errors.email} autoComplete="email" />

            <Input label="Password" type="password" placeholder="••••••••"
              value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              error={errors.password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />

            <button type="submit" disabled={mutation.isPending}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors disabled:opacity-50">
              {mutation.isPending && <Spinner size={14} />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#6b7280] mt-4">
          {mode === 'login' ? (
            <>No account?{' '}<Link to="/register" className="text-indigo-400 hover:text-indigo-300">Sign up</Link></>
          ) : (
            <>Already have an account?{' '}<Link to="/login" className="text-indigo-400 hover:text-indigo-300">Sign in</Link></>
          )}
        </p>
      </div>
    </div>
  )
}
