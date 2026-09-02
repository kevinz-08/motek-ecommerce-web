import type { AdminHelpContent } from '../AdminHelpButton'

export const pedidosHelpContent: AdminHelpContent = {
  title: 'Pedidos',
  summary:
    'Lista todos los pedidos de la tienda con su estado de pago y envío. Puedes filtrar por ' +
    'estado, cambiar el estado manualmente, y revisar el detalle completo de cada pedido sin ' +
    'descargar el comprobante.',
  steps: [
    'Usa los botones de arriba (Todos, Pendiente, Pagado, Enviado, Entregado, Cancelado) para filtrar la lista.',
    'El selector "Cambiar estado" actualiza el pedido al instante — no pide confirmación, así que revisa bien antes de cambiarlo. El sistema no valida que el cambio siga un orden lógico (por ejemplo, puedes marcar "Entregado" un pedido que nunca pasó por "Pagado"), así que es tu responsabilidad mantener el estado correcto.',
    'El botón ⓘ abre el detalle completo del pedido (comprador, dirección, productos, pago) sin tener que descargar el PDF.',
    'El campo "ID Vendelo" en el detalle solo aparece cuando el pedido ya fue enviado a Vendelo para su despacho — si no aparece, el envío todavía no se ha creado allá (puede tardar unos minutos tras el pago).',
    'Esta pantalla no permite crear envíos, generar guías ni resolver novedades de transporte con Vendelo — esas operaciones todavía no tienen una pantalla propia en el panel.',
    'El botón ↓ descarga el comprobante de venta en PDF.',
  ],
}
