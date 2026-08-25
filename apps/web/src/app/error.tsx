'use client'

import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[app/error]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-2xl font-semibold text-gray-800">Algo salió mal</h2>
      <p className="max-w-md text-gray-500">
        Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio.
      </p>
      {process.env.NODE_ENV !== 'production' && (
        <pre className="max-w-xl overflow-auto rounded bg-gray-100 px-4 py-2 text-left text-sm text-red-600">
          {error.message}
        </pre>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-[var(--c-accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--c-accent-hover)]"
        >
          Intentar de nuevo
        </button>
        <Link
          href="/"
          className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  )
}
