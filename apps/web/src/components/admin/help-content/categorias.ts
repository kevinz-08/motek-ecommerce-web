import type { AdminHelpContent } from '../AdminHelpButton'

export const categoriasHelpContent: AdminHelpContent = {
  title: 'Categorías',
  summary:
    'Organiza el catálogo en categorías de hasta dos niveles: categorías raíz (ej. "Sistema ' +
    'Eléctrico") y subcategorías dentro de ellas (ej. "Baterías"). Los productos se asignan a ' +
    'cualquiera de los dos niveles.',
  steps: [
    'La jerarquía tiene máximo 2 niveles: al crear o editar una categoría, el campo "Categoría padre" solo ofrece categorías raíz — no puedes anidar una subcategoría dentro de otra subcategoría.',
    'La etiqueta "Raíz" en la tabla indica que esa categoría no tiene padre. Las que sí tienen padre muestran su nombre en la columna "Padre".',
    'El slug (usado en la URL del catálogo) se genera automáticamente a partir del nombre solo cuando creas una categoría nueva. Si editas el nombre de una categoría existente, el slug NO se actualiza solo — tienes que cambiarlo a mano si quieres que coincida.',
    'El slug solo acepta letras minúsculas, números y guiones (ej: "sistema-electrico") — si escribes mayúsculas, espacios o acentos, el formulario te lo va a rechazar.',
    'La columna "Productos" muestra cuántos productos usan esa categoría.',
    'No puedes eliminar una categoría que tiene productos o subcategorías asociadas — el sistema te lo va a impedir con un mensaje explicando cuántos hay. Primero hay que reasignar o eliminar esos productos/subcategorías.',
  ],
}
