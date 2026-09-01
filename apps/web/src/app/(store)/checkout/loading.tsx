import { SkeletonBlock, SkeletonLine } from '@/components/ui/Skeleton'

function FieldSkeleton() {
  return (
    <div className="space-y-1.5">
      <SkeletonLine className="w-28" />
      <SkeletonBlock className="w-full h-10 rounded-xl" />
    </div>
  )
}

export default function CheckoutLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <SkeletonLine className="w-52 h-9 rounded-lg mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">

        {/* Formulario de envío */}
        <div className="space-y-5">
          <SkeletonLine className="w-40 h-6 rounded-lg" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          <FieldSkeleton />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          <FieldSkeleton />
          <FieldSkeleton />

          <SkeletonBlock className="w-full h-12 rounded-xl mt-2" />
        </div>

        {/* Resumen del pedido */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4 h-fit">
          <SkeletonLine className="w-36 h-5 rounded-lg" />

          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonBlock className="w-12 h-12 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonLine className="w-3/4" />
                  <SkeletonLine className="w-1/3" />
                </div>
                <SkeletonLine className="w-16 shrink-0" />
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
            <SkeletonLine className="w-16 h-5" />
            <SkeletonLine className="w-24 h-6 rounded-lg" />
          </div>
        </div>

      </div>
    </div>
  )
}
