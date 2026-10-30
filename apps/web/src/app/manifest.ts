import type { MetadataRoute } from 'next'

/**
 * Manifiesto web: nombre, colores e íconos que usa el celular cuando el
 * cliente agrega la tienda a la pantalla de inicio. Íconos generados desde
 * public/assets/logo.png sobre fondo blanco (apple-icon.png en esta carpeta
 * cubre iOS; los de public/ cubren Android).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Motek Store — Repuestos para motos',
    short_name: 'Motek',
    description: 'Repuestos, aceites, llantas y accesorios para motos con envío a todo Colombia.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    lang: 'es-CO',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
