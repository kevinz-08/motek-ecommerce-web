import Link from 'next/link'
import Image from 'next/image'
import {
  WHATSAPP_URL, STORE_MAP_URL, STORE_PHONE_DISPLAY, STORE_PHONE_TEL,
  STORE_EMAIL, STORE_CITY, STORE_COUNTRY, STORE_ADDRESS,
} from '@/lib/contact'

const WHATSAPP_FOOTER_URL = WHATSAPP_URL('Hola Tienda Motek')

const NAV_LINKS = [
  { href: '/catalogo', label: 'Ver todo el catálogo' },
  { href: '/catalogo?category=sistema-electrico', label: 'Sistema Eléctrico' },
  { href: '/catalogo?category=repuestos', label: 'Repuestos' },
  { href: '/catalogo?category=aceites', label: 'Aceites' },
  { href: '/catalogo?category=llantas', label: 'Llantas' },
  { href: '/catalogo?category=accesorios', label: 'Accesorios' },
]

const LEGAL_LINKS = [
  { href: '/legal/terminos-y-condiciones', label: 'Términos y condiciones' },
  { href: '/legal/politica-de-privacidad', label: 'Política de privacidad' },
  { href: '/legal/politica-de-envios', label: 'Política de envíos' },
  { href: '/legal/politica-de-cambios', label: 'Política de cambios' },
]

function InstagramIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.589 6.686a4.793 4.793 0 01-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 01-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 013.183-4.51v-3.5a6.329 6.329 0 00-5.394 10.692 6.33 6.33 0 0010.857-4.424V8.687a8.182 8.182 0 004.773 1.526V6.79a4.831 4.831 0 01-1.003-.104z" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.114.552 4.1 1.516 5.827L.057 23.854l6.162-1.617A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.002-1.371l-.36-.213-3.657.958.976-3.563-.234-.376A9.79 9.79 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 5.25v1.5z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-[var(--c-bg)] text-[var(--c-text-2)] border-t border-[var(--c-border)]" aria-label="Pie de página">

      {/* Franja superior con propuesta de valor */}
      <div className="bg-[var(--c-active-bg)] border-b border-[var(--c-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <p className="text-center text-xs sm:text-sm text-[var(--c-text-2)] tracking-wide">
            Envío gratis desde $500.000 &nbsp;·&nbsp; Garantía de hasta 1 año &nbsp;·&nbsp; Atención personalizada por WhatsApp
          </p>
        </div>
      </div>

      {/* Cuerpo principal del footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

          {/* Columna 1 — Acerca de la tienda */}
          <div className="flex flex-col gap-5">
            <Link href="/" aria-label="Ir a la página principal de Motek Store">
              <Image
                src="/assets/logo.webp"
                alt="Motek Store"
                width={130}
                height={36}
                className="object-contain"
                style={{ height: 'auto' }}
              />
            </Link>
            <p className="text-sm leading-relaxed text-[var(--c-text-2)]">
              Taller especializado en repuestos y servicio técnico de motos en Colombia. Calidad garantizada para que tu moto nunca se detenga.
            </p>

            {/* Redes sociales */}
            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://www.instagram.com/motekstore/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Síguenos en Instagram"
                className="w-9 h-9 rounded-full bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)] text-[var(--c-text-3)] flex items-center justify-center transition-colors duration-200"
              >
                <InstagramIcon />
              </a>
              <a
                href="https://www.facebook.com/motekstore"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Síguenos en Facebook"
                className="w-9 h-9 rounded-full bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)] text-[var(--c-text-3)] flex items-center justify-center transition-colors duration-200"
              >
                <FacebookIcon />
              </a>
              <a
                href="https://www.tiktok.com/@motekstore?_r=1&_t=ZS-982pru3g5t2"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Síguenos en TikTok"
                className="w-9 h-9 rounded-full bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)] text-[var(--c-text-3)] flex items-center justify-center transition-colors duration-200"
              >
                <TikTokIcon />
              </a>
              <a
                href={WHATSAPP_FOOTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Contáctanos por WhatsApp"
                className="w-9 h-9 rounded-full bg-[var(--c-surface-2)] hover:bg-[var(--c-active-bg)] hover:text-[var(--c-accent)] text-[var(--c-text-3)] flex items-center justify-center transition-colors duration-200"
              >
                <WhatsAppIcon />
              </a>
            </div>
          </div>

          {/* Columna 2 — Tienda / Categorías */}
          <div>
            <h2 className="text-[var(--c-text)] font-semibold text-sm uppercase tracking-wider mb-5">
              Tienda
            </h2>
            <ul className="space-y-3" role="list">
              {NAV_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-[var(--c-text-2)] hover:text-[var(--c-accent)] hover:translate-x-0.5 inline-flex transition-all duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Columna 3 — Legal */}
          <div>
            <h2 className="text-[var(--c-text)] font-semibold text-sm uppercase tracking-wider mb-5">
              Legal
            </h2>
            <ul className="space-y-3" role="list">
              {LEGAL_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-[var(--c-text-2)] hover:text-[var(--c-accent)] hover:translate-x-0.5 inline-flex transition-all duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Columna 4 — Dónde encontrarnos */}
          <div>
            <h2 className="text-[var(--c-text)] font-semibold text-sm uppercase tracking-wider mb-5">
              Dónde encontrarnos
            </h2>
            <ul className="space-y-4" role="list">
              <li>
                <a
                  href={STORE_MAP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 text-sm text-[var(--c-text-2)] hover:text-[var(--c-accent)] transition-colors duration-150"
                >
                  <MapPinIcon />
                  <span>{STORE_ADDRESS}, {STORE_COUNTRY}</span>
                </a>
              </li>
              <li>
                <a
                  href={`tel:${STORE_PHONE_TEL}`}
                  className="flex items-start gap-2.5 text-sm text-[var(--c-text-2)] hover:text-[var(--c-accent)] transition-colors duration-150"
                >
                  <PhoneIcon />
                  <span>{STORE_PHONE_DISPLAY}</span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${STORE_EMAIL}`}
                  className="flex items-start gap-2.5 text-sm text-[var(--c-text-2)] hover:text-[var(--c-accent)] transition-colors duration-150"
                >
                  <MailIcon />
                  <span>{STORE_EMAIL}</span>
                </a>
              </li>
            </ul>

            {/* CTA WhatsApp */}
            <a
              href={WHATSAPP_FOOTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--c-accent)] hover:bg-[var(--c-accent-hover)] text-white text-sm font-semibold transition-colors duration-200"
            >
              <WhatsAppIcon />
              Escríbenos ahora
            </a>
          </div>
        </div>
      </div>

      {/* Barra inferior */}
      <div className="border-t border-[var(--c-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[var(--c-text-3)]">
            © {year} Motek Store. Todos los derechos reservados. {STORE_CITY}, {STORE_COUNTRY}.
          </p>

          {/* Métodos de pago aceptados */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--c-text-3)] mr-1">Pagos seguros con</span>
            {['Wompi', 'Visa', 'MC', 'PSE'].map((method) => (
              <span
                key={method}
                className="px-2.5 py-1 rounded bg-[var(--c-surface-2)] text-[11px] font-semibold text-[var(--c-text-2)] tracking-wide border border-[var(--c-border)]"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
