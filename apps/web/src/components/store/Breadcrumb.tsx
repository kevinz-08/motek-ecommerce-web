import Link from 'next/link'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface Props {
  items: BreadcrumbItem[]
}

/** Breadcrumb reutilizable — usado en el catálogo (vista grid) y en la PDP. */
export function Breadcrumb({ items }: Props) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs c-text-3 mb-2 flex-wrap">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:c-text transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'c-text font-medium' : undefined}>{item.label}</span>
            )}
            {!isLast && <span aria-hidden="true">/</span>}
          </span>
        )
      })}
    </nav>
  )
}
