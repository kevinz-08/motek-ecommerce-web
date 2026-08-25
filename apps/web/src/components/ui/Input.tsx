import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface FieldChromeProps {
  label?: string
  error?: string
  hint?: string
  leftAddon?: ReactNode
  rightAddon?: ReactNode
}

const FIELD_BASE =
  'w-full h-11 rounded-[var(--radius-md)] border bg-[var(--c-surface)] px-3 text-[length:var(--text-body)] text-[var(--c-text)] ' +
  'transition-colors duration-[var(--dur-hover)] ease-[var(--ease-out)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const FIELD_BORDER = (hasError: boolean) =>
  hasError
    ? 'border-[var(--c-danger)] focus:border-[var(--c-danger)]'
    : 'border-[var(--c-border)] focus:border-[var(--c-accent)]'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldChromeProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftAddon, rightAddon, id, className, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const helpId = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-[length:var(--text-body-sm)] font-medium text-[var(--c-text-2)]">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftAddon && <span className="absolute left-3 text-[var(--c-text-3)]">{leftAddon}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={helpId}
          className={cn(FIELD_BASE, FIELD_BORDER(!!error), !!leftAddon && 'pl-9', !!rightAddon && 'pr-9', className)}
          {...props}
        />
        {rightAddon && <span className="absolute right-3 text-[var(--c-text-3)]">{rightAddon}</span>}
      </div>
      {error && (
        <p id={helpId} className="text-[length:var(--text-body-sm)] text-[var(--c-danger)]">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={helpId} className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)]">
          {hint}
        </p>
      )}
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldChromeProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className, rows = 4, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const helpId = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-[length:var(--text-body-sm)] font-medium text-[var(--c-text-2)]">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={!!error}
        aria-describedby={helpId}
        className={cn(FIELD_BASE, FIELD_BORDER(!!error), 'h-auto py-2 resize-y', className)}
        {...props}
      />
      {error && (
        <p id={helpId} className="text-[length:var(--text-body-sm)] text-[var(--c-danger)]">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={helpId} className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)]">
          {hint}
        </p>
      )}
    </div>
  )
})
