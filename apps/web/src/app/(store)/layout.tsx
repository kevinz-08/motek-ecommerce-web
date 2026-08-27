import { Suspense } from 'react'
import { Navbar } from '@/components/nav/Navbar'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { Footer } from '@/components/store/Footer'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { AuthModal } from '@/components/auth/AuthModal'
import { getCachedNavCategories, getCachedMotorcycleBrands } from '@/lib/cache'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, motorcycleBrands] = await Promise.all([
    getCachedNavCategories(),
    getCachedMotorcycleBrands(),
  ])

  return (
    <>
      {/* Suspense requerido por useSearchParams() dentro de Navbar */}
      <Suspense fallback={<div className="h-16 bg-[var(--c-bg)] border-b border-[var(--c-border)]" />}>
        <Navbar categories={categories} motorcycleBrands={motorcycleBrands} />
      </Suspense>

      <main className="flex-1">{children}</main>
      <WhatsAppButton />
      <Footer />

      {/* Panel lateral del carrito — disponible en cualquier ruta del storefront */}
      <CartDrawer />

      {/* Modal de login/registro — disponible en cualquier ruta del storefront */}
      <AuthModal />
    </>
  )
}
