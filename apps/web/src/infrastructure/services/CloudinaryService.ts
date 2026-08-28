/**
 * Servicio de gestión de imágenes de productos con Cloudinary.
 *
 * Cloudinary es una plataforma CDN especializada en imágenes. Almacena las imágenes
 * de los productos y las sirve optimizadas y con caché global.
 *
 * Configuración requerida en variables de entorno:
 *   CLOUDINARY_CLOUD_NAME  → Nombre del cloud (ej: "motek-store")
 *   CLOUDINARY_API_KEY     → Llave pública de la API
 *   CLOUDINARY_API_SECRET  → Llave privada (solo servidor, nunca al cliente)
 *
 * Estructura de carpetas en Cloudinary:
 *   motek-store/products/{sku}-{timestamp}
 *   Ejemplo: motek-store/products/FRE-BRE-FZ25-001-1712345678
 *
 * Transformaciones automáticas al subir:
 *   - Redimensionado: máx 800×800 px (sin estirar, mantiene proporción)
 *   - Calidad: auto (Cloudinary optimiza para web automáticamente)
 *
 * Las URLs retornadas son HTTPS (secure: true) y van en el array Product.images[].
 *
 * Nota: La integración con el formulario de subida de imágenes del admin está
 * pendiente de implementar (requiere un endpoint de upload con autenticación).
 */
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env['CLOUDINARY_CLOUD_NAME'],
  api_key: process.env['CLOUDINARY_API_KEY'],
  api_secret: process.env['CLOUDINARY_API_SECRET'],
  secure: true, // Siempre usar HTTPS para las URLs de imágenes
})

export interface UploadResult {
  publicId: string
  url: string
  secureUrl: string
  width: number
  height: number
}

/** Servicio de gestión de imágenes con Cloudinary */
export class CloudinaryService {
  /**
   * Sube una imagen de producto y retorna una URL de entrega optimizada.
   *
   * Estrategia:
   *   1. Subir el archivo original sin transformaciones → preserva calidad máxima en Cloudinary.
   *   2. Construir la URL de entrega con transformaciones on-the-fly:
   *        f_auto   → WebP/AVIF automático según el browser del visitante
   *        q_auto   → Cloudinary elige la calidad óptima (IA)
   *        w_1200   → Ancho máximo para página de detalle (50vw en desktop ancho)
   *        c_limit  → Solo reduce, nunca amplía
   *
   *   Cloudinary aplica estas transformaciones una vez y las cachea globalmente,
   *   por lo que no hay costo de procesamiento por cada request.
   *
   *   La URL optimizada es la que se almacena en Product.images[] en la BD.
   *   Desde el frontend se puede reducir aún más el ancho con cloudinaryUrl()
   *   de src/lib/cloudinary.ts para contextos específicos (card, thumbnail, etc.).
   */
  async uploadProductImage(file: Buffer, productSku: string): Promise<UploadResult> {
    const uploaded = await new Promise<{ public_id: string; width: number; height: number }>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder:    'motek-store/products',
              public_id: `${productSku}-${Date.now()}`,
              // Subir sin transformación para preservar la imagen original
            },
            (error, result) => {
              if (error || !result) {
                reject(error ?? new Error('Upload failed'))
                return
              }
              resolve({ public_id: result.public_id, width: result.width, height: result.height })
            },
          )
          .end(file)
      },
    )

    // Construir URL de entrega optimizada (f_auto + q_auto + tamaño máximo para detalle)
    const optimizedUrl = cloudinary.url(uploaded.public_id, {
      transformation: [
        { fetch_format: 'auto', quality: 'auto', width: 1200, crop: 'limit' },
      ],
      secure: true,
    })

    return {
      publicId:  uploaded.public_id,
      url:       optimizedUrl,
      secureUrl: optimizedUrl,
      width:     uploaded.width,
      height:    uploaded.height,
    }
  }

  /** Elimina una imagen de Cloudinary por su public_id */
  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId)
  }
}
