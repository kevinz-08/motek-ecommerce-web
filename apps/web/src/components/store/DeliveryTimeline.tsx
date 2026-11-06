'use client'

/**
 * Línea de tiempo Pedido → Enviado → Entregado con fechas estimadas.
 * Las fechas se calculan en el cliente (la página es ISR y "hoy" cambiaría
 * con el HTML cacheado); mientras hidrata solo se muestran las etiquetas.
 */
import { useSyncExternalStore } from 'react'
import { Package, ShoppingBag, Truck } from 'lucide-react'
import {
  DELIVERED_BUSINESS_DAYS,
  SHIPPED_BUSINESS_DAYS,
  bogotaToday,
  formatRange,
} from '@/lib/delivery-estimate'

const noopSubscribe = () => () => {}

function Connector() {
  return <div className="flex-1 border-t-2 border-dashed border-[var(--c-accent)] opacity-60 mx-1 mt-6" aria-hidden />
}

function Step({ icon: Icon, title, detail }: { icon: typeof Truck; title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center text-center w-[28%] shrink-0">
      <div className="w-12 h-12 rounded-full bg-white border c-border flex items-center justify-center shadow-sm">
        <Icon className="w-5 h-5 text-[var(--c-accent)]" aria-hidden />
      </div>
      <p className="mt-2 text-sm font-semibold c-text">{title}</p>
      <p className="text-xs c-text-3 min-h-8 leading-snug">{detail}</p>
    </div>
  )
}

export function DeliveryTimeline() {
  const today = useSyncExternalStore(noopSubscribe, () => bogotaToday(), () => '')

  return (
    <section aria-label="Tiempo estimado de entrega" className="mt-5 rounded-2xl c-surface-2 border c-border px-3 py-4">
      <div className="flex items-start justify-between">
        <Step icon={ShoppingBag} title="Pedido" detail={today ? 'Hoy' : ''} />
        <Connector />
        <Step icon={Truck} title="Enviado" detail={today ? formatRange(today, SHIPPED_BUSINESS_DAYS) : ''} />
        <Connector />
        <Step icon={Package} title="Entregado" detail={today ? formatRange(today, DELIVERED_BUSINESS_DAYS) : ''} />
      </div>
      <p className="mt-3 text-center text-[11px] c-text-4">
        Estimado en días hábiles · puede variar según la ciudad
      </p>
    </section>
  )
}
