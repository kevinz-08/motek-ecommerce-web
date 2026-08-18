import "dotenv/config";
import { PrismaClient, Role, OrderStatus, PaymentProvider, PaymentStatus } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] ?? '' })
const prisma = new PrismaClient({ adapter })

async function main() {
  // ─── Admin user ───────────────────────────────────────────────────────────
  // Credenciales de acceso al panel de administración:
  //   Email:      motekdev@gmail.com
  //   Contraseña: Admin123!
  const adminPassword = await bcrypt.hash('Admin123!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'motekdev@gmail.com' },
    update: { password: adminPassword },
    create: {
      email: 'motekdev@gmail.com',
      name: 'Admin Motek',
      role: Role.ADMIN,
      password: adminPassword,
    },
  })

  // ─── Test customer ────────────────────────────────────────────────────────
  // Credenciales de prueba:
  //   Email:      cliente@ejemplo.co
  //   Contraseña: Cliente123!
  const customerPassword = await bcrypt.hash('Cliente123!', 12)
  const customer = await prisma.user.upsert({
    where: { email: 'cliente@ejemplo.co' },
    update: { password: customerPassword },
    create: {
      email: 'cliente@ejemplo.co',
      name: 'Carlos Pérez',
      role: Role.CUSTOMER,
      password: customerPassword,
    },
  })

  // ─── Categories ───────────────────────────────────────────────────────────
  const sistemaElectrico = await prisma.category.upsert({
    where: { slug: 'sistema-electrico' },
    update: {},
    create: {
      name: 'Sistema Eléctrico',
      slug: 'sistema-electrico',
      description: 'Componentes eléctricos y electrónicos para motos',
    },
  })

  const motores = await prisma.category.upsert({
    where: { slug: 'motores' },
    update: { parentId: sistemaElectrico.id },
    create: {
      name: 'Motores',
      slug: 'motores',
      description: 'Repuestos de motor: pistones, anillos, cigüeñales',
      parentId: sistemaElectrico.id,
    },
  })

  const llantas = await prisma.category.upsert({
    where: { slug: 'llantas' },
    update: {},
    create: {
      name: 'Llantas',
      slug: 'llantas',
      description: 'Llantas y neumáticos para todo tipo de moto',
    },
  })

  // Categorías agregadas para tener datos de prueba en el navbar/showcases del
  // rediseño de landing (Llantas, Repuestos, Aceites, Sistema Eléctrico).
  const repuestos = await prisma.category.upsert({
    where: { slug: 'repuestos' },
    update: {},
    create: {
      name: 'Repuestos',
      slug: 'repuestos',
      description: 'Piezas originales y alternativas para tu moto',
    },
  })

  const aceites = await prisma.category.upsert({
    where: { slug: 'aceites' },
    update: {},
    create: {
      name: 'Aceites',
      slug: 'aceites',
      description: 'Lubricantes para todo tipo de motor',
    },
  })

  const frenos = await prisma.category.upsert({
    where: { slug: 'frenos' },
    update: { parentId: repuestos.id },
    create: {
      name: 'Frenos',
      slug: 'frenos',
      description: 'Pastillas, discos y kits de frenos para motos',
      parentId: repuestos.id,
    },
  })

  const accesorios = await prisma.category.upsert({
    where: { slug: 'accesorios' },
    update: {},
    create: {
      name: 'Accesorios',
      slug: 'accesorios',
      description: 'Cascos, guantes y equipo de protección',
    },
  })

  // ─── Products ─────────────────────────────────────────────────────────────
  const products = [
    // Frenos
    {
      name: 'Pastillas de freno Brembo Yamaha FZ25',
      slug: 'pastillas-freno-brembo-yamaha-fz25',
      description:
        'Pastillas de freno originales Brembo para Yamaha FZ25. Alta resistencia al calor y larga durabilidad. Desgaste progresivo para mayor seguridad.',
      price: 8500000, // $85.000 COP
      stock: 25,
      sku: 'FRE-BRE-FZ25-001',
      images: [],
      isActive: true,
      categoryId: frenos.id,
      compatible: [
        { brand: 'Yamaha', model: 'FZ25', year: 2020 },
        { brand: 'Yamaha', model: 'FZ25', year: 2021 },
        { brand: 'Yamaha', model: 'FZ25', year: 2022 },
      ],
    },
    {
      name: 'Disco de freno delantero Honda CB150',
      slug: 'disco-freno-delantero-honda-cb150',
      description:
        'Disco de freno delantero de alta calidad para Honda CB150. Acero inoxidable, diseño ventilado para mejor disipación de calor.',
      price: 19500000, // $195.000 COP
      stock: 15,
      sku: 'FRE-DIS-CB150-002',
      images: [],
      isActive: true,
      categoryId: frenos.id,
      compatible: [
        { brand: 'Honda', model: 'CB150', year: 2019 },
        { brand: 'Honda', model: 'CB150', year: 2020 },
        { brand: 'Honda', model: 'CB150', year: 2021 },
      ],
    },
    {
      name: 'Kit freno trasero AKT 125',
      slug: 'kit-freno-trasero-akt-125',
      description:
        'Kit completo de freno trasero para AKT 125. Incluye zapatas, resortes y pasadores. Fácil instalación.',
      price: 12000000, // $120.000 COP
      stock: 30,
      sku: 'FRE-KIT-AKT125-003',
      images: [],
      isActive: true,
      categoryId: frenos.id,
      compatible: [
        { brand: 'AKT', model: 'TT125', year: 2020 },
        { brand: 'AKT', model: 'NKD125', year: 2021 },
      ],
    },
    // Motores (hijo de Sistema Eléctrico)
    {
      name: 'Pistón completo Yamaha YBR 125',
      slug: 'piston-completo-yamaha-ybr125',
      description:
        'Pistón completo con anillos para Yamaha YBR 125. Aluminio de alta resistencia, medidas estándar. Incluye pasador y seguros.',
      price: 35000000, // $350.000 COP
      stock: 10,
      sku: 'MOT-PIS-YBR125-001',
      images: [],
      isActive: true,
      categoryId: motores.id,
      compatible: [{ brand: 'Yamaha', model: 'YBR125', year: 2018 }],
    },
    {
      name: 'Anillos motor Honda Wave 110',
      slug: 'anillos-motor-honda-wave-110',
      description:
        'Juego de anillos de motor para Honda Wave 110. Cromo duro, alta resistencia al desgaste. Medida estándar 50mm.',
      price: 18000000, // $180.000 COP
      stock: 20,
      sku: 'MOT-ANI-WAV110-002',
      images: [],
      isActive: true,
      categoryId: motores.id,
      compatible: [
        { brand: 'Honda', model: 'Wave 110', year: 2019 },
        { brand: 'Honda', model: 'Wave 110', year: 2020 },
      ],
    },
    {
      name: 'Cigüeñal Bajaj Boxer 150',
      slug: 'ciguenal-bajaj-boxer-150',
      description:
        'Cigüeñal completo con rodamientos para Bajaj Boxer 150. Balanceado de fábrica. Garantía de 6 meses.',
      price: 85000000, // $850.000 COP
      stock: 5,
      sku: 'MOT-CIG-BOX150-003',
      images: [],
      isActive: true,
      categoryId: motores.id,
      compatible: [{ brand: 'Bajaj', model: 'Boxer 150', year: 2020 }],
    },
    {
      name: 'Filtro de aceite Honda CBR 150',
      slug: 'filtro-aceite-honda-cbr150',
      description:
        'Filtro de aceite original para Honda CBR 150. Alta capacidad de filtración. Recomendado cambio cada 3.000 km.',
      price: 2500000, // $25.000 COP
      stock: 50,
      sku: 'MOT-FIL-CBR150-004',
      images: [],
      isActive: true,
      categoryId: motores.id,
      compatible: [
        { brand: 'Honda', model: 'CBR150R', year: 2020 },
        { brand: 'Honda', model: 'CBR150R', year: 2021 },
        { brand: 'Honda', model: 'CBR150R', year: 2022 },
      ],
    },
    // Llantas
    {
      name: 'Llanta delantera Pirelli 100/90-18',
      slug: 'llanta-delantera-pirelli-100-90-18',
      description:
        'Llanta delantera Pirelli Sport Demon 100/90-18. Excelente agarre en pavimento seco y mojado. Diseño sport de alto rendimiento.',
      price: 12500000, // $125.000 COP  — typo intencional para ver en UI si precio tiene decimales
      stock: 12,
      sku: 'LLA-PIR-100-90-18-001',
      images: [],
      isActive: true,
      categoryId: llantas.id,
      compatible: [],
    },
    {
      name: 'Llanta trasera Michelin 120/80-17',
      slug: 'llanta-trasera-michelin-120-80-17',
      description:
        'Llanta trasera Michelin Pilot Street 120/80-17. Compuesto de goma de larga duración. Ideal para uso urbano y carretera.',
      price: 15800000, // $158.000 COP
      stock: 8,
      sku: 'LLA-MIC-120-80-17-002',
      images: [],
      isActive: true,
      categoryId: llantas.id,
      compatible: [],
    },
    {
      name: 'Llanta todo terreno Maxxis 90/90-21',
      slug: 'llanta-todo-terreno-maxxis-90-90-21',
      description:
        'Llanta Maxxis Enduro 90/90-21 para uso mixto. Taco profundo para terrenos difíciles. Estructura reforzada anti-pinchazos.',
      price: 22000000, // $220.000 COP
      stock: 3,
      sku: 'LLA-MAX-90-90-21-003',
      images: [],
      isActive: true,
      categoryId: llantas.id,
      compatible: [],
    },
    {
      name: 'Llanta trasera Metzeler 130/70-17',
      slug: 'llanta-trasera-metzeler-130-70-17',
      description:
        'Llanta trasera Metzeler Sportec 130/70-17. Compuesto dual para máximo agarre en curva sin sacrificar duración.',
      price: 24500000, // $245.000 COP
      stock: 9,
      sku: 'LLA-MET-130-70-17-004',
      images: [],
      isActive: true,
      categoryId: llantas.id,
      compatible: [],
    },
    {
      name: 'Llanta delantera Continental 110/70-17',
      slug: 'llanta-delantera-continental-110-70-17',
      description:
        'Llanta delantera Continental ContiRoad 110/70-17. Excelente evacuación de agua, ideal para uso diario en ciudad y carretera.',
      price: 17800000, // $178.000 COP
      stock: 14,
      sku: 'LLA-CON-110-70-17-005',
      images: [],
      isActive: true,
      categoryId: llantas.id,
      compatible: [],
    },
    {
      name: 'Llanta trasera Dunlop 140/70-17',
      slug: 'llanta-trasera-dunlop-140-70-17',
      description:
        'Llanta trasera Dunlop D404 140/70-17. Diseño clásico de banda ancha, gran estabilidad a velocidad de crucero.',
      price: 21000000, // $210.000 COP
      stock: 6,
      sku: 'LLA-DUN-140-70-17-006',
      images: [],
      isActive: true,
      categoryId: llantas.id,
      compatible: [],
    },
    // Repuestos
    {
      name: 'Bujía NGK Iridium',
      slug: 'bujia-ngk-iridium',
      description:
        'Bujía de iridio NGK, encendido más eficiente y mayor vida útil que una bujía estándar. Compatible con la mayoría de motos 125-250cc.',
      price: 4500000, // $45.000 COP
      stock: 60,
      sku: 'REP-BUJ-NGK-001',
      images: [],
      isActive: true,
      categoryId: repuestos.id,
      compatible: [],
    },
    {
      name: 'Cadena de transmisión DID 428H',
      slug: 'cadena-transmision-did-428h',
      description:
        'Cadena de transmisión DID 428H reforzada, 120 eslabones. Tratamiento anticorrosivo, alta resistencia a la tracción.',
      price: 9800000, // $98.000 COP
      stock: 18,
      sku: 'REP-CAD-DID428-002',
      images: [],
      isActive: true,
      categoryId: repuestos.id,
      compatible: [],
    },
    {
      name: 'Kit de arrastre completo AKT 125',
      slug: 'kit-arrastre-completo-akt-125',
      description:
        'Kit de arrastre completo (cadena, piñón y catalina) para AKT 125. Todo lo necesario en un solo kit, fácil instalación.',
      price: 15500000, // $155.000 COP
      stock: 11,
      sku: 'REP-KIT-AKT125-003',
      images: [],
      isActive: true,
      categoryId: repuestos.id,
      compatible: [{ brand: 'AKT', model: 'TT125', year: 2020 }],
    },
    // Aceites
    {
      name: 'Aceite Motul 5100 10W40',
      slug: 'aceite-motul-5100-10w40',
      description:
        'Aceite semisintético Motul 5100 10W40 para motor 4 tiempos. Protección superior en condiciones exigentes, 1 litro.',
      price: 6800000, // $68.000 COP
      stock: 40,
      sku: 'ACE-MOT-5100-001',
      images: [],
      isActive: true,
      categoryId: aceites.id,
      compatible: [],
    },
    {
      name: 'Aceite Castrol Power1 20W50',
      slug: 'aceite-castrol-power1-20w50',
      description:
        'Aceite mineral Castrol Power1 20W50, fórmula de arranque rápido. Ideal para motos de baja y media cilindrada, 1 litro.',
      price: 4200000, // $42.000 COP
      stock: 55,
      sku: 'ACE-CAS-P1-002',
      images: [],
      isActive: true,
      categoryId: aceites.id,
      compatible: [],
    },
    {
      name: 'Aceite Liquimoly Street Race 10W50',
      slug: 'aceite-liquimoly-street-race-10w50',
      description:
        'Aceite 100% sintético Liquimoly Street Race 10W50. Máximo rendimiento para uso deportivo, 1 litro.',
      price: 9500000, // $95.000 COP
      stock: 22,
      sku: 'ACE-LIQ-SR-003',
      images: [],
      isActive: true,
      categoryId: aceites.id,
      compatible: [],
    },
    {
      name: 'Aceite de horquilla Motul 10W',
      slug: 'aceite-horquilla-motul-10w',
      description:
        'Aceite de horquilla Motul 10W, mantiene la viscosidad estable en un amplio rango de temperaturas. Presentación 1 litro.',
      price: 5800000, // $58.000 COP
      stock: 30,
      sku: 'ACE-HOR-MOT10-004',
      images: [],
      isActive: true,
      categoryId: aceites.id,
      compatible: [],
    },
    {
      name: 'Aceite de caja Liquimoly 80W90',
      slug: 'aceite-caja-liquimoly-80w90',
      description:
        'Aceite para caja de cambios y transmisión Liquimoly 80W90, protección extrema contra el desgaste. Presentación 1 litro.',
      price: 7200000, // $72.000 COP
      stock: 26,
      sku: 'ACE-CAJ-LIQ80-005',
      images: [],
      isActive: true,
      categoryId: aceites.id,
      compatible: [],
    },
    {
      name: 'Grasa para cadena Motul en spray',
      slug: 'grasa-cadena-motul-spray',
      description:
        'Grasa lubricante para cadena Motul en spray, fórmula adherente que resiste el agua y reduce el desgaste. 400ml.',
      price: 4500000, // $45.000 COP
      stock: 45,
      sku: 'ACE-GRA-CAD-006',
      images: [],
      isActive: true,
      categoryId: aceites.id,
      compatible: [],
    },
    // Accesorios
    {
      name: 'Casco integral LS2',
      slug: 'casco-integral-ls2',
      description:
        'Casco integral LS2 certificado, carcasa en policarbonato, visor antirayado. Disponible en varias tallas.',
      price: 28000000, // $280.000 COP
      stock: 16,
      sku: 'ACC-CAS-LS2-001',
      images: [],
      isActive: true,
      categoryId: accesorios.id,
      compatible: [],
    },
    {
      name: 'Guantes de moto Racing',
      slug: 'guantes-moto-racing',
      description:
        'Guantes de moto con protección en nudillos, palma reforzada antideslizante. Ajuste con velcro en muñeca.',
      price: 6500000, // $65.000 COP
      stock: 35,
      sku: 'ACC-GUA-RAC-002',
      images: [],
      isActive: true,
      categoryId: accesorios.id,
      compatible: [],
    },
    {
      name: 'Espejos retrovisores universales',
      slug: 'espejos-retrovisores-universales',
      description:
        'Par de espejos retrovisores universales, rosca 8mm y 10mm incluida. Ajuste de ángulo 360°.',
      price: 5200000, // $52.000 COP
      stock: 28,
      sku: 'ACC-ESP-UNI-003',
      images: [],
      isActive: true,
      categoryId: accesorios.id,
      compatible: [],
    },
    {
      name: 'Baúl trasero 32 litros',
      slug: 'baul-trasero-32-litros',
      description:
        'Baúl trasero de 32 litros con base universal, cierre con doble llave y respaldo acolchado para el pasajero.',
      price: 18500000, // $185.000 COP
      stock: 14,
      sku: 'ACC-BAU-32L-004',
      images: [],
      isActive: true,
      categoryId: accesorios.id,
      compatible: [],
    },
    {
      name: 'Cubre moto impermeable talla L',
      slug: 'cubre-moto-impermeable-l',
      description:
        'Cubierta impermeable talla L, protege contra sol, lluvia y polvo. Costuras selladas y correa de ajuste inferior.',
      price: 7800000, // $78.000 COP
      stock: 20,
      sku: 'ACC-CUB-L-005',
      images: [],
      isActive: true,
      categoryId: accesorios.id,
      compatible: [],
    },
    {
      name: 'Candado de disco con alarma',
      slug: 'candado-disco-alarma',
      description:
        'Candado de disco con alarma de 110dB, sensor de movimiento y estuche de transporte incluido.',
      price: 9200000, // $92.000 COP
      stock: 25,
      sku: 'ACC-CAN-ALM-006',
      images: [],
      isActive: true,
      categoryId: accesorios.id,
      compatible: [],
    },
    {
      name: 'Portacelular resistente al agua',
      slug: 'portacelular-resistente-agua',
      description:
        'Soporte para celular con funda resistente al agua, giro 360° y ajuste universal para manubrio.',
      price: 3900000, // $39.000 COP
      stock: 40,
      sku: 'ACC-POR-CEL-007',
      images: [],
      isActive: true,
      categoryId: accesorios.id,
      compatible: [],
    },
    {
      name: 'Manoplas térmicas universales',
      slug: 'manoplas-termicas-universales',
      description:
        'Manoplas térmicas para manubrio, protegen del frío y la lluvia. Instalación sin herramientas especiales.',
      price: 6200000, // $62.000 COP
      stock: 18,
      sku: 'ACC-MAN-TER-008',
      images: [],
      isActive: true,
      categoryId: accesorios.id,
      compatible: [],
    },
    {
      name: 'Alforjas laterales impermeables',
      slug: 'alforjas-laterales-impermeables',
      description:
        'Par de alforjas laterales impermeables, 20 litros de capacidad total, tiras reflectivas para mayor visibilidad.',
      price: 14500000, // $145.000 COP
      stock: 12,
      sku: 'ACC-ALF-LAT-009',
      images: [],
      isActive: true,
      categoryId: accesorios.id,
      compatible: [],
    },
  ]

  for (const { compatible, ...productData } of products) {
    const product = await prisma.product.upsert({
      where: { sku: productData.sku },
      update: {},
      create: {
        ...productData,
        compatible: {
          create: compatible,
        },
      },
    })
    console.log(`✓ Producto: ${product.name}`)
  }

  // ─── Settings ─────────────────────────────────────────────────────────────
  await prisma.settings.upsert({
    where: { key: 'MERCADOPAGO_ENABLED' },
    update: {},
    create: { key: 'MERCADOPAGO_ENABLED', value: 'false' },
  })
  await prisma.settings.upsert({
    where: { key: 'COD_ENABLED' },
    update: {},
    create: { key: 'COD_ENABLED', value: 'true' },
  })

  // ─── Sample orders ────────────────────────────────────────────────────────
  const product1 = await prisma.product.findUnique({ where: { sku: 'FRE-BRE-FZ25-001' } })
  const product2 = await prisma.product.findUnique({ where: { sku: 'LLA-PIR-100-90-18-001' } })

  if (product1 && product2) {
    // Orden pagada
    const paidOrder = await prisma.order.create({
      data: {
        userId: customer.id,
        status: OrderStatus.PAID,
        total: product1.price + product2.price,
        paymentProvider: PaymentProvider.WOMPI,
        shippingAddress: {
          fullName: 'Carlos Pérez',
          address: 'Calle 45 # 23-10, Apto 302',
          city: 'Medellín',
          department: 'Antioquia',
          phone: '3001234567',
        },
        items: {
          create: [
            { productId: product1.id, quantity: 1, priceAtPurchase: product1.price },
            { productId: product2.id, quantity: 1, priceAtPurchase: product2.price },
          ],
        },
        payment: {
          create: {
            provider: PaymentProvider.WOMPI,
            externalId: 'WOMPI-TEST-123456',
            status: PaymentStatus.APPROVED,
            amount: product1.price + product2.price,
          },
        },
      },
    })
    console.log(`✓ Orden pagada: ${paidOrder.id}`)

    // Orden pendiente
    const pendingOrder = await prisma.order.create({
      data: {
        userId: customer.id,
        status: OrderStatus.PENDING,
        total: product2.price * 2,
        paymentProvider: PaymentProvider.WOMPI,
        shippingAddress: {
          fullName: 'Carlos Pérez',
          address: 'Calle 45 # 23-10, Apto 302',
          city: 'Medellín',
          department: 'Antioquia',
          phone: '3001234567',
        },
        items: {
          create: [
            { productId: product2.id, quantity: 2, priceAtPurchase: product2.price },
          ],
        },
        payment: {
          create: {
            provider: PaymentProvider.WOMPI,
            status: PaymentStatus.PENDING,
            amount: product2.price * 2,
          },
        },
      },
    })
    console.log(`✓ Orden pendiente: ${pendingOrder.id}`)
  }

  console.log('\n✅ Seed completado')
  console.log('\n─── Credenciales de acceso ───────────────────────')
  console.log(`  Admin:`)
  console.log(`    Email:      ${admin.email}`)
  console.log(`    Contraseña: Admin123!`)
  console.log(`    Panel:      /admin`)
  console.log(`  Cliente de prueba:`)
  console.log(`    Email:      ${customer.email}`)
  console.log(`    Contraseña: Cliente123!`)
  console.log('──────────────────────────────────────────────────')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
