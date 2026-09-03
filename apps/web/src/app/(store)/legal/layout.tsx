import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface LegalLayoutProps {
  children: React.ReactNode
}

export default function LegalLayout({ children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-400">
            <Link href="/" className="hover:text-[var(--c-accent)] transition-colors">Inicio</Link>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <span className="text-gray-600 font-medium">Información legal</span>
          </nav>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-16">
        <article className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 sm:px-12">
          {children}
        </article>

        {/* Navegación entre documentos */}
        <nav aria-label="Documentos legales" className="mt-8">
          <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">
            Otros documentos legales
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Link
              href="/legal/terminos-y-condiciones"
              className="text-xs text-center bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-600 hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] transition-colors"
            >
              Términos y condiciones
            </Link>
            <Link
              href="/legal/politica-de-privacidad"
              className="text-xs text-center bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-600 hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] transition-colors"
            >
              Política de privacidad
            </Link>
            <Link
              href="/legal/politica-de-envios"
              className="text-xs text-center bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-600 hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] transition-colors"
            >
              Política de envíos
            </Link>
            <Link
              href="/legal/politica-de-cambios"
              className="text-xs text-center bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-600 hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] transition-colors"
            >
              Política de cambios
            </Link>
          </div>
        </nav>
      </div>
    </div>
  )
}
