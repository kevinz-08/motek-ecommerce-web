'use client'

/**
 * Anticipo pre-envío de contraentrega (Settings.COD_DEPOSIT_AMOUNT).
 *
 * El admin escribe pesos; se guarda en centavos (convención de precios del proyecto).
 * 0 = desactivado. El anticipo se cobra por Wompi antes de despachar y se descuenta
 * del cobro en la puerta. El retiro en tienda siempre está exento.
 */
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { apiClient } from '@/lib/api-client'

interface CodDepositFormProps {
  /** Valor inicial en centavos COP, leído desde la BD al cargar la página. */
  initialCents: number
}

export function CodDepositForm({ initialCents }: CodDepositFormProps) {
  const { data: session } = useSession()
  const [pesos, setPesos] = useState(String(Math.round(initialCents / 100)))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const save = async () => {
    const value = Number(pesos)
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      setMessage({ ok: false, text: 'Ingresa un valor en pesos entero (0 para desactivar).' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const res = await apiClient(session?.user?.accessToken).put<{ success: boolean }>(
        '/admin/settings/cod-deposit',
        { amountCents: Math.round(value * 100) },
      )
      setMessage(res.ok
        ? { ok: true, text: value === 0 ? 'Anticipo desactivado.' : 'Anticipo guardado.' }
        : { ok: false, text: 'No se pudo guardar. Intenta de nuevo.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[var(--c-text-3)] text-sm">$</span>
        <input
          type="number"
          min={0}
          step={1000}
          value={pesos}
          onChange={(e) => setPesos(e.target.value)}
          aria-label="Anticipo de contraentrega en pesos"
          className="w-32 bg-[var(--c-surface)] text-[var(--c-text)] border border-[var(--c-border)] rounded-[var(--radius-md)] px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--c-accent)]"
        />
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="px-3 py-1.5 text-sm font-semibold bg-[var(--c-accent)] text-white rounded-[var(--radius-md)] hover:bg-[var(--c-accent-hover)] disabled:opacity-50 transition-colors"
      >
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
      {message && (
        <span className={`text-xs ${message.ok ? 'text-[var(--c-success)]' : 'text-[var(--c-danger)]'}`}>{message.text}</span>
      )}
    </div>
  )
}
