/**
 * Configuración central de NextAuth v5.
 *
 * Proveedores disponibles:
 *  - Credentials: email + contraseña. authorize() llama al NestJS API (POST /auth/login)
 *    en lugar de verificar bcrypt localmente. La contraseña nunca toca Next.js.
 *  - Google: OAuth. PrismaAdapter crea el usuario si no existe. Después de crear la sesión,
 *    el jwt callback llama al endpoint interno /auth/session-token para obtener el JWT NestJS.
 *
 * Estrategia de sesión: JWT (necesaria para Credentials + PrismaAdapter juntos).
 *
 * Tokens:
 *  - NextAuth JWT (cookie httpOnly): mantiene la sesión del browser con id, role, accessToken.
 *  - NestJS JWT (accessToken): se usa como Bearer token en todas las llamadas a la API.
 */
import NextAuth, { CredentialsSignin } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/infrastructure/database/prisma-client'

class EmailNotVerifiedError extends CredentialsSignin {
  code = 'EMAIL_NOT_VERIFIED'
}

// ── Augmentaciones de tipo ────────────────────────────────────────────────────
declare module 'next-auth' {
  interface User {
    role?: string
    accessToken?: string
  }
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      accessToken?: string
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Note: `declare module 'next-auth/jwt'` is intentionally omitted.
// next-auth/jwt re-exports from @auth/core/jwt which pnpm does not hoist to
// node_modules/@auth/core, making TypeScript's module augmentation fail at
// compile time (TS2664). We use explicit casts in the session callback instead.

const API_URL = process.env['API_URL'] ?? 'http://localhost:3001'

export const { handlers, auth, signIn, signOut } = NextAuth({
  // PrismaAdapter maneja la creación de usuarios y cuentas OAuth.
  adapter: PrismaAdapter(prisma),

  // JWT es requerido para que el Credentials provider funcione junto con el adapter.
  session: { strategy: 'jwt' },

  providers: [
    // ─── Google OAuth ────────────────────────────────────────────────────────
    Google({
      clientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
    }),

    // ─── Credentials (email + contraseña) ───────────────────────────────────
    Credentials({
      credentials: {
        email: { label: 'Correo electrónico', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          if (res.status === 403) {
            const errData = (await res.json()) as { message?: string }
            if (errData.message === 'EMAIL_NOT_VERIFIED') throw new EmailNotVerifiedError()
            return null
          }

          if (!res.ok) return null

          const data = (await res.json()) as {
            accessToken: string
            role: string
            userId: string
            name: string
            email: string
          }
          return {
            id: data.userId,
            email: data.email,
            name: data.name,
            role: data.role,
            accessToken: data.accessToken,
          }
        } catch (error) {
          if (error instanceof EmailNotVerifiedError) throw error
          console.error('[auth] authorize() falló:', error)
          return null
        }
      },
    }),
  ],

  callbacks: {
    /**
     * JWT callback — se ejecuta al crear o actualizar el token.
     * `user` y `account` solo están disponibles en el primer inicio de sesión.
     */
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id!

        if (user.accessToken) {
          // Credentials: authorize() ya obtuvo el JWT NestJS
          token.accessToken = user.accessToken
          token.role = user.role ?? 'CUSTOMER'
        } else if (account?.provider === 'google') {
          // Google OAuth: pedir JWT NestJS al endpoint interno
          try {
            const res = await fetch(`${API_URL}/auth/session-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': process.env['INTERNAL_API_SECRET'] ?? '',
              },
              body: JSON.stringify({ email: user.email }),
            })
            if (res.ok) {
              const data = (await res.json()) as { accessToken: string; role: string }
              token.accessToken = data.accessToken
              token.role = data.role
            }
          } catch {
            // No fatal — el usuario puede seguir navegando; las llamadas autenticadas fallarán
            token.role = 'CUSTOMER'
          }
        }
      }
      return token
    },

    /**
     * Session callback — transforma el token JWT en el objeto de sesión del cliente.
     */
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = (token.role as string) ?? 'CUSTOMER'
        session.user.accessToken = token.accessToken as string | undefined
      }
      return session
    },
  },

  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
})
