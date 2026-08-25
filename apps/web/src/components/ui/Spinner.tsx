import { cn } from '@/lib/cn'

export interface SpinnerProps {
  size?: 'sm' | 'md'
  className?: string
  label?: string
}

const SIZE_CLASSES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
} as const

/** Indicador de carga en línea. Hereda el color de texto actual (currentColor). */
export function Spinner({ size = 'sm', className, label = 'Cargando' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-current border-t-transparent',
        SIZE_CLASSES[size],
        className,
      )}
    />
  )
}
