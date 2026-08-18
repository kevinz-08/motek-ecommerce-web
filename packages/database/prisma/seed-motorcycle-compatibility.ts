/**
 * prisma/seed-motorcycle-compatibility.ts — Poblar MotorcycleCompatibility
 *
 * Marcas objetivo (pedidas por negocio): AKT, Auteco, Bajaj, Benelli, Hero,
 * Honda, Kawasaki, KTM, Royal Enfield, Suzuki, TVS, Yamaha.
 *
 * Dos fuentes de compatibilidad, ambas ligadas a productos REALES ya
 * sembrados por `catalog.ts` (nunca se inventa qué producto sirve para qué
 * moto):
 *
 *   1. SPECIFIC_COMPATIBILITY — marca/modelo extraído directamente del
 *      nombre/SKU real del producto (ej. "FILTRO AIRE ALTO FLUJO GIXXER 150"
 *      → Suzuki Gixxer 150). Es dato verificable en el propio catálogo, no
 *      una asociación al azar.
 *   2. UNIVERSAL_SKUS — accesorios/consumibles que por naturaleza no
 *      dependen de una moto puntual (cascos, candados, aceites, bombillos
 *      H4, balaclavas, bujías...). Se etiquetan como "Todos los modelos"
 *      en cada una de las 12 marcas, para que esas marcas aparezcan en el
 *      selector aunque el catálogo actual no tenga todavía un repuesto
 *      específico para ellas (Royal Enfield, Kawasaki, Benelli y Hero no
 *      tienen hoy ningún repuesto con modelo puntual en el nombre).
 *
 * El script es idempotente: por cada SKU borra su compatibilidad previa y
 * la vuelve a crear, así que se puede re-ejecutar sin duplicar filas.
 *
 * Ejecutar: npm run db:moto-compat
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] ?? '' })
const prisma = new PrismaClient({ adapter })

const BRANDS = [
  'AKT', 'Auteco', 'Bajaj', 'Benelli', 'Hero', 'Honda',
  'Kawasaki', 'KTM', 'Royal Enfield', 'Suzuki', 'TVS', 'Yamaha',
] as const

// ─── Compatibilidad específica — derivada del nombre real del producto ────────
// (SKUs y nombres tomados de los 31 productos realmente sembrados en esta BD —
// ver `prisma/seed.ts` — no de `catalog.ts`, que describe un catálogo distinto
// que todavía no se cargó en este entorno.)
const SPECIFIC_COMPATIBILITY: Record<string, Array<{ brand: string; model: string; year?: number }>> = {
  'FRE-BRE-FZ25-001':  [{ brand: 'Yamaha', model: 'FZ25', year: 2020 }, { brand: 'Yamaha', model: 'FZ25', year: 2021 }, { brand: 'Yamaha', model: 'FZ25', year: 2022 }],
  'FRE-DIS-CB150-002': [{ brand: 'Honda', model: 'CB150', year: 2019 }, { brand: 'Honda', model: 'CB150', year: 2020 }, { brand: 'Honda', model: 'CB150', year: 2021 }],
  'FRE-KIT-AKT125-003': [{ brand: 'AKT', model: 'AKT 125' }],
  'MOT-PIS-YBR125-001': [{ brand: 'Yamaha', model: 'YBR125', year: 2018 }],
  'MOT-ANI-WAV110-002': [{ brand: 'Honda', model: 'Wave 110', year: 2019 }, { brand: 'Honda', model: 'Wave 110', year: 2020 }],
  'MOT-CIG-BOX150-003': [{ brand: 'Bajaj', model: 'Boxer 150', year: 2020 }],
  'MOT-FIL-CBR150-004': [{ brand: 'Honda', model: 'CBR150R', year: 2020 }, { brand: 'Honda', model: 'CBR150R', year: 2021 }, { brand: 'Honda', model: 'CBR150R', year: 2022 }],
  'REP-KIT-AKT125-003': [{ brand: 'AKT', model: 'TT125', year: 2020 }, { brand: 'AKT', model: 'NKD125', year: 2021 }],
}

// ─── Accesorios/consumibles de ajuste universal ───────────────────────────────
// El resto del catálogo (llantas de medida genérica, aceites, accesorios y
// consumibles como bujía/cadena) no referencia una moto puntual en su nombre —
// son productos que realmente calzan en cualquier marca/modelo. Se marcan
// "Todos los modelos" en las 12 marcas para que Auteco, Benelli, Hero,
// Kawasaki, KTM, Royal Enfield, Suzuki y TVS —que hoy no tienen ningún
// repuesto con modelo puntual en este catálogo de 31 productos— igual
// aparezcan en el selector "Buscar por moto".
const UNIVERSAL_SKUS = [
  'REP-BUJ-NGK-001', 'REP-CAD-DID428-002',
  'LLA-PIR-100-90-18-001', 'LLA-MIC-120-80-17-002', 'LLA-MAX-90-90-21-003',
  'LLA-MET-130-70-17-004', 'LLA-CON-110-70-17-005', 'LLA-DUN-140-70-17-006',
  'ACE-MOT-5100-001', 'ACE-CAS-P1-002', 'ACE-LIQ-SR-003', 'ACE-HOR-MOT10-004',
  'ACE-CAJ-LIQ80-005', 'ACE-GRA-CAD-006',
  'ACC-CAS-LS2-001', 'ACC-GUA-RAC-002', 'ACC-ESP-UNI-003', 'ACC-BAU-32L-004',
  'ACC-CUB-L-005', 'ACC-CAN-ALM-006', 'ACC-POR-CEL-007', 'ACC-MAN-TER-008',
  'ACC-ALF-LAT-009',
]

async function main() {
  console.log('🏍️  Poblando MotorcycleCompatibility...\n')

  let specificRows = 0
  let universalRows = 0
  let notFound = 0

  console.log('📌 Compatibilidad específica:')
  for (const [sku, entries] of Object.entries(SPECIFIC_COMPATIBILITY)) {
    const product = await prisma.product.findUnique({ where: { sku } })
    if (!product) {
      console.warn(`  ⚠️  SKU no encontrado: ${sku}`)
      notFound++
      continue
    }
    await prisma.motorcycleCompatibility.deleteMany({ where: { productId: product.id } })
    await prisma.motorcycleCompatibility.createMany({
      data: entries.map((e) => ({ productId: product.id, brand: e.brand, model: e.model, year: e.year ?? null })),
    })
    specificRows += entries.length
    console.log(`  ✓ [${sku}] ${product.name} → ${entries.map((e) => `${e.brand} ${e.model}`).join(', ')}`)
  }

  console.log('\n🧩 Accesorios universales (todas las marcas):')
  for (const sku of UNIVERSAL_SKUS) {
    const product = await prisma.product.findUnique({ where: { sku } })
    if (!product) {
      console.warn(`  ⚠️  SKU no encontrado: ${sku}`)
      notFound++
      continue
    }
    await prisma.motorcycleCompatibility.deleteMany({ where: { productId: product.id } })
    await prisma.motorcycleCompatibility.createMany({
      data: BRANDS.map((brand) => ({ productId: product.id, brand, model: 'Todos los modelos', year: null })),
    })
    universalRows += BRANDS.length
    console.log(`  ✓ [${sku}] ${product.name} → universal (12 marcas)`)
  }

  console.log(`\n✅ Compatibilidad cargada: ${specificRows} filas específicas + ${universalRows} filas universales`)
  if (notFound > 0) console.log(`⚠️  ${notFound} SKUs no encontrados en la base de datos`)

  const distinctBrands = await prisma.motorcycleCompatibility.findMany({
    select: { brand: true },
    distinct: ['brand'],
    orderBy: { brand: 'asc' },
  })
  console.log(`\n📋 Marcas con al menos un producto compatible: ${distinctBrands.map((b) => b.brand).join(', ')}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
