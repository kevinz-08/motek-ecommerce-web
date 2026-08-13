export interface ProductBenefit {
  id: string
  /** Título corto del beneficio. Ej: "Alta durabilidad". Opcional. */
  title?: string
  /** Descripción del beneficio. Requerido. */
  body: string
  /** Posición de ordenamiento ascendente. 0 = primero. */
  order: number
}

/** Ítem de compatibilidad con motos, escrito como texto libre por el admin. Ej: "Honda CB160F 2020-2023". */
export interface ProductCompatibilityItem {
  id: string
  body: string
  /** Posición de ordenamiento ascendente. 0 = primero. */
  order: number
}

export interface ProductDescription {
  id: string
  productId: string
  /** Texto largo de presentación del producto. Sustituye o complementa description. */
  generalDescription?: string
  /** Lista de beneficios ordenados por `order` ascendente. */
  benefits: ProductBenefit[]
  /** Lista de compatibilidad con motos (texto libre), ordenada por `order` ascendente. */
  compatibility: ProductCompatibilityItem[]
  createdAt: Date
  updatedAt: Date
}

/** Input para crear o actualizar la descripción estructurada de un producto. */
export interface UpsertDescriptionInput {
  productId: string
  generalDescription?: string
  /** Máximo 10 beneficios. Cada uno reemplaza completamente la lista anterior. */
  benefits: Array<{ title?: string; body: string; order: number }>
  /** Máximo 30 ítems. Cada uno reemplaza completamente la lista anterior. */
  compatibility: Array<{ body: string; order: number }>
}
