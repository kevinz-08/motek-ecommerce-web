/**
 * Servicio de emails transaccionales usando Resend.
 *
 * Resend es una API de email diseñada para developers. Se usa para enviar
 * emails transaccionales (no marketing) relacionados con el estado de los pedidos.
 *
 * Configuración requerida:
 *   RESEND_API_KEY       → Llave de API de resend.com
 *   RESEND_FROM_EMAIL    → Dirección remitente (ej: motekdev@gmail.com)
 *                          El dominio debe estar verificado en Resend.
 *
 * Emails disponibles:
 *   1. sendOrderConfirmation  → Pago APPROVED — "Tu pedido fue confirmado"
 *   2. sendShippingNotification → Admin marca pedido como SHIPPED
 *   3. sendPaymentDeclined      → Pago DECLINED/VOIDED/ERROR
 *
 * Todos los emails usan HTML inline (sin dependencias de templates externos).
 * El método formatCOP convierte centavos a pesos COP con formato colombiano.
 *
 * Uso desde los webhooks (fire-and-forget):
 *   emailService.sendOrderConfirmation(order, email).catch(console.error)
 *   → No bloqueamos la respuesta del webhook esperando que el email se envíe.
 *     Si el email falla, se loguea el error pero el webhook responde 200 igual.
 */
import { Resend } from 'resend'
import { Order } from '@motek/domain'

const resend = new Resend(process.env['RESEND_API_KEY'])
const FROM = process.env['RESEND_FROM_EMAIL'] ?? 'no-reply@motekstore.com'

/** Servicio de emails transaccionales usando la API de Resend */
export class ResendEmailService {
  /**
   * Envía email de confirmación de pedido pagado.
   * Se llama desde el webhook de Wompi/MP cuando el pago es APPROVED.
   * @param order - Pedido con los datos de envío y total
   * @param customerEmail - Email del cliente al que se enviará
   */
  async sendOrderConfirmation(order: Order, customerEmail: string): Promise<void> {
    await resend.emails.send({
      from: FROM,
      to: customerEmail,
      subject: `¡Tu pedido #${order.id.slice(-8).toUpperCase()} fue confirmado! 🏍️`,
      html: this.orderConfirmationHtml(order),
    })
  }

  /** Email de notificación cuando el pedido es despachado */
  async sendShippingNotification(
    order: Order,
    customerEmail: string,
    trackingNumber?: string,
  ): Promise<void> {
    await resend.emails.send({
      from: FROM,
      to: customerEmail,
      subject: `Tu pedido #${order.id.slice(-8).toUpperCase()} fue enviado`,
      html: this.shippingNotificationHtml(order, trackingNumber),
    })
  }

  /** Email cuando el pago fue rechazado */
  async sendPaymentDeclined(order: Order, customerEmail: string): Promise<void> {
    await resend.emails.send({
      from: FROM,
      to: customerEmail,
      subject: `Problema con tu pago — Pedido #${order.id.slice(-8).toUpperCase()}`,
      html: this.paymentDeclinedHtml(order),
    })
  }

  private formatCOP(cents: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(cents / 100)
  }

  private orderConfirmationHtml(order: Order): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #1a1a1a; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: #e60000; margin: 0;">⚡ Motek Store</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #16a34a;">¡Tu pedido fue confirmado!</h2>
    <p>Número de pedido: <strong>#${order.id.slice(-8).toUpperCase()}</strong></p>
    <p>Total: <strong>${this.formatCOP(order.total)}</strong></p>
    <p>Dirección de envío: ${order.shippingAddress.address}, ${order.shippingAddress.city}</p>
    <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="font-size: 14px; color: #6b7280;">
      Te notificaremos cuando tu pedido sea despachado.<br>
      ¿Tienes dudas? Escríbenos a motekdev@gmail.com
    </p>
  </div>
</body>
</html>`
  }

  private shippingNotificationHtml(order: Order, trackingNumber?: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #1a1a1a; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: #e60000; margin: 0;">⚡ Motek Store</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #e60000;">¡Tu pedido está en camino! 🚚</h2>
    <p>Pedido: <strong>#${order.id.slice(-8).toUpperCase()}</strong></p>
    ${trackingNumber ? `<p>Número de seguimiento: <strong>${trackingNumber}</strong></p>` : ''}
    <p>Destino: ${order.shippingAddress.address}, ${order.shippingAddress.city}</p>
  </div>
</body>
</html>`
  }

  private paymentDeclinedHtml(order: Order): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #1a1a1a; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: #e60000; margin: 0;">⚡ Motek Store</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #dc2626;">Hubo un problema con tu pago</h2>
    <p>Pedido: <strong>#${order.id.slice(-8).toUpperCase()}</strong></p>
    <p>Total: ${this.formatCOP(order.total)}</p>
    <p>Por favor intenta de nuevo o usa otro método de pago.</p>
    <a href="${process.env['NEXTAUTH_URL']}/carrito"
       style="display: inline-block; background: #e60000; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 16px;">
      Volver al carrito
    </a>
  </div>
</body>
</html>`
  }
}
