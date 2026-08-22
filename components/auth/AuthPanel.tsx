'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'register'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Panneau d'authentification — maquette `Tanuki Auth` : un seul écran, bascule
 * Connexion / Créer un compte, validation inline, lien mot de passe oublié.
 *
 * Les routes `/login` et `/register` restent distinctes (elles sont la cible de
 * tous les `redirect=` de l'application) : elles rendent ce même panneau avec un
 * onglet initial différent.
 */
export default function AuthPanel({ initialMode = 'login' }: { initialMode?: Mode }) {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const redirectTo = params.get('redirect') ?? '/'

  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState<{ email?: boolean; pwd?: boolean; confirm?: boolean }>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isRegister = mode === 'register'
  const emailErr = touched.email && !EMAIL_RE.test(email)
  const pwdErr = touched.pwd && password.length < 8
  const confirmErr = isRegister && touched.confirm && confirm !== password

  const canSubmit =
    EMAIL_RE.test(email) && password.length >= 8 && (!isRegister || confirm === password)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ email: true, pwd: true, confirm: true })
    if (!canSubmit) return

    setLoading(true)
    setError(null)
    setNotice(null)

    if (isRegister) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/api/auth/callback` },
      })
      setLoading(false)
      if (error) { setError(error.message); return }
      setNotice('Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-mail ou mot de passe incorrect.')
      setLoading(false)
      return
    }
    router.refresh()
    router.push(redirectTo)
  }

  async function handleMagicLink() {
    if (!EMAIL_RE.test(email)) {
      setTouched(t => ({ ...t, email: true }))
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/api/auth/callback` },
    })
    setLoading(false)
    if (error) { setError("Envoi du lien impossible pour le moment."); return }
    setNotice('Lien de connexion envoyé — vérifiez votre boîte mail.')
  }

  async function handleReset() {
    if (!EMAIL_RE.test(email)) {
      setTouched(t => ({ ...t, email: true }))
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/api/auth/callback`,
    })
    setLoading(false)
    if (error) { setError('Envoi impossible pour le moment.'); return }
    setNotice('Si un compte existe pour cette adresse, un lien de réinitialisation vient de partir.')
  }

  const field =
    'w-full rounded-control bg-[rgba(255,255,255,0.55)] px-4 py-3.5 text-[14px] text-ink placeholder:text-ink-55'
  const label = 'font-mono text-[9px] tracking-[0.16em] text-ink-55'

  return (
    <div className="glass w-full max-w-[440px] rounded-hero p-8 sm:p-11">
      <div className="mb-8 flex gap-1 rounded-control bg-[rgba(26,22,17,0.06)] p-1">
        {(['login', 'register'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`flex-1 rounded-control py-2.5 text-[13px] font-medium transition-colors ${
              mode === m ? 'bg-[rgba(255,255,255,0.85)] text-ink' : 'text-ink-60 hover:text-ink'
            }`}
          >
            {m === 'login' ? 'Connexion' : 'Créer un compte'}
          </button>
        ))}
      </div>

      <h1 className="m-0 mb-1.5 text-[24px] font-semibold tracking-[-0.02em] sm:text-[26px]">
        {isRegister ? 'Créer un compte' : 'Bon retour'}
      </h1>
      <p className="m-0 mb-7 text-[13px] text-[rgba(26,22,17,0.65)]">
        {isRegister
          ? 'Suivi de commandes, wishlist et demandes de rachat au même endroit.'
          : 'Retrouvez vos commandes, votre wishlist et votre avoir.'}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="auth-email" className={label}>E-MAIL</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, email: true }))}
            placeholder="vous@exemple.fr"
            className={`${field} border ${emailErr ? 'border-[#8A2F1D]' : 'border-[rgba(26,22,17,0.15)]'}`}
          />
          {emailErr && <span className="text-[12px] text-[#8A2F1D]">Adresse e-mail invalide.</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="auth-pwd" className={label}>MOT DE PASSE</label>
          <input
            id="auth-pwd"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, pwd: true }))}
            placeholder="••••••••"
            className={`${field} border ${pwdErr ? 'border-[#8A2F1D]' : 'border-[rgba(26,22,17,0.15)]'}`}
          />
          {pwdErr && <span className="text-[12px] text-[#8A2F1D]">8 caractères minimum.</span>}
        </div>

        {isRegister && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="auth-confirm" className={label}>CONFIRMER LE MOT DE PASSE</label>
            <input
              id="auth-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, confirm: true }))}
              placeholder="••••••••"
              className={`${field} border ${confirmErr ? 'border-[#8A2F1D]' : 'border-[rgba(26,22,17,0.15)]'}`}
            />
            {confirmErr && (
              <span className="text-[12px] text-[#8A2F1D]">Les mots de passe ne correspondent pas.</span>
            )}
          </div>
        )}

        {error && (
          <p className="m-0 rounded-control border border-[rgba(138,47,29,0.35)] bg-[rgba(138,47,29,0.08)] px-4 py-3 text-[13px] text-[#8A2F1D]">
            {error}
          </p>
        )}
        {notice && (
          <p className="m-0 rounded-control border border-[rgba(200,134,10,0.35)] bg-[rgba(200,134,10,0.10)] px-4 py-3 text-[13px] text-ink">
            {notice}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-ochre mt-3 w-full py-4 text-[15px] disabled:opacity-60">
          {loading ? 'Un instant…' : isRegister ? 'Créer mon compte' : 'Se connecter'}
        </button>
      </form>

      {!isRegister && (
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleMagicLink}
            className="text-[13px] text-ink-60 transition-colors hover:text-ochre"
          >
            Recevoir un lien de connexion
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="text-[13px] text-ink-60 transition-colors hover:text-ochre"
          >
            Mot de passe oublié ?
          </button>
        </div>
      )}
    </div>
  )
}
