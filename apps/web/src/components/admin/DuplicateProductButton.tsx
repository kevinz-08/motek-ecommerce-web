'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Copy } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { revalidateAdminCache } from '@/lib/revalidate'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface Props {
  id: string
  name: string
}

export function DuplicateProductButton({ id, name }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: session } = useSession()
  const router = useRouter()

  const handleDuplicate = async () => {
    setLoading(true)
    setError(null)
    const res = await apiClient(session?.user?.accessToken).post<{ id: string; name: string }>(
      `/admin/products/${id}/duplicate`,
    )
    if (!res.ok) {
      setError(res.error ?? 'Error al duplicar el producto')
      setLoading(false)
      return
    }
    await revalidateAdminCache([CACHE_TAGS.products])
    // Se deja el modal en "loading" hasta que la navegación termine: evita un segundo clic.
    router.push(`/admin/productos/${res.data.id}?duplicado=1`)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Duplicar ${name}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--c-text-3)] hover:text-[var(--c-text)] transition-colors"
      >
        <Copy className="w-3.5 h-3.5" />
        Duplicar
      </button>

      <Modal open={open} onClose={() => !loading && setOpen(false)} title="Duplicar producto">
        <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-2)]">
          ¿Estás seguro de que quieres duplicar <span className="font-semibold text-[var(--c-text)]">{name}</span>? Se creará como{' '}
          <span className="font-semibold text-[var(--c-text)]">&lsquo;{name} (Copia)&rsquo;</span>.
        </p>

        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
          <p className="text-[length:var(--text-body-sm)] font-semibold text-[var(--c-text)]">
            Al hacer una copia, ten en cuenta:
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[length:var(--text-body-sm)] text-[var(--c-text-2)]">
            <li>La copia se crea <strong>inactiva</strong>. Cuando esté lista, marca &ldquo;Producto activo&rdquo; y guarda los cambios.</li>
            <li>El <strong>stock inicial es 0</strong>. Ajústalo al que tengas.</li>
            <li>El <strong>SKU y el slug son provisionales</strong> (terminan en &ldquo;COPIA&rdquo;). Cámbialos por los definitivos.</li>
            <li>Las <strong>imágenes se comparten</strong> con el original (no se vuelven a subir).</li>
            <li>Se copian precio, descripción, beneficios, compatibilidad y medidas.</li>
          </ol>
        </div>

        {error && <p className="mt-3 text-[length:var(--text-body-sm)] text-[var(--c-danger)]">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleDuplicate} loading={loading}>
            Duplicar
          </Button>
        </div>
      </Modal>
    </>
  )
}
