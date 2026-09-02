import type { Metadata } from 'next'
import { SyncForm } from '@/components/admin/SyncForm'
import { AdminHelpButton } from '@/components/admin/AdminHelpButton'
import { syncHelpContent } from '@/components/admin/help-content/sync'

export const metadata: Metadata = { title: 'Sincronizar inventario' }

export default function AdminSyncPage() {
  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-text)] tracking-tight">Sincronizar inventario</h1>
          <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)] mt-1">
            Revisa el stock y precio del export de Optimun antes de aplicarlos a la tienda.
            Solo se modifican productos que ya existen — nada se guarda hasta que confirmes.
          </p>
        </div>
        <AdminHelpButton content={syncHelpContent} />
      </div>

      <div className="max-w-3xl">
        <SyncForm />
      </div>
    </div>
  )
}
