import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { prisma } from '@/infrastructure/database/prisma-client'
import { CheckoutForm } from '@/components/checkout/CheckoutForm'

export const metadata: Metadata = {
  title: 'Finalizar compra',
  description: 'Completa tus datos de envío y pago para confirmar tu pedido.',
  robots: { index: false, follow: false },
}

/**
 * Checkout — accesible con o sin sesión.
 *
 * Ya no redirige a login: un visitante sin cuenta debe poder llegar acá. Si el
 * flujo de invitado está apagado (`GUEST_CHECKOUT_ENABLED`), es `CheckoutForm`
 * quien muestra el CTA de iniciar sesión, con el carrito intacto.
 */
export default async function CheckoutPage() {
  const session = await auth()

  const [codSetting, shippingOnlineSetting, guestSetting] = await Promise.all([
    prisma.settings.findUnique({ where: { key: 'COD_ENABLED' } }),
    prisma.settings.findUnique({ where: { key: 'SHIPPING_ONLINE_ENABLED' } }),
    prisma.settings.findUnique({ where: { key: 'GUEST_CHECKOUT_ENABLED' } }),
  ])
  // Por defecto habilitado si no existe la fila aún — mismo fallback que orders.controller.ts.
  const codEnabled = codSetting ? codSetting.value === 'true' : true
  // Default FALSE si no existe la fila — no empezar a cobrar flete extra sin
  // opt-in explícito del admin (mismo criterio que orders.controller.ts).
  const shippingOnlineEnabled = shippingOnlineSetting?.value === 'true'
  // Default FALSE si no existe la fila — el flujo de invitado se abre desde
  // /admin/configuracion, no por el solo hecho de desplegar el código.
  // Mismo default que aplica el backend en POST /orders/guest.
  const guestCheckoutEnabled = guestSetting?.value === 'true'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Finalizar compra</h1>
      <CheckoutForm
        userEmail={session?.user?.email ?? null}
        isAuthenticated={Boolean(session?.user)}
        guestCheckoutEnabled={guestCheckoutEnabled}
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
        codEnabled={codEnabled}
        shippingOnlineEnabled={shippingOnlineEnabled}
      />
    </div>
  )
}
