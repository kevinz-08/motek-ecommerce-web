'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

const RESEND_COOLDOWN = 60
const CODE_LENGTH = 6

interface Props {
  email: string
}

export function VerifyEmailForm({ email }: Props) {
  const router = useRouter()
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const [resending, setResending] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(CODE_LENGTH).fill(null))

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  const submitCode = useCallback(
    async (code: string) => {
      if (loading || verified) return
      setLoading(true)
      setError(null)

      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
        const res = await fetch(`${apiBase}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code }),
        })

        const data = (await res.json()) as { message: string }

        if (!res.ok) {
          setError(data.message ?? 'Código inválido o expirado.')
          setDigits(Array(CODE_LENGTH).fill(''))
          requestAnimationFrame(() => inputRefs.current[0]?.focus())
          return
        }

        setVerified(true)
        setTimeout(() => router.push('/auth/login?verified=1'), 2_000)
      } catch {
        setError('Error de red. Verifica tu conexión e intenta de nuevo.')
        setDigits(Array(CODE_LENGTH).fill(''))
        requestAnimationFrame(() => inputRefs.current[0]?.focus())
      } finally {
        setLoading(false)
      }
    },
    [email, loading, verified, router],
  )

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const newDigits = [...digits]
    newDigits[index] = value.slice(-1)
    setDigits(newDigits)
    setError(null)

    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newDigits.every((d) => d !== '')) {
      submitCode(newDigits.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (!pasted) return
    const newDigits = Array(CODE_LENGTH).fill('')
    pasted.split('').forEach((char, i) => { newDigits[i] = char })
    setDigits(newDigits)
    inputRefs.current[Math.min(pasted.length - 1, CODE_LENGTH - 1)]?.focus()
    if (newDigits.every((d) => d !== '')) submitCode(newDigits.join(''))
  }

  const handleResend = async () => {
    setResending(true)
    setError(null)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      await fetch(`${apiBase}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } finally {
      setResending(false)
      setCountdown(RESEND_COOLDOWN)
      setDigits(Array(CODE_LENGTH).fill(''))
      requestAnimationFrame(() => inputRefs.current[0]?.focus())
    }
  }

  if (verified) {
    return (
      <div className="catalog-light min-h-screen c-bg flex items-center justify-center px-4">
        <div className="c-surface border c-border rounded-2xl p-8 w-full max-w-md text-center shadow-[var(--shadow-lg)]">
          <p className="text-5xl mb-4">✅</p>
          <h1 className="text-xl font-bold c-text mb-2">¡Correo verificado!</h1>
          <p className="c-text-3 text-sm">Redirigiendo al inicio de sesión...</p>
        </div>
      </div>
    )
  }

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => `${a}${'*'.repeat(b.length)}${c}`)

  return (
    <div className="catalog-light min-h-screen c-bg flex items-center justify-center px-4 py-10">
      <div className="c-surface border c-border rounded-2xl p-8 w-full max-w-md shadow-[var(--shadow-lg)]">

        <div className="text-center mb-8">
          <Link href="/">
            <Image
              src="/assets/logo.webp"
              alt="Motek Store"
              width={80}
              height={60}
              className="object-contain mx-auto"
              priority
            />
          </Link>
          <p className="c-text-3 mt-1 text-sm">Verificación de correo</p>
        </div>

        <div className="text-center mb-6">
          <p className="text-2xl mb-2">📧</p>
          <h1 className="text-lg font-bold c-text mb-1">Revisa tu correo</h1>
          <p className="text-sm c-text-3">
            Enviamos un código de 6 dígitos a{' '}
            <span className="c-text-2 font-medium">{maskedEmail}</span>
          </p>
        </div>

        {error && (
          <div role="alert" className="bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/30 text-[var(--c-danger)] text-sm rounded-lg px-4 py-3 mb-4 text-center">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              aria-label={`Dígito ${i + 1} del código`}
              disabled={loading}
              className={`w-11 h-14 text-center text-xl font-bold rounded-lg border transition-colors bg-[var(--c-surface-2)] c-text
                caret-transparent outline-none
                ${error ? 'border-[var(--c-danger)]' : 'c-border focus:border-[var(--c-accent)]'}
                disabled:opacity-40`}
            />
          ))}
        </div>

        {loading && (
          <p className="text-center text-sm c-text-4 mb-4">Verificando...</p>
        )}

        <div className="text-center">
          {countdown > 0 ? (
            <p className="text-sm c-text-4">
              Reenviar código en <span className="c-text-2 font-medium tabular-nums">{countdown}s</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-sm text-[var(--c-accent)] hover:underline disabled:opacity-50"
            >
              {resending ? 'Enviando...' : 'Reenviar código'}
            </button>
          )}
        </div>

        <p className="text-xs c-text-4 text-center mt-6">
          ¿Correo incorrecto?{' '}
          <Link href="/auth/register" className="text-[var(--c-accent)] hover:underline">
            Volver al registro
          </Link>
        </p>
      </div>
    </div>
  )
}
