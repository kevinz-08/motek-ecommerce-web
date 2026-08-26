import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Crear cuenta',
  description: 'Regístrate gratis para realizar compras, guardar tus datos de envío y seguir tus pedidos.',
  robots: { index: false, follow: false },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
