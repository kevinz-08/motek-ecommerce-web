'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Trash2, ChevronUp, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'

interface Benefit {
  id?: string
  title: string
  body: string
  order: number
}

interface ProductDescriptionEditorProps {
  productId: string
  initialGeneralDescription?: string
  initialBenefits?: Benefit[]
}

const MAX_BENEFITS = 10

export function ProductDescriptionEditor({
  productId,
  initialGeneralDescription = '',
  initialBenefits = [],
}: ProductDescriptionEditorProps) {
  const { data: session } = useSession()

  const [generalDescription, setGeneralDescription] = useState(initialGeneralDescription)
  const [benefits, setBenefits] = useState<Benefit[]>(initialBenefits)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Operaciones sobre la lista de beneficios ──────────────────────────────

  const addBenefit = () => {
    if (benefits.length >= MAX_BENEFITS) return
    setBenefits((prev) => [...prev, { title: '', body: '', order: prev.length }])
  }

  const removeBenefit = (index: number) => {
    setBenefits((prev) =>
      prev.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i })),
    )
  }

  const moveBenefit = (index: number, direction: 'up' | 'down') => {
    const next = [...benefits]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setBenefits(next.map((b, i) => ({ ...b, order: i })))
  }

  const updateBenefit = (index: number, field: 'title' | 'body', value: string) => {
    setBenefits((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
    )
  }

  // ── Guardar ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    const emptyBenefit = benefits.find((b) => !b.body.trim())
    if (emptyBenefit) {
      setError('Cada beneficio debe tener una descripción')
      setSaving(false)
      return
    }

    const payload = {
      generalDescription: generalDescription.trim() || undefined,
      benefits: benefits.map(({ title, body, order }) => ({
        title: title.trim() || undefined,
        body: body.trim(),
        order,
      })),
    }

    try {
      const res = await apiClient(session?.user?.accessToken).put<void>(
        `/admin/products/${productId}/description`,
        payload,
      )
      if (!res.ok) throw new Error(res.error ?? 'Error al guardar la descripción')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
      <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest">
        Descripción estructurada
      </h2>

      {/* Descripción general */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1">
          Descripción general
        </label>
        <textarea
          rows={5}
          value={generalDescription}
          onChange={(e) => setGeneralDescription(e.target.value)}
          maxLength={2000}
          placeholder="Descripción completa del producto, materiales, garantía, características técnicas..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[var(--c-accent)] transition-colors resize-none"
        />
        <p className="text-xs text-white/30 mt-1 text-right">{generalDescription.length}/2000</p>
      </div>

      {/* Beneficios */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white/70">
            Beneficios{' '}
            <span className="text-white/30 font-normal">({benefits.length}/{MAX_BENEFITS})</span>
          </label>
          <button
            type="button"
            onClick={addBenefit}
            disabled={benefits.length >= MAX_BENEFITS}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--c-accent-text)] hover:text-[var(--c-accent-text-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar beneficio
          </button>
        </div>

        {benefits.length === 0 && (
          <p className="text-xs text-white/25 text-center py-6 border border-dashed border-white/10 rounded-lg">
            Sin beneficios aún — haz clic en &quot;Agregar beneficio&quot; para comenzar
          </p>
        )}

        {benefits.map((benefit, index) => (
          <div
            key={index}
            className="flex gap-3 bg-white/[0.03] border border-white/10 rounded-lg p-4"
          >
            {/* Controles de orden */}
            <div className="flex flex-col justify-start gap-0.5 pt-0.5 shrink-0">
              <button
                type="button"
                onClick={() => moveBenefit(index, 'up')}
                disabled={index === 0}
                aria-label="Subir beneficio"
                className="text-white/25 hover:text-white/60 disabled:opacity-20 transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <span className="text-center text-xs text-white/20 leading-none select-none">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => moveBenefit(index, 'down')}
                disabled={index === benefits.length - 1}
                aria-label="Bajar beneficio"
                className="text-white/25 hover:text-white/60 disabled:opacity-20 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Campos */}
            <div className="flex-1 space-y-2 min-w-0">
              <input
                type="text"
                value={benefit.title}
                onChange={(e) => updateBenefit(index, 'title', e.target.value)}
                placeholder="Título (opcional) — ej: Alta durabilidad"
                maxLength={120}
                className="w-full bg-transparent border border-white/10 rounded-md px-3 py-1.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[var(--c-accent)] transition-colors"
              />
              <textarea
                rows={2}
                value={benefit.body}
                onChange={(e) => updateBenefit(index, 'body', e.target.value)}
                placeholder="Descripción del beneficio *"
                maxLength={500}
                required
                className="w-full bg-transparent border border-white/10 rounded-md px-3 py-1.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[var(--c-accent)] transition-colors resize-none"
              />
              <p className="text-right text-xs text-white/20">{benefit.body.length}/500</p>
            </div>

            {/* Eliminar */}
            <button
              type="button"
              onClick={() => removeBenefit(index)}
              aria-label="Eliminar beneficio"
              className="text-white/20 hover:text-red-400 transition-colors shrink-0 self-start pt-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[var(--c-accent)] text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-[var(--c-accent-hover)] transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Guardando...' : 'Guardar descripción'}
        </button>

        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            Guardado correctamente
          </span>
        )}
      </div>
    </div>
  )
}
