import type { AdminHelpContent } from '../AdminHelpButton'

export const stockHelpContent: AdminHelpContent = {
  title: 'Stock bajo',
  summary:
    'Muestra los productos con 5 unidades o menos en stock, para que puedas reabastecerlos a ' +
    'tiempo. El umbral de 5 unidades está fijo y no se puede cambiar desde el panel.',
  steps: [
    'Cada fila muestra el producto, su SKU y el stock actual.',
    'Escribe la nueva cantidad en el campo "Actualizar stock" y haz clic en "Guardar" — el botón solo se activa cuando cambias el valor.',
    'El cambio se aplica de inmediato, sin confirmación adicional. La marca ✓ de "guardado" desaparece después de unos segundos, así que no te preocupes si no la ves al volver a mirar.',
    'Si necesitas actualizar el inventario completo de la tienda (no solo los productos con stock bajo), usa /admin/sync con el export de Optimun en vez de actualizar uno por uno aquí.',
  ],
}
