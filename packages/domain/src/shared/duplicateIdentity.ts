/** Identidad única (nombre, slug, SKU) que recibe la copia de un producto. */
export interface DuplicateIdentity {
  name: string
  slug: string
  sku: string
}

const COPY_NAME_SUFFIX = /\s*\(Copia(?: \d+)?\)$/
const COPY_SLUG_SUFFIX = /-copia(?:-\d+)?$/
const COPY_SKU_SUFFIX = /-COPIA(?:-\d+)?$/

/**
 * Identidad de la copia para el intento `attempt` (1, 2, 3…).
 * Intento 1: "X (Copia)" / "x-copia" / "SKU-COPIA"; luego "(Copia 2)", "-copia-2", "-COPIA-2".
 * Si el origen ya es una copia, se le quita el sufijo antes de agregar el nuevo
 * para no encadenar "(Copia) (Copia)".
 */
export function buildDuplicateIdentity(
  source: { name: string; slug: string; sku: string },
  attempt: number,
): DuplicateIdentity {
  const name = source.name.replace(COPY_NAME_SUFFIX, '')
  const slug = source.slug.replace(COPY_SLUG_SUFFIX, '')
  const sku = source.sku.replace(COPY_SKU_SUFFIX, '')
  const n = attempt > 1 ? ` ${attempt}` : ''
  const dash = attempt > 1 ? `-${attempt}` : ''
  return {
    name: `${name} (Copia${n})`,
    slug: `${slug}-copia${dash}`,
    sku: `${sku}-COPIA${dash}`,
  }
}
