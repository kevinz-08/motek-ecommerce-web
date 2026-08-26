import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordForm } from './ResetPasswordForm'

export const metadata: Metadata = {
  title: 'Nueva contraseña',
  description: 'Establece una nueva contraseña para tu cuenta.',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function ResetPasswordPage({ params }: PageProps) {
  const { token } = await params

  return (
    <div className="catalog-light min-h-screen c-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <Link href="/" className="c-text font-bold text-lg hover:text-[var(--c-accent)] transition-colors">
            Motek Store
          </Link>
          <h1 className="text-2xl font-black c-text mt-6 mb-2">Nueva contraseña</h1>
          <p className="c-text-3 text-sm">
            Elige una contraseña segura para tu cuenta.
          </p>
        </div>

        <div className="c-surface border c-border rounded-2xl p-6 shadow-[var(--shadow-lg)]">
          <ResetPasswordForm token={token} />
        </div>

      </div>
    </div>
  )
}
