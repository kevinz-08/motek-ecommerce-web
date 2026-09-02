import type { AdminHelpContent } from '../AdminHelpButton'

export const bannersHelpContent: AdminHelpContent = {
  title: 'Banners del Hero',
  summary:
    'Controla las imágenes del carrusel principal de la home (el "Hero"). El diseño es solo ' +
    'imagen — sin título, descripción ni botón visibles. La imagen completa es clickeable hacia ' +
    'el destino que elijas. El orden en que aparecen en el carrusel es el mismo orden de esta tabla.',
  steps: [
    'El "Título interno" no se muestra en el sitio — solo se usa como texto alternativo de la imagen (accesibilidad) y para identificar el banner en esta lista.',
    'Solo los banners marcados como "Activo" se muestran en la home — puedes crear banners de promociones futuras y activarlos cuando llegue la fecha, sin borrarlos.',
    'Hay un máximo de 8 banners activos a la vez, para no sobrecargar el carrusel. Si lo alcanzas, desactiva uno antes de activar otro.',
    'Las flechas ▲▼ cambian el orden de aparición en el carrusel — el primero de la tabla es el primero que se ve al cargar la home.',
    'El destino de click es opcional: si eliges "No clickeable", la imagen es puramente decorativa.',
    'La URL de destino puede ser una ruta interna del sitio (ej. "/catalogo?category=llantas") o una URL externa completa (ej. "https://wa.me/...").',
    'Si borras todos los banners, el Hero de la home simplemente no se muestra — el resto de la página sigue funcionando normal.',
  ],
}
