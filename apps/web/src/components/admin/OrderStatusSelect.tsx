'use client'

import { useState } from 'react'
import { OrderStatus } from '@motek/domain'

const statusOptions: OrderStatus[] = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']

const statusLabels: Record<OrderStatus, string> = {
  PENDING:   'Pendiente',
  PAID:      'Pagado',
  SHIPPED:   'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

interface OrderStatusSelectProps {
  orderId: string
  currentStatus: OrderStatus
}

export function OrderStatusSelect({ orderId, currentStatus }: OrderStatusSelectProps) {
  const [status, setStatus] = useState<OrderStatus>(currentStatus)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const handleChange = async (newStatus: OrderStatus) => {
    if (newStatus === status || loading) return
    setLoading(true)
    setError(false)

    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        setStatus(newStatus)
      } else {
        setError(true)
        setTimeout(() => setError(false), 3000)
      }
    } catch {
      setError(true)
      setTimeout(() => setError(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <select
      value={status}
      onChange={(e) => handleChange(e.target.value as OrderStatus)}
      disabled={loading}
      aria-label="Cambiar estado del pedido"
      title={error ? 'Error al actualizar el estado' : undefined}
      className={`text-xs bg-[var(--c-surface)] text-[var(--c-text)] border rounded-[var(--radius-md)] px-2 py-1.5 focus:outline-none focus:border-[var(--c-accent)] disabled:opacity-50 cursor-pointer transition-colors ${
        error ? 'border-[var(--c-danger)]' : 'border-[var(--c-border)]'
      }`}
    >
      {statusOptions.map((s) => (
        <option key={s} value={s}>
          {loading && s === status ? '...' : statusLabels[s]}
        </option>
      ))}
    </select>
  )
}
