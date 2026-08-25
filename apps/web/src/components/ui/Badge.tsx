import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-[var(--c-success-bg)] text-[var(--c-success)]',
  warning: 'bg-[var(--c-warning-bg)] text-[var(--c-warning)]',
  danger: 'bg-[var(--c-danger-bg)] text-[var(--c-danger)]',
  info: 'bg-[var(--c-info-bg)] text-[var(--c-info)]',
  neutral: 'bg-[var(--c-surface-2)] text-[var(--c-text-2)]',
}

/**
 * Insignia de estado. El color nunca es el único portador de significado:
 * siempre combinar con texto (brief §3.4) — este componente no impone
 * iconos, el consumidor los agrega vía children si aplica.
 */
export function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-0.5',
        'text-[length:var(--text-caption)] font-medium leading-[var(--text-caption--line-height)]',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
