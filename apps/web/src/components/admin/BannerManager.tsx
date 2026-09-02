'use client'

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { z } from 'zod'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { revalidateAdminCache } from '@/lib/revalidate'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { WHATSAPP_URL } from '@/lib/contact'
import { AdminHelpButton } from './AdminHelpButton'
import { bannersHelpContent } from './help-content/banners'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BannerRow = {
  id: string
  imageUrl: string
  imagePublicId: string
  /** Recurso optimizado para mobile — opcional, cae a imageUrl si es null. */
  imageUrlMobile: string | null
  imagePublicIdMobile: string | null
  title: string
  description: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  order: number
  isActive: boolean
}

/** Categoría o subcategoría disponible para el destino "Categoría" del botón. */
export type CategoryOption = {
  slug: string
  name: string
  isChild: boolean
}

// ─── Destino del botón ────────────────────────────────────────────────────────
//
// El admin no maneja URLs — elige de una lista de destinos conocidos y, si
// aplica, la categoría específica. La URL real (ctaUrl) se arma a partir de
// esa elección y solo se expone como texto libre en el destino "avanzado".

type DestinationType = 'ninguno' | 'catalogo' | 'categoria' | 'whatsapp' | 'custom'

const DESTINATION_LABELS: Record<DestinationType, string> = {
  ninguno: 'No clickeable (solo imagen)',
  catalogo: 'Catálogo completo',
  categoria: 'Una categoría o subcategoría',
  whatsapp: 'WhatsApp (contacto)',
  custom: 'Otro enlace (avanzado)',
}

/** Reconstruye la selección de destino a partir de un ctaUrl ya guardado (modo edición). */
function inferDestination(ctaUrl: string | null | undefined): { type: DestinationType; categorySlug: string; customUrl: string } {
  if (!ctaUrl) return { type: 'ninguno', categorySlug: '', customUrl: '' }
  if (ctaUrl === '/catalogo') return { type: 'catalogo', categorySlug: '', customUrl: '' }
  const categoryMatch = ctaUrl.match(/^\/catalogo\?category=([a-z0-9-]+)$/)
  if (categoryMatch) return { type: 'categoria', categorySlug: categoryMatch[1]!, customUrl: '' }
  if (ctaUrl.startsWith('https://wa.me/')) return { type: 'whatsapp', categorySlug: '', customUrl: '' }
  return { type: 'custom', categorySlug: '', customUrl: ctaUrl }
}

