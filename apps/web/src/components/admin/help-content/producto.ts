import type { AdminHelpContent } from '../AdminHelpButton'

const SHARED_STEPS = [
  'El slug (URL del producto) se genera automáticamente a partir del nombre mientras escribes. Si quieres uno personalizado, escríbelo en el campo "Slug" después de terminar de escribir el nombre — si vuelves a editar el nombre, se sobreescribe de nuevo.',
  'El precio se escribe en pesos colombianos normales (ej: 85000), sin centavos — el sistema lo convierte internamente.',
  'Puedes agregar hasta 10 beneficios — son los puntos que se muestran en la página del producto (ej: "Alta durabilidad"). Déjalos vacíos si el producto no los necesita.',
  'El texto dice "máximo 4 imágenes" pero no es un límite estricto del sistema — es una recomendación para que la galería del producto se vea bien. Puedes subir más si lo necesitas.',
  'Los campos marcados con * son obligatorios para guardar.',
]

export const productoNuevoHelpContent: AdminHelpContent = {
  title: 'Nuevo producto',
  summary: 'Crea un producto nuevo en el catálogo de la tienda. No se publica hasta que guardes.',
  steps: SHARED_STEPS,
}

export const productoEditarHelpContent: AdminHelpContent = {
  title: 'Editar producto',
  summary: 'Modifica los datos de un producto existente, o elimínalo permanentemente desde la zona de peligro.',
  steps: [
    ...SHARED_STEPS,
    'Desactivar "Producto activo" lo oculta del catálogo sin borrarlo — es la opción reversible si solo quieres dejar de venderlo temporalmente.',
    '"Eliminar producto" (zona de peligro, al final) es permanente y no se puede deshacer. Si solo quieres ocultarlo, usa la casilla "Producto activo" en su lugar.',
  ],
}
