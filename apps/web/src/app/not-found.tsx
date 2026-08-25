import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Página no encontrada',
  description: 'La página que buscas no existe o fue movida.',
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">

      {/* Número 404 */}
      <p className="text-[120px] sm:text-[160px] font-black leading-none text-gray-200 select-none">
        404
      </p>

      {/* Ícono */}
      <div className="text-5xl -mt-4 mb-6">🏍️</div>

      {/* Texto */}
      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">
        Página no encontrada
      </h1>
      <p className="text-gray-500 max-w-sm mb-8 text-sm sm:text-base leading-relaxed">
        La página que buscas no existe o fue movida.
        Puede que la URL esté mal escrita o el producto ya no esté disponible.
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="bg-gray-900 text-white px-7 py-3 rounded-xl font-bold hover:bg-gray-700 transition-colors"
        >
          Ir al inicio
        </Link>
        <Link
          href="/catalogo"
          className="bg-[var(--c-accent)] text-[var(--c-text-on-accent)] px-7 py-3 rounded-xl font-bold hover:bg-[var(--c-accent-hover)] transition-colors"
        >
          Ver catálogo
        </Link>
      </div>

    </div>
  )
}
