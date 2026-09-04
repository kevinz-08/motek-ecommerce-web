/**
 * scripts/simulate-wompi-webhook.ts
 *
 * Simula eventos del webhook de Wompi con firma criptográfica VÁLIDA,
 * firmada con el WOMPI_EVENTS_SECRET local. Útil para probar el webhook
 * completo sin hacer pagos reales en el sandbox de Wompi.
 *
 * Requisitos:
 *   - El servidor Next.js debe estar corriendo (npm run dev).
 *   - Debe existir un pedido con status PENDING en la BD.
 *   - WOMPI_EVENTS_SECRET debe estar configurado en .env.local.
 *
 * Uso:
 *   npx tsx scripts/simulate-wompi-webhook.ts <orderId> <APPROVED|DECLINED|VOIDED|ERROR> [amountInCents]
 *
 * Ejemplos:
 *   npx tsx scripts/simulate-wompi-webhook.ts cm5abc123 APPROVED 8500000
 *   npx tsx scripts/simulate-wompi-webhook.ts cm5abc123 DECLINED
 *
 * El script imprime la respuesta del webhook. Si todo está bien verás:
 *   { received: true, stateChanged: true }
 *
 * Casos probados por este script (ejecuta el mismo comando dos veces seguidas):
 *   1ra corrida → stateChanged: true  (transición aplicada)
 *   2da corrida → stateChanged: false (idempotencia: el pedido ya no está en PENDING)
 */
import { createHash } from 'crypto'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

type WompiStatus = 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING'

const VALID_STATUSES: WompiStatus[] = ['APPROVED', 'DECLINED', 'VOIDED', 'ERROR', 'PENDING']

async function main() {
  const [, , orderId, statusArg, amountArg] = process.argv

  if (!orderId || !statusArg) {
    console.error(
      'Uso: npx tsx scripts/simulate-wompi-webhook.ts <orderId> <APPROVED|DECLINED|VOIDED|ERROR|PENDING> [amountInCents]',
    )
    process.exit(1)
  }

  const status = statusArg.toUpperCase() as WompiStatus
  if (!VALID_STATUSES.includes(status)) {
    console.error(`Status inválido. Usa uno de: ${VALID_STATUSES.join(', ')}`)
    process.exit(1)
  }

  const eventsSecret = process.env['WOMPI_EVENTS_SECRET']
  if (!eventsSecret) {
    console.error('WOMPI_EVENTS_SECRET no está configurado en .env.local')
    process.exit(1)
  }

  const webhookUrl =
    process.env['WOMPI_WEBHOOK_URL'] ?? 'http://localhost:3000/api/payments/wompi/webhook'

  const transactionId = `sim-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const reference = `ORDER-${orderId}-${Date.now()}`
  const amountInCents = amountArg ? Number(amountArg) : 8500000
  const timestamp = Math.floor(Date.now() / 1000)

  // Wompi firma: SHA256( data.transaction.id + data.transaction.status + data.transaction.amount_in_cents + timestamp + events_secret )
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
  const propertyValues = [transactionId, status, String(amountInCents)]
  const checksum = createHash('sha256')
    .update(`${propertyValues.join('')}${timestamp}${eventsSecret}`)
    .digest('hex')

  const event = {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: transactionId,
        reference,
        status,
        amount_in_cents: amountInCents,
        currency: 'COP',
      },
    },
    sent_at: new Date().toISOString(),
    timestamp,
    signature: { checksum, properties },
    environment: 'test',
  }

  console.log(`→ POST ${webhookUrl}`)
  console.log(`  orderId=${orderId}  status=${status}  amount=${amountInCents}`)

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })

  const body = await res.text()
  console.log(`← ${res.status} ${res.statusText}`)
  console.log(`  ${body}`)

  if (res.status === 200) {
    console.log('\n✓ El webhook aceptó el evento.')
    console.log('  Ejecuta el mismo comando de nuevo — deberías ver stateChanged: false (idempotencia).')
  } else if (res.status === 401) {
    console.error('\n✗ Firma rechazada. Verifica que WOMPI_EVENTS_SECRET coincida con el del servidor.')
  } else {
    console.error('\n✗ Respuesta inesperada.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
