'use client'

interface Props {
  children: React.ReactNode
}

export function CatalogThemeWrapper({ children }: Props) {
  return (
    <div className="catalog-light transition-colors duration-300">
      {children}
    </div>
  )
}
