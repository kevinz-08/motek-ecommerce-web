import { prisma } from '@/infrastructure/database/prisma-client'
import { MercadoPagoToggle } from '@/components/admin/MercadoPagoToggle'
import { CodToggle } from '@/components/admin/CodToggle'
import { ShippingOnlineToggle } from '@/components/admin/ShippingOnlineToggle'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export default async function AdminConfigPage() {
  const [mpSetting, codSetting, shippingOnlineSetting] = await Promise.all([
    prisma.settings.findUnique({ where: { key: 'MERCADOPAGO_ENABLED' } }),
    prisma.settings.findUnique({ where: { key: 'COD_ENABLED' } }),
    prisma.settings.findUnique({ where: { key: 'SHIPPING_ONLINE_ENABLED' } }),
  ])

  const mpEnabled = mpSetting?.value === 'true'
  // Por defecto habilitado si no existe la fila aún — mismo fallback que orders.controller.ts.
  const codEnabled = codSetting ? codSetting.value === 'true' : true
  // Default FALSE si no existe la fila — no empezar a cobrar flete extra sin
  // opt-in explícito del admin (mismo criterio que orders.controller.ts).
  const shippingOnlineEnabled = shippingOnlineSetting?.value === 'true'

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--c-text)] tracking-tight mb-8">Configuración</h1>

      <div className="max-w-2xl space-y-6">

        {/* Pasarelas de pago */}
        <Card>
          <CardHeader>
            <CardTitle>Pasarelas de pago</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)] mb-6">
              Wompi es la pasarela principal y siempre está activa. Mercado Pago es el respaldo
              — actívalo solo si Wompi tiene incidentes.
            </p>

            <div className="space-y-3">
              {/* Wompi — siempre activo */}
              <div className="flex items-center justify-between p-4 bg-[var(--c-success-bg)] border border-[var(--c-success)]/20 rounded-[var(--radius-md)]">
                <div>
                  <p className="font-semibold text-[var(--c-text)]">Wompi</p>
                  <p className="text-xs text-[var(--c-text-3)]">
                    Pasarela principal · Tarjeta, Nequi, PSE, Bancolombia
                  </p>
                </div>
                <Badge variant="success">Activo</Badge>
              </div>

              {/* Mercado Pago — toggle */}
              <div className="flex items-center justify-between gap-4 p-4 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-[var(--radius-md)]">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--c-text)]">Mercado Pago</p>
                  <p className="text-xs text-[var(--c-text-3)]">
                    Pasarela de respaldo · Actívalo en caso de incidente en Wompi
                  </p>
                </div>
                <MercadoPagoToggle enabled={mpEnabled} />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Métodos de pago alternativos */}
        <Card>
          <CardHeader>
            <CardTitle>Pago contra entrega</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)] mb-6">
              Si lo desactivas, los clientes dejan de ver la opción en el checkout — no se borra
              ninguna funcionalidad, solo deja de ofrecerse hasta que lo reactives.
            </p>

            <div className="flex items-center justify-between gap-4 p-4 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-[var(--radius-md)]">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--c-text)]">Pago contra entrega (COD)</p>
                <p className="text-xs text-[var(--c-text-3)]">
                  El cliente paga en efectivo al repartidor de Vendelo al recibir su pedido
                </p>
              </div>
              <CodToggle enabled={codEnabled} />
            </div>
          </CardBody>
        </Card>

        {/* Flete de pedidos pagados en línea */}
        <Card>
          <CardHeader>
            <CardTitle>Flete de pedidos pagados en línea</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)] mb-6">
              Aplica solo a pedidos pagados por Wompi/Mercado Pago (no a Pago contra entrega, que
              ya cobra todo en efectivo). Desactivado por defecto.
            </p>

            <div className="flex items-center justify-between gap-4 p-4 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-[var(--radius-md)]">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--c-text)]">Flete pagado en línea</p>
                <p className="text-xs text-[var(--c-text-3)]">
                  Activo: el flete cotizado se suma al cobro de Wompi/Mercado Pago — el cliente
                  paga producto + envío en un solo cargo. Desactivado (default): el negocio absorbe
                  el flete desde su billetera de Vendelo, como hasta ahora.
                </p>
              </div>
              <ShippingOnlineToggle enabled={shippingOnlineEnabled} />
            </div>
          </CardBody>
        </Card>

        {/* Sincronización */}
        <Card>
          <CardHeader>
            <CardTitle>Sincronización con Optimun</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="bg-[var(--c-info-bg)] border border-[var(--c-info)]/20 rounded-[var(--radius-md)] p-4">
              <p className="text-[length:var(--text-body-sm)] text-[var(--c-info)]">
                <span className="font-semibold">Fase 2</span> — La sincronización automática con
                Optimun está planificada para la próxima versión. Por ahora usa el importador CSV
                en la sección de Stock para actualizar inventario manualmente.
              </p>
            </div>
          </CardBody>
        </Card>

      </div>
    </div>
  )
}
