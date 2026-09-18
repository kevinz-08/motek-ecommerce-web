/**
 * Layout raíz de la aplicación — envuelve TODAS las páginas.
 *
 * Responsabilidades:
 *   1. Carga Oswald (--font-oswald, títulos) y Roboto (--font-roboto, cuerpo)
 *      de Google Fonts vía next/font/google
 *   2. Define la metadata global (título base, descripción, Open Graph)
 *   3. Establece el idioma del documento (lang="es-CO")
 *   4. Aplica clases globales: antialiased, h-full, variables de fuente
 *
 * suppressHydrationWarning en <body>:
 *   Algunas extensiones del navegador (gestores de contraseñas, traductores,
 *   extensiones de accesibilidad) inyectan atributos en el <body> DESPUÉS de
 *   que el servidor renderiza el HTML pero ANTES de que React hidrata el DOM.
 *   Esto genera un warning de hidratación:
 *     "Prop `bis_register` did not match. Server: '' Client: 'W3siQ...'"
 *   El prop suppressHydrationWarning silencia este warning SOLO para el elemento
 *   <body> (no se propaga a sus hijos).
 *
 * metadata.title.template:
 *   Las páginas que definen su propio title usarán el template:
 *     "Pastillas de freno Brembo | Motek Store"
 *   Si no definen title, se usa el default:
 *     "Motek Store — Repuestos y Servicios"
 */
import type { Metadata } from 'next'
import { Oswald, Roboto } from 'next/font/google'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AuthSessionProvider } from '@/components/providers/SessionProvider'
import './globals.css'

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
})

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://motek-store.vercel.app'),
  title: {
    default: 'Motek Store — Repuestos y Servicios',
    template: '%s | Motek Store',
  },
  description:
    'Taller especializado en motos eléctricas y a gasolina. Repuestos originales y servicio técnico en Colombia.',
  keywords: ['repuestos motos', 'taller motos', 'motos Colombia', 'repuestos motos Colombia'],
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'Motek Store',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={`${oswald.variable} ${roboto.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-white text-gray-900" suppressHydrationWarning>
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
