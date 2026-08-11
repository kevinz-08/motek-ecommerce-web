/**
 * Entidad de dominio Category — jerarquía de dos niveles.
 *
 * Estructura:
 *   Padre  (parentId = null)
 *   └── Subcategoría (parentId = padre.id)
 *       └── Productos
 *
 * Los productos pueden vincularse tanto a un padre (cuando no hay
 * subcategoría más específica) como a una subcategoría.
 */

/** Categoría raíz o subcategoría */
export interface Category {
  id:          string
  name:        string
  slug:        string
  description: string | null
  imageUrl:    string | null
  /** null → categoría raíz; string → id del padre */
  parentId:    string | null
  /** Subcategorías directas (solo se incluye cuando se obtiene con children) */
  children?:   CategoryChild[]
}

/** Subcategoría — misma forma pero sin `children` para evitar recursión infinita */
export interface CategoryChild {
  id:          string
  name:        string
  slug:        string
  description: string | null
  imageUrl:    string | null
  parentId:    string
}
