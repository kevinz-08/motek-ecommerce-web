import { Injectable } from '@nestjs/common'
import { v2 as cloudinary } from 'cloudinary'

export interface UploadResult {
  publicId: string
  url: string
  secureUrl: string
  width: number
  height: number
}

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env['CLOUDINARY_CLOUD_NAME'],
      api_key: process.env['CLOUDINARY_API_KEY'],
      api_secret: process.env['CLOUDINARY_API_SECRET'],
      secure: true,
    })
  }

  private async uploadImage(
    file: Buffer,
    folder: string,
    publicIdPrefix: string,
    transform: { width: number; crop?: string },
  ): Promise<UploadResult> {
    const uploaded = await new Promise<{ public_id: string; width: number; height: number }>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { folder, public_id: `${publicIdPrefix}-${Date.now()}` },
            (error, result) => {
              if (error || !result) { reject(error ?? new Error('Upload failed')); return }
              resolve({ public_id: result.public_id, width: result.width, height: result.height })
            },
          )
          .end(file)
      },
    )

    const optimizedUrl = cloudinary.url(uploaded.public_id, {
      transformation: [{ fetch_format: 'auto', quality: 'auto', ...transform }],
      secure: true,
    })

    return {
      publicId: uploaded.public_id,
      url: optimizedUrl,
      secureUrl: optimizedUrl,
      width: uploaded.width,
      height: uploaded.height,
    }
  }

  async uploadProductImage(file: Buffer, productSku: string): Promise<UploadResult> {
    return this.uploadImage(file, 'motek-store/products', productSku, { width: 1200, crop: 'limit' })
  }

  /** Hero es full-bleed en el home, por eso necesita más ancho que una card de producto. */
  async uploadHeroBannerImage(file: Buffer, slug: string): Promise<UploadResult> {
    return this.uploadImage(file, 'motek-store/hero-banners', slug, { width: 1920, crop: 'limit' })
  }

  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId)
  }
}
