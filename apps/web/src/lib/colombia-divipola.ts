/**
 * Mapeo DIVIPOLA → nombre del departamento colombiano.
 *
 * DIVIPOLA es el estándar oficial del DANE (Departamento Administrativo Nacional
 * de Estadística) para codificar divisiones territoriales. Los códigos de
 * departamento son los 2 primeros dígitos del código de ciudad.
 *
 * Esta lista es **estable** — Colombia no ha creado ni eliminado departamentos
 * desde 1991. No requiere migración de BD ni sincronización con Venndelo:
 * mientras `country_code === 'CO'`, este mapeo es definitivo.
 *
 * Referencia oficial:
 *   https://www.dane.gov.co/index.php/sistema-estadistico-nacional-sen/normas-y-estandares/nomenclaturas-y-clasificaciones/clasificaciones/divipola
 */
export const COLOMBIA_DEPARTMENTS: Record<string, string> = {
  '05': 'Antioquia',
  '08': 'Atlántico',
  '11': 'Bogotá D.C.',
  '13': 'Bolívar',
  '15': 'Boyacá',
  '17': 'Caldas',
  '18': 'Caquetá',
  '19': 'Cauca',
  '20': 'Cesar',
  '23': 'Córdoba',
  '25': 'Cundinamarca',
  '27': 'Chocó',
  '41': 'Huila',
  '44': 'La Guajira',
  '47': 'Magdalena',
  '50': 'Meta',
  '52': 'Nariño',
  '54': 'Norte de Santander',
  '63': 'Quindío',
  '66': 'Risaralda',
  '68': 'Santander',
  '70': 'Sucre',
  '73': 'Tolima',
  '76': 'Valle del Cauca',
  '81': 'Arauca',
  '85': 'Casanare',
  '86': 'Putumayo',
  '88': 'San Andrés y Providencia',
  '91': 'Amazonas',
  '94': 'Guainía',
  '95': 'Guaviare',
  '97': 'Vaupés',
  '99': 'Vichada',
}

/**
 * Devuelve el nombre del departamento dado el subdivisionCode (los 2 primeros
 * dígitos del código DIVIPOLA). Retorna el código si no se reconoce — fallback
 * defensivo para que la UI nunca quede vacía si Venndelo agrega una división
 * que no conocemos.
 */
export function getDepartmentName(subdivisionCode: string): string {
  return COLOMBIA_DEPARTMENTS[subdivisionCode] ?? subdivisionCode
}

/**
 * Normaliza el nombre de una ciudad. Los datos sincronizados desde Venndelo
 * vienen con trailing spaces y casing inconsistente (ej. "BUCARAMANGA " vs
 * "Barrio Medellín"). Recortamos espacios y dejamos el casing original — el
 * componente decide el estilo de display.
 */
export function normalizeCityName(rawName: string): string {
  return rawName.trim()
}
