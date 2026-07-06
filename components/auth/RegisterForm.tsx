'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RegisterForm() {
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      setLoading(false)
      return
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${location.origin}/api/auth/callback`,
      },
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="card-elevated text-center">
        <p className="text-amber font-display text-xl mb-2">Vérifiez votre email</p>
        <p className="text-muted text-sm">
          Lien envoyé à <strong className="text-cream">{email}</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="card-elevated">
      <form onSubmit={handleRegister}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">Nom complet</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="Jean Dupont" required className="input" />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com" required className="input" />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères minimum" required className="input" />
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded px-3 py-2">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </div>
      </form>
    </div>
  )
}
