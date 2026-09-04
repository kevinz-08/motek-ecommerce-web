/**
 * scripts/upload-catalog.ts
 *
 * Lee la carpeta de productos descargada de Google Drive, sube todas las
 * imágenes a Cloudinary y genera prisma/catalog-upload.ts con los productos
 * listos para pegar en catalog.ts.
 *
 * Estructura esperada después de descargar de Drive en Windows:
 *   BASE_DIR/
 *     ELECTRICOS-REGULADORES/          ← nombre = PADRE-SUBCATEGORIA
 *       7-RR23-REGULADOR HONDA CB-1-85000/   ← SKU-NOMBRE-STOCK-PRECIO
 *         1   (o 1.jpeg)
 *         2
 *         ...
 *
 * Uso:
 *   1. Cambia BASE_DIR a la ruta donde descomprimiste las carpetas de Drive
 *   2. npx tsx scripts/upload-catalog.ts
 *   3. Revisa prisma/catalog-upload.ts y pega los productos en catalog.ts
 */
import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Next.js usa .env.local para secretos — dotenv/config solo carga .env
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

// ─── CONFIGURA ESTA RUTA ──────────────────────────────────────────────────────
const BASE_DIR = path.resolve('./tmp-productos')
// ─────────────────────────────────────────────────────────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
})

// Mapeo: nombre de carpeta en Drive → slug en la BD
// Agrega aquí cada carpeta nueva que aparezca en tu descarga
const PARENT_SLUG: Record<string, string> = {
  'ELECTRICOS': 'sistema-electrico',
  'REPUESTOS':  'repuestos',
  'ACEITES':    'aceites',
  'LLANTAS':    'llantas',
  'ACCESORIOS': 'accesorios',
}

