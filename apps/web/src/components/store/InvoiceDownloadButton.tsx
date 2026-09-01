interface InvoiceDownloadButtonProps {
  orderId: string
}

/** Enlaza al mismo comprobante server-rendered que usa /checkout/confirmacion — una sola fuente de verdad para el PDF. */
export function InvoiceDownloadButton({ orderId }: InvoiceDownloadButtonProps) {
  return (
    <a
      href={`/api/orders/${orderId}/comprobante`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500
        hover:text-gray-800 transition-colors"
      title="Descargar comprobante PDF"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
      Comprobante PDF
    </a>
  )
}
