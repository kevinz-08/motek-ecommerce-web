'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Centrado en escritorio; `sheet` se ancla abajo en móvil (brief §6.1). */
  variant?: 'centered' | 'sheet'
  /** Ancho máximo del diálogo. `md` (max-w-lg) es el valor histórico por defecto. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
} as const

const SHEET_SIZE_CLASSES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-3xl',
} as const

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * Modal accesible: atrapa el foco, cierra con Escape, restituye el foco al
 * disparador al cerrar y bloquea el scroll del body mientras está abierto
 * (brief §10.1). Componente puramente presentacional.
 */
export function Modal({ open, onClose, title, children, variant = 'centered', size = 'md', className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    triggerRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const dialog = dialogRef.current
    const focusable = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    focusable?.[0]?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const nodes = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50 animate-fadeIn"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'relative w-full bg-[var(--c-surface)] shadow-[var(--shadow-lg)] max-h-[90vh] flex flex-col',
          variant === 'sheet'
            ? cn('rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)]', SHEET_SIZE_CLASSES[size])
            : cn(SIZE_CLASSES[size], 'rounded-[var(--radius-lg)] m-4'),
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--c-border)] px-6 py-4 shrink-0">
          <h2 id="modal-title" className="text-[length:var(--text-h3)] font-semibold text-[var(--c-text)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--c-text-3)] hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)]"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
