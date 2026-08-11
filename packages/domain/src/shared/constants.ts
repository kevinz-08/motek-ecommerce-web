/**
 * Constantes de negocio compartidas entre use cases.
 *
 * No confundir con la copy de marketing ("Envío gratis desde $500.000") que
 * vive hardcodeada en varios componentes de apps/web — esta constante es la
 * fuente de verdad para la LÓGICA (QuoteShipping). Si el umbral cambia, hay
 * que actualizar ambos lugares hasta que la copy se centralice (pendiente).
 */
export const FREE_SHIPPING_THRESHOLD_CENTS = 500_000_00
