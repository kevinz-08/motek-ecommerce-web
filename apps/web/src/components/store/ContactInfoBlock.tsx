import {
  WHATSAPP_URL, STORE_ADDRESS, STORE_MAP_URL, STORE_PHONE_DISPLAY, STORE_PHONE_TEL, STORE_EMAIL,
} from '@/lib/contact'
import { Card } from '@/components/ui/Card'

const WHATSAPP_CONTACT_URL = WHATSAPP_URL('Hola Motek, tengo una consulta')

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
    <svg className="w-5 h-5 shrink-0 text-[var(--c-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg className="w-5 h-5 shrink-0 text-[var(--c-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 5.25v1.5z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg className="w-5 h-5 shrink-0 text-[var(--c-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

const SOCIALS = [
  { href: 'https://www.instagram.com/motekstore/', label: 'Instagram', Icon: InstagramIcon, hover: 'hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)]' },
  { href: 'https://www.facebook.com/motekstore', label: 'Facebook', Icon: FacebookIcon, hover: 'hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)]' },
  { href: 'https://www.tiktok.com/@motekstore?_r=1&_t=ZS-982pru3g5t2', label: 'TikTok', Icon: TikTokIcon, hover: 'hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)]' },
  { href: WHATSAPP_CONTACT_URL, label: 'WhatsApp', Icon: WhatsAppIcon, hover: 'hover:bg-[#25D366]/10 hover:text-[#25D366]' },
]

export function ContactInfoBlock() {
  return (
    <Card className="bg-[var(--c-surface-2)]">
      <h2 className="text-lg font-semibold text-[var(--c-text)]">Contacto directo</h2>
      <p className="mt-1 text-sm text-[var(--c-text-3)]">Respondemos rápido, sobre todo por WhatsApp.</p>

      <ul className="mt-6 space-y-4" role="list">
        <li>
          <a
            href={STORE_MAP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 text-sm text-[var(--c-text-2)] hover:text-[var(--c-text)] transition-colors duration-150"
          >
            <MapPinIcon />
            <span>{STORE_ADDRESS}</span>
          </a>
        </li>
        <li>
          <a
            href={`tel:${STORE_PHONE_TEL}`}
            className="flex items-center gap-3 text-sm text-[var(--c-text-2)] hover:text-[var(--c-text)] transition-colors duration-150"
          >
            <PhoneIcon />
            <span>{STORE_PHONE_DISPLAY}</span>
          </a>
        </li>
        <li>
          <a
            href={`mailto:${STORE_EMAIL}`}
            className="flex items-center gap-3 text-sm text-[var(--c-text-2)] hover:text-[var(--c-text)] transition-colors duration-150"
          >
            <MailIcon />
            <span>{STORE_EMAIL}</span>
          </a>
        </li>
      </ul>

      <a
        href={WHATSAPP_CONTACT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#1ebe5a]"
      >
        <WhatsAppIcon />
        Escríbenos por WhatsApp
      </a>

      <div className="mt-6 flex items-center gap-3 border-t border-[var(--c-border)] pt-6">
        {SOCIALS.map(({ href, label, Icon, hover }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-[var(--c-surface)] border border-[var(--c-border)] text-[var(--c-text-3)] transition-colors duration-200 ${hover}`}
          >
            <Icon />
          </a>
        ))}
      </div>
    </Card>
  )
}
