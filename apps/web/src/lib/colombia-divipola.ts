/**
 * El mapeo DIVIPOLA → departamento vive en @motek/domain (lo comparte la API
 * al crear pedidos en Venndelo). Se re-exporta aquí para no cambiar imports.
 */
export { COLOMBIA_DEPARTMENTS, getDepartmentName } from '@motek/domain'

/**
 * Normaliza el nombre de una ciudad. Los datos sincronizados desde Venndelo
 * vienen con trailing spaces y casing inconsistente (ej. "BUCARAMANGA " vs
 * "Barrio Medellín"). Recortamos espacios y dejamos el casing original — el
 * componente decide el estilo de display.
 */
export function normalizeCityName(rawName: string): string {
  return rawName.trim()
}
