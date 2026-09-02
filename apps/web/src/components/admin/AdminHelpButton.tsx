'use client'

/**
 * Botón ⓘ genérico para explicarle al admin cómo funciona una sección del
 * panel. El contenido vive en archivos separados (ver components/admin/help-content/)
 * para que agregar ayuda a una nueva sección sea solo escribir el contenido,
 * sin tocar este componente.
 */
import { useState } from 'react'
import { Info } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export interface AdminHelpContent {
  /** Título del modal — normalmente el mismo nombre de la sección. */
  title: string
  /** Explicación breve de qué hace la sección y qué garantías tiene. */
  summary: string
  /** Pasos numerados de cómo usarla, en orden. */
  steps: string[]
}

export function AdminHelpButton({ content }: { content: AdminHelpContent }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="¿Cómo funciona esta sección?"
        aria-label="¿Cómo funciona esta sección?"
        className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] bg-[var(--c-surface-2)] text-[var(--c-text-3)] hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)] transition-colors shrink-0"
      >
        <Info className="w-4 h-4" aria-hidden="true" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={content.title}>
        <div className="space-y-5">
          <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-2)] leading-relaxed">{content.summary}</p>

          <div>
            <h3 className="text-xs font-bold text-[var(--c-text-4)] uppercase tracking-wide mb-3">
              Cómo usarla, paso a paso
            </h3>
            <ol className="space-y-3">
              {content.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-[length:var(--text-body-sm)] text-[var(--c-text-2)] leading-relaxed">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--c-surface-2)] text-[var(--c-text-3)] text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex justify-end pt-2 border-t border-[var(--c-border)]">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Entendido
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
