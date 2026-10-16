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
  const [error, setError] = useState<string | null>(null)

  const showError = (message: string) => {
    setError(message)
    // El motivo de un rechazo (ej. envío ya despachado) necesita tiempo de lectura
    setTimeout(() => setError(null), 8000)
  }

  const handleChange = async (newStatus: OrderStatus) => {
    if (newStatus === status || loading) return
    // Anular también anula el envío en Vendelo, y eso no se puede revertir
    if (
      newStatus === 'CANCELLED'
      && !window.confirm('¿Anular este pedido? Si ya está en Vendelo, el envío también se anula y no se puede revertir.')
    ) {
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        setStatus(newStatus)
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        showError(data.error ?? 'Error al actualizar el estado')
      }
    } catch {
      showError('Error de red al actualizar el estado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value as OrderStatus)}
        disabled={loading}
        aria-label="Cambiar estado del pedido"
        title={error ?? undefined}
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
      {error && (
        <span role="alert" className="text-[11px] leading-tight text-[var(--c-danger)] max-w-[16rem]">
          {error}
        </span>
      )}
    </span>
  )
}
