import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--c-accent)] text-white hover:bg-[var(--c-accent-hover)] border border-transparent',
  secondary:
    'bg-[var(--c-surface)] text-[var(--c-text)] border border-[var(--c-border)] hover:bg-[var(--c-surface-hover)]',
  ghost:
    'bg-transparent text-[var(--c-text-2)] border border-transparent hover:bg-[var(--c-surface-hover)]',
  danger:
    'bg-[var(--c-danger)] text-white border border-transparent hover:brightness-90',
}

/** Altura mínima táctil 44px en md/lg; sm reservado a escritorio/paneles densos (brief §6.2). */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[length:var(--text-body-sm)] gap-1.5',
  md: 'h-11 px-4 text-[length:var(--text-body)] gap-2',
  lg: 'h-13 px-6 text-[length:var(--text-body-lg)] gap-2',
}

/**
 * Botón base del sistema de diseño. Puramente presentacional: sin fetch,
 * sin lógica de dominio. El estado `loading` conserva el ancho del botón
 * (nunca cambia de tamaño) para evitar saltos de layout.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, leftIcon, rightIcon, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium',
        'transition-colors duration-[var(--dur-hover)] ease-[var(--ease-out)]',
        'disabled:opacity-50 disabled:pointer-events-none',
        'cursor-pointer',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 'md' : 'sm'} />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  )
})
