import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * Cifrado simétrico AES-256-GCM para secretos que deben persistirse en BD
 * (ej. el refresh token OAuth de Venndelo).
 *
 * Formato del payload: `v1.<iv>.<authTag>.<ciphertext>` (cada parte en base64url).
 * El prefijo de versión permite rotar el algoritmo/clave sin ambigüedad.
 * GCM autentica el contenido: un payload alterado o una clave equivocada hacen
 * que `decryptSecret` lance en lugar de devolver basura.
 */

const ALGORITHM = 'aes-256-gcm'
const VERSION = 'v1'
const IV_BYTES = 12
const KEY_BYTES = 32

/**
 * Interpreta la clave de cifrado desde una env var. Acepta 32 bytes en base64
 * (44 chars, `openssl rand -base64 32`) o en hex (64 chars, `openssl rand -hex 32`).
 * Lanza si no decodifica exactamente a 32 bytes — fallar al arrancar es mejor
 * que cifrar con una clave débil o truncada.
 */
export function parseEncryptionKey(raw: string): Buffer {
  const value = raw.trim()
  const key = /^[0-9a-fA-F]{64}$/.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64')
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `Clave de cifrado inválida: se esperaban ${KEY_BYTES} bytes (base64 o hex), se obtuvieron ${key.length}`,
    )
  }
  return key
}

export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv, tag, ciphertext].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.')
}

export function decryptSecret(payload: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = payload.split('.')
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error('Payload cifrado con formato desconocido')
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
