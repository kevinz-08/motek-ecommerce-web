import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Cambios y Devoluciones',
  description:
    'Política de cambios, devoluciones y reembolsos de Motek Store. Condiciones, plazos y proceso.',
  robots: { index: true, follow: true },
}

export default function PoliticaDeCambiosPage() {
  return (
    <>
      {/* Encabezado */}
      <header className="mb-8 pb-6 border-b border-gray-100">
        <p className="text-xs font-semibold text-[var(--c-accent)] uppercase tracking-widest mb-2">
          Documento legal
        </p>
        <h1 className="text-3xl font-black text-gray-900 leading-tight">
          Política de Cambios, Devoluciones y Reembolsos
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          Última actualización: <time dateTime="2026-06-01">01 de junio de 2026</time>
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed">

        {/* Requisitos */}
        <section aria-labelledby="seccion-requisitos">
          <h2 id="seccion-requisitos" className="text-lg font-bold text-gray-900 mb-3">
            1. Requisitos para Solicitar Cambio o Devolución
          </h2>
          <p className="text-gray-700 mb-3">
            El Cliente puede solicitar cambio, devolución y/o reembolso de los
            productos adquiridos siempre y cuando cumpla con <strong>todos</strong>{' '}
            los siguientes requisitos:
          </p>
          <ol className="list-decimal list-outside pl-5 space-y-2 text-gray-700">
            <li>
              Solicitar el cambio, devolución o reembolso dentro de los{' '}
              <strong>cinco (5) días calendario</strong> contados a partir de la fecha
              de recibido del producto (registrada por la transportadora).
            </li>
            <li>
              El producto no debe presentar uso, no debe haber sido modificado,
              debe estar en <strong>perfectas condiciones</strong> y en su{' '}
              <strong>embalaje original</strong>.
            </li>
            <li>
              El producto debe contener las <strong>etiquetas, accesorios y
              empaques originales</strong> intactos.
            </li>
          </ol>
        </section>

        {/* Condiciones importantes */}
        <section aria-labelledby="seccion-condiciones">
          <h2 id="seccion-condiciones" className="text-lg font-bold text-gray-900 mb-3">
            2. Condiciones Importantes
          </h2>
          <ul className="list-disc list-outside pl-5 space-y-2 text-gray-700">
            <li>
              Se realizará el cobro del servicio de transporte requerido para la
              devolución y/o entrega de los productos objeto de cambio, lo cual será
              anunciado al momento de dar respuesta al requerimiento.
            </li>
            <li>
              En casos donde el cliente rechace el pedido o solicite su devolución
              sin causa justificada, se le cobrará el valor total del flete de
              ida y regreso.
            </li>
            <li>
              Si el cliente decide devolver los productos a través de medios no
              autorizados, MOTEK STORE podrá cargarle los gastos extras en
              que se incurran.
            </li>
            <li>
              <strong>La devolución del dinero solo aplica en motivos de reclamos
              por garantía y/o derecho de retracto.</strong>
            </li>
            <li>
              No se aceptan cambios de productos comprados en ofertas o con
              descuentos aplicados, ya sea por medio de la página web o redes sociales.
            </li>
            <li>
              No se aceptan devoluciones parciales de productos adquiridos por
              Kit o paquete.
            </li>
            <li>
              MOTEK STORE no se responsabiliza por daños, pérdidas o robos
              en el retorno de los productos enviados por el cliente.
            </li>
          </ul>
        </section>

        {/* Proceso */}
        <section aria-labelledby="seccion-proceso">
          <h2 id="seccion-proceso" className="text-lg font-bold text-gray-900 mb-3">
            3. Proceso para Solicitar Cambio o Devolución
          </h2>
          <p className="text-gray-700 mb-3">
            El Cliente debe comunicarse a través de nuestro WhatsApp{' '}
            <a
              href="https://wa.me/573152926609"
              className="text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
              target="_blank"
              rel="noopener noreferrer"
            >
              +57 315 292 6609
            </a>{' '}
            para que el área encargada pueda proceder a analizar el caso, indicando:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-700">
            <li>Número de pedido.</li>
            <li>Motivo de la devolución o cambio.</li>
            <li>Evidencia fotográfica del estado del producto.</li>
          </ul>
        </section>

        {/* Cambios */}
        <section aria-labelledby="seccion-cambios">
          <h2 id="seccion-cambios" className="text-lg font-bold text-gray-900 mb-3">
            4. Cambios de Producto
          </h2>
          <ul className="list-disc list-outside pl-5 space-y-2 text-gray-700">
            <li>
              Una vez analizada la solicitud, el cambio se efectuará dentro del
              plazo máximo de <strong>30 días calendario</strong> desde la fecha
              en que son recibidos los productos por parte de MOTEK STORE.
            </li>
            <li>
              <strong>Los cambios están limitados a una sola vez por pedido.</strong>{' '}
              No se aceptan cambios sobre cambios; una vez gestionado un cambio,
              el producto recibido no podrá ser nuevamente objeto de cambio.
            </li>
            <li>
              El cambio se hará por el valor total de la compra (no incluye valor
              de envío) y debe realizarse por valor igual o superior al producto
              original, caso en el cual el Cliente pagará el excedente.
            </li>
            <li>
              Todos los cambios están sujetos a disponibilidad en stock.
            </li>
          </ul>
        </section>

        {/* Reembolsos */}
        <section aria-labelledby="seccion-reembolsos">
          <h2 id="seccion-reembolsos" className="text-lg font-bold text-gray-900 mb-3">
            5. Devoluciones y Reembolsos
          </h2>
          <p className="text-gray-700 mb-3">
            Una vez recibido el producto devuelto en nuestras instalaciones y
            verificado su estado, se procederá al reembolso del valor pagado
            descontando los gastos de envío.
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-gray-700">
            <li>
              El reembolso se efectuará a través del mismo medio de pago utilizado
              en la compra, o mediante transferencia bancaria si así lo solicita
              el cliente (con certificación bancaria adjunta).
            </li>
            <li>
              Plazo máximo de reembolso:{' '}
              <strong>30 días calendario</strong> desde la fecha en que se reciben
              los productos en nuestras instalaciones.
            </li>
            <li>
              En ningún caso se reembolsará el valor correspondiente a servicios
              ya ejecutados por terceros, como el flete o seguro.
            </li>
          </ul>
          <p className="text-gray-600 text-xs mt-3 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5">
            El valor del flete de envío y/o devolución está respaldado en la guía
            de transporte. MOTEK STORE no está obligada a proporcionar facturas
            de servicios prestados por terceros, como empresas transportadoras,
            dado que dichas facturas están amparadas por la reserva legal contemplada
            en el <strong>artículo 61 del Código de Comercio</strong>.
          </p>
        </section>

        {/* Contacto */}
        <section
          aria-labelledby="seccion-contacto-cam"
          className="bg-gray-50 rounded-xl p-5 mt-6"
        >
          <h2
            id="seccion-contacto-cam"
            className="text-base font-bold text-gray-900 mb-2"
          >
            ¿Necesitas iniciar un proceso de cambio?
          </h2>
          <p className="text-gray-600 text-sm">
            Contáctanos dentro de los 5 días hábiles siguientes a recibir tu pedido.
            Escríbenos a{' '}
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