const CHILD_SLUG: Record<string, string> = {
  // Sistema Eléctrico
  'REGULADORES':    'reguladores',
  'RERGULADORES':   'reguladores',   // typo frecuente en Drive
  'RAMALES':        'ramales',
  'CDI':            'cdi',
  'BATERIAS':       'baterias',
  'ESTATORES':      'estatores',
  'BOBINAS':           'bobinas',
  'BOBINAS DE ALTA':   'bobinas',
  'SENSORES':          'sensores',
  'MOTORES DE ARRANQUE': 'motores-de-arranque',
  // Repuestos
  'FILTRO DE AIRE': 'filtro-de-aire',
  'BUJIAS':         'bujias',
  'CONECTORES':     'conectores',
  'FRENOS':         'frenos',
  'REPUESTOS MOTOR':'repuestos-motor',
  // Aceites
  'LIQUIMOLY':      'liquimoly',
  'CASTROL':        'castrol',
  // Llantas (categoría padre sin subcategoría)
  'LLANTAS':        'llantas',
  'KONTROL':        'kontrol',
  'DUNLOP':         'dunlop',
  'SKY':            'sky',
  // Accesorios
  'ESPEJOS':               'espejos',
  'EXPLORADORES':          'exploradores',
  'BOMBILLAS LED':         'bombillas-led',
  'EQUIPAMIENTO':          'equipamiento',
  'OBJETIVO':              'objetivo',
  'BALACLAVAS':            'balaclavas',
  'FENDER':                'fender',
  'FILTROS DE AIRE':       'filtros-de-aire',
  'SEGURIDAD':             'seguridad',
  'STOP':                  'stop',
  'ACCESORIOS GENERALES':  'accesorios-generales',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * ELECTRICOS-REGULADORES → { parent: 'ELECTRICOS', child: 'REGULADORES' }
 * LLANTAS               → { parent: 'LLANTAS',     child: 'LLANTAS' }  (categoría sin subcategoría)
 */
function parseCatFolder(name: string): { parent: string; child: string } | null {
  const idx = name.indexOf('-')
  if (idx === -1) {
    // Carpeta de categoría padre sin subcategoría (ej: LLANTAS)
    const word = name.trim()
    return CHILD_SLUG[word] ? { parent: word, child: word } : null
  }
  return {
    parent: name.slice(0, idx).trim(),
    child:  name.slice(idx + 1).trim(),
  }
}

/**
 * 7-RR23-REGULADOR HONDA CB 110-1-85000
 *   → { sku: '7-RR23', name: 'REGULADOR HONDA CB 110', stock: 1, price: 8500000 }
 *
 * Estrategia:
 *   1. Extrae STOCK y PRECIO del final con regex: -DIGITS(1-4)-DIGITS(4-7)$
 *   2. Extrae SKU del inicio con regex: ^DIGITS-ALPHANUM-
 *   3. Lo que queda es el NOMBRE
 */
function parseProdFolder(name: string): {
  sku: string; name: string; stock: number; price: number
} | null {
  // Normalizar: quitar puntos de miles en el precio (ej: 52.000 → 52000)
  const normalized = name.replace(/(\d)\.(\d{3})(?=\s*$|-\s*\d)/g, '$1$2')

  // Paso 1 — stock y precio al final. Acepta espacios antes/después del guión
  const tailMatch = normalized.match(/-\s*(\d{1,4})\s*-\s*(\d{4,7})\s*$/)
  if (!tailMatch) return null

  const stock = parseInt(tailMatch[1]!, 10)
  const price = parseInt(tailMatch[2]!, 10) * 100  // COP → centavos

  const withoutTail = normalized.slice(0, normalized.lastIndexOf(tailMatch[0]!)).trim()

  // Paso 2 — SKU al inicio (formato: número + guión + código alfanumérico)
  const skuMatch = withoutTail.match(/^(\d+-[A-Z0-9]+)-(.+)$/i)
  if (!skuMatch) return null

  return {
    sku:   skuMatch[1]!.trim(),
    name:  skuMatch[2]!.trim(),
    stock,
    price,
  }
}

/** Retorna máximo 5 archivos de imagen ordenados: primero numéricos, luego alfabéticos */
function getImages(dir: string): string[] {
  return fs.readdirSync(dir)
    .filter(f => /\.(jpe?g|webp)$/i.test(f) && fs.statSync(path.join(dir, f)).isFile())
    .sort((a, b) => {
      const na = parseInt(path.parse(a).name)
      const nb = parseInt(path.parse(b).name)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.localeCompare(b)
    })
    .slice(0, 4)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type ProductEntry = {
  sku:          string
  name:         string
  slug:         string
  description:  string
  price:        number
  stock:        number
  images:       string[]
  isActive:     boolean
  categorySlug: string
  compatible:   Array<{ brand: string; model: string; year?: number }>
}

async function main() {
  if (!fs.existsSync(BASE_DIR)) {
    console.error(`❌  BASE_DIR no existe: ${BASE_DIR}`)
    console.error('   Edita la variable BASE_DIR en el script con la ruta correcta.')
    process.exit(1)
  }

  const products: ProductEntry[] = []
  const warnings: string[] = []

  const catFolders = fs.readdirSync(BASE_DIR).filter(f =>
    fs.statSync(path.join(BASE_DIR, f)).isDirectory()
  )

  for (const catFolder of catFolders) {
    const catPath = path.join(BASE_DIR, catFolder)
    const catParts = parseCatFolder(catFolder)

    if (!catParts) {
      warnings.push(`Carpeta ignorada (sin separador '-'): ${catFolder}`)
      continue
    }

    const categorySlug = CHILD_SLUG[catParts.child]
    if (!categorySlug) {
      warnings.push(`Subcategoría desconocida: "${catParts.child}" — agrega la entrada a CHILD_SLUG`)
      continue
    }

    console.log(`\n📂  ${catFolder}  →  ${categorySlug}`)

    const prodFolders = fs.readdirSync(catPath).filter(f =>
      fs.statSync(path.join(catPath, f)).isDirectory()
    )

    for (const prodFolder of prodFolders) {
      const prodPath = path.join(catPath, prodFolder)
      const parsed   = parseProdFolder(prodFolder)

      if (!parsed) {
        warnings.push(`Producto no parseado: ${prodFolder}`)
        continue
      }

      const { sku, name, stock, price } = parsed
      const imgFiles = getImages(prodPath)

      if (imgFiles.length === 0) {
        warnings.push(`Sin imágenes: ${prodFolder}`)
        continue
      }

      console.log(`  ⬆  ${sku} — ${name} (${imgFiles.length} img)`)

      const imagePublicIds: string[] = []

      for (let i = 0; i < imgFiles.length; i++) {
        const publicId = `products/${sku}/${i + 1}`
        try {
          await cloudinary.uploader.upload(path.join(prodPath, imgFiles[i]), {
            public_id:     publicId,
            overwrite:     true,
            resource_type: 'image',
          })
          imagePublicIds.push(publicId)
          process.stdout.write(`     ✓ ${publicId}\n`)
        } catch (err) {
          warnings.push(`Error subiendo imagen ${imgFiles[i]} de ${sku}: ${err}`)
        }
      }

      if (imagePublicIds.length === 0) continue

      products.push({
        sku,
        name,
        slug:         toSlug(sku),
        description:  '',
        price,
        stock,
        images:       imagePublicIds,
        isActive:     true,
        categorySlug,
        compatible:   [],
      })
    }
  }

  // ─── Generar archivo de salida ──────────────────────────────────────────────

  const entries = products.map(p => `  {
    sku:          '${p.sku}',
    name:         '${p.name.replace(/'/g, "\\'")}',
    slug:         '${p.slug}',
    description:  '',
    price:        ${p.price},
    stock:        ${p.stock},
    images:       ${JSON.stringify(p.images)},
    isActive:     true,
    categorySlug: '${p.categorySlug}',
    compatible:   [],
  }`).join(',\n')

  const output = `// AUTO-GENERADO — ${new Date().toISOString()}
// Generados ${products.length} productos desde ${BASE_DIR}
//
// ¿Cómo usar?
//   Copia el contenido del array de abajo y pégalo dentro del array PRODUCTS
//   en prisma/catalog.ts, luego corre: npm run db:catalog
//
// Campos que deberías revisar manualmente:
//   - description: agregar texto descriptivo para SEO
//   - compatible:  agregar compatibilidades de marca/modelo/año
//   - slug:        actualmente usa el SKU; cámbialo si prefieres algo más descriptivo

export const UPLOADED_PRODUCTS = [
${entries}
]
`

  const outPath = path.resolve('../../packages/database/prisma/catalog-upload.ts')
  fs.writeFileSync(outPath, output, 'utf-8')

  console.log(`\n✅  ${products.length} productos generados → prisma/catalog-upload.ts`)

  if (warnings.length) {
    console.log(`\n⚠️   ${warnings.length} advertencias:`)
    warnings.forEach(w => console.log(`    • ${w}`))
  }
}

main().catch(err => {
  console.error('❌  Error fatal:', err)
  process.exit(1)
})
