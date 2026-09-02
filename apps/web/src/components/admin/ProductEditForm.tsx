'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Product } from '@motek/domain'
import { X, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { revalidateAdminCache } from '@/lib/revalidate'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface Category {
  id: string
  name: string
  slug: string
}

interface Benefit {
  body: string
  order: number
}

interface CompatibilityEntry {
  brand: string
  model: string
  year: string
}

interface ProductEditFormProps {
  product?: Product
  categories: Category[]
  initialBenefits?: Benefit[]
  initialCompatibility?: CompatibilityEntry[]
}

const SELECT_CLASS =
  'w-full h-11 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] px-4 text-[length:var(--text-body)] text-[var(--c-text)] focus:outline-none focus:border-[var(--c-accent)] transition-colors'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ''

function toImageUrl(publicIdOrUrl: string): string {
  if (publicIdOrUrl.startsWith('http')) return publicIdOrUrl
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${publicIdOrUrl}`
}

export function ProductEditForm({ product, categories, initialBenefits = [], initialCompatibility = [] }: ProductEditFormProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<string[]>(
    (product?.images ?? []).filter((url) => typeof url === 'string' && url.trim().length > 0),
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [benefits, setBenefits] = useState<Benefit[]>(initialBenefits)
  const [compatibility, setCompatibility] = useState<CompatibilityEntry[]>(initialCompatibility)

  const [form, setForm] = useState({
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    description: product?.description ?? '',
    price: product ? String(product.price / 100) : '',
    stock: product ? String(product.stock) : '0',
    sku: product?.sku ?? '',
    categoryId: product?.categoryId ?? (categories[0]?.id ?? ''),
    isActive: product?.isActive ?? true,
    weightKg: product?.weightKg != null ? String(product.weightKg) : '',
    heightCm: product?.heightCm != null ? String(product.heightCm) : '',
    widthCm: product?.widthCm != null ? String(product.widthCm) : '',
    lengthCm: product?.lengthCm != null ? String(product.lengthCm) : '',
  })

  // ── Información adicional (antes "Beneficios") ──────────────────────────────

  const addBenefit = () => {
    if (benefits.length >= 10) return
    setBenefits((prev) => [...prev, { body: '', order: prev.length }])
  }

  const removeBenefit = (index: number) => {
    setBenefits((prev) =>
      prev.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i })),
    )
  }

  const updateBenefit = (index: number, value: string) => {
    setBenefits((prev) =>
      prev.map((b, i) => (i === index ? { ...b, body: value } : b)),
    )
  }

  // ── Compatibilidad ───────────────────────────────────────────────────────

  const addCompatibility = () => {
    if (compatibility.length >= 30) return
    setCompatibility((prev) => [...prev, { brand: '', model: '', year: '' }])
  }

  const removeCompatibility = (index: number) => {
    setCompatibility((prev) => prev.filter((_, i) => i !== index))
  }

  const updateCompatibility = (index: number, field: keyof CompatibilityEntry, value: string) => {
    setCompatibility((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    )
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!product) return
    setDeleting(true)
    setError(null)
    const res = await apiClient(session?.user?.accessToken).delete(`/admin/products/${product.id}`)
    if (!res.ok) {
      setError(res.error ?? 'Error al eliminar el producto')
      setDeleting(false)
      setConfirmDelete(false)
      return
    }
    await revalidateAdminCache([CACHE_TAGS.products, CACHE_TAGS.motorcycles])
    router.push('/admin/productos')
    router.refresh()
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      ...form,
      price: Math.round(parseFloat(form.price) * 100),
      stock: parseInt(form.stock, 10),
      images,
      weightKg: form.weightKg.trim() ? parseFloat(form.weightKg) : undefined,
      heightCm: form.heightCm.trim() ? parseInt(form.heightCm, 10) : undefined,
      widthCm: form.widthCm.trim() ? parseInt(form.widthCm, 10) : undefined,
      lengthCm: form.lengthCm.trim() ? parseInt(form.lengthCm, 10) : undefined,
      compatible: compatibility
        .filter((c) => c.brand.trim() && c.model.trim())
        .map((c) => ({
          brand: c.brand.trim(),
          model: c.model.trim(),
          year: c.year.trim() ? parseInt(c.year, 10) : undefined,
        })),
    }

    const client = apiClient(session?.user?.accessToken)

    try {
      let productId = product?.id

      if (product) {
        const res = await client.put<void>(`/admin/products/${product.id}`, payload)
        if (!res.ok) throw new Error(res.error ?? 'Error al guardar el producto')
      } else {
        const res = await client.post<{ id: string }>('/admin/products', payload)
        if (!res.ok) throw new Error(res.error ?? 'Error al guardar el producto')
        productId = res.data.id
      }

      // Guardar beneficios junto con el producto (lista puede ser vacía para limpiar).
      // La compatibilidad (marca/modelo/año) va en el payload del producto — ver arriba.
      if (productId) {
        await client.put(`/admin/products/${productId}/description`, {
          benefits: benefits
            .filter((b) => b.body.trim())
            .map((b, i) => ({ body: b.body.trim(), order: i })),
          compatibility: [],
        })
      }

      await revalidateAdminCache([CACHE_TAGS.products, CACHE_TAGS.motorcycles])
      router.push('/admin/productos')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim()

  // ── Imágenes ──────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0 || uploading) return

    const remaining = 4 - images.length
    if (remaining <= 0) return
    const filesToUpload = files.slice(0, remaining)

    setUploading(true)
    setUploadError(null)

    const uploadedUrls: string[] = []
    for (const file of filesToUpload) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sku', form.sku || 'producto')

      try {
        const res = await apiClient(session?.user?.accessToken).postForm<{ url: string }>(
          '/admin/products/upload-image',
          formData,
        )
        if (!res.ok) throw new Error(res.error ?? 'Error al subir la imagen')
        uploadedUrls.push(res.data.url)
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : 'Error al subir imagen')
      }
    }

    if (uploadedUrls.length > 0) {
      setImages((prev) => [...prev, ...uploadedUrls])
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (url: string) => {
    setImages((prev) => prev.filter((u) => u !== url))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">

      {/* ── Información general ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[11px] tracking-[0.18em] uppercase text-[var(--c-text-3)]">
            Información general
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">

          <Input
            label="Nombre *"
            required
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value, slug: generateSlug(e.target.value) })}
          />

          <Input
            label="Slug (URL)"
            type="text"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="font-mono"
          />

          <Textarea
            label="Descripción *"
            required
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          {/* ── Información adicional — inline, justo debajo de Descripción ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[length:var(--text-body-sm)] font-medium text-[var(--c-text-2)]">
                Información Adicional
                {benefits.length > 0 && (
                  <span className="ml-1.5 text-[var(--c-text-4)] font-normal text-xs">({benefits.length}/10)</span>
                )}
              </label>
              <button
                type="button"
                onClick={addBenefit}
                disabled={benefits.length >= 10}
                className="flex items-center gap-1 text-xs text-[var(--c-accent-text)] hover:text-[var(--c-accent-text-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar ítem
              </button>
            </div>

            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs text-[var(--c-text-4)] w-4 text-right shrink-0">{index + 1}.</span>
                <input
                  type="text"
                  value={benefit.body}
                  onChange={(e) => updateBenefit(index, e.target.value)}
                  placeholder={`Ítem ${index + 1} — ej: Alta durabilidad y resistencia`}
                  maxLength={200}
                  aria-label={`Información adicional ${index + 1}`}
                  className="flex-1 h-10 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] px-3 text-[length:var(--text-body-sm)] text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => removeBenefit(index)}
                  aria-label="Eliminar beneficio"
                  className="text-[var(--c-text-4)] hover:text-[var(--c-danger)] transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* ── Compatibilidad — motos compatibles, texto libre, mismo patrón que Beneficios ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[length:var(--text-body-sm)] font-medium text-[var(--c-text-2)]">
                Compatibilidad
                {compatibility.length > 0 && (
                  <span className="ml-1.5 text-[var(--c-text-4)] font-normal text-xs">({compatibility.length}/30)</span>
                )}
              </label>
              <button
                type="button"
                onClick={addCompatibility}
                disabled={compatibility.length >= 30}
                className="flex items-center gap-1 text-xs text-[var(--c-accent-text)] hover:text-[var(--c-accent-text-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar moto compatible
              </button>
            </div>

            {compatibility.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs text-[var(--c-text-4)] w-4 text-right shrink-0">{index + 1}.</span>
                <input
                  type="text"
                  value={entry.brand}
                  onChange={(e) => updateCompatibility(index, 'brand', e.target.value)}
                  placeholder="Marca — ej: Honda"
                  maxLength={60}
                  aria-label={`Marca de moto compatible ${index + 1}`}
                  className="w-28 h-10 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] px-3 text-[length:var(--text-body-sm)] text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                />
                <input
                  type="text"
                  value={entry.model}
                  onChange={(e) => updateCompatibility(index, 'model', e.target.value)}
                  placeholder="Modelo — ej: CB160F"
                  maxLength={60}
                  aria-label={`Modelo de moto compatible ${index + 1}`}
                  className="flex-1 h-10 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] px-3 text-[length:var(--text-body-sm)] text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                />
                <input
                  type="number"
                  value={entry.year}
                  onChange={(e) => updateCompatibility(index, 'year', e.target.value)}
                  placeholder="Año"
                  min={1980}
                  max={2100}
                  aria-label={`Año de moto compatible ${index + 1} (vacío = todos los años)`}
                  className="w-20 h-10 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] px-3 text-[length:var(--text-body-sm)] text-[var(--c-text)] placeholder:text-[var(--c-text-4)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => removeCompatibility(index)}
                  aria-label="Eliminar moto compatible"
                  className="text-[var(--c-text-4)] hover:text-[var(--c-danger)] transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {compatibility.length === 0 && (
              <p className="text-xs text-[var(--c-text-4)]">Sin motos compatibles cargadas. El año puede dejarse vacío si aplica a todos los años del modelo.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Precio (COP) *"
              required
              type="number"
              min="0"
              step="100"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="85000"
              hint="En pesos (sin centavos)"
            />
            <Input
              label="Stock"
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="SKU *"
              required
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="FRE-BRE-FZ25-001"
              className="font-mono"
            />
            <div className="flex flex-col gap-2">
              <label htmlFor="categoryId" className="text-[length:var(--text-body-sm)] font-medium text-[var(--c-text-2)]">
                Categoría *
              </label>
              <select
                id="categoryId"
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className={SELECT_CLASS}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 accent-[var(--c-accent)]"
            />
            <label htmlFor="isActive" className="text-[length:var(--text-body-sm)] font-medium text-[var(--c-text-2)]">
              Producto activo (visible en el catálogo)
            </label>
          </div>
        </CardBody>
      </Card>

      {/* ── Envío (Vendelo) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[11px] tracking-[0.18em] uppercase text-[var(--c-text-3)]">
            Envío
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-xs text-[var(--c-text-4)]">
            Peso y dimensiones reales embalados. Si se dejan vacíos, la cotización de envío
            usa un valor por defecto genérico que puede no coincidir con el flete real cobrado.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Peso (kg)"
              type="number"
              min="0"
              step="0.01"
              value={form.weightKg}
              onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
              placeholder="0.5"
            />
            <Input
              label="Alto (cm)"
              type="number"
              min="0"
              step="1"
              value={form.heightCm}
              onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
              placeholder="10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ancho (cm)"
              type="number"
              min="0"
              step="1"
              value={form.widthCm}
              onChange={(e) => setForm({ ...form, widthCm: e.target.value })}
              placeholder="10"
            />
            <Input
              label="Largo (cm)"
              type="number"
              min="0"
              step="1"
              value={form.lengthCm}
              onChange={(e) => setForm({ ...form, lengthCm: e.target.value })}
              placeholder="10"
            />
          </div>
        </CardBody>
      </Card>

      {/* ── Imágenes ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[11px] tracking-[0.18em] uppercase text-[var(--c-text-3)]">
            Imágenes del producto
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 min-h-[140px]">
            {images.map((url) => (
              <div key={url} className="relative group aspect-square rounded-[var(--radius-md)] overflow-hidden bg-[var(--c-surface-2)] border border-[var(--c-border)]">
                <img
                  src={toImageUrl(url)}
                  alt="Imagen del producto"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-[var(--c-danger)] text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all"
                  aria-label="Eliminar imagen"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {Array.from({ length: 4 - images.length }).map((_, i) => (
              <div key={`placeholder-${i}`} className="aspect-square rounded-[var(--radius-md)] border-2 border-dashed border-[var(--c-border)] bg-[var(--c-surface-2)]" />
            ))}
          </div>

          <div className="relative">
            <label
              htmlFor="image-upload"
              className={`flex flex-col items-center justify-center gap-2 w-full h-28 rounded-[var(--radius-lg)] border-2 border-dashed transition-colors
                ${uploading
                  ? 'border-[var(--c-accent)]/50 bg-[var(--c-active-bg)]'
                  : 'border-[var(--c-border)] hover:border-[var(--c-accent)]/50 hover:bg-[var(--c-active-bg)]'
                }`}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-6 h-6 text-[var(--c-accent-text)] animate-spin" />
                  <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)]">Subiendo...</span>
                </>
              ) : (
                <>
                  <ImagePlus className="w-6 h-6 text-[var(--c-text-4)]" />
                  <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)]">Haz clic para subir imágenes — máximo 4</span>
                  <span className="text-xs text-[var(--c-text-4)]">PNG, JPG, WEBP · Máx. 10 MB</span>
                </>
              )}
            </label>
            {/* Cubre todo el dropzone (en vez de sr-only 1x1px) para que el navegador nunca necesite
                hacer scroll-into-view al enfocar el input oculto y abrir el selector nativo de archivos. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              id="image-upload"
              aria-label="Subir imágenes del producto — máximo 4"
              disabled={uploading}
            />
          </div>

          {uploadError && <p className="text-[length:var(--text-body-sm)] text-[var(--c-danger)]">{uploadError}</p>}
        </CardBody>
      </Card>

      {error && (
        <div className="bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/30 text-[var(--c-danger)] text-[length:var(--text-body-sm)] rounded-[var(--radius-md)] px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" loading={loading} disabled={uploading}>
          {product ? 'Guardar cambios' : 'Crear producto'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>

      {/* ── Zona de peligro (solo en edición) ── */}
      {product && (
        <div className="border border-[var(--c-danger)]/20 rounded-[var(--radius-lg)] p-5 space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--c-danger)]/70 uppercase">
            Zona de peligro
          </p>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 text-[length:var(--text-body-sm)] text-[var(--c-danger)]/80 hover:text-[var(--c-danger)] transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar producto
          </button>

          <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Eliminar producto">
            <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-2)]">
              ¿Eliminar <span className="text-[var(--c-text)] font-medium">{product.name}</span> permanentemente? Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancelar
              </Button>
              <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
                Sí, eliminar
              </Button>
            </div>
          </Modal>
        </div>
      )}
    </form>
  )
}
