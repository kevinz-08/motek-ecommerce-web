'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { getDepartmentName, normalizeCityName } from '@/lib/colombia-divipola'

export interface CityOption {
  code: string
  name: string
  subdivisionCode: string
}

interface CitySelectorProps {
  value: CityOption | null
  onChange: (city: CityOption | null) => void
  required?: boolean
  disabled?: boolean
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function CitySelector({ value, onChange, required, disabled }: CitySelectorProps) {
  const [query, setQuery] = useState(value?.name ?? '')
  const [results, setResults] = useState<CityOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, 300)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/vendelo/cities?q=${encodeURIComponent(q)}`)
      if (res.ok) setResults(await res.json() as CityOption[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!value) search(debouncedQuery)
  }, [debouncedQuery, value, search])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(city: CityOption) {
    onChange(city)
    // Mostramos al usuario el formato "Ciudad, Departamento" para que después
    // de elegir vea claramente cuál era la opción exacta (especialmente útil
    // si hay varias ciudades con el mismo nombre).
    setQuery(`${normalizeCityName(city.name)}, ${getDepartmentName(city.subdivisionCode)}`)
    setResults([])
    setOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onChange(null)
    setOpen(true)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id="checkout-city"
        type="text"
        required={required}
        disabled={disabled}
        aria-required={required}
        aria-autocomplete="list"
        aria-expanded={open && results.length > 0}
        value={query}
        onChange={handleInputChange}
        onFocus={() => { if (!value) setOpen(true) }}
        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--c-accent)] disabled:bg-gray-50 disabled:text-gray-400"
        placeholder="Escribe el nombre de tu ciudad..."
        autoComplete="off"
      />

      {value && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--c-accent)] font-medium">
          ✓
        </span>
      )}

      {open && (loading || results.length > 0) && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto text-sm"
        >
          {loading && (
            <li className="px-4 py-2.5 text-gray-400">Buscando...</li>
          )}
          {!loading && results.map((city) => (
            <li
              key={city.code}
              role="option"
              aria-selected={value?.code === city.code}
              onMouseDown={() => handleSelect(city)}
              className="px-4 py-2 cursor-pointer hover:bg-[var(--c-active-bg)] group"
            >
              <div className="text-gray-900 group-hover:text-[var(--c-accent)] leading-tight">
                {normalizeCityName(city.name)}
              </div>
              <div className="text-xs text-gray-500 group-hover:text-[var(--c-accent)] leading-tight">
                {getDepartmentName(city.subdivisionCode)}
              </div>
            </li>
          ))}
          {!loading && results.length === 0 && query.length >= 2 && (
            <li className="px-4 py-2.5 text-gray-400">Sin resultados para &quot;{query}&quot;</li>
          )}
        </ul>
      )}
    </div>
  )
}
