import type { Metadata } from 'next'
import LoginForm from '@/components/auth/LoginForm'

export const metadata: Metadata = { title: 'Connexion' }

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-cream mb-1">GORIKI</h1>
          <p className="text-muted text-sm">Connexion à votre compte</p>
        </div>
        <LoginForm />
        <p className="text-center text-muted text-sm mt-6">
          Pas encore de compte ?{' '}
          <a href="/register" className="text-amber hover:text-amber-light">S&apos;inscrire</a>
        </p>
      </div>
    </main>
  )
}
