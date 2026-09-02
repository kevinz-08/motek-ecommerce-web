'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Pencil, Trash2, ChevronDown } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export interface CouponRow {
  id: string
  code: string
  type: 'PERCENTAGE' | 'FIXED'
  value: number
  restriction: 'NONE' | 'ONCE_PER_CUSTOMER' | 'FIRST_PURCHASE'
  isActive: boolean
  expiresAt: string
  createdAt: string
  categoryId: string | null
  productId: string | null
}

export interface CategoryOption {
  id: string
  name: string
  parentId: string | null
}

export interface ProductOption {
  id: string
  name: string
}

interface CouponManagerProps {
  initialCoupons: CouponRow[]
  categories: CategoryOption[]
  products: ProductOption[]
}

const DURATION_PRESETS = [
  { label: '30 días', days: 30 },
  { label: '60 días', days: 60 },
  { label: '90 días', days: 90 },
]

const SELECT_CLASS =
  'w-full h-11 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] px-4 text-[length:var(--text-body)] text-[var(--c-text)] focus:outline-none focus:border-[var(--c-accent)] transition-colors'

const LABEL_CLASS = 'block text-xs font-semibold text-[var(--c-text-3)] uppercase tracking-widest mb-1.5'

function formatCOP(cents: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0] as string
}

type Scope = 'category' | 'product'

interface FormState {
  code: string
  type: 'PERCENTAGE' | 'FIXED'
  value: string
  restriction: 'NONE' | 'ONCE_PER_CUSTOMER' | 'FIRST_PURCHASE'
  expiresAt: string
  scope: Scope
  categoryId: string
  productId: string
}

const EMPTY_FORM: FormState = {
  code: '',
  type: 'PERCENTAGE',
  value: '',
  restriction: 'NONE',
  expiresAt: addDays(30),
  scope: 'category',
  categoryId: '',
  productId: '',
}

// ─── CouponManager ────────────────────────────────────────────────────────────

type StatusFilter = 'active' | 'inactive' | 'all'
type DateFilter = 'all' | '1m' | '2m'

