import Link from 'next/link'
import Image from 'next/image'
import { Category } from '@motek/domain'

const CATEGORY_IMAGES: Record<string, string> = {
  'sistema-electrico': '/assets/category/sistema-electrico.webp',
  'repuestos': '/assets/category/repuestos.webp',
  'aceites': '/assets/category/aceites.webp',
  'llantas': '/assets/category/llantas.webp',
  'accesorios': '/assets/category/accesorios.webp',
}

interface CategoryGridProps {
  categories: Category[]
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  return (
    <section id="categorias" className="py-20 px-4 bg-[var(--c-surface)]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-[var(--c-text)]">
            Conoce Nuestras Categorías
          </h2>
        </div>

        <div className="flex items-stretch justify-start lg:justify-center gap-5 overflow-x-auto lg:overflow-visible scrollbar-hide pb-2">
          {categories.map((cat) => {
            const imgSrc = CATEGORY_IMAGES[cat.slug] ?? '/assets/category/default.jpg'

            return (
              <Link
                key={cat.id}
                href={`/catalogo?category=${cat.slug}`}
                className="group relative shrink-0 w-[219px] sm:w-[247px] md:w-[272px] aspect-[4/5] rounded-[var(--radius-lg)] overflow-hidden border border-[var(--c-border)] shadow-[var(--shadow-sm)] transition-shadow duration-[var(--dur-hover)] hover:shadow-[var(--shadow-md)]"
              >
                <Image
                  src={imgSrc}
                  alt={cat.name}
                  fill
                  sizes="(max-width: 640px) 219px, (max-width: 768px) 247px, 272px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <h3 className="absolute bottom-0 left-0 right-0 p-5 text-xl md:text-2xl font-black uppercase tracking-tight text-white leading-tight">
                  {cat.name}
                </h3>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
