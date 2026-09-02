'use client'

import { useState } from 'react'

interface StockUpdateFormProps {
  productId: string
  currentStock: number
}

export function StockUpdateForm({ productId, currentStock }: StockUpdateFormProps) {
  const [value, setValue] = useState(currentStock)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    setSaved(false)
    try {
      await fetch(`/api/admin/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: value }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-label="Nuevo stock"
        className="w-20 h-9 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--radius-md)] px-2 text-[length:var(--text-body-sm)] text-[var(--c-text)] text-center focus:outline-none focus:border-[var(--c-accent)] transition-colors"
      />
      <button
        onClick={handleSave}
        disabled={loading || value === currentStock}
        className="text-xs bg-[var(--c-warning)] text-[#1a1a1a] px-3 py-1.5 rounded-[var(--radius-md)] font-medium hover:brightness-95 transition-colors disabled:opacity-50"
      >
        {loading ? '...' : saved ? '✓' : 'Guardar'}
      </button>
    </div>
  )
}
