import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common'

/**
 * Valida que un ID de novedad Vendelo tenga formato seguro antes de que llegue
 * al service o se interpole en una URL de la API externa.
 *
 * Caracteres permitidos: alfanuméricos, guión y guión bajo.
 * Longitud máxima: 100 caracteres.
 *
 * encodeURIComponent mitiga path traversal pero no previene payloads inflados
 * ni caracteres inválidos para la API de Vendelo. Este pipe actúa en la frontera
 * del sistema (controller) siguiendo Clean Architecture: validación en el borde.
 */
@Injectable()
export class ParseVendeloIdPipe implements PipeTransform<string, string> {
  private static readonly VALID_ID = /^[a-zA-Z0-9_-]{1,100}$/

  transform(value: string): string {
    if (typeof value !== 'string' || !ParseVendeloIdPipe.VALID_ID.test(value)) {
      throw new BadRequestException(
        'ID de novedad con formato inválido. Solo se permiten caracteres alfanuméricos, guión y guión bajo (máx. 100 caracteres).',
      )
    }
    return value
  }
}
