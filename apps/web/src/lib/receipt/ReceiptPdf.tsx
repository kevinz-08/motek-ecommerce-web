/**
 * Comprobante de venta — plantilla PDF (no es factura electrónica DIAN).
 *
 * Se renderiza on-demand desde `/api/orders/[id]/comprobante.pdf` con los datos
 * de la orden almacenada en BD. No se persiste el PDF: si el formato cambia,
 * los comprobantes históricos reflejan el nuevo formato automáticamente.
 */
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1f2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 16,
  },
  storeName: { fontSize: 16, fontWeight: 'bold', color: '#e60000' },
  storeSubtitle: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  badge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    textAlign: 'right',
  },
  badgeLabel: { fontSize: 8, color: '#6b7280' },
  badgeNumber: { fontSize: 11, fontWeight: 'bold', color: '#111827' },
  badgeDate: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  twoCol: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  col: { flex: 1, paddingRight: 12 },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: 60, color: '#6b7280' },
  value: { flex: 1 },
  table: { marginBottom: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  thead: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  th: { fontSize: 9, fontWeight: 'bold', color: '#374151' },
  trow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
  },
  tdSku: { width: 70 },
  tdName: { flex: 1, paddingRight: 8 },
  tdQty: { width: 35, textAlign: 'right' },
  tdUnit: { width: 70, textAlign: 'right' },
  tdSubtotal: { width: 80, textAlign: 'right' },
  totalsBlock: { marginTop: 10, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', marginBottom: 2 },
  totalLabel: { width: 100, textAlign: 'right', color: '#6b7280' },
  totalValue: { width: 90, textAlign: 'right', fontWeight: 'bold' },
  totalFinal: { fontSize: 13, color: '#e60000' },
  payment: {
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footer: {
    marginTop: 24,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'center',
  },
})

export interface ReceiptItem {
  sku: string
  name: string
  quantity: number
  unitPrice: number   // centavos COP
  subtotal: number    // centavos COP
}

export interface ReceiptData {
  orderId: string
  orderDate: Date
  buyer: {
    name: string
    idType: string
    idNumber: string
    businessName?: string
    email: string
    phone: string
    address: string
    city: string
  }
  items: ReceiptItem[]
  total: number         // centavos COP — total cobrado (productos + envío si aplica)
  shippingTotal: number // centavos COP — 0 si el negocio absorbió el flete
  payment: {
    provider: string
    externalId: string | null
    reference: string | null
  }
}

// Issuer = la tienda, hardcoded porque cambia muy raramente.
// Cuando se mude o se incorpore, basta con editar este objeto.
const ISSUER = {
  name: 'Motek Store',
  nit: '1007784964-5',
  address: 'Carrera 21 #21-58, Bucaramanga, Santander',
  email: 'motekdev@gmail.com',
  phone: '+57 315 292 6609',
}

function formatCOP(cents: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(d)
}

/** Toma los últimos 8 chars del CUID en mayúscula. Ej: `CV-AC8WSTG6`. */
function receiptNumber(orderId: string): string {
  return `CV-${orderId.slice(-8).toUpperCase()}`
}

export function ReceiptPdf({ data }: { data: ReceiptData }) {
  return (
    <Document title={`Comprobante ${receiptNumber(data.orderId)}`}>
      <Page size="LETTER" style={styles.page}>

        {/* ── Encabezado ───────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.storeName}>{ISSUER.name}</Text>
            <Text style={styles.storeSubtitle}>NIT {ISSUER.nit}</Text>
            <Text style={styles.storeSubtitle}>{ISSUER.address}</Text>
            <Text style={styles.storeSubtitle}>
              {ISSUER.email} · {ISSUER.phone}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>COMPROBANTE DE VENTA</Text>
            <Text style={styles.badgeNumber}>{receiptNumber(data.orderId)}</Text>
            <Text style={styles.badgeDate}>{formatDate(data.orderDate)}</Text>
          </View>
        </View>

        {/* ── Comprador ─────────────────────────────────────────────── */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Comprador</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Nombre:</Text>
              <Text style={styles.value}>
                {data.buyer.businessName ?? data.buyer.name}
              </Text>
            </View>
            {data.buyer.businessName && (
              <View style={styles.row}>
                <Text style={styles.label}>Contacto:</Text>
                <Text style={styles.value}>{data.buyer.name}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.label}>{data.buyer.idType}:</Text>
              <Text style={styles.value}>{data.buyer.idNumber}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{data.buyer.email}</Text>
            </View>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Entrega</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Dirección:</Text>
              <Text style={styles.value}>{data.buyer.address}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Ciudad:</Text>
              <Text style={styles.value}>{data.buyer.city}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Teléfono:</Text>
              <Text style={styles.value}>{data.buyer.phone}</Text>
            </View>
          </View>
        </View>

        {/* ── Ítems ────────────────────────────────────────────────── */}
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.tdSku]}>SKU</Text>
            <Text style={[styles.th, styles.tdName]}>Producto</Text>
            <Text style={[styles.th, styles.tdQty]}>Cant</Text>
            <Text style={[styles.th, styles.tdUnit]}>Unitario</Text>
            <Text style={[styles.th, styles.tdSubtotal]}>Subtotal</Text>
          </View>
          {data.items.map((item, idx) => (
            <View key={idx} style={styles.trow}>
              <Text style={styles.tdSku}>{item.sku}</Text>
              <Text style={styles.tdName}>{item.name}</Text>
              <Text style={styles.tdQty}>{item.quantity}</Text>
              <Text style={styles.tdUnit}>{formatCOP(item.unitPrice)}</Text>
              <Text style={styles.tdSubtotal}>{formatCOP(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        {/* ── Totales ──────────────────────────────────────────────── */}
        <View style={styles.totalsBlock}>
          {data.shippingTotal > 0 && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal productos:</Text>
                <Text style={styles.totalValue}>{formatCOP(data.total - data.shippingTotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Envío:</Text>
                <Text style={styles.totalValue}>{formatCOP(data.shippingTotal)}</Text>
              </View>
            </>
          )}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.totalFinal]}>Total:</Text>
            <Text style={[styles.totalValue, styles.totalFinal]}>
              {formatCOP(data.total)}
            </Text>
          </View>
        </View>

        {/* ── Pago ─────────────────────────────────────────────────── */}
        <View style={styles.payment}>
          <Text style={styles.sectionTitle}>Información de pago</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Pasarela:</Text>
            <Text style={styles.value}>{data.payment.provider}</Text>
          </View>
          {data.payment.reference && (
            <View style={styles.row}>
              <Text style={styles.label}>Referencia:</Text>
              <Text style={styles.value}>{data.payment.reference}</Text>
            </View>
          )}
          {data.payment.externalId && (
            <View style={styles.row}>
              <Text style={styles.label}>ID Trans:</Text>
              <Text style={styles.value}>{data.payment.externalId}</Text>
            </View>
          )}
        </View>

        {/* ── Pie ─────────────────────────────────────────────────── */}
        <Text style={styles.footer}>
          Este es un comprobante administrativo de venta. Para factura electrónica DIAN,
          contacta a {ISSUER.email}. {ISSUER.name} no es responsable de IVA — los precios mostrados son netos.
        </Text>

      </Page>
    </Document>
  )
}
