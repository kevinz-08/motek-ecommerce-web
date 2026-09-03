import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Envíos',
  description:
    'Política de envíos, tiempos de entrega, costos y garantía legal de productos de Motek Store.',
  robots: { index: true, follow: true },
}

export default function PoliticaDeEnviosPage() {
  return (
    <>
      {/* Encabezado */}
      <header className="mb-8 pb-6 border-b border-gray-100">
        <p className="text-xs font-semibold text-[var(--c-accent)] uppercase tracking-widest mb-2">
          Documento legal
        </p>
        <h1 className="text-3xl font-black text-gray-900 leading-tight">
          Política de Envíos
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          Última actualización: <time dateTime="2026-06-01">01 de junio de 2026</time>
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed">

        {/* Cobertura */}
        <section aria-labelledby="seccion-cobertura">
          <h2 id="seccion-cobertura" className="text-lg font-bold text-gray-900 mb-3">
            1. Cobertura de Envíos
          </h2>
          <p className="text-gray-700">
            MOTEK STORE realiza envíos a todas las ciudades de Colombia,
            apoyados por empresas transportadoras como{' '}
            <strong>Coordinadora, Envía, Interrapidísimo</strong>, entre otras.
            Los costos y tiempos de envío varían según la ubicación y el método
            de envío seleccionado, y se mostrarán una vez se procese la compra.
          </p>
        </section>

        {/* Costos */}
        <section aria-labelledby="seccion-costos">
          <h2 id="seccion-costos" className="text-lg font-bold text-gray-900 mb-3">
            2. Costos de Envío
          </h2>
          <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-700">
            <li>
              <strong>Envío gratuito</strong> para compras superiores a{' '}
              <strong>$500.000 COP</strong>.
            </li>
            <li>
              Para compras menores, el costo de envío se calcula según el destino
              y se muestra en el resumen del pedido antes de confirmar el pago.
            </li>
            <li>
              En casos donde la dirección de entrega esté en una zona de difícil
              acceso o requiera reexpedición, se notificará al cliente sobre los
              costos adicionales antes de proceder con el envío, ya que Motek ONLINE
              STORE no podrá asumirlos.
            </li>
          </ul>
        </section>

        {/* Tiempos */}
        <section aria-labelledby="seccion-tiempos">
          <h2 id="seccion-tiempos" className="text-lg font-bold text-gray-900 mb-3">
            3. Tiempos de Despacho y Entrega
          </h2>
          <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-700">
            <li>
              Los términos de envío inician desde el momento en que es{' '}
              <strong>confirmado el pago</strong>. Tenga en cuenta que en tarjetas
              de crédito, débito y PSE la confirmación puede tardar hasta un día hábil.
            </li>
            <li>
              <strong>Plazo de despacho:</strong> 1 a 5 días hábiles desde la
              confirmación del pago.
            </li>
            <li>
              <strong>Plazo de entrega:</strong> depende de la transportadora y
              la zona de destino. Los plazos son estimados y no garantizados.
            </li>
            <li>
              Si por situaciones externas a nuestra esfera de control los periodos
              de entrega se extendieran más de lo establecido, esto no dará al
              consumidor ningún derecho de indemnización.
            </li>
          </ul>
          <p className="text-gray-600 text-xs mt-3 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5">
            Las empresas transportistas pueden presentar retrasos por motivos de
            clima, derrumbes, tráfico u otras novedades que sean reportadas.
          </p>
        </section>

        {/* Dirección de entrega */}
        <section aria-labelledby="seccion-direccion">
          <h2 id="seccion-direccion" className="text-lg font-bold text-gray-900 mb-3">
            4. Dirección de Entrega
          </h2>
          <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-700">
            <li>
              Solo se realiza la entrega en una dirección de entrega válida
              dentro del territorio colombiano.
            </li>
            <li>
              Es responsabilidad exclusiva del Cliente proporcionar una dirección
              exacta y completa al momento de realizar la compra.
            </li>
            <li>
              <strong>Una vez el pedido haya sido despachado, no se aceptan
              cambios en la dirección de entrega.</strong>
            </li>
          </ul>
        </section>

        {/* Responsabilidad */}
        <section aria-labelledby="seccion-responsabilidad">
          <h2 id="seccion-responsabilidad" className="text-lg font-bold text-gray-900 mb-3">
            5. Responsabilidad en la Entrega
          </h2>
          <p className="text-gray-700 mb-3">
            MOTEK STORE no se hace responsable por retrasos, pérdidas o daños
            en los productos una vez que han sido entregados a la transportadora.
            Cualquier reclamación relacionada con el transporte debe ser gestionada
            directamente con la empresa transportadora correspondiente.
          </p>
          <p className="text-gray-700">
            Se entenderá entregado el producto con la firma de la guía del
            transportador, ya sea por la persona que realizó la compra o por quien
            se encuentre en el sitio al momento de la entrega.
          </p>
          <p className="text-gray-700 mt-3">
            En caso de que el paquete presente señas de daños o rupturas en el
            empaque al momento de la entrega, comuníquese de inmediato a través de
            nuestro WhatsApp{' '}
            <a
              href="https://wa.me/573152926609"
              className="text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
              target="_blank"
              rel="noopener noreferrer"
            >
              +57 315 292 6609
            </a>
            .
          </p>
        </section>

        {/* Garantía legal */}
        <section aria-labelledby="seccion-garantia">
          <h2 id="seccion-garantia" className="text-lg font-bold text-gray-900 mb-3">
            6. Garantía Legal de los Productos
          </h2>
          <p className="text-gray-700 mb-3">
            De conformidad con el{' '}
            <strong>artículo 7 de la Ley 1480 de 2011</strong>, MOTEK STORE
            garantiza la calidad, idoneidad, seguridad y buen funcionamiento de
            los productos vendidos, sin costo adicional para el consumidor.
          </p>
          <p className="text-gray-700 mb-3">
            El plazo de garantía comienza a contar desde la fecha de entrega del
            producto al Cliente y dependerá del tipo de producto, el cual será
            informado al momento de la compra.
          </p>

          <h3 className="font-semibold text-gray-800 mb-2 mt-4">
            Cobertura — opciones del Cliente (Art. 11, Ley 1480/2011)
          </h3>
          <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-700">
            <li>Reparación gratuita de los defectos de fabricación.</li>
            <li>
              Reemplazo del producto por otro de la misma especie, características
              o especificaciones técnicas cuando la reparación no sea posible.
            </li>
            <li>
              Devolución del dinero pagado total o parcial, cuando la falla se
              repita o el bien no pueda repararse o sustituirse.
            </li>
          </ul>

          <h3 className="font-semibold text-gray-800 mb-2 mt-4">
            Proceso de garantía
          </h3>
          <p className="text-gray-700 mb-2">
            El Cliente debe comunicarse a través de{' '}
            <a
              href="mailto:motekdev@gmail.com"
              className="text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
            >
              motekdev@gmail.com
            </a>{' '}
            o WhatsApp indicando: número de pedido, descripción detallada del
            defecto y evidencia fotográfica o video.
          </p>
          <p className="text-gray-700">
            MOTEK STORE gestionará la garantía en un plazo máximo de{' '}
            <strong>15 días hábiles</strong> desde la recepción del producto.
            En caso de no solución, el producto se cambiará por uno nuevo o se
            entregará un bono por el valor adquirido, redimible durante 6 meses.
          </p>

          <h3 className="font-semibold text-gray-800 mb-2 mt-4">
            Excepciones — la garantía no aplica cuando el defecto provenga de:
          </h3>
          <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-700">
            <li>Uso indebido, negligencia o manipulación no autorizada.</li>
            <li>
              Instalación o mantenimiento distinto al indicado en el manual de
              instrucciones.
            </li>
            <li>Alteración o modificación del producto.</li>
            <li>Desgaste natural por uso normal.</li>
          </ul>
        </section>

        {/* Contacto */}
        <section
          aria-labelledby="seccion-contacto-env"
          className="bg-gray-50 rounded-xl p-5 mt-6"
        >
          <h2
            id="seccion-contacto-env"
            className="text-base font-bold text-gray-900 mb-2"
          >
            ¿Novedades con tu envío?
          </h2>
          <p className="text-gray-600 text-sm">
            Reporta cualquier novedad dentro de los{' '}
            <strong>5 días hábiles siguientes</strong> a la entrega. Escríbenos a{' '}
            <a
              href="mailto:motekdev@gmail.com"
              className="text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
            >
              motekdev@gmail.com
            </a>{' '}
            o por WhatsApp al{' '}
            <a
              href="https://wa.me/573152926609"
              className="text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
              target="_blank"
              rel="noopener noreferrer"
            >
              +57 315 292 6609
            </a>
            .
          </p>
        </section>
      </div>
    </>
  )
}
