import type { Metadata } from 'next'
import { AboutUsBlock } from '@/components/store/AboutUsBlock'
import { PqrForm } from '@/components/store/PqrForm'
import { ContactInfoBlock } from '@/components/store/ContactInfoBlock'
import { Card } from '@/components/ui/Card'

export const metadata: Metadata = {
  title: 'Contáctanos | Motek Store',
  description: 'Escríbenos tus preguntas, quejas o reclamos. Te respondemos por correo o WhatsApp.',
}

export default function ContactoPage() {
  return (
    <div className="bg-[var(--c-surface)]">
      <div className="py-14 sm:py-20">
        <AboutUsBlock />
      </div>

      <section className="bg-[var(--c-surface-2)] py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10">
            <Card className="lg:col-span-3">
              <h2 className="text-lg font-semibold text-[var(--c-text)]">Radica tu PQR</h2>
              <p className="mt-1 mb-6 text-sm text-[var(--c-text-3)]">
                Peticiones, quejas y reclamos — te respondemos en máximo 48 horas hábiles.
              </p>
              <PqrForm />
            </Card>

            <div className="lg:col-span-2">
              <ContactInfoBlock />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
