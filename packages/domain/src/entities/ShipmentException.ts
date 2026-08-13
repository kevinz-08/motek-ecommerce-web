export type ShipmentExceptionStatus =
  | 'PENDING'
  | 'TRANSMITTING'
  | 'REPLIED'
  | 'ERROR'
  | 'REJECTED'
  | 'APPROVED'

/** Solo las novedades en estado PENDING pueden recibir una resolución. */
export const RESOLVABLE_EXCEPTION_STATUSES: ShipmentExceptionStatus[] = ['PENDING']

export interface PossibleReply {
  type_id: number
  name: string
  description: string
}

export interface ShipmentExceptionDetail {
  id: string
  order_id: string
  tracking_number: string
  code: string
  description: string
  notes: string
  status: ShipmentExceptionStatus
  possible_replies: PossibleReply[]
  created_at: string
}

export interface ExceptionResolution {
  type_id: number
  notes: string
  delivery_date?: string
  address?: string
  collection_point_id?: string
}
