import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** La jerarquía se comunica primero con borde/superficie; `hover` solo agrega sombra al interactuar (brief §5.3). */
  hover?: boolean
  padding?: 'none' | 'sm' | 'md'
}

const PADDING_CLASSES = {
  none: '',
  sm: 'p-4',
  md: 'p-4 sm:p-6',
} as const

export function Card({ hover = false, padding = 'md', className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--c-border)] bg-[var(--c-surface)]',
        'shadow-[var(--shadow-sm)]',
        hover && 'transition-shadow duration-[var(--dur-hover)] ease-[var(--ease-out)] hover:shadow-[var(--shadow-md)]',
        PADDING_CLASSES[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-[length:var(--text-h3)] font-semibold text-[var(--c-text)]', className)}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-[length:var(--text-body)] text-[var(--c-text-2)]', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex items-center gap-3', className)} {...props} />
}
