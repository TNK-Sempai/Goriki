import type { Metadata } from 'next'
import RegisterForm from '@/components/auth/RegisterForm'

export const metadata: Metadata = { title: 'Créer un compte' }

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-cream mb-1">GORIKI</h1>
          <p className="text-muted text-sm">Créer votre compte</p>
        </div>
        <RegisterForm />
        <p className="text-center text-muted text-sm mt-6">
          Déjà un compte ?{' '}
          <a href="/login" className="text-amber hover:text-amber-light">Se connecter</a>
        </p>
      </div>
    </main>
  )
}
