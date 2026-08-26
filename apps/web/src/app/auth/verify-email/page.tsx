import type { Metadata } from 'next'
import { Suspense } from 'react'
import { VerifyEmailForm } from './VerifyEmailForm'

export const metadata: Metadata = {
  title: 'Verifica tu correo',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ email?: string }>
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { email = '' } = await searchParams
  return (
    <Suspense>
      <VerifyEmailForm email={email} />
    </Suspense>
  )
}
