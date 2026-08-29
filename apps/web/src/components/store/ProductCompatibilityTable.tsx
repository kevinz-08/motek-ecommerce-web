import { MotorcycleCompatibility } from '@motek/domain'

interface Props {
  compatible: MotorcycleCompatibility[]
}

export function ProductCompatibilityTable({ compatible }: Props) {
  if (compatible.length === 0) return null

  return (
    <div>
      <h2 className="text-lg font-semibold c-text mb-3">🏍️ Compatibilidad</h2>
      <div className="overflow-x-auto rounded-xl border c-border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b c-border text-left c-text-3 bg-[var(--c-surface)]">
              <th className="py-2.5 px-4 font-medium">Marca</th>
              <th className="py-2.5 px-4 font-medium">Modelo</th>
              <th className="py-2.5 px-4 font-medium">Año</th>
            </tr>
          </thead>
          <tbody>
            {compatible.map((c) => (
              <tr key={c.id} className="border-b c-border last:border-b-0 c-text-2">
                <td className="py-2.5 px-4">{c.brand}</td>
                <td className="py-2.5 px-4">{c.model}</td>
                <td className="py-2.5 px-4">{c.year ?? 'Todos'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
