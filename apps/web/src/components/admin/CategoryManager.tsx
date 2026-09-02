'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { z } from 'zod'
import { apiClient } from '@/lib/api-client'
import { revalidateAdminCache } from '@/lib/revalidate'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { AdminHelpButton } from './AdminHelpButton'
import { categoriasHelpContent } from './help-content/categorias'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataTableColumn } from './DataTable'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CategoryRow = {
  id: string
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  parentId: string | null
  parent: { id: string; name: string } | null
  _count: { products: number }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  slug: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(80, 'Máximo 80 caracteres')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo letras minúsculas, números y guiones'),
  description: z.string().max(500, 'Máximo 500 caracteres').optional(),
  imageUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  parentId: z.string().optional().or(z.literal('')),
})

type CategoryFormData = z.infer<typeof categorySchema>
type FormErrors = Partial<Record<keyof CategoryFormData, string>>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// ─── Category Form ────────────────────────────────────────────────────────────

interface CategoryFormProps {
  initial?: CategoryRow
  rootCategories: CategoryRow[]
  onSuccess: () => void
  onCancel: () => void
  token: string | undefined
}

function CategoryForm({ initial, rootCategories, onSuccess, onCancel, token }: CategoryFormProps) {
  const [form, setForm] = useState<CategoryFormData>({
    name: initial?.name ?? '',
    slug: initial?.slug ?? '',
    description: initial?.description ?? '',
    imageUrl: initial?.imageUrl ?? '',
    parentId: initial?.parentId ?? '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isEdit = !!initial

  function setField<K extends keyof CategoryFormData>(key: K, value: CategoryFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function handleNameChange(value: string) {
    setField('name', value)
    if (!isEdit) setField('slug', toSlug(value))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const parsed = categorySchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: FormErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof CategoryFormData
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description || null,
        imageUrl: parsed.data.imageUrl || null,
        parentId: parsed.data.parentId || null,
      }

      const client = apiClient(token)
      const res = isEdit
        ? await client.put<void>(`/admin/categories/${initial.id}`, payload)
        : await client.post<void>('/admin/categories', payload)

      if (!res.ok) {
        setServerError(res.error ?? 'Error inesperado')
        return
      }

      await revalidateAdminCache([CACHE_TAGS.categories, CACHE_TAGS.catalog])
      onSuccess()
    } catch {
      setServerError('Error de red. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError && (
        <div className="bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/30 text-[var(--c-danger)] text-[length:var(--text-body-sm)] px-4 py-3 rounded-[var(--radius-md)]">
          {serverError}
        </div>
      )}

      <Input
        label="Nombre *"
        type="text"
        value={form.name}
        onChange={(e) => handleNameChange(e.target.value)}
        placeholder="Ej: Sistema Eléctrico"
        error={errors.name}
      />

      <Input
        label="Slug *"
        type="text"
        value={form.slug}
        onChange={(e) => setField('slug', e.target.value)}
        placeholder="Ej: sistema-electrico"
        className="font-mono"
        error={errors.slug}
        hint={!errors.slug ? 'Se usa en la URL del catálogo' : undefined}
      />

      {/* Categoría padre */}
      <div className="flex flex-col gap-2">
        <label htmlFor="parentId" className="text-[length:var(--text-body-sm)] font-medium text-[var(--c-text-2)]">
          Categoría padre
        </label>
        <select
          id="parentId"
          value={form.parentId ?? ''}
          onChange={(e) => setField('parentId', e.target.value)}
          className="w-full h-11 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] px-4 text-[length:var(--text-body)] text-[var(--c-text)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
        >
          <option value="">— Sin padre (categoría raíz)</option>
          {rootCategories
            .filter((c) => c.id !== initial?.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>

      <Textarea
        label="Descripción"
        value={form.description ?? ''}
        onChange={(e) => setField('description', e.target.value)}
        placeholder="Descripción breve de la categoría..."
        rows={3}
        error={errors.description}
      />

      <Input
        label="URL de imagen"
        type="url"
        value={form.imageUrl ?? ''}
        onChange={(e) => setField('imageUrl', e.target.value)}
        placeholder="https://res.cloudinary.com/..."
        error={errors.imageUrl}
      />

      {/* Acciones */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading} className="flex-1">
          {isEdit ? 'Guardar cambios' : 'Crear categoría'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

// ─── Category Manager (main component) ───────────────────────────────────────

interface CategoryManagerProps {
  categories: CategoryRow[]
}

type ModalState =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; category: CategoryRow }

export function CategoryManager({ categories }: CategoryManagerProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const token = session?.user?.accessToken

  const [modal, setModal] = useState<ModalState>({ type: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const rootCategories = categories.filter((c) => c.parentId === null)

  function closeModal() { setModal({ type: 'closed' }) }

  function handleSuccess() {
    closeModal()
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await apiClient(token).delete<void>(`/admin/categories/${deleteTarget.id}`)
      if (!res.ok) {
        setDeleteError(res.error ?? 'Error al eliminar')
        return
      }
      await revalidateAdminCache([CACHE_TAGS.categories, CACHE_TAGS.catalog])
      setDeleteTarget(null)
      router.refresh()
    } catch {
      setDeleteError('Error de red')
    } finally {
      setDeleteLoading(false)
    }
  }

  const columns: DataTableColumn<CategoryRow>[] = [
    {
      key: 'name',
      header: 'Nombre',
      cell: (cat) => (
        <div className="flex items-center gap-2">
          {cat.parentId === null && (
            <span className="text-[10px] font-bold text-[var(--c-info)] bg-[var(--c-info-bg)] px-1.5 py-0.5 rounded uppercase tracking-wide">
              Raíz
            </span>
          )}
          <span className="font-medium text-[var(--c-text)]">{cat.name}</span>
        </div>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      hideBelowLg: true,
      cell: (cat) => <span className="font-mono text-xs text-[var(--c-text-4)]">{cat.slug}</span>,
    },
    {
      key: 'parent',
      header: 'Padre',
      hideBelowLg: true,
      cell: (cat) => cat.parent?.name ?? <span className="text-[var(--c-text-4)]">—</span>,
    },
    {
      key: 'products',
      header: 'Productos',
      align: 'center',
      cell: (cat) => (
        <span className={`font-bold ${cat._count.products > 0 ? 'text-[var(--c-text)]' : 'text-[var(--c-text-4)]'}`}>
          {cat._count.products}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (cat) => (
        <div className="flex items-center justify-end gap-3">
          <button onClick={() => setModal({ type: 'edit', category: cat })} className="text-[var(--c-accent-text)] hover:text-[var(--c-accent-text-hover)] text-xs font-medium transition-colors">
            Editar
          </button>
          <button onClick={() => { setDeleteTarget(cat); setDeleteError(null) }} className="text-[var(--c-text-4)] hover:text-[var(--c-danger)] text-xs font-medium transition-colors">
            Eliminar
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-text)] tracking-tight">Categorías</h1>
          <p className="text-[var(--c-text-3)] text-[length:var(--text-body-sm)] mt-0.5">{categories.length} categorías en total</p>
        </div>
        <div className="flex items-center gap-2">
          <AdminHelpButton content={categoriasHelpContent} />
          <Button onClick={() => setModal({ type: 'create' })}>+ Nueva categoría</Button>
        </div>
      </div>

      {/* Tabla */}
      <DataTable columns={columns} rows={categories} rowKey={(c) => c.id} emptyMessage="No hay categorías. Crea la primera." />

      {/* Modal crear/editar */}
      <Modal
        open={modal.type !== 'closed'}
        onClose={closeModal}
        title={modal.type === 'edit' ? `Editar: ${modal.category.name}` : 'Nueva categoría'}
      >
        {modal.type !== 'closed' && (
          <CategoryForm
            initial={modal.type === 'edit' ? modal.category : undefined}
            rootCategories={rootCategories}
            onSuccess={handleSuccess}
            onCancel={closeModal}
            token={token}
          />
        )}
      </Modal>

      {/* Modal confirmación de borrado */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar categoría">
        <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-2)]">
          ¿Seguro que quieres eliminar <span className="font-semibold text-[var(--c-text)]">{deleteTarget?.name}</span>?
          {deleteTarget && deleteTarget._count.products > 0 && (
            <> Tiene {deleteTarget._count.products} producto{deleteTarget._count.products === 1 ? '' : 's'} asociado{deleteTarget._count.products === 1 ? '' : 's'}.</>
          )}
        </p>
        {deleteError && <p className="mt-3 text-[length:var(--text-body-sm)] text-[var(--c-danger)]">{deleteError}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleteLoading}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </>
  )
}
