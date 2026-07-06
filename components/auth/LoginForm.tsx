'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const router  = useRouter()
  const supabase = createClient()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [mode,     setMode]     = useState<'login' | 'magic'>('login')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email ou mot de passe incorrect.'); setLoading(false); return }
    router.refresh()
    router.push('/')
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/api/auth/callback` },
    })
    if (error) { setError("Erreur lors de l'envoi du lien."); setLoading(false); return }
    setLoading(false)
    alert('Lien envoyé ! Vérifiez votre email.')
  }

  return (
    <div className="card-elevated">
      <div className="flex rounded-md overflow-hidden border border-dim mb-6">
        {(['login', 'magic'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === m ? 'bg-amber text-bg' : 'bg-surface-1 text-muted hover:text-cream'
            }`}
          >
            {m === 'login' ? 'Mot de passe' : 'Lien magique'}
          </button>
        ))}
      </div>

      <form onSubmit={mode === 'login' ? handleLogin : handleMagicLink}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com" required className="input" />
          </div>
          {mode === 'login' && (
            <div>
              <label className="block text-sm text-muted mb-1.5">Mot de passe</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required className="input" />
            </div>
          )}
          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded px-3 py-2">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Envoyer le lien'}
          </button>
        </div>
      </form>
    </div>
  )
}
