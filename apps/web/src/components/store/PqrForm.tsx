'use client'

import { useState, type FormEvent } from 'react'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'

type PqrType = 'PETICION' | 'QUEJA' | 'RECLAMO' | 'SUGERENCIA'

const PQR_TYPES: { value: PqrType; label: string }[] = [
  { value: 'PETICION', label: 'Petición' },
  { value: 'QUEJA', label: 'Queja' },
  { value: 'RECLAMO', label: 'Reclamo' },
  { value: 'SUGERENCIA', label: 'Sugerencia' },
]

interface FormData {
  name: string
  email: string
  type: PqrType
  message: string
}

type FieldErrors = Partial<Record<keyof FormData, string>>

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form: FormData): FieldErrors {
  const errors: FieldErrors = {}
  if (!form.name.trim()) errors.name = 'Ingresa tu nombre completo'
  if (!form.email.trim()) errors.email = 'Ingresa tu correo'
  else if (!EMAIL_REGEX.test(form.email)) errors.email = 'Correo inválido'
  if (!form.message.trim()) errors.message = 'Cuéntanos qué necesitas'
  else if (form.message.trim().length < 10) errors.message = 'Danos un poco más de detalle (mín. 10 caracteres)'
  return errors
}

export function PqrForm() {
  const [form, setForm] = useState<FormData>({ name: '', email: '', type: 'PETICION', message: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [serverError, setServerError] = useState<string | null>(null)

  const handleChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const fieldErrors = validate(form)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setStatus('submitting')
    setServerError(null)

    const res = await apiClient().post('/contact', form)

    if (res.ok) {
      setStatus('success')
      setForm({ name: '', email: '', type: 'PETICION', message: '' })
    } else {
      setStatus('error')
      setServerError(res.error)
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--c-success)]/30 bg-[var(--c-success-bg)] px-6 py-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--c-success)]/15">
          <svg className="h-6 w-6 text-[var(--c-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-[var(--c-success)]">¡Mensaje enviado!</h3>
        <p className="mt-1.5 text-sm text-[var(--c-text-2)]">
          Recibimos tu PQR. Te responderemos al correo que nos dejaste en un plazo máximo de 48 horas hábiles.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-5 text-sm font-medium text-[var(--c-success)] underline underline-offset-2 hover:brightness-90"
        >
          Enviar otro mensaje
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-label="Formulario de PQR">
      <Input
        id="pqr-name"
        label="Nombre completo"
        type="text"
        autoComplete="name"
        value={form.name}
        onChange={handleChange('name')}
        placeholder="Tu nombre"
        error={errors.name}
      />

      <Input
        id="pqr-email"
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={handleChange('email')}
        placeholder="tucorreo@ejemplo.com"
        error={errors.email}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="pqr-type" className="text-[length:var(--text-body-sm)] font-medium text-[var(--c-text-2)]">
          Tipo de PQR
        </label>
        <select
          id="pqr-type"
          value={form.type}
          onChange={handleChange('type')}
          className="w-full h-11 rounded-[var(--radius-md)] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-[length:var(--text-body)] text-[var(--c-text)] transition-colors duration-[var(--dur-hover)] ease-[var(--ease-out)] focus:border-[var(--c-accent)] appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 stroke=%22%23757575%22 viewBox=%220 0 24 24%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%222%22 d=%22M19 9l-7 7-7-7%22/></svg>')] bg-[length:1.1rem] bg-[right_0.9rem_center] bg-no-repeat pr-10"
        >
          {PQR_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <Textarea
        id="pqr-message"
        label="Mensaje"
        rows={5}
        value={form.message}
        onChange={handleChange('message')}
        placeholder="Cuéntanos con detalle qué pasó o qué necesitas..."
        error={errors.message}
      />

      {status === 'error' && serverError && (
        <div className="rounded-[var(--radius-md)] border border-[var(--c-danger)]/30 bg-[var(--c-danger-bg)] px-4 py-3 text-sm text-[var(--c-danger)]">
          No pudimos enviar tu mensaje: {serverError}
        </div>
      )}

      <Button type="submit" loading={status === 'submitting'} className="w-full sm:w-auto">
        {status === 'submitting' ? 'Enviando...' : 'Enviar mensaje'}
      </Button>
    </form>
  )
}
