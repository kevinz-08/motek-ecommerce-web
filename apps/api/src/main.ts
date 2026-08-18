import './instrument'
import 'reflect-metadata'
import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import helmet from 'helmet'
import compression = require('compression')
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './shared/filters/http-exception.filter'
import { StructuredLogger } from './shared/logger/StructuredLogger'
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor'

type CorsOriginCallback = (err: Error | null, allow?: boolean) => void

function getCorsOrigin(origin: string | undefined, callback: CorsOriginCallback): void {
  // Peticiones sin origin: server-side, Swagger, curl
  if (!origin) return callback(null, true)

  const isProd = process.env['NODE_ENV'] === 'production'
  const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'

  if (isProd) {
    // Producción: solo el frontend declarado en FRONTEND_URL
    return origin === frontendUrl
      ? callback(null, true)
      : callback(null, false)
  }

  // Desarrollo: frontend, localhost y subdominios ngrok (para webhooks locales)
  const devAllowed = [frontendUrl, 'http://localhost:3000']
  if (
    devAllowed.includes(origin) ||
    origin.endsWith('.ngrok-free.app') ||
    origin.endsWith('.ngrok-free.dev')
  ) {
    return callback(null, true)
  }

  callback(new Error(`CORS bloqueado para origin: ${origin}`))
}

function assertEnvVars(): void {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'INTERNAL_API_SECRET',
    'WOMPI_PUBLIC_KEY',
    'WOMPI_PRIVATE_KEY',
    'WOMPI_EVENTS_SECRET',
    'WOMPI_INTEGRITY_SECRET',
    'RESEND_API_KEY',
    'VENDELO_API_KEY',
    'VENDELO_WEBHOOK_SECRET',
  ]
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    console.error(`[Bootstrap] Variables de entorno requeridas no configuradas: ${missing.join(', ')}`)
    process.exit(1)
  }
}

async function bootstrap() {
  assertEnvVars()
  const structuredLogger = new StructuredLogger()
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true })
  app.useLogger(structuredLogger)

  // Cloud Run termina TLS y reenvía con X-Forwarded-For — sin esto, ThrottlerGuard
  // (rate limit por IP) vería la IP del balanceador en vez de la del cliente real.
  app.getHttpAdapter().getInstance().set('trust proxy', 1)

  // Seguridad y compresión
  // En desarrollo, Swagger UI requiere scripts/estilos inline — relajamos CSP solo ahí
  app.use(
    helmet({
      contentSecurityPolicy: process.env['NODE_ENV'] === 'production' ? undefined : false,
    }),
  )
  app.use(compression())

  // CORS — producción: solo FRONTEND_URL; desarrollo: + localhost + wildcards ngrok
  app.enableCors({
    origin: getCorsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // Validación global: rechaza campos extra, transforma tipos automáticamente
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // Filtro global: mapea AppError del dominio a códigos HTTP correctos
  app.useGlobalFilters(new HttpExceptionFilter())

  // Interceptor global: loguea cada request HTTP completado con método, URL, status y latencia
  app.useGlobalInterceptors(new LoggingInterceptor())

  // Swagger solo en desarrollo
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Motek API')
      .setDescription('E-commerce de repuestos para motos — API REST')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document, {
      customCssUrl: 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css',
      customJs: [
        'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js',
        'https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js',
      ],
    })
    Logger.log('Swagger disponible en /api/docs', 'Bootstrap')
  }

  const port = process.env['PORT'] ?? 3001
  await app.listen(port)
  Logger.log(`API corriendo en http://localhost:${port}`, 'Bootstrap')
}

bootstrap()
