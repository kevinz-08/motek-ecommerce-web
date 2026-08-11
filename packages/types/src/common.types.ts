/** Respuesta de error estándar que devuelve el HttpExceptionFilter de NestJS */
export interface ApiError {
  statusCode: number
  code?: string
  message: string
  path: string
  timestamp: string
}

/** Wrapper genérico para listas paginadas */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
