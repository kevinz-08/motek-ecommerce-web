'use client'

import { useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Upload } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { SyncResultTable } from './SyncResultTable'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { SyncReport } from '@motek/domain'

type StockSyncUpdate = { productId: string; stock: number; price?: number }

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'preview'; report: SyncReport }
  | { status: 'applying'; report: SyncReport }
  | { status: 'applied'; report: SyncReport; appliedCount: number }
  | { status: 'error'; message: string }

/** Convierte el detalle de cambios del preview al payload que espera /stock/apply. */
function toUpdates(report: SyncReport): StockSyncUpdate[] {
  return report.updatedItems.map((item) => ({
    productId: item.productId,
    stock: item.newStock,
    ...(item.newPrice !== null && { price: item.newPrice }),
  }))
}

export function SyncForm() {
  const { data: session } = useSession()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>({ status: 'idle' })

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.xlsx')) {
      setState({ status: 'error', message: 'Solo se aceptan archivos .xlsx exportados desde Optimun.' })
      return
    }

    setState({ status: 'loading' })

    const form = new FormData()
    form.append('file', file)

    const res = await apiClient(session?.user?.accessToken).postForm<SyncReport>(
      '/admin/sync/stock/preview',
      form,
    )

    if (inputRef.current) inputRef.current.value = ''

    if (!res.ok) {
      setState({ status: 'error', message: res.error })
      return
    }

    setState({ status: 'preview', report: res.data })
  }

  const handleApply = async () => {
    if (state.status !== 'preview') return
    const updates = toUpdates(state.report)
    if (updates.length === 0) return

    setState({ status: 'applying', report: state.report })

    const res = await apiClient(session?.user?.accessToken).post<{ appliedCount: number }>(
      '/admin/sync/stock/apply',
      { updates },
    )

    if (!res.ok) {
      setState({ status: 'error', message: res.error })
      return
    }

    setState({ status: 'applied', report: state.report, appliedCount: res.data.appliedCount })
  }

  const isLoading = state.status === 'loading'
  const showDropZone = state.status === 'idle' || state.status === 'loading' || state.status === 'error'

  return (
    <div className="space-y-6">

      {/* ── Drop zone / selector ──────────────────────────────────────── */}
      {showDropZone && (
        <div
          className="border-2 border-dashed border-[var(--c-border)] rounded-[var(--radius-lg)] p-10 text-center hover:border-[var(--c-accent)]/50 transition-colors cursor-pointer"
          onClick={() => !isLoading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFile}
            disabled={isLoading}
          />

          <Upload className="w-8 h-8 text-[var(--c-text-4)] mx-auto mb-3" />
          <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)]">
            {isLoading
              ? 'Leyendo archivo y calculando cambios...'
              : 'Selecciona el archivo .xlsx exportado desde Optimun'}
          </p>
          <p className="text-xs text-[var(--c-text-4)] mt-1">Solo archivos .xlsx · Máx. 5 MB · No se guarda nada todavía</p>

          {!isLoading && (
            <Button type="button" className="mt-4" leftIcon={<Upload className="w-4 h-4" />}>
              Elegir archivo
            </Button>
          )}

          {isLoading && (
            <div className="mt-4 flex justify-center text-[var(--c-text-3)]">
              <Spinner size="md" />
            </div>
          )}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {state.status === 'error' && (
        <div className="bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/20 rounded-[var(--radius-lg)] p-4">
          <p className="text-[length:var(--text-body-sm)] text-[var(--c-danger)]">{state.message}</p>
        </div>
      )}

      {/* ── Preview / aplicado ────────────────────────────────────────── */}
      {(state.status === 'preview' || state.status === 'applying' || state.status === 'applied') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-[length:var(--text-body-sm)] font-semibold text-[var(--c-text-2)]">
              {state.status === 'applied' ? 'Cambios guardados' : 'Vista previa — nada se ha guardado todavía'}
            </h2>
            <button
              type="button"
              className="text-xs text-[var(--c-text-3)] hover:text-[var(--c-text)] transition-colors"
              onClick={() => setState({ status: 'idle' })}
            >
              {state.status === 'applied' ? 'Sincronizar otro archivo' : 'Descartar'}
            </button>
          </div>

          <SyncResultTable report={state.report} />

          {state.status === 'applied' ? (
            <div className="bg-[var(--c-success-bg)] border border-[var(--c-success)]/20 rounded-[var(--radius-lg)] p-4">
              <p className="text-[length:var(--text-body-sm)] text-[var(--c-success)]">
                {state.appliedCount} {state.appliedCount === 1 ? 'producto actualizado' : 'productos actualizados'} en la tienda.
              </p>
            </div>
          ) : (
            <Button
              type="button"
              onClick={handleApply}
              disabled={state.status === 'applying' || state.report.updated === 0}
              loading={state.status === 'applying'}
              className="w-full sm:w-auto"
            >
              {state.report.updated === 0 ? 'No hay cambios para guardar' : `Guardar cambios (${state.report.updated})`}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
