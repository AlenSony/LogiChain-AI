'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type AuthMode = 'signin' | 'signup'

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('customer')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (mode === 'signin') {
      // --- SIGN IN LOGIC ---
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage({ type: 'error', text: error.message })
        setLoading(false)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } else {
      // --- SIGN UP LOGIC ---
      // We pass 'name' and 'role' into options.data so our Supabase DB trigger 
      // automatically populates the public.profiles table!
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || 'New User',
            role: role,
          },
        },
      })

      setLoading(false)
      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else if (data?.user && data.session === null) {
        // If email confirmation is enabled on your local/remote Supabase
        setMessage({ type: 'success', text: 'Registration initiated! Please check your email for a verification link.' })
      } else {
        setMessage({ type: 'success', text: 'Account provisioned successfully! Redirecting...' })
        setTimeout(() => {
          router.push('/dashboard')
          router.refresh()
        }, 1500)
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900 font-sans selection:bg-emerald-100">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl p-8 transition-all duration-300">
        
        {/* Typographic Minimal Branding */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            LogiChain <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 ml-1"></span>
          </h2>
          <p className="mt-1 text-xs uppercase tracking-widest text-slate-400 font-semibold">
            Autonomous Logistics Network
          </p>
        </div>

        {/* Minimal Mode Switcher Tabs */}
        <div className="flex border-b border-slate-100 mb-6">
          <button
            onClick={() => { setMode('signin'); setMessage(null); }}
            className={`flex-1 pb-3 text-sm font-medium transition-all ${
              mode === 'signin' 
                ? 'border-b-2 border-emerald-600 text-slate-900' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setMode('signup'); setMessage(null); }}
            className={`flex-1 pb-3 text-sm font-medium transition-all ${
              mode === 'signup' 
                ? 'border-b-2 border-emerald-600 text-slate-900' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Info/Error Notification Banner */}
        {message && (
          <div className={`mb-6 rounded-lg p-3 text-sm border ${
            message.type === 'error' 
              ? 'bg-rose-50 border-rose-200 text-rose-700' 
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Dynamic Form Framework */}
        <form className="space-y-4" onSubmit={handleAuth}>
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-slate-900 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all"
                placeholder="Alen Sony"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Identity Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-slate-900 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Security Keyphrase</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-slate-900 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Operational Node Designation</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-slate-900 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="customer">Customer Access Portal</option>
                <option value="admin">Logistics Control Tower Admin</option>
                <option value="warehouse_manager">Regional Hub Node Director</option>
                <option value="pickup_employee">Fleet Dispatch Agent (Pickup)</option>
                <option value="delivery_employee">Fleet Dispatch Agent (Delivery)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-lg bg-emerald-600 p-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/10 transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading 
              ? 'Synchronizing Matrix...' 
              : mode === 'signin' ? 'Initialize Terminal Session' : 'Provision System Credentials'
            }
          </button>
        </form>

      </div>
    </div>
  )
}