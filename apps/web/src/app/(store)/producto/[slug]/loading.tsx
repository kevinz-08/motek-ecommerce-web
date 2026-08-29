import { SkeletonBlock, SkeletonLine } from '@/components/ui/Skeleton'

export default function ProductoLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

          {/* Galería */}
          <div className="space-y-3">
            <SkeletonBlock className="w-full aspect-square rounded-2xl" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          </div>

          {/* Detalle */}
          <div className="space-y-4">
            <SkeletonLine className="w-24" />
            <SkeletonLine className="w-4/5 h-8 rounded-lg" />
            <SkeletonLine className="w-2/5 h-9 rounded-lg mt-2" />

            {/* Stock badge */}
            <SkeletonBlock className="w-36 h-6 rounded-full" />

            {/* Botón agregar al carrito */}
            <SkeletonBlock className="w-full h-12 rounded-xl mt-2" />

            {/* Trust badges */}
            <div className="flex gap-6 mt-2">
              <SkeletonLine className="w-36" />
              <SkeletonLine className="w-36" />
            </div>

            <hr className="border-gray-100 my-4" />

            {/* Descripción */}
            <div className="space-y-2">
              <SkeletonLine className="w-28 h-5 rounded-lg" />
              <SkeletonLine className="w-full" />
              <SkeletonLine className="w-full" />
              <SkeletonLine className="w-3/4" />
            </div>

            {/* Compatibilidad */}
            <div className="mt-6 space-y-3">
              <SkeletonLine className="w-32 h-5 rounded-lg" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonBlock key={i} className="w-28 h-7 rounded-full" />
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
