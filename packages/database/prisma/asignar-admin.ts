/**
 * Asigna el rol ADMIN a una cuenta real y desactiva un admin heredado.
 *
 * Motivo: el admin creado por versiones viejas de prisma/seed.ts tiene una
 * contraseña escrita en el repositorio. Este script:
 *   1. Da rol ADMIN a `--email` (la cuenta debe existir: p. ej. creada al
 *      iniciar sesión con Google).
 *   2. Si se pasa `--desactivar`, a esa cuenta le quita el rol ADMIN (pasa a
 *      CUSTOMER) y le pone una contraseña aleatoria que nadie conoce, así ya no
 *      se puede entrar con la contraseña pública.
 *
 * Nunca deja la tienda sin admin: aborta si la cuenta a promover no existe.
 * Por defecto es una SIMULACIÓN; modifica solo con `--confirmar`.
 *
 * Uso (desde packages/database — con `pnpm --filter ... exec` pnpm no encuentra tsx
 * cuando se le pasan varios flags al script):
 *   pnpm exec tsx prisma/asignar-admin.ts \
 *     --email=motekdev@gmail.com --desactivar=admin@electromotos-tony.co [--confirmar]
 *
 * Después: cerrar sesión y volver a entrar — el rol viaja en el token de sesión.
 */
import 'dotenv/config'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '../src/index'

const args = process.argv.slice(2)
const arg = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]?.trim().toLowerCase()
const email = arg('email')
const desactivar = arg('desactivar')
const confirmar = args.includes('--confirmar')

async function main() {
  if (!email) {
    console.error('Falta --email=<cuenta que será admin>')
    process.exitCode = 1
    return
  }
  if (desactivar && desactivar === email) {
    console.error('--email y --desactivar no pueden ser la misma cuenta')
    process.exitCode = 1
    return
  }

  const target = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, password: true, accounts: { select: { provider: true } } },
  })
  if (!target) {
    console.error(`La cuenta ${email} no existe. Inicia sesión con ella una vez en la tienda y repite.`)
    process.exitCode = 1
    return
  }
  const proveedores = target.accounts.map((a) => a.provider).join(', ') || 'contraseña'
  console.log(`\nPromover: ${email} (rol actual ${target.role}, acceso por ${proveedores})`)

  const old = desactivar
    ? await prisma.user.findUnique({ where: { email: desactivar }, select: { id: true, role: true } })
    : null
  if (desactivar) {
    console.log(old
      ? `Desactivar: ${desactivar} (rol actual ${old.role}) → CUSTOMER + contraseña aleatoria`
      : `Desactivar: ${desactivar} no existe — se omite`)
  }

  if (!confirmar) {
    console.log('\nSIMULACIÓN: no se modificó nada. Para aplicar, repetir con --confirmar.')
    return
  }

  const randomPassword = await bcrypt.hash(randomBytes(32).toString('base64url'), 12)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { role: 'ADMIN' } })
    if (old) {
      await tx.user.update({ where: { id: old.id }, data: { role: 'CUSTOMER', password: randomPassword } })
      // Cierra cualquier sesión abierta de la cuenta desactivada
      await tx.session.deleteMany({ where: { userId: old.id } })
    }
  })

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } })
  console.log(`\nListo. Admins actuales: ${admins.map((a) => a.email).join(', ')}`)
  console.log('Cierra sesión en la tienda y vuelve a entrar para que el panel admin te reconozca.')
}

main()
  .catch((e) => {
    console.error(`\nError: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
