/**
 * Compatibilidad de un producto con una marca/modelo/año de motocicleta.
 * Un producto puede tener múltiples entradas de compatibilidad.
 * Ejemplo: Pastillas Brembo compatibles con Yamaha FZ25 año 2020, 2021 y 2022
 *          se representa como 3 registros de MotorcycleCompatibility.
 */
export interface MotorcycleCompatibility {
  /** ID único generado por la base de datos (cuid) */
  id: string
  /** Marca de la moto. Ej: "Yamaha", "Honda", "AKT" */
  brand: string
  /** Modelo de la moto. Ej: "FZ25", "CB150R", "TT125" */
  model: string
  /** Año del modelo. null si aplica a todos los años del modelo */
  year: number | null
}

/**
 * Entidad principal de producto en el dominio.
 *
 * IMPORTANTE sobre precios:
 *   Todos los precios se almacenan en CENTAVOS de pesos colombianos (COP).
 *   Esto evita errores de punto flotante con números decimales.
 *   Ejemplo:  $85.000 COP  se almacena como  8500000  (int)
 *   Ejemplo: $158.000 COP  se almacena como 15800000  (int)
 *
 *   Para mostrar al cliente: formatCOP(product.price) → "$85.000"
 *   Para el formulario admin: product.price / 100 → muestra "85000"
 *
 * Esta interfaz NO depende de Prisma. Los repositorios en infrastructure/
 * mapean los tipos de Prisma a esta interfaz mediante funciones toDomain().
 */
export interface Product {
  /** ID único generado por la base de datos (cuid) */
  id: string
  /** Nombre descriptivo del producto. Ej: "Pastillas de freno Brembo Yamaha FZ25" */
  name: string
  /** Slug URL-friendly único. Ej: "pastillas-freno-brembo-yamaha-fz25". Usado en /producto/[slug] */
  slug: string
  /** Descripción larga del producto con características técnicas */
  description: string
  /** Precio en centavos de COP. $85.000 COP = 8500000 */
  price: number
  /** Unidades disponibles en inventario. 0 = agotado */
  stock: number
  /** Código de referencia único del producto. Ej: "FRE-BRE-FZ25-001" */
  sku: string
  /** URLs de imágenes alojadas en Cloudinary. Array vacío si no tiene imágenes */
  images: string[]
  /** Si es false, el producto no aparece en el catálogo público */
  isActive: boolean
  /** Peso real embalado en kilogramos. null si el admin no lo ha cargado —
   *  VendeloService usa VENDELO_DEFAULT_WEIGHT_KG como fallback en ese caso. */
  weightKg: number | null
  /** Alto real embalado en centímetros. Mismo fallback que weightKg. */
  heightCm: number | null
  /** Ancho real embalado en centímetros. Mismo fallback que weightKg. */
  widthCm: number | null
  /** Largo real embalado en centímetros. Mismo fallback que weightKg. */
  lengthCm: number | null
  /** ID de la categoría a la que pertenece (FK hacia Category) */
  categoryId: string
  /**
   * ID de la categoría padre (parentId de Category). null si el producto pertenece
   * a una categoría raíz. Opcional — se popula cuando el query hace include de category.
   * Usado por ValidateCoupon para la cascada de scope categoría → subcategoría.
   */
  parentCategoryId?: string | null
  /** Fecha de creación del registro */
  createdAt: Date
  /** Fecha de última actualización (se actualiza automáticamente en BD) */
  updatedAt: Date
  /**
   * null = visible y activo en BD.
   * Non-null = soft-deleted: oculto en catálogo y panel admin, recuperable desde la papelera.
   */
  deletedAt?: Date | null
  /** Lista de motos compatibles. Opcional — puede no estar cargada dependiendo del query */
  compatible?: MotorcycleCompatibility[]
}

/**
 * Filtros para buscar productos en el catálogo.
 * Todos son opcionales — si no se pasan, se listan todos los productos activos.
 * Los filtros se combinan con AND lógico.
 */
export interface ProductFilters {
  /** Filtrar por slug de categoría. Ej: "sistema-electrico", "repuestos", "llantas" */
  categorySlug?: string
  /** Búsqueda libre en nombre, descripción y SKU (case-insensitive) */
  search?: string
  /** Precio mínimo en centavos COP. Ej: 5000000 para $50.000 mínimo */
  minPrice?: number
  /** Precio máximo en centavos COP. Ej: 20000000 para $200.000 máximo */
  maxPrice?: number
  /** Si es true, solo retorna productos con stock > 0 */
  inStock?: boolean
  /** Si es true, incluye también productos con isActive: false. Uso exclusivo del panel admin. */
  includeInactive?: boolean
  /** Filtra por marca de moto compatible (match exacto, case-insensitive). Ej: "Yamaha" */
  motorcycleBrand?: string
  /** Filtra por modelo de moto compatible — solo tiene efecto junto con motorcycleBrand. Ej: "MT-15" */
  motorcycleModel?: string
  /** Número de página para paginación. Empieza en 1. Default: 1 */
  page?: number
  /** Cantidad de productos por página. Default: 12 */
  limit?: number
}
