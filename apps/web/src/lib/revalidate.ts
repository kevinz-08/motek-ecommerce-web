/**
 * Helper cliente para invalidar el caché de Next.js desde componentes admin.
 *
 * Los componentes 'use client' no pueden llamar `revalidateTag` directamente
 * (es server-only). Este helper llama al endpoint `/api/admin/revalidate`
 * que ejecuta la invalidación en el servidor.
 *
 * El error se silencia para no bloquear al usuario — si falla, el caché
 * expira de forma natural según su TTL.
 */
export async function revalidateAdminCache(tags: string[]): Promise<void> {
  try {
    await fetch('/api/admin/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    })
  } catch {
    // Non-blocking: el caché expirará por TTL
  }
}
