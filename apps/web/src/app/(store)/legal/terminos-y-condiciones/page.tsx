import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description:
    'Términos y condiciones de uso del sitio web y contratos de compraventa de Motek Store.',
  robots: { index: true, follow: true },
}

export default function TerminosYCondicionesPage() {
  return (
    <>
      {/* Encabezado del documento */}
      <header className="mb-8 pb-6 border-b border-gray-100">
        <p className="text-xs font-semibold text-[var(--c-accent)] uppercase tracking-widest mb-2">
          Documento legal
        </p>
        <h1 className="text-3xl font-black text-gray-900 leading-tight">
          Términos y Condiciones
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          Última actualización: <time dateTime="2026-06-01">01 de junio de 2026</time>
        </p>
      </header>

      {/* Cuerpo del documento */}
      <div className="prose prose-gray max-w-none text-sm leading-relaxed space-y-8">

        {/* Introducción */}
        <p className="text-gray-700 leading-relaxed">
          Estos términos regulan el acceso y uso del sitio web{' '}
          <strong>motek-store.vercel.app</strong> (el «Sitio») y la celebración de contratos
          de compraventa de repuestos y accesorios («Productos») entre{' '}
          <strong>MOTEK STORE</strong> (la «Empresa») y usted (el «Cliente»).
          Al acceder o utilizar este sitio, usted acepta estos Términos en su totalidad.
          Si no está de acuerdo, no debe utilizar nuestro sitio. Al realizar un pedido,
          declara ser mayor de 18 años y tener capacidad legal para celebrar contratos.
          Los menores de edad no podrán realizar compras a través de la página web.
        </p>

        {/* 1. Objeto */}
        <section aria-labelledby="seccion-1">
          <h2 id="seccion-1" className="text-lg font-bold text-gray-900 mb-3">
            1. Objeto
          </h2>
          <p className="text-gray-700">
            Estos términos regulan el acceso y uso del Sitio y la celebración de contratos
            de compraventa de Productos entre la Empresa y el Cliente.
          </p>
        </section>

        {/* 2. Definiciones */}
        <section aria-labelledby="seccion-2">
          <h2 id="seccion-2" className="text-lg font-bold text-gray-900 mb-3">
            2. Definiciones
          </h2>
          <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-700">
            <li>
              <strong>Cliente:</strong> Persona natural o jurídica que compra Productos
              en el Sitio.
            </li>
            <li>
              <strong>Pedido:</strong> Solicitud de compra realizada en línea.
            </li>
            <li>
              <strong>Transportadora:</strong> Compañía de mensajería contratada para
              despacho y/o devolución.
            </li>
          </ul>
        </section>

        {/* 3. Registro y cuenta */}
        <section aria-labelledby="seccion-3">
          <h2 id="seccion-3" className="text-lg font-bold text-gray-900 mb-3">
            3. Registro y Cuenta de Usuario
          </h2>
          <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-700">
            <li>
              El cliente es responsable de mantener la confidencialidad de su usuario
              y contraseña.
            </li>
            <li>
              La Empresa podrá suspender o cancelar cuentas por incumplimiento de
              estos Términos.
            </li>
          </ul>
        </section>

        {/* 4. Proceso de compra */}
        <section aria-labelledby="seccion-4">
          <h2 id="seccion-4" className="text-lg font-bold text-gray-900 mb-3">
            4. Proceso de Compra
          </h2>
          <ol className="list-decimal list-outside pl-5 space-y-1.5 text-gray-700">
            <li>Selección de Productos y «Carrito».</li>
            <li>Ingreso de datos: dirección y medio de pago.</li>
            <li>Confirmación del Pedido y envío de correo de validación.</li>
            <li>Despacho sujeto a confirmación de pago y disponibilidad.</li>
          </ol>
        </section>

        {/* 5. Precios y pagos */}
        <section aria-labelledby="seccion-5">
          <h2 id="seccion-5" className="text-lg font-bold text-gray-900 mb-3">
            5. Precios y Pagos
          </h2>
          <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-700">
            <li>Los precios en el Sitio son netos y tienen descuento si es aplicable.</li>
            <li>
              La Empresa se reserva el derecho a corregir errores de precio antes
              de procesar el pedido.
            </li>
            <li>
              El pago solo se realiza por los medios habilitados en la página:
              transferencia, tarjeta, PSE, Nequi, entre otros.
            </li>
          </ul>
        </section>

        {/* 6. Disponibilidad */}
        <section aria-labelledby="seccion-6">
          <h2 id="seccion-6" className="text-lg font-bold text-gray-900 mb-3">
            6. Disponibilidad de los Productos
          </h2>
          <p className="text-gray-700">
            Todos los pedidos están sujetos a la disponibilidad de nuestro inventario.
            Si existen dificultades en cuanto al suministro de productos o se agotan
            los artículos en stock, se reembolsará cualquier cantidad de dinero que
            haya sido abonada.
          </p>
        </section>

        {/* 7. Envíos */}
        <section aria-labelledby="seccion-7">
          <h2 id="seccion-7" className="text-lg font-bold text-gray-900 mb-3">
            7. Envíos
          </h2>
          <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-700">
            <li>
              <strong>Plazos de despacho:</strong> de 1 a 5 días hábiles contados
              desde la confirmación del pago.
            </li>
            <li>
              <strong>Plazos de entrega:</strong> dependen de la transportadora y
              la zona de destino.
            </li>
            <li>
              <strong>Cambio de dirección:</strong> no se aceptan solicitudes de
              cambio una vez el pedido ha sido despachado.
            </li>
            <li>
              <strong>Costos de envío:</strong> gratuito para compras superiores a
              $500.000 COP; en caso contrario, tiene un costo adicional según el destino.
            </li>
          </ul>
          <p className="text-gray-700 mt-3">
            MOTEK STORE no responde por demoras, daños o pérdidas ocasionadas
            por la empresa transportadora. Los reclamos por esos conceptos deben
            tramitarse directamente con ella.
          </p>
        </section>

        {/* 8. Cambios y devoluciones */}
        <section aria-labelledby="seccion-8">
          <h2 id="seccion-8" className="text-lg font-bold text-gray-900 mb-3">
            8. Cambios, Devoluciones y Reembolsos
          </h2>
          <p className="text-gray-700">
            Podrá encontrar nuestras políticas publicadas en el Sitio bajo{' '}
            <a
              href="/legal/politica-de-cambios"
              className="text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
            >
              Política de Cambios y Devoluciones
            </a>
            .
          </p>
        </section>

        {/* 9. Garantías */}
        <section aria-labelledby="seccion-9">
          <h2 id="seccion-9" className="text-lg font-bold text-gray-900 mb-3">
            9. Garantías Legales
          </h2>
          <p className="text-gray-700">
            Adicional a estas políticas, el Cliente cuenta con las garantías mínimas
            de calidad y sano funcionamiento previstas en la{' '}
            <strong>Ley 1480 de 2011</strong> (Estatuto del Consumidor colombiano).
          </p>
        </section>

        {/* 10. Propiedad intelectual */}
        <section aria-labelledby="seccion-10">
          <h2 id="seccion-10" className="text-lg font-bold text-gray-900 mb-3">
            10. Propiedad Intelectual
          </h2>
          <p className="text-gray-700">
            Todos los derechos sobre el contenido, diseño y logos del Sitio son
            titularidad de MOTEK STORE y están protegidos por la legislación
            vigente. Queda prohibida su reproducción sin autorización expresa.
          </p>
        </section>

        {/* 11. Limitación de responsabilidad */}
        <section aria-labelledby="seccion-11">
          <h2 id="seccion-11" className="text-lg font-bold text-gray-900 mb-3">
            11. Limitación de Responsabilidad
          </h2>
          <p className="text-gray-700">
            En ningún caso la Empresa será responsable por daños indirectos, lucro
            cesante o perjuicios derivados del uso del Sitio o de la entrega de
            Productos por la transportadora.
          </p>
        </section>

        {/* 12. Indemnización */}
        <section aria-labelledby="seccion-12">
          <h2 id="seccion-12" className="text-lg font-bold text-gray-900 mb-3">
            12. Indemnización
          </h2>
          <p className="text-gray-700">
            El cliente se obliga a indemnizar y mantener a salvo a MOTEK STORE
            frente a cualquier reclamación, pérdida o daño que resulte de su uso
            indebido del Sitio o de la violación de estos Términos.
          </p>
        </section>

        {/* 13. Fuerza mayor */}
        <section aria-labelledby="seccion-13">
          <h2 id="seccion-13" className="text-lg font-bold text-gray-900 mb-3">
            13. Fuerza Mayor
          </h2>
          <p className="text-gray-700">
            La Empresa quedará exonerada de responsabilidad por incumplimientos
            derivados de causas de fuerza mayor o caso fortuito, incluyendo conflictos
            laborales de la transportadora, desastres naturales o restricciones legales.
          </p>
        </section>

        {/* 14. Modificaciones */}
        <section aria-labelledby="seccion-14">
          <h2 id="seccion-14" className="text-lg font-bold text-gray-900 mb-3">
            14. Modificación de los Términos
          </h2>
          <p className="text-gray-700">
            MOTEK STORE se reserva el derecho de actualizar estos términos en
            cualquier momento. Las modificaciones se publicarán en el Sitio con su
            fecha de entrada en vigor. El uso continuado del Sitio tras la publicación
            implica la aceptación de los nuevos términos.
          </p>
        </section>

        {/* Contacto */}
        <section
          aria-labelledby="seccion-contacto"
          className="bg-gray-50 rounded-xl p-5 mt-6"
        >
          <h2
            id="seccion-contacto"
            className="text-base font-bold text-gray-900 mb-2"
          >
            ¿Tienes preguntas?
          </h2>
          <p className="text-gray-600 text-sm">
            Escríbenos a{' '}
            <a
              href="mailto:motekdev@gmail.com"
              className="text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
            >
              motekdev@gmail.com
            </a>{' '}
            o contáctanos por WhatsApp al{' '}
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
