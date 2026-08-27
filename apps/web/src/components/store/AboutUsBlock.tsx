import { Card } from '@/components/ui/Card'

const ABOUT_US = [
  {
    title: '¿Quiénes somos?',
    text: 'En Motek Store queremos ser la mejor opción para tu motocicleta. Nos especializamos en la comercialización online de repuestos y accesorios multimarca para motocicletas en Colombia, ofreciendo un catálogo completo, seguro y al alcance de un clic.',
  },
  {
    title: 'Calidad que confías',
    text: 'Entendemos que tu tiempo y la seguridad de tu moto son lo primero. Por eso seleccionamos piezas de alta calidad y accesorios que elevan tu experiencia de conducción, con envíos rápidos y un proceso de compra fácil y confiable.',
  },
  {
    title: 'Donde estés, contigo',
    text: 'No importa en qué rincón del país estés, nuestro compromiso es mantenerte en movimiento con la tranquilidad de que llevas lo mejor en cada camino que recorres con tu moto.',
  },
]

export function AboutUsBlock() {
  return (
    <section className="bg-[var(--c-surface)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="inline-block text-xs font-semibold uppercase tracking-wider text-[var(--c-accent)] bg-[var(--c-active-bg)] px-3 py-1 rounded-[var(--radius-full)]">
          Quiénes somos
        </span>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-[var(--c-text)] tracking-tight">
          Hablemos, estamos para ayudarte
        </h1>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-left">
          {ABOUT_US.map(({ title, text }) => (
            <Card
              key={title}
              className="bg-[var(--c-surface-2)] hover:border-[var(--c-accent)]/30"
              hover
            >
              <h2 className="text-sm font-semibold text-[var(--c-text)] mb-1.5">{title}</h2>
              <p className="text-sm text-[var(--c-text-3)] leading-relaxed">{text}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
