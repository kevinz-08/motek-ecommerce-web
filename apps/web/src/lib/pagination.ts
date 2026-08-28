/**
 * Retorna la secuencia de páginas a mostrar en una paginación con ventana deslizante.
 *
 * Siempre incluye la primera y la última página.
 * Muestra hasta 2 páginas antes y después de la actual.
 * Los saltos se representan con '...'.
 *
 * Ejemplos:
 *   current=1,  total=5  → [1, 2, 3, 4, 5]
 *   current=5,  total=20 → [1, '...', 3, 4, 5, 6, 7, '...', 20]
 *   current=1,  total=20 → [1, 2, 3, '...', 20]
 *   current=20, total=20 → [1, '...', 18, 19, 20]
 */
export function getPaginationPages(current: number, total: number): (number | '...')[] {
  if (total <= 1) return []

  const delta = 2 // páginas a mostrar alrededor de la actual
  const pages: (number | '...')[] = []

  const rangeStart = Math.max(2, current - delta)
  const rangeEnd = Math.min(total - 1, current + delta)

  pages.push(1)

  if (rangeStart > 2) pages.push('...')

  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i)
  }

  if (rangeEnd < total - 1) pages.push('...')

  pages.push(total)

  return pages
}
