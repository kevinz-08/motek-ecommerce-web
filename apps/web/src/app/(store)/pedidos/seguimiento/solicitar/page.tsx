import type { Metadata } from 'next'
import Link from 'next/link'
import { RequestTrackingLinkForm } from '@/components/checkout/RequestTrackingLinkForm'

export const metadata: Metadata = {
  title: 'Recuperar enlace de seguimiento',
  description: 'Te reenviamos por correo el enlace para seguir tu pedido.',
  robots: { index: false, follow: false },
}

export default function SolicitarSeguimientoPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto px-4 sm:px-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-8">
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            Recupera el enlace de tu pedido
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Si compraste sin cuenta y perdiste el correo de confirmación, te
            reenviamos los enlaces de seguimiento.
          </p>

          <RequestTrackingLinkForm
            turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
          />

          <p className="mt-6 text-xs text-gray-500 text-center">
            ¿Tienes cuenta?{' '}
            <Link href="/auth/login?callbackUrl=/pedidos" className="text-[var(--c-accent)] font-semibold hover:underline">
              Inicia sesión
            </Link>{' '}
            para ver todo tu historial.
          </p>
        </div>
      </div>
    </div>
  )
}
