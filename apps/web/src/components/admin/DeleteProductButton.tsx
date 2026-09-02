'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Trash2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { revalidateAdminCache } from '@/lib/revalidate'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface Props {
  id: string
  name: string
}

export function DeleteProductButton({ id, name }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: session } = useSession()
  const router = useRouter()

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    const res = await apiClient(session?.user?.accessToken).delete(`/admin/products/${id}`)
    if (!res.ok) {
      setError(res.error ?? 'Error al eliminar el producto')
      setLoading(false)
      return
    }
    await revalidateAdminCache([CACHE_TAGS.products])
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Eliminar ${name}`}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-[var(--c-text-4)] hover:text-[var(--c-danger)] transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Eliminar producto">
        <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-2)]">
          ¿Seguro que quieres eliminar <span className="font-semibold text-[var(--c-text)]">{name}</span>? Esta acción no se puede deshacer desde aquí, pero el producto queda en la papelera.
        </p>
        {error && <p className="mt-3 text-[length:var(--text-body-sm)] text-[var(--c-danger)]">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={loading}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </>
  )
}
