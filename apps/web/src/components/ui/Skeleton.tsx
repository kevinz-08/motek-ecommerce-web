/** Primitivas de skeleton compartidas. Usar en cada loading.tsx específico. */

interface SkeletonProps {
  className?: string
}

export function SkeletonBlock({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
      aria-hidden="true"
    />
  )
}

export function SkeletonLine({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-full bg-gray-200 h-4 ${className}`}
      aria-hidden="true"
    />
  )
}

export function SkeletonBlockDark({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/10 ${className}`}
      aria-hidden="true"
    />
  )
}

export function SkeletonLineDark({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-full bg-white/10 h-4 ${className}`}
      aria-hidden="true"
    />
  )
}
