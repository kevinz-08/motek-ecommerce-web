import { SkeletonBlock, SkeletonLine } from '@/components/ui/Skeleton'

function OrderCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <SkeletonLine className="w-24 h-5" />
          <SkeletonBlock className="w-20 h-6 rounded-full" />
        </div>
        <div className="flex items-center gap-4">
          <SkeletonLine className="w-24" />
          <SkeletonLine className="w-20 h-5" />
        </div>
      </div>

      {/* Items */}
      <div className="px-6 py-4 space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <SkeletonBlock className="w-14 h-14 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <SkeletonLine className="w-3/4" />
              <SkeletonLine className="w-1/3" />
            </div>
            <SkeletonLine className="w-16 shrink-0" />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <SkeletonLine className="w-40" />
        <SkeletonLine className="w-20" />
      </div>

    </div>
  )
}

export default function PedidosLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8 space-y-2">
          <SkeletonLine className="w-44 h-9 rounded-lg" />
          <SkeletonLine className="w-32" />
        </div>

        {/* Order cards */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>

      </div>
    </div>
  )
}
