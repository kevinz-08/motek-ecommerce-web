import { WHATSAPP_URL } from '@/lib/contact'

/**
 * Trustbar — exactamente 3 sellos de confianza (docs/blueprint landing rediseño):
 * Envío Rápido, Soporte por WhatsApp, Garantía. Storefront público en modo
 * claro fijo: fondo blanco, texto negro/gris, ícono en acento rojo escaso.
 */
const BADGES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
    label: 'Envío Rápido',
    sub: 'A toda Colombia',
    href: undefined as string | undefined,
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.004c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm5.8 14.06c-.24.68-1.4 1.3-1.93 1.38-.49.08-1.11.11-1.79-.11-.41-.13-.94-.31-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.09 1-2.38.24-.26.53-.32.7-.32h.5c.16 0 .38-.06.59.45.24.58.81 2 .88 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.16-.29.36-.42.48-.14.14-.28.29-.12.56.16.28.71 1.18 1.53 1.91 1.05.94 1.94 1.23 2.21 1.37.28.14.44.12.6-.07.16-.19.68-.79.86-1.06.19-.28.37-.23.62-.14.26.09 1.63.77 1.91.91.28.14.47.21.53.33.07.12.07.68-.17 1.36z" />
      </svg>
    ),
    label: 'Soporte por WhatsApp',
    sub: 'Escríbenos',
    href: WHATSAPP_URL(),
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    label: 'Garantía',
    sub: 'Hasta 1 año en repuestos',
    href: undefined as string | undefined,
  },
]

export function TrustBadges() {
  return (
    <section id="trust-badges" className="bg-[var(--c-bg)] border-y border-[var(--c-border)]">
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        {/* Mobile: fila compacta de 3 columnas (ícono arriba, texto centrado).
            sm+: vuelve al layout horizontal (ícono a la izquierda, texto a la derecha). */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {BADGES.map((badge) => {
            const content = (
              <div className="flex flex-col sm:flex-row items-center sm:items-center justify-center sm:justify-start gap-1.5 sm:gap-3 text-center sm:text-left">
                <span className="shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[var(--c-surface-2)] flex items-center justify-center text-[var(--c-accent)] [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6">
                  {badge.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-xs sm:text-sm text-[var(--c-text)] leading-tight">
                    {badge.label}
                  </p>
                  <p className="text-[11px] sm:text-xs text-[var(--c-text-3)] mt-0.5 leading-tight">
                    {badge.sub}
                  </p>
                </div>
              </div>
            )

            return badge.href ? (
              <a
                key={badge.label}
                href={badge.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
              >
                {content}
              </a>
            ) : (
              <div key={badge.label}>{content}</div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
