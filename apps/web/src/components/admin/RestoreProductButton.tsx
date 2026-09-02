'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { RotateCcw } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { revalidateAdminCache } from '@/lib/revalidate'
import { CACHE_TAGS } from '@/lib/cache-tags'

interface Props {
  id: string
  name: string
}

export function RestoreProductButton({ id, name }: Props) {
  const [loading, setLoading] = useState(false)
  const { data: session } = useSession()
  const router = useRouter()

  const handleRestore = async () => {
    setLoading(true)
    const res = await apiClient(session?.user?.accessToken).patch(`/admin/products/${id}/restore`, {})
    if (!res.ok) {
      alert(res.error ?? 'Error al restaurar el producto')
      setLoading(false)
      return
    }
    await revalidateAdminCache([CACHE_TAGS.products])
    router.refresh()
  }

  return (
    <button
      onClick={handleRestore}
      disabled={loading}
      aria-label={`Restaurar ${name}`}
      className="flex items-center gap-1.5 text-xs text-[var(--c-text-3)] hover:text-[var(--c-success)] disabled:opacity-50 transition-colors font-medium"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      {loading ? 'Restaurando...' : 'Restaurar'}
    </button>
  )
}
