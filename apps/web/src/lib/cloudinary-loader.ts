/**
 * Loader personalizado para next/image.
 *
 * Las URLs que llegan aquí ya vienen transformadas por `cloudinaryUrl()`
 * (f_auto,q_auto,w_N,c_limit) o son assets estáticos de /public. En ambos
 * casos no hace falta que Vercel Image Optimization las vuelva a procesar
 * — devolvemos el src tal cual para que next/image no llame a /_next/image.
 */
export default function cloudinaryLoader({ src }: { src: string; width: number; quality?: number }): string {
  return src
}