export function CouponManager({ initialCoupons, categories, products }: CouponManagerProps) {
  const { data: session } = useSession()
  const [coupons, setCoupons] = useState<CouponRow[]>(initialCoupons)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CouponRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const client = apiClient(session?.user?.accessToken)

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowForm(true)
  }

  function openEdit(c: CouponRow) {
    setEditingId(c.id)
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value / 100),
      restriction: c.restriction,
      expiresAt: c.expiresAt.split('T')[0] as string,
      scope: c.productId ? 'product' : 'category',
      categoryId: c.categoryId ?? '',
      productId: c.productId ?? '',
    })
    setError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const rawValue = parseFloat(form.value)
    if (isNaN(rawValue) || rawValue <= 0) {
      setError('El valor debe ser mayor a 0')
      setLoading(false)
      return
    }
    const valueInCents = Math.round(rawValue * 100)

    const payload = {
      code: form.code.toUpperCase().trim(),
      type: form.type,
      value: valueInCents,
      restriction: form.restriction,
      expiresAt: new Date(form.expiresAt + 'T23:59:59').toISOString(),
      categoryId: form.scope === 'category' && form.categoryId ? form.categoryId : null,
      productId: form.scope === 'product' && form.productId ? form.productId : null,
    }

    if (!payload.categoryId && !payload.productId) {
      setError('Debes seleccionar una categoría o un producto')
      setLoading(false)
      return
    }

    try {
      if (editingId) {
        const res = await client.patch<CouponRow>(`/coupons/${editingId}`, payload)
        if (!res.ok) throw new Error(res.error ?? 'Error al actualizar')
        setCoupons((prev) => prev.map((c) => (c.id === editingId ? res.data : c)))
      } else {
        const res = await client.post<CouponRow>('/coupons', payload)
        if (!res.ok) throw new Error(res.error ?? 'Error al crear')
        setCoupons((prev) => [res.data, ...prev])
      }
      closeForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await client.delete<{ success: boolean }>(`/coupons/${deleteTarget.id}`)
      if (!res.ok) throw new Error(res.error ?? 'Error al desactivar')
      setCoupons((prev) => prev.map((c) => (c.id === deleteTarget.id ? { ...c, isActive: false } : c)))
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setDeleteLoading(false)
    }
  }

  const parentCategories = categories.filter((c) => c.parentId === null)
  const childCategories = categories.filter((c) => c.parentId !== null)

  const PAGE_SIZE = 20
  const now = new Date()
  const ago1m = new Date(now); ago1m.setMonth(ago1m.getMonth() - 1)
  const ago2m = new Date(now); ago2m.setMonth(ago2m.getMonth() - 2)

  const activeCount = coupons.filter((c) => c.isActive && new Date(c.expiresAt) >= now).length

  const filteredCoupons = coupons.filter((c) => {
    const expired = new Date(c.expiresAt) < now
    const isEffective = c.isActive && !expired

    if (statusFilter === 'active' && !isEffective) return false
    if (statusFilter === 'inactive' && isEffective) return false

    const created = new Date(c.createdAt ?? 0)
    if (dateFilter === '1m' && created < ago1m) return false
    if (dateFilter === '2m' && created < ago2m) return false

    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredCoupons.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visibleCoupons = filteredCoupons.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-text)] tracking-tight">Cupones</h1>
          <p className="text-[var(--c-text-3)] text-[length:var(--text-body-sm)] mt-0.5">
            {coupons.length} cupón{coupons.length !== 1 && 'es'} · {activeCount} activo{activeCount !== 1 && 's'}
          </p>
        </div>
        <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Nuevo cupón
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Filtro por estado */}
        <div className="flex gap-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] p-1">
          {([
            { key: 'active',   label: `Activos (${activeCount})` },
            { key: 'inactive', label: `Inactivos (${coupons.length - activeCount})` },
            { key: 'all',      label: `Todos (${coupons.length})` },
          ] as { key: StatusFilter; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setStatusFilter(key); setPage(1) }}
              className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-[length:var(--text-body-sm)] font-semibold transition-colors ${
                statusFilter === key ? 'bg-[var(--c-surface-hover)] text-[var(--c-text)]' : 'text-[var(--c-text-3)] hover:text-[var(--c-text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filtro por fecha */}
        <div className="relative">
          <select
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value as DateFilter); setPage(1) }}
            aria-label="Filtrar por fecha de creación"
            className="appearance-none bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] pl-3 pr-8 py-1.5 text-[length:var(--text-body-sm)] text-[var(--c-text-2)] focus:outline-none focus:border-[var(--c-accent)] transition-colors cursor-pointer"
          >
            <option value="all">Cualquier fecha</option>
            <option value="1m">Último mes</option>
            <option value="2m">Últimos 2 meses</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--c-text-4)] pointer-events-none" />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-lg)] overflow-x-auto">
        {/* Encabezado */}
        <div className="grid grid-cols-[1fr_auto_1fr_1fr_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-[var(--c-border)] min-w-[720px]">
          {(['CÓDIGO', 'DESCUENTO', 'ALCANCE', 'RESTRICCIÓN', 'VENCE', 'ESTADO', '']).map((h) => (
            <span key={h} className="text-[11px] font-semibold text-[var(--c-text-4)] uppercase tracking-widest">{h}</span>
          ))}
        </div>

        {visibleCoupons.length === 0 && (
          <div className="text-center py-12 text-[var(--c-text-4)]">
            {filteredCoupons.length === 0 && coupons.length > 0
              ? 'Ningún cupón coincide con los filtros.'
              : coupons.length === 0
                ? 'No hay cupones. Crea el primero con el botón de arriba.'
                : 'No hay cupones activos.'}
          </div>
        )}

        {visibleCoupons.map((c) => {
          const expired = new Date(c.expiresAt) < new Date()
          const isEffectivelyActive = c.isActive && !expired
          const scopeLabel = c.productId
            ? `Producto: ${products.find((p) => p.id === c.productId)?.name ?? c.productId}`
            : c.categoryId
              ? `Cat: ${categories.find((cat) => cat.id === c.categoryId)?.name ?? c.categoryId}`
              : '—'

          return (
            <div
              key={c.id}
              className={`grid grid-cols-[1fr_auto_1fr_1fr_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-[var(--c-divider)] last:border-0 hover:bg-[var(--c-surface-hover)] transition-colors min-w-[720px] ${!c.isActive ? 'opacity-50' : ''}`}
            >
              {/* Código */}
              <span className="font-mono text-[length:var(--text-body-sm)] font-semibold text-[var(--c-text)]">{c.code}</span>

              {/* Descuento */}
              <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-2)] whitespace-nowrap">
                {c.type === 'PERCENTAGE' ? `${c.value / 100}%` : formatCOP(c.value)}
              </span>

              {/* Alcance */}
              <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)] truncate" title={scopeLabel}>{scopeLabel}</span>

              {/* Restricción */}
              <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)]">
                {c.restriction === 'NONE'
                  ? 'Sin límite'
                  : c.restriction === 'ONCE_PER_CUSTOMER'
                    ? '1 por cliente'
                    : 'Primera compra'}
              </span>

              {/* Vence */}
              <span className={`text-[length:var(--text-body-sm)] whitespace-nowrap ${expired ? 'text-[var(--c-danger)]' : 'text-[var(--c-text-3)]'}`}>
                {formatDate(c.expiresAt)}
              </span>

              {/* Estado */}
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                  isEffectivelyActive
                    ? 'bg-[var(--c-success-bg)] text-[var(--c-success)]'
                    : expired
                      ? 'bg-[var(--c-warning-bg)] text-[var(--c-warning)]'
                      : 'bg-[var(--c-surface-2)] text-[var(--c-text-4)]'
                }`}
              >
                {isEffectivelyActive ? 'Activo' : expired ? 'Vencido' : 'Inactivo'}
              </span>

              {/* Acciones */}
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => openEdit(c)}
                  className="text-[var(--c-accent-text)] hover:text-[var(--c-accent-text-hover)] transition-colors"
                  aria-label="Editar cupón"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {c.isActive && (
                  <button
                    onClick={() => { setDeleteTarget(c); setDeleteError(null) }}
                    className="text-[var(--c-text-4)] hover:text-[var(--c-danger)] transition-colors"
                    aria-label="Desactivar cupón"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <nav aria-label="Paginación de cupones" className="flex items-center justify-between mt-4">
          <span className="text-xs text-[var(--c-text-4)]">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredCoupons.length)} de {filteredCoupons.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 rounded-[var(--radius-md)] text-[length:var(--text-body-sm)] text-[var(--c-text-3)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                aria-current={n === safePage ? 'page' : undefined}
                className={`w-8 h-8 rounded-[var(--radius-md)] text-[length:var(--text-body-sm)] font-semibold transition-colors ${
                  n === safePage ? 'bg-[var(--c-surface-hover)] text-[var(--c-text)]' : 'text-[var(--c-text-3)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-hover)]'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 rounded-[var(--radius-md)] text-[length:var(--text-body-sm)] text-[var(--c-text-3)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </nav>
      )}

      {/* Modal crear / editar */}
      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Editar cupón' : 'Nuevo cupón'}>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error && (
            <div className="bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/30 text-[var(--c-danger)] text-[length:var(--text-body-sm)] px-4 py-3 rounded-[var(--radius-md)]">
              {error}
            </div>
          )}

          <Input
            label="Código *"
            required
            type="text"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            className="font-mono uppercase"
            placeholder="HALLOWEEN20"
          />

          {/* Tipo + Valor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Tipo *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'PERCENTAGE' | 'FIXED' })}
                className={SELECT_CLASS}
              >
                <option value="PERCENTAGE">Porcentaje (%)</option>
                <option value="FIXED">Monto fijo (COP)</option>
              </select>
            </div>
            <Input
              label={`Valor * ${form.type === 'PERCENTAGE' ? '(%)' : '(COP)'}`}
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder={form.type === 'PERCENTAGE' ? '20' : '50000'}
            />
          </div>

          {/* Restricción */}
          <div>
            <label className={LABEL_CLASS}>Restricción</label>
            <select
              value={form.restriction}
              onChange={(e) => setForm({ ...form, restriction: e.target.value as FormState['restriction'] })}
              className={SELECT_CLASS}
            >
              <option value="NONE">Sin límite por cliente</option>
              <option value="ONCE_PER_CUSTOMER">Una vez por cliente</option>
              <option value="FIRST_PURCHASE">Solo primera compra</option>
            </select>
          </div>

          {/* Vencimiento */}
          <div>
            <label className={LABEL_CLASS}>Fecha de vencimiento *</label>
            <div className="flex gap-2 mb-2">
              {DURATION_PRESETS.map(({ label, days }) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, expiresAt: addDays(days) }))}
                  className="text-xs px-3 py-1.5 border border-[var(--c-border)] rounded-[var(--radius-md)] text-[var(--c-text-3)] hover:text-[var(--c-text)] hover:border-[var(--c-accent)]/50 hover:bg-[var(--c-active-bg)] transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              required
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              aria-label="Fecha de vencimiento"
              className="w-full h-11 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] px-4 text-[length:var(--text-body)] text-[var(--c-text)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Alcance */}
          <div>
            <label className={LABEL_CLASS}>Alcance *</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-[length:var(--text-body-sm)] text-[var(--c-text-2)] hover:text-[var(--c-text)] transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="category"
                  checked={form.scope === 'category'}
                  onChange={() => setForm({ ...form, scope: 'category', productId: '' })}
                  className="accent-[var(--c-accent)]"
                />
                Categoría / Subcategoría
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[length:var(--text-body-sm)] text-[var(--c-text-2)] hover:text-[var(--c-text)] transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="product"
                  checked={form.scope === 'product'}
                  onChange={() => setForm({ ...form, scope: 'product', categoryId: '' })}
                  className="accent-[var(--c-accent)]"
                />
                Producto específico
              </label>
            </div>

            {form.scope === 'category' && (
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className={SELECT_CLASS}
                required
              >
                <option value="">— Selecciona categoría —</option>
                {parentCategories.map((c) => (
                  <optgroup key={c.id} label={c.name}>
                    <option value={c.id}>{c.name} (aplica a toda la categoría)</option>
                    {childCategories
                      .filter((s) => s.parentId === c.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>&nbsp;&nbsp;{s.name}</option>
                      ))}
                  </optgroup>
                ))}
              </select>
            )}

            {form.scope === 'product' && (
              <select
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                className={SELECT_CLASS}
                required
              >
                <option value="">— Selecciona producto —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}

            {form.scope === 'category' && form.categoryId && parentCategories.some((c) => c.id === form.categoryId) && (
              <p className="mt-2 text-xs text-[var(--c-info)] bg-[var(--c-info-bg)] border border-[var(--c-info)]/20 px-3 py-2 rounded-[var(--radius-md)]">
                El descuento aplicará en cascada a todas las subcategorías de esta categoría.
              </p>
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loading} className="flex-1">
              {editingId ? 'Guardar cambios' : 'Crear cupón'}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm} disabled={loading}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal confirmación de desactivación */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Desactivar cupón">
        <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-2)]">
          ¿Desactivar el cupón <span className="font-semibold text-[var(--c-text)]">{deleteTarget?.code}</span>? Dejará de aplicarse en el checkout.
        </p>
        {deleteError && <p className="mt-3 text-[length:var(--text-body-sm)] text-[var(--c-danger)]">{deleteError}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleteLoading}>
            Desactivar
          </Button>
        </div>
      </Modal>
    </>
  )
}
