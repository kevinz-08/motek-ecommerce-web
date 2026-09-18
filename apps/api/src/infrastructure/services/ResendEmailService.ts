import { Injectable, Logger } from '@nestjs/common'
import { Resend } from 'resend'
import { Order } from '@motek/domain'

@Injectable()
export class ResendEmailService {
  private readonly logger = new Logger(ResendEmailService.name)
  private readonly resend: Resend | null
  private readonly from: string
  private readonly frontendUrl: string

  constructor() {
    const apiKey = process.env['RESEND_API_KEY']
    this.resend = apiKey ? new Resend(apiKey) : null
    this.from = process.env['RESEND_FROM_EMAIL'] ?? 'no-reply@motekstore.com'
    this.frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY no configurada — los emails no se enviarán')
    }
  }

  /**
   * URL a la que apunta el botón principal de los correos de un pedido.
   *
   * Un invitado no tiene panel: su único acceso es el `trackingToken`, así que
   * este correo es literalmente la llave de su pedido. Un usuario registrado va
   * a su historial.
   */
  private orderCtaHref(order: Order): string {
    return order.userId
      ? `${this.frontendUrl}/pedidos`
      : `${this.frontendUrl}/pedidos/seguimiento?token=${encodeURIComponent(order.trackingToken)}`
  }

  private orderCtaLabel(order: Order): string {
    return order.userId ? 'Ver mis pedidos' : 'Seguir mi pedido'
  }

  /** Email inmediato al crear el pedido (estado PENDING). */
  async sendOrderReceived(order: Order, customerEmail: string): Promise<void> {
    if (!this.resend) return
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: customerEmail,
      subject: `Recibimos tu pedido #${order.id.slice(-8).toUpperCase()} ⚡`,
      html: this.buildEmail({
        accentColor: '#e60000',
        icon: '📦',
        heading: 'Pedido recibido',
        intro: `Estamos procesando tu pago. En cuanto sea confirmado, te enviaremos otro correo.`,
        orderId: order.id,
        total: order.total,
        address: order.shippingAddress,
        cta: { label: this.orderCtaLabel(order), href: this.orderCtaHref(order) },
      }),
    })
    if (error) this.logger.error(`sendOrderReceived failed orderId=${order.id}: ${JSON.stringify(error)}`)
  }

  /** Email al confirmar que el pago fue APROBADO (estado PAID). */
  async sendOrderConfirmation(order: Order, customerEmail: string): Promise<void> {
    if (!this.resend) return
    const isCod = order.paymentProvider === 'COD'
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: customerEmail,
      subject: isCod
        ? `¡Pedido confirmado! #${order.id.slice(-8).toUpperCase()} 🏍️`
        : `¡Pago confirmado! Pedido #${order.id.slice(-8).toUpperCase()} 🏍️`,
      html: this.buildEmail({
        accentColor: '#16a34a',
        icon: '✅',
        heading: isCod ? '¡Pedido confirmado!' : '¡Pago confirmado!',
        intro: isCod
          ? 'Tu pedido fue confirmado y está siendo preparado para envío. Pagas en efectivo al repartidor cuando lo recibas.'
          : 'Tu pedido fue aprobado y está siendo preparado para envío.',
        orderId: order.id,
        total: order.total,
        address: order.shippingAddress,
        cta: { label: this.orderCtaLabel(order), href: this.orderCtaHref(order) },
        footer: 'Te notificaremos cuando tu pedido sea despachado.',
      }),
    })
    if (error) this.logger.error(`sendOrderConfirmation failed orderId=${order.id}: ${JSON.stringify(error)}`)
  }

  /** Email cuando el envío sale del almacén (estado SHIPPED). */
  async sendShippingNotification(order: Order, customerEmail: string, trackingNumber?: string): Promise<void> {
    if (!this.resend) return
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: customerEmail,
      subject: `Tu pedido #${order.id.slice(-8).toUpperCase()} está en camino 🚚`,
      html: this.buildEmail({
        accentColor: '#e60000',
        icon: '🚚',
        heading: '¡Tu pedido está en camino!',
        intro: trackingNumber
          ? `Número de seguimiento: <strong>${trackingNumber}</strong>`
          : 'Tu pedido salió de nuestro almacén y está en camino.',
        orderId: order.id,
        total: order.total,
        address: order.shippingAddress,
        cta: { label: this.orderCtaLabel(order), href: this.orderCtaHref(order) },
      }),
    })
    if (error) this.logger.error(`sendShippingNotification failed orderId=${order.id}: ${JSON.stringify(error)}`)
  }

  /** Email con código OTP de 6 dígitos para verificar el correo al registrarse. Expira en 10 minutos. */
  async sendOtpVerification(customerEmail: string, name: string, otpCode: string): Promise<void> {
    if (!this.resend) return
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: customerEmail,
      subject: `${otpCode} es tu código de verificación — Motek Store`,
      html: this.buildOtpEmail(name, otpCode),
    })
    if (error) {
      this.logger.error(`sendOtpVerification FAILED email=${customerEmail}: ${JSON.stringify(error)}`)
    } else {
      this.logger.log(`sendOtpVerification OK email=${customerEmail} resendId=${data?.id}`)
    }
  }

  /** Email con enlace para restablecer la contraseña. Token expira en 1 hora. */
  async sendPasswordReset(customerEmail: string, name: string, rawToken: string): Promise<void> {
    if (!this.resend) return
    const resetUrl = `${this.frontendUrl}/auth/reset-password/${rawToken}`
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: customerEmail,
      subject: 'Recupera tu contraseña — Motek Store',
      html: this.buildPasswordResetEmail(name, resetUrl),
    })
    if (error) this.logger.error(`sendPasswordReset failed email=${customerEmail}: ${JSON.stringify(error)}`)
  }

  /** Email cuando la pasarela rechaza el pago. */
  async sendPaymentDeclined(order: Order, customerEmail: string): Promise<void> {
    if (!this.resend) return
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: customerEmail,
      subject: `Problema con tu pago — Pedido #${order.id.slice(-8).toUpperCase()}`,
      html: this.buildEmail({
        accentColor: '#dc2626',
        icon: '❌',
        heading: 'El pago no pudo procesarse',
        intro: 'Tu pago fue rechazado. Puedes intentarlo nuevamente con otro método de pago.',
        orderId: order.id,
        total: order.total,
        address: order.shippingAddress,
        cta: { label: 'Volver al carrito', href: `${this.frontendUrl}/carrito` },
      }),
    })
    if (error) this.logger.error(`sendPaymentDeclined failed orderId=${order.id}: ${JSON.stringify(error)}`)
  }

  /**
   * Reenvía al comprador los enlaces de seguimiento de sus pedidos de invitado.
   *
   * Es la respuesta a "perdí el correo de confirmación". El endpoint que lo
   * dispara responde siempre 202 sin decir si el email existe: la única señal
   * de que hay o no pedidos llega a la bandeja del dueño del correo, nunca a
   * quien hizo la petición.
   */
  async sendGuestTrackingLinks(
    customerEmail: string,
    orders: Array<{ id: string; trackingToken: string; createdAt: Date; total: number }>,
  ): Promise<void> {
    if (!this.resend || orders.length === 0) return

    const rows = orders
      .map((o) => {
        const href = `${this.frontendUrl}/pedidos/seguimiento?token=${encodeURIComponent(o.trackingToken)}`
        const date = o.createdAt.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
        return `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">
                Pedido #${o.id.slice(-8).toUpperCase()}
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${date} · ${this.formatCOP(o.total)}</p>
              <a href="${href}" style="font-size:14px;color:#e60000;font-weight:700;text-decoration:none;">
                Ver el estado de este pedido →
              </a>
            </td>
          </tr>`
      })
      .join('')

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: customerEmail,
      subject: 'Tus enlaces de seguimiento — Motek Store',
      html: this.buildTrackingLinksEmail(rows, orders.length),
    })
    if (error) {
      this.logger.error(`sendGuestTrackingLinks failed email=${customerEmail}: ${JSON.stringify(error)}`)
    }
  }

  private buildTrackingLinksEmail(rows: string, count: number): string {
    return /* html */ `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tus enlaces de seguimiento</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" style="max-width:560px;" cellspacing="0" cellpadding="0">
          <tr>
            <td style="background:#1a1a1a;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#e60000;letter-spacing:-0.5px;">
                ⚡ Motek Store
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:36px 32px;">
              <p style="font-size:40px;margin:0 0 12px;">🔎</p>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">
                Tus enlaces de seguimiento
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Encontramos ${count} ${count === 1 ? 'pedido asociado' : 'pedidos asociados'} a este correo.
                Estos enlaces son personales: cualquiera que los tenga puede ver el pedido, así que no los compartas.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
              <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
                Si no pediste estos enlaces, puedes ignorar este correo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">Motek Store · Repuestos y accesorios para moto</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
  }

  /** Email del formulario de PQR (Contáctanos) — se envía al correo de soporte de la tienda. */
  async sendContactMessage(msg: { name: string; email: string; type: string; message: string }): Promise<void> {
    if (!this.resend) {
      this.logger.warn('sendContactMessage omitido: RESEND_API_KEY no configurada')
      return
    }
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: 'motekdev@gmail.com',
      replyTo: msg.email,
      subject: `[PQR - ${this.pqrTypeLabel(msg.type)}] Mensaje de ${msg.name}`,
      html: this.buildContactEmail(msg),
    })
    if (error) {
      this.logger.error(`sendContactMessage failed email=${msg.email}: ${JSON.stringify(error)}`)
      throw new Error(`No se pudo enviar el mensaje: ${JSON.stringify(error)}`)
    }
    this.logger.log(`sendContactMessage OK email=${msg.email} resendId=${data?.id}`)
  }

  private pqrTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      PETICION: 'Petición',
      QUEJA: 'Queja',
      RECLAMO: 'Reclamo',
      SUGERENCIA: 'Sugerencia',
    }
    return labels[type] ?? type
  }

  private buildContactEmail(msg: { name: string; email: string; type: string; message: string }): string {
    return /* html */ `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nuevo mensaje de contacto</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" style="max-width:560px;" cellspacing="0" cellpadding="0">

          <tr>
            <td style="background:#1a1a1a;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#e60000;letter-spacing:-0.5px;">
                ⚡ Motek Store
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff;padding:36px 32px;">
              <p style="font-size:40px;margin:0 0 12px;">✉️</p>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#e60000;">
                Nuevo mensaje — ${this.pqrTypeLabel(msg.type)}
              </h1>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size:13px;color:#6b7280;padding-bottom:8px;">Nombre</td>
                        <td align="right" style="font-size:13px;font-weight:700;color:#111827;padding-bottom:8px;">
                          ${msg.name}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;">Correo</td>
                        <td align="right" style="font-size:13px;font-weight:700;color:#111827;">
                          ${msg.email}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Mensaje</p>
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;white-space:pre-wrap;">
                ${msg.message}
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;
                        border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Enviado desde el formulario de Contáctanos de motekstore.co
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
  }

  // ─── Template builder ────────────────────────────────────────────────────────

  private formatCOP(cents: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(cents / 100)
  }

  private buildPasswordResetEmail(name: string, resetUrl: string): string {
    return /* html */ `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recuperar contraseña</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" style="max-width:560px;" cellspacing="0" cellpadding="0">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a1a;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#e60000;letter-spacing:-0.5px;">
                ⚡ Motek Store
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px;">
              <p style="font-size:36px;margin:0 0 12px;">🔐</p>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">
                Recupera tu contraseña
              </h1>
              <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
                Hola, <strong>${name}</strong>. Recibimos una solicitud para restablecer la contraseña de tu cuenta.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Haz clic en el botón para crear una nueva contraseña. Este enlace es válido por <strong>1 hora</strong>.
              </p>

              <!-- CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td style="border-radius:8px;background:#e60000;">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;
                              color:#ffffff;text-decoration:none;border-radius:8px;">
                      Restablecer contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
                Si no solicitaste este cambio, ignora este correo. Tu contraseña no será modificada.
              </p>
              <p style="margin:0;font-size:13px;color:#6b7280;">
                Por seguridad, no compartas este enlace con nadie.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;
                        border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Motek Store · Accesorios y repuestos para motos<br/>
                Si tienes dudas, contáctanos en motekdev@gmail.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
  }

  private buildOtpEmail(name: string, otpCode: string): string {
    const digits = otpCode.split('')
    const digitBoxes = digits
      .map(
        (d) =>
          `<td style="width:48px;height:56px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;
                      text-align:center;vertical-align:middle;font-size:28px;font-weight:700;
                      color:#111827;font-family:monospace;">${d}</td>`,
      )
      .join('<td style="width:8px;"></td>')

    return /* html */ `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verifica tu correo</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" style="max-width:560px;" cellspacing="0" cellpadding="0">

          <tr>
            <td style="background:#1a1a1a;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#e60000;letter-spacing:-0.5px;">
                ⚡ Motek Store
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff;padding:36px 32px;">
              <p style="font-size:40px;margin:0 0 12px;">🔒</p>
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">
                Verifica tu correo electrónico
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Hola, <strong>${name}</strong>. Ingresa este código en la pantalla de verificación.
                Es válido por <strong>10 minutos</strong> y solo puede usarse una vez.
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                <tr>${digitBoxes}</tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.5;">
                Si no creaste una cuenta en Motek Store, puedes ignorar este correo con seguridad.
              </p>
              <p style="margin:0;font-size:13px;color:#dc2626;font-weight:600;">
                Nunca compartas este código con nadie. Nuestro equipo jamás te lo pedirá.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;
                        border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Motek Store · Accesorios y repuestos para motos<br/>
                Si tienes dudas, contáctanos en motekdev@gmail.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
  }

  private buildEmail(opts: {
    accentColor: string
    icon: string
    heading: string
    intro: string
    orderId: string
    total: number
    address: Order['shippingAddress']
    cta: { label: string; href: string }
    footer?: string
  }): string {
    const shortId = opts.orderId.slice(-8).toUpperCase()
    return /* html */ `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.heading}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" style="max-width:560px;" cellspacing="0" cellpadding="0">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a1a;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#e60000;letter-spacing:-0.5px;">
                ⚡ Motek Store
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px;">
              <p style="font-size:40px;margin:0 0 12px;">${opts.icon}</p>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${opts.accentColor};">
                ${opts.heading}
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                ${opts.intro}
              </p>

              <!-- Order details -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size:13px;color:#6b7280;padding-bottom:8px;">Número de pedido</td>
                        <td align="right" style="font-size:13px;font-weight:700;color:#111827;padding-bottom:8px;">
                          #${shortId}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;padding-bottom:8px;">Total</td>
                        <td align="right" style="font-size:13px;font-weight:700;color:#111827;padding-bottom:8px;">
                          ${this.formatCOP(opts.total)}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;">Envío a</td>
                        <td align="right" style="font-size:13px;color:#111827;">
                          ${opts.address.city}, ${opts.address.department}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-radius:8px;background:${opts.accentColor};">
                    <a href="${opts.cta.href}"
                       style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;
                              color:#ffffff;text-decoration:none;border-radius:8px;">
                      ${opts.cta.label}
                    </a>
                  </td>
                </tr>
              </table>

              ${opts.footer ? `<p style="margin:24px 0 0;font-size:13px;color:#6b7280;">${opts.footer}</p>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;
                        border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0 0 10px;font-size:12px;color:#9ca3af;">
                Motek Store · Accesorios y repuestos para motos<br/>
                ¿Tienes dudas? Escríbenos a
                <a href="mailto:motekdev@gmail.com"
                   style="color:#6b7280;text-decoration:underline;">motekdev@gmail.com</a>
              </p>
              <p style="margin:0;font-size:11px;color:#d1d5db;line-height:1.8;">
                <a href="${this.frontendUrl}/legal/politica-de-envios"
                   style="color:#9ca3af;text-decoration:underline;">Política de envíos</a>
                &nbsp;·&nbsp;
                <a href="${this.frontendUrl}/legal/politica-de-cambios"
                   style="color:#9ca3af;text-decoration:underline;">Política de cambios</a>
                &nbsp;·&nbsp;
                <a href="${this.frontendUrl}/legal/terminos-y-condiciones"
                   style="color:#9ca3af;text-decoration:underline;">Términos y condiciones</a>
                &nbsp;·&nbsp;
                <a href="${this.frontendUrl}/legal/politica-de-privacidad"
                   style="color:#9ca3af;text-decoration:underline;">Privacidad</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
  }
}
