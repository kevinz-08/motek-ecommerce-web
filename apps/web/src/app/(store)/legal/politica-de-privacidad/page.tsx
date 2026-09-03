import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description:
    'Política de privacidad y tratamiento de datos personales de Motek Store, conforme a la Ley 1581 de 2012.',
  robots: { index: true, follow: true },
}

export default function PoliticaDePrivacidadPage() {
  return (
    <>
      {/* Encabezado */}
      <header className="mb-8 pb-6 border-b border-gray-100">
        <p className="text-xs font-semibold text-[var(--c-accent)] uppercase tracking-widest mb-2">
          Documento legal
        </p>
        <h1 className="text-3xl font-black text-gray-900 leading-tight">
          Política de Privacidad
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          Última actualización: <time dateTime="2026-06-01">01 de junio de 2026</time>
        </p>
        <p className="text-xs text-gray-500 mt-2 bg-[var(--c-active-bg)] border border-[var(--c-accent)] rounded-lg px-4 py-2.5">
          Esta política se rige por la{' '}
          <strong>Ley 1581 de 2012</strong> y el{' '}
          <strong>Decreto 1377 de 2013</strong> sobre protección de datos personales
          en Colombia.
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed">

        {/* Introducción / Consentimiento */}
        <section aria-labelledby="seccion-consentimiento">
          <h2
            id="seccion-consentimiento"
            className="text-lg font-bold text-gray-900 mb-3"
          >
            1. Consentimiento y Responsable del Tratamiento
          </h2>
          <p className="text-gray-700">
            <strong>MOTEK STORE</strong>, como empresa que almacena, usa, circula
            y recolecta datos personales, requiere obtener su consentimiento para que,
            de manera libre, previa, expresa, voluntaria, inequívoca y debidamente
            informada, autorice la recolección, registro, almacenamiento, uso,
            circulación, supresión, procesamiento, compilación, intercambio,
            actualización y disposición de los datos personales que sean suministrados
            e incorporados en las bases de datos con que cuenta MOTEK STORE.
          </p>
        </section>

        {/* Finalidad */}
        <section aria-labelledby="seccion-finalidad">
          <h2 id="seccion-finalidad" className="text-lg font-bold text-gray-900 mb-3">
            2. Finalidad del Tratamiento
          </h2>
          <p className="text-gray-700 mb-3">
            La recolección y tratamiento de sus datos personales obedece a la finalidad
            de atender adecuadamente nuestras actividades de venta, facturación y
            despacho de pedidos. Los datos se utilizan para:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-700">
            <li>Procesar y gestionar pedidos.</li>
            <li>Proporcionar soporte al cliente.</li>
            <li>Enviar comunicaciones relacionadas con las compras.</li>
            <li>Mejorar nuestros productos y servicios.</li>
            <li>Cumplir con obligaciones legales y fiscales.</li>
            <li>
              Enviar información promocional, <strong>siempre que se cuente con
              el consentimiento explícito y separado</strong> del titular.
            </li>
          </ul>
        </section>

        {/* Datos recolectados */}
        <section aria-labelledby="seccion-datos">
          <h2 id="seccion-datos" className="text-lg font-bold text-gray-900 mb-3">
            3. Datos Personales Recolectados
          </h2>
          <p className="text-gray-700">
            Los datos personales solicitados por MOTEK STORE corresponden
            exclusivamente a aquellos que resultan pertinentes, necesarios y adecuados
            para el desarrollo de las finalidades previamente informadas. No requerimos
            el suministro de datos sensibles, siendo facultativa su decisión de otorgarlos.
          </p>
          <p className="text-gray-700 mt-3">
            Los datos que recolectamos incluyen: nombre completo, correo electrónico,
            número de teléfono, dirección de envío y datos de pago procesados por
            la pasarela de pagos Wompi (los datos de tarjeta nunca se almacenan
            en nuestros servidores).
          </p>
        </section>

        {/* Compartir datos */}
        <section aria-labelledby="seccion-compartir">
          <h2 id="seccion-compartir" className="text-lg font-bold text-gray-900 mb-3">
            4. Transferencia y Compartición de Datos
          </h2>
          <p className="text-gray-700 mb-3">
            No compartimos información personal con terceros, excepto en los siguientes
            casos:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-700">
            <li>
              Proveedores de servicios que apoyan la operación de nuestro negocio,
              como empresas de transporte y plataformas de pago.
            </li>
            <li>
              Cuando sea requerido por ley o en respuesta a procesos legales.
            </li>
          </ul>
        </section>

        {/* Derechos del titular */}
        <section aria-labelledby="seccion-derechos">
          <h2 id="seccion-derechos" className="text-lg font-bold text-gray-900 mb-3">
            5. Derechos del Titular
          </h2>
          <p className="text-gray-700 mb-3">
            En su condición de titular de los datos personales, usted podrá formular
            consultas, peticiones y reclamos ante MOTEK STORE con el propósito de:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-700">
            <li>Conocer los datos que tenemos sobre usted.</li>
            <li>Informarse sobre el tratamiento del que son objeto.</li>
            <li>
              Solicitar la actualización, modificación o rectificación de sus datos.
            </li>
            <li>
              Solicitar la supresión de sus datos cuando los mismos hayan sido
              utilizados de manera contraria a las finalidades autorizadas.
            </li>
            <li>Revocar el consentimiento otorgado para el tratamiento.</li>
          </ul>
        </section>

        {/* Modificaciones */}
        <section aria-labelledby="seccion-modificaciones">
          <h2 id="seccion-modificaciones" className="text-lg font-bold text-gray-900 mb-3">
            6. Modificaciones a esta Política
          </h2>
          <p className="text-gray-700">
            Nos reservamos el derecho de modificar esta política de privacidad en
            cualquier momento. Cualquier cambio será publicado en esta página con
            una nueva fecha de actualización.
          </p>
        </section>

        {/* Contacto */}
        <section
          aria-labelledby="seccion-contacto-priv"
          className="bg-gray-50 rounded-xl p-5 mt-6"
        >
          <h2
            id="seccion-contacto-priv"
            className="text-base font-bold text-gray-900 mb-2"
          >
            Contacto para ejercer sus derechos
          </h2>
          <p className="text-gray-600 text-sm">
            Cualquier pregunta o inquietud sobre esta política, así como el ejercicio
            de sus derechos como titular, puede dirigirla a:{' '}
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