function buildCtaUrl(type: DestinationType, categorySlug: string, customUrl: string): string {
  switch (type) {
    case 'ninguno': return ''
    case 'catalogo': return '/catalogo'
    case 'categoria': return categorySlug ? `/catalogo?category=${categorySlug}` : ''
    case 'whatsapp': return WHATSAPP_URL()
    case 'custom': return customUrl
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const bannerSchema = z.object({
  title: z.string().min(1, 'Requerido').max(80, 'Máximo 80 caracteres'),
})

const customUrlSchema = z
  .string()
  .min(1, 'Escribe la URL de destino')
  .regex(/^(\/|https?:\/\/)/, 'Debe ser una ruta relativa ("/promo") o una URL completa ("https://...")')

type BannerFormData = z.infer<typeof bannerSchema>
type FormErrors = Partial<Record<keyof BannerFormData, string>> & { categorySlug?: string; customUrl?: string }

// ─── Banner Form ──────────────────────────────────────────────────────────────

interface BannerFormProps {
  initial?: BannerRow
  nextOrder: number
  categories: CategoryOption[]
  onSuccess: () => void
  onCancel: () => void
  token: string | undefined
}

/** Métodos que el padre (BannerManager) puede invocar sobre el form vía ref. */
export interface BannerFormHandle {
  /** Borra en Cloudinary la imagen subida en esta sesión si nunca se guardó (banner no creado/editado con éxito). */
  cleanupUnsavedImage: () => void
}

/**
 * Borra en Cloudinary una imagen que se subió pero nunca quedó asociada a un
 * banner guardado (reemplazo cancelado, imagen quitada antes de guardar, o
 * el formulario se cerró sin confirmar — incluye cerrar con Escape, click
 * fuera del modal o el botón ✕, no solo "Cancelar"). No bloquea la UI ni
 * reporta errores al admin — si falla, el asset huérfano queda igual que
 * antes de este fix.
 */
function deleteUnsavedImage(token: string | undefined, publicId: string) {
  apiClient(token).post('/admin/banners/image/delete', { publicId }).catch(() => {})
}

const SELECT_CLASS =
  'w-full h-11 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] px-4 text-[length:var(--text-body)] text-[var(--c-text)] focus:outline-none focus:border-[var(--c-accent)] transition-colors'

const BannerForm = forwardRef<BannerFormHandle, BannerFormProps>(function BannerForm(
  { initial, nextOrder, categories, onSuccess, onCancel, token },
  ref,
) {
  const isEdit = !!initial
  const initialDestination = inferDestination(initial?.ctaUrl)
  // PublicId de la imagen realmente guardada en el banner (si existe) — sirve para saber,
  // en cualquier punto del formulario, si la imagen actual en pantalla ya está persistida
  // o es un upload de esta sesión que todavía no se confirmó con "Guardar".
  const savedPublicId = initial?.imagePublicId
  const savedPublicIdMobile = initial?.imagePublicIdMobile ?? undefined
  // true una vez que el submit se confirma con éxito — evita que el cleanup-al-cerrar
  // borre por error la imagen recién guardada cuando el modal se cierra después de guardar.
  const savedRef = useRef(false)

  const [form, setForm] = useState<BannerFormData>({
    title: initial?.title ?? '',
  })
  const [destination, setDestination] = useState<DestinationType>(initialDestination.type)
  const [categorySlug, setCategorySlug] = useState(initialDestination.categorySlug)
  const [customUrl, setCustomUrl] = useState(initialDestination.customUrl)
  const [image, setImage] = useState<{ url: string; publicId: string } | null>(
    initial ? { url: initial.imageUrl, publicId: initial.imagePublicId } : null,
  )
  const [imageMobile, setImageMobile] = useState<{ url: string; publicId: string } | null>(
    initial?.imageUrlMobile && initial?.imagePublicIdMobile
      ? { url: initial.imageUrlMobile, publicId: initial.imagePublicIdMobile }
      : null,
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageMobileError, setImageMobileError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingMobile, setUploadingMobile] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputMobileRef = useRef<HTMLInputElement>(null)

  /** Si la imagen en pantalla no es la que ya está guardada, es un upload de esta sesión. */
  const isUnsaved = (publicId: string) => publicId !== savedPublicId
  const isUnsavedMobile = (publicId: string) => publicId !== savedPublicIdMobile

  useImperativeHandle(ref, () => ({
    cleanupUnsavedImage: () => {
      if (savedRef.current) return
      if (image && isUnsaved(image.publicId)) deleteUnsavedImage(token, image.publicId)
      if (imageMobile && isUnsavedMobile(imageMobile.publicId)) deleteUnsavedImage(token, imageMobile.publicId)
    },
  }))

  function handleRemoveImage() {
    if (image && isUnsaved(image.publicId)) deleteUnsavedImage(token, image.publicId)
    setImage(null)
  }

  function handleRemoveMobileImage() {
    if (imageMobile && isUnsavedMobile(imageMobile.publicId)) deleteUnsavedImage(token, imageMobile.publicId)
    setImageMobile(null)
  }

  function setField<K extends keyof BannerFormData>(key: K, value: BannerFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function handleDestinationChange(type: DestinationType) {
    setDestination(type)
    setErrors((prev) => ({ ...prev, categorySlug: undefined, customUrl: undefined }))
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || uploading) return

    setUploading(true)
    setImageError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('slug', form.title || 'banner')

    const res = await apiClient(token).postForm<{ url: string; publicId: string }>(
      '/admin/banners/upload-image',
      formData,
    )
    if (!res.ok) {
      setImageError(res.error ?? 'Error al subir la imagen')
    } else {
      setImage({ url: res.data.url, publicId: res.data.publicId })
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFileChangeMobile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || uploadingMobile) return

    setUploadingMobile(true)
    setImageMobileError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('slug', `${form.title || 'banner'}-mobile`)

    const res = await apiClient(token).postForm<{ url: string; publicId: string }>(
      '/admin/banners/upload-image',
      formData,
    )
    if (!res.ok) {
      setImageMobileError(res.error ?? 'Error al subir la imagen')
    } else {
      setImageMobile({ url: res.data.url, publicId: res.data.publicId })
    }
    setUploadingMobile(false)
    if (fileInputMobileRef.current) fileInputMobileRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const parsed = bannerSchema.safeParse(form)
    const fieldErrors: FormErrors = {}
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof BannerFormData
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
    }

    // El destino "categoría" y "avanzado" requieren su propio campo lleno.
    if (destination === 'categoria' && !categorySlug) {
      fieldErrors.categorySlug = 'Selecciona una categoría'
    }
    if (destination === 'custom') {
      const urlCheck = customUrlSchema.safeParse(customUrl)
      if (!urlCheck.success) fieldErrors.customUrl = urlCheck.error.issues[0]?.message
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }
    if (!image) {
      setImageError('Sube una imagen para el banner')
      return
    }

    const ctaUrl = buildCtaUrl(destination, categorySlug, customUrl)

    setLoading(true)
    try {
      const payload = {
        title: form.title,
        ctaUrl: ctaUrl || undefined,
        imageUrl: image.url,
        imagePublicId: image.publicId,
        // En edición se envía explícitamente null cuando se quitó la imagen mobile,
        // para que el backend limpie el campo en vez de dejar el valor anterior.
        imageUrlMobile: imageMobile ? imageMobile.url : (isEdit ? null : undefined),
        imagePublicIdMobile: imageMobile ? imageMobile.publicId : (isEdit ? null : undefined),
        ...(isEdit ? {} : { order: nextOrder }),
      }

      const client = apiClient(token)
      const res = isEdit
        ? await client.put<void>(`/admin/banners/${initial.id}`, payload)
        : await client.post<void>('/admin/banners', payload)

      if (!res.ok) {
        setServerError(res.error ?? 'Error inesperado')
        return
      }

      savedRef.current = true
      await revalidateAdminCache([CACHE_TAGS.hero])
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

      {/* Imagen */}
      <div>
        <label className="block text-xs font-semibold text-[var(--c-text-3)] uppercase tracking-widest mb-1.5">
          Imagen <span className="text-[var(--c-danger)]">*</span>
        </label>

        {image ? (
          <div className="relative w-full aspect-[21/9] rounded-[var(--radius-md)] overflow-hidden bg-[var(--c-surface-2)] border border-[var(--c-border)] group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-[var(--c-danger)] text-white rounded-full p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all"
              aria-label="Quitar imagen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="sr-only"
              id="banner-image-upload"
              disabled={uploading}
            />
            <label
              htmlFor="banner-image-upload"
              className={`flex flex-col items-center justify-center gap-2 w-full h-28 rounded-[var(--radius-lg)] border-2 border-dashed cursor-pointer transition-colors ${
                uploading
                  ? 'border-[var(--c-accent)]/50 bg-[var(--c-active-bg)] cursor-not-allowed'
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
                  <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)]">Haz clic para subir la imagen</span>
                  <span className="text-xs text-[var(--c-text-4)]">JPG, PNG, WEBP · Máx. 5 MB</span>
                </>
              )}
            </label>
          </div>
        )}
        {imageError && <p className="text-[var(--c-danger)] text-xs mt-1">{imageError}</p>}
      </div>

      {/* Imagen mobile (opcional) — recorte/peso distinto al desktop */}
      <div>
        <label className="block text-xs font-semibold text-[var(--c-text-3)] uppercase tracking-widest mb-1.5">
          Imagen mobile (opcional)
        </label>
        <p className="text-xs text-[var(--c-text-4)] mb-1.5">
          Si no se sube, el carrusel usa la imagen de arriba también en mobile.
        </p>

        {imageMobile ? (
          <div className="relative w-full max-w-xs aspect-[9/16] rounded-[var(--radius-md)] overflow-hidden bg-[var(--c-surface-2)] border border-[var(--c-border)] group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageMobile.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <button
              type="button"
              onClick={handleRemoveMobileImage}
              className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-[var(--c-danger)] text-white rounded-full p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all"
              aria-label="Quitar imagen mobile"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputMobileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChangeMobile}
              className="sr-only"
              id="banner-image-upload-mobile"
              disabled={uploadingMobile}
            />
            <label
              htmlFor="banner-image-upload-mobile"
              className={`flex flex-col items-center justify-center gap-2 w-full max-w-xs h-24 rounded-[var(--radius-lg)] border-2 border-dashed cursor-pointer transition-colors ${
                uploadingMobile
                  ? 'border-[var(--c-accent)]/50 bg-[var(--c-active-bg)] cursor-not-allowed'
                  : 'border-[var(--c-border)] hover:border-[var(--c-accent)]/50 hover:bg-[var(--c-active-bg)]'
              }`}
            >
              {uploadingMobile ? (
                <>
                  <Loader2 className="w-5 h-5 text-[var(--c-accent-text)] animate-spin" />
                  <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)]">Subiendo...</span>
                </>
              ) : (
                <>
                  <ImagePlus className="w-5 h-5 text-[var(--c-text-4)]" />
                  <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)]">Subir imagen mobile</span>
                </>
              )}
            </label>
          </div>
        )}
        {imageMobileError && <p className="text-[var(--c-danger)] text-xs mt-1">{imageMobileError}</p>}
      </div>

      <Input
        label="Título interno *"
        type="text"
        value={form.title}
        onChange={(e) => setField('title', e.target.value)}
        placeholder="Ej: Promo llantas agosto"
        maxLength={80}
        error={errors.title}
        hint={!errors.title ? 'No se muestra en el sitio — se usa como texto alternativo de la imagen (accesibilidad) y para identificar el banner en esta lista.' : undefined}
      />

      {/* Destino — la imagen completa es clickeable hacia acá, no hay botón de texto */}
      <div className="flex flex-col gap-2">
        <label htmlFor="destination" className="text-[length:var(--text-body-sm)] font-medium text-[var(--c-text-2)]">
          Al hacer click en la imagen, ir a:
        </label>
        <select
          id="destination"
          value={destination}
          onChange={(e) => handleDestinationChange(e.target.value as DestinationType)}
          className={SELECT_CLASS}
        >
          {(Object.keys(DESTINATION_LABELS) as DestinationType[]).map((type) => (
            <option key={type} value={type}>{DESTINATION_LABELS[type]}</option>
          ))}
        </select>
      </div>

      {/* Selector de categoría — solo si el destino es "Una categoría o subcategoría" */}
      {destination === 'categoria' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="categorySlug" className="text-[length:var(--text-body-sm)] font-medium text-[var(--c-text-2)]">
            ¿Cuál categoría?
          </label>
          <select
            id="categorySlug"
            value={categorySlug}
            onChange={(e) => {
              setCategorySlug(e.target.value)
              setErrors((prev) => ({ ...prev, categorySlug: undefined }))
            }}
            className={SELECT_CLASS}
          >
            <option value="">Selecciona una categoría...</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.isChild ? `— ${c.name}` : c.name}</option>
            ))}
          </select>
          {errors.categorySlug && <p className="text-[var(--c-danger)] text-xs mt-1">{errors.categorySlug}</p>}
        </div>
      )}

      {/* URL personalizada — solo para el destino "avanzado" */}
      {destination === 'custom' && (
        <Input
          label="URL de destino"
          type="text"
          value={customUrl}
          onChange={(e) => {
            setCustomUrl(e.target.value)
            setErrors((prev) => ({ ...prev, customUrl: undefined }))
          }}
          placeholder="https://... o /una-ruta-del-sitio"
          className="font-mono"
          error={errors.customUrl}
          hint={!errors.customUrl ? 'Solo para casos que no están en la lista — si tienes dudas, pide ayuda técnica.' : undefined}
        />
      )}

      {/* Acciones */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading} disabled={uploading} className="flex-1">
          {isEdit ? 'Guardar cambios' : 'Crear banner'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </form>
  )
})

BannerForm.displayName = 'BannerForm'

// ─── Banner Manager (main component) ─────────────────────────────────────────

interface BannerManagerProps {
  banners: BannerRow[]
  categories: CategoryOption[]
}

type ModalState =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; banner: BannerRow }

export function BannerManager({ banners, categories }: BannerManagerProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const token = session?.user?.accessToken

  const [modal, setModal] = useState<ModalState>({ type: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<BannerRow | null>(null)
  const [rowError, setRowError] = useState<Record<string, string>>({})
  const [rowLoading, setRowLoading] = useState<string | null>(null)
  const formRef = useRef<BannerFormHandle>(null)

  const nextOrder = banners.length > 0 ? Math.max(...banners.map((b) => b.order)) + 1 : 0

  // Cualquier vía de cierre del modal (botón "Cancelar", ✕, Escape o click fuera) pasa por
  // acá — así la limpieza de imágenes subidas-pero-no-guardadas cubre las 4 por igual.
  function closeModal() {
    formRef.current?.cleanupUnsavedImage()
    setModal({ type: 'closed' })
  }

  function handleSuccess() {
    closeModal()
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setRowLoading(id)
    setRowError((prev) => ({ ...prev, [id]: '' }))
    try {
      const res = await apiClient(token).delete<void>(`/admin/banners/${id}`)
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: res.error ?? 'Error al eliminar' }))
        return
      }
      await revalidateAdminCache([CACHE_TAGS.hero])
      setDeleteTarget(null)
      router.refresh()
    } catch {
      setRowError((prev) => ({ ...prev, [id]: 'Error de red' }))
    } finally {
      setRowLoading(null)
    }
  }

  async function toggleActive(banner: BannerRow) {
    setRowLoading(banner.id)
    setRowError((prev) => ({ ...prev, [banner.id]: '' }))
    const res = await apiClient(token).put<void>(`/admin/banners/${banner.id}`, {
      isActive: !banner.isActive,
    })
    if (!res.ok) {
      setRowError((prev) => ({ ...prev, [banner.id]: res.error ?? 'Error al actualizar' }))
      setRowLoading(null)
      return
    }
    await revalidateAdminCache([CACHE_TAGS.hero])
    router.refresh()
  }

  /** Intercambia el `order` de dos banners adyacentes — solo se envían esos dos al backend. */
  async function swapOrder(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= banners.length) return

    const current = banners[index]!
    const target = banners[targetIndex]!

    setRowLoading(current.id)
    const res = await apiClient(token).put<void>('/admin/banners/reorder', {
      items: [
        { id: current.id, order: target.order },
        { id: target.id, order: current.order },
      ],
    })
    if (!res.ok) {
      setRowError((prev) => ({ ...prev, [current.id]: res.error ?? 'Error al reordenar' }))
      setRowLoading(null)
      return
    }
    await revalidateAdminCache([CACHE_TAGS.hero])
    router.refresh()
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-text)] tracking-tight">Banners del Hero</h1>
          <p className="text-[var(--c-text-3)] text-[length:var(--text-body-sm)] mt-0.5">
            {banners.length} banner{banners.length !== 1 && 's'} · {banners.filter((b) => b.isActive).length} activo{banners.filter((b) => b.isActive).length !== 1 && 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminHelpButton content={bannersHelpContent} />
          <Button onClick={() => setModal({ type: 'create' })}>+ Nuevo banner</Button>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-lg)] overflow-hidden">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className="flex items-center gap-4 px-4 py-3 border-b border-[var(--c-divider)] last:border-0 hover:bg-[var(--c-surface-hover)] transition-colors"
          >
            {/* Reorder */}
            <div className="flex flex-col shrink-0">
              <button
                onClick={() => swapOrder(index, 'up')}
                disabled={index === 0 || rowLoading === banner.id}
                aria-label="Subir banner"
                className="text-[var(--c-text-4)] hover:text-[var(--c-text)] disabled:opacity-20 transition-colors leading-none py-0.5"
              >
                ▲
              </button>
              <button
                onClick={() => swapOrder(index, 'down')}
                disabled={index === banners.length - 1 || rowLoading === banner.id}
                aria-label="Bajar banner"
                className="text-[var(--c-text-4)] hover:text-[var(--c-text)] disabled:opacity-20 transition-colors leading-none py-0.5"
              >
                ▼
              </button>
            </div>

            {/* Miniatura */}
            <div className="relative w-24 h-12 shrink-0 rounded-[var(--radius-md)] overflow-hidden bg-[var(--c-surface-2)] border border-[var(--c-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={banner.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[length:var(--text-body-sm)] font-medium text-[var(--c-text)] truncate">{banner.title}</p>
              {banner.ctaUrl && (
                <p className="text-xs text-[var(--c-text-4)] truncate">
                  Click → <span className="font-mono">{banner.ctaUrl}</span>
                </p>
              )}
              {rowError[banner.id] && (
                <p className="text-[var(--c-danger)] text-xs mt-0.5">{rowError[banner.id]}</p>
              )}
            </div>

            {/* Activo */}
            <button
              onClick={() => toggleActive(banner)}
              disabled={rowLoading === banner.id}
              className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${
                banner.isActive
                  ? 'bg-[var(--c-success-bg)] text-[var(--c-success)] hover:brightness-95'
                  : 'bg-[var(--c-surface-2)] text-[var(--c-text-4)] hover:bg-[var(--c-surface-hover)]'
              }`}
            >
              {banner.isActive ? 'Activo' : 'Inactivo'}
            </button>

            {/* Acciones */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setModal({ type: 'edit', banner })}
                className="text-[var(--c-accent-text)] hover:text-[var(--c-accent-text-hover)] text-xs font-medium transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => setDeleteTarget(banner)}
                className="text-[var(--c-text-4)] hover:text-[var(--c-danger)] text-xs font-medium transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

        {banners.length === 0 && (
          <div className="text-center py-12 text-[var(--c-text-4)]">
            No hay banners. Crea el primero — hasta entonces el Hero de la home no se muestra.
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      <Modal
        open={modal.type !== 'closed'}
        onClose={closeModal}
        title={modal.type === 'edit' ? `Editar: ${modal.banner.title}` : 'Nuevo banner'}
      >
        {modal.type !== 'closed' && (
          <BannerForm
            ref={formRef}
            initial={modal.type === 'edit' ? modal.banner : undefined}
            nextOrder={nextOrder}
            categories={categories}
            onSuccess={handleSuccess}
            onCancel={closeModal}
            token={token}
          />
        )}
      </Modal>

      {/* Modal confirmación de borrado */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar banner">
        <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-2)]">
          ¿Seguro que quieres eliminar <span className="font-semibold text-[var(--c-text)]">{deleteTarget?.title}</span>?
        </p>
        {deleteTarget && rowError[deleteTarget.id] && (
          <p className="mt-3 text-[length:var(--text-body-sm)] text-[var(--c-danger)]">{rowError[deleteTarget.id]}</p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={!!deleteTarget && rowLoading === deleteTarget.id}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={!!deleteTarget && rowLoading === deleteTarget.id}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </>
  )
}
