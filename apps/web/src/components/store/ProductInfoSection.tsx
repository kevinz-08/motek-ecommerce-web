import Link from 'next/link'
import { MotorcycleCompatibility } from '@motek/domain'
import { ProductCompatibilityTable } from '@/components/store/ProductCompatibilityTable'

interface Benefit {
  id: string
  body: string
}

interface Props {
  description?: string
  benefits: Benefit[]
  compatible: MotorcycleCompatibility[]
}

/**
 * Zona de "informarse" — separada visualmente de la zona de "comprar" con un
 * fondo distinto (c-surface-2), igual patrón que "Productos relacionados".
 * Agrupa descripción, beneficios, compatibilidad y políticas de envío/cambios.
 */
export function ProductInfoSection({ description, benefits, compatible }: Props) {
  return (
    <section className="mt-16 c-surface-2 py-12 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-10">
        {description && (
          <div className="prose prose-sm c-text-2 max-w-none">
            <h2 className="text-lg font-semibold c-text mb-2">Descripción</h2>
            <p>{description}</p>
          </div>
        )}

        {benefits.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold c-text mb-3">Información Adicional</h2>
            <ul className="space-y-2">
              {benefits.map((benefit) => (
                <li key={benefit.id} className="flex items-start gap-2.5 text-sm c-text-2">
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-[var(--c-active-bg)] text-[var(--c-accent)] flex items-center justify-center shrink-0 text-[10px] font-bold">✓</span>
                  {benefit.body}
                </li>
              ))}
            </ul>
          </div>
        )}

        <ProductCompatibilityTable compatible={compatible} />

        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold c-text mb-3">📦 Envíos</h2>
            <div className="text-sm c-text-2 space-y-1.5">
              <p>• Despacho en <strong>1 a 5 días hábiles</strong> desde la confirmación del pago.</p>
              <p>• Envío <strong>gratis</strong> en compras superiores a $500.000 COP.</p>
              <p>• Cobertura a <strong>todo Colombia</strong> con Coordinadora, Envía e Interrapidísimo.</p>
              <p>• Una vez despachado, no se aceptan cambios de dirección.</p>
              <Link
                href="/legal/politica-de-envios"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1 text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
              >
                Ver política completa de envíos →
              </Link>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold c-text mb-3">🔄 Cambios y devoluciones</h2>
            <div className="text-sm c-text-2 space-y-1.5">
              <p>• Tienes <strong>5 días calendario</strong> desde la recepción para solicitar un cambio.</p>
              <p>• El producto debe estar sin uso, en su <strong>embalaje original</strong> e intacto.</p>
              <p>• El cambio se gestiona en un plazo máximo de <strong>30 días calendario</strong>.</p>
              <p>• Los reembolsos aplican únicamente por garantía o derecho de retracto.</p>
              <Link
                href="/legal/politica-de-cambios"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1 text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
              >
                Ver política completa de cambios →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
