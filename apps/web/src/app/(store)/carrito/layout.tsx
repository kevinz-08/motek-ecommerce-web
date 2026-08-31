import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Carrito de compras',
  description: 'Revisa los productos agregados al carrito antes de finalizar tu compra.',
  robots: { index: false, follow: false },
}

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children
}
