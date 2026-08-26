'use client'

/**
 * Modal de perfil de usuario.
 *
 * Se abre desde el botón de cuenta en la Navbar (reemplaza la navegación
 * a /perfil, que no existe como ruta y causaba un 404 que corrompía el
 * estado de sesión al volver con el botón Atrás).
 *
 * Contenido:
 *   - Avatar con iniciales (no editable)
 *   - Nombre completo y email (solo lectura)
 *   - Campo de celular (se guarda en localStorage — TODO: sincronizar con DB)
 *   - Botón "Contactar con soporte" → WhatsApp
 *   - Botón "Ver mis pedidos" → /pedidos
 */
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { WHATSAPP_URL } from '@/lib/contact'

interface UserInfo {
  name?:  string | null
  email?: string | null
  role?:  string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  user: UserInfo | undefined
}


export function ProfileModal({ isOpen, onClose, user }: Props) {
  const [phone, setPhone]       = useState('')
  const [saved, setSaved]       = useState(false)
  const saveTimer               = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dialogRef               = useRef<HTMLDivElement>(null)

  // Iniciales del avatar (máx 2 caracteres)
  const initials = (user?.name ?? 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  // Cargar teléfono guardado
  useEffect(() => {
    if (isOpen) {
      setPhone(localStorage.getItem('motek-store-phone') ?? '')
    }
  }, [isOpen])

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Bloquear scroll del body mientras está abierto
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Limpiar timer al desmontar
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  const handleSavePhone = () => {
    localStorage.setItem('motek-store-phone', phone.trim())
    setSaved(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaved(false), 2000)
  }

  const whatsappUrl = WHATSAPP_URL(`Hola, soy ${user?.name ?? 'un cliente'} y necesito soporte.`)

  if (!isOpen) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Perfil de usuario"
        className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn"
      >
        {/* Cerrar */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white/40 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* ── Cabecera con avatar ────────────────────────────────────── */}
        <div className="flex flex-col items-center px-8 pt-8 pb-6 border-b border-white/10">
          {/* Avatar con iniciales */}
          <div className="w-20 h-20 rounded-full bg-[var(--c-accent)] flex items-center justify-center text-white text-2xl font-black mb-4 select-none shadow-lg ring-4 ring-[var(--c-accent)]/20">
            {initials}
          </div>

          <h2 className="text-lg font-bold text-white text-center leading-snug">
            {user?.name ?? 'Usuario'}
          </h2>
          <p className="text-sm text-white/40 mt-0.5 text-center">
            {user?.email ?? '—'}
          </p>
        </div>

        {/* ── Cuerpo ────────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-4">

          {/* Número de celular */}
          <div>
            <label
              htmlFor="profile-phone"
              className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-1.5"
            >
              Número de celular
            </label>
            <div className="flex gap-2">
              <input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSavePhone() }}
                placeholder="+57 300 000 0000"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[var(--c-accent)] transition-colors"
              />
              <button
                onClick={handleSavePhone}
                className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  saved
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 hover:bg-white/15 text-white'
                }`}
              >
                {saved ? '✓' : 'Guardar'}
              </button>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col gap-2 pt-1">
            {/* Soporte WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[var(--c-accent)] hover:bg-[var(--c-accent-hover)] text-[var(--c-text-on-accent)] rounded-xl font-semibold text-sm transition-colors"
            >
              {/* WhatsApp icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.122 1.533 5.857L0 24l6.335-1.521A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.817 9.817 0 01-5.006-1.367l-.357-.212-3.76.902.937-3.667-.233-.376A9.82 9.82 0 012.182 12C2.182 6.578 6.578 2.182 12 2.182S21.818 6.578 21.818 12 17.422 21.818 12 21.818z" />
              </svg>
              Contactar con soporte
            </a>

            {/* Ver pedidos */}
            <Link
              href="/pedidos"
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Ver mis pedidos
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
