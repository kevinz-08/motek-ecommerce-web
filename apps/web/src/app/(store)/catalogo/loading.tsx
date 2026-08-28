import { SkeletonBlock, SkeletonLine } from '@/components/ui/Skeleton'

function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <SkeletonBlock className="w-full aspect-square rounded-none" />
      <div className="p-4 space-y-2">
        <SkeletonLine className="w-3/4" />
        <SkeletonLine className="w-1/2" />
        <SkeletonLine className="w-1/3 mt-3" />
      </div>
    </div>
  )
}

export default function CatalogoLoading() {
  return (
    <div className="bg-white min-h-screen">

      {/* Breadcrumb + título */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-2 mb-2">
            <SkeletonLine className="w-12" />
            <SkeletonLine className="w-2 h-2 rounded-full" />
            <SkeletonLine className="w-16" />
          </div>
          <SkeletonLine className="w-48 h-8 rounded-lg" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="w-28 h-9 rounded-xl" />
            <SkeletonBlock className="w-24 h-7 rounded-full hidden sm:block" />
          </div>
          <SkeletonLine className="w-24" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>

      </div>
    </div>
  )
}
