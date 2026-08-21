import {
  BadRequestException, Body, Controller, Delete, Get,
  HttpCode, Param, Post, Put, UploadedFile, UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { PrismaService } from '../infrastructure/database/prisma.service'
import { CloudinaryService } from '../infrastructure/services/CloudinaryService'
import { CreateHeroBannerDto } from './dto/create-hero-banner.dto'
import { UpdateHeroBannerDto } from './dto/update-hero-banner.dto'
import { ReorderHeroBannersDto } from './dto/reorder-hero-banners.dto'

/** Tope duro para no inflar el peso del carrusel del home. */
const MAX_ACTIVE_BANNERS = 8

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

@ApiTags('admin / banners')
@ApiBearerAuth('access-token')
@Roles('ADMIN')
@Controller('admin/banners')
export class AdminBannersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los banners (activos e inactivos) ordenados' })
  findAll() {
    return this.prisma.client.heroBanner.findMany({ orderBy: { order: 'asc' } })
  }

  @Post('upload-image')
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir imagen de banner a Cloudinary' })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      cb(null, IMAGE_MIME_TYPES.includes(file.mimetype))
    },
  }))
  async uploadImage(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body('slug') slug: string,
  ) {
    if (!file) {
      throw new BadRequestException('Archivo inválido — solo se permiten imágenes JPEG, PNG o WebP de hasta 5MB')
    }
    const result = await this.cloudinary.uploadHeroBannerImage(file.buffer, slug || 'banner')
    return { url: result.secureUrl, publicId: result.publicId }
  }

  @Post('image/delete')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Borrar una imagen subida a Cloudinary que nunca se guardó en un banner '
      + '(reemplazo cancelado o imagen quitada antes de guardar). Se recibe por body y no '
      + 'por path param porque el publicId de Cloudinary contiene "/" (incluye el folder).',
  })
  async deleteUnsavedImage(@Body('publicId') publicId: string) {
    if (!publicId) throw new BadRequestException('publicId es requerido')
    await this.cloudinary.deleteImage(publicId)
    return { success: true }
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Crear banner' })
  async create(@Body() dto: CreateHeroBannerDto) {
    const activeCount = await this.prisma.client.heroBanner.count({ where: { isActive: true } })
    if (activeCount >= MAX_ACTIVE_BANNERS) {
      throw new BadRequestException(`Máximo ${MAX_ACTIVE_BANNERS} banners activos a la vez`)
    }
    return this.prisma.client.heroBanner.create({ data: dto })
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Reordenar banners (recibe el array completo de {id, order})' })
  async reorder(@Body() dto: ReorderHeroBannersDto) {
    await this.prisma.client.$transaction(
      dto.items.map((item) =>
        this.prisma.client.heroBanner.update({ where: { id: item.id }, data: { order: item.order } }),
      ),
    )
    return { success: true }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar banner (si cambia la imagen, borra la anterior en Cloudinary)' })
  async update(@Param('id') id: string, @Body() dto: UpdateHeroBannerDto) {
    if (dto.isActive) {
      const activeCount = await this.prisma.client.heroBanner.count({
        where: { isActive: true, id: { not: id } },
      })
      if (activeCount >= MAX_ACTIVE_BANNERS) {
        throw new BadRequestException(`Máximo ${MAX_ACTIVE_BANNERS} banners activos a la vez`)
      }
    }

    const previous = await this.prisma.client.heroBanner.findUnique({ where: { id } })
    const updated = await this.prisma.client.heroBanner.update({ where: { id }, data: dto })

    if (previous && dto.imagePublicId && dto.imagePublicId !== previous.imagePublicId) {
      await this.cloudinary.deleteImage(previous.imagePublicId).catch(() => {
        // No bloquear la actualización si Cloudinary falla o el asset ya no existe.
      })
    }
    if (
      previous?.imagePublicIdMobile
      && dto.imagePublicIdMobile !== undefined
      && dto.imagePublicIdMobile !== previous.imagePublicIdMobile
    ) {
      await this.cloudinary.deleteImage(previous.imagePublicIdMobile).catch(() => {
        // No bloquear la actualización si Cloudinary falla o el asset ya no existe.
      })
    }

    return updated
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Eliminar banner (borra también las imágenes en Cloudinary)' })
  async delete(@Param('id') id: string) {
    const banner = await this.prisma.client.heroBanner.delete({ where: { id } })
    await this.cloudinary.deleteImage(banner.imagePublicId).catch(() => {
      // No bloquear la eliminación del banner si Cloudinary falla o el asset ya no existe.
    })
    if (banner.imagePublicIdMobile) {
      await this.cloudinary.deleteImage(banner.imagePublicIdMobile).catch(() => {
        // No bloquear la eliminación del banner si Cloudinary falla o el asset ya no existe.
      })
    }
    return { success: true }
  }
}
