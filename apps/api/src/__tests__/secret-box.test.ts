import { describe, it, expect } from 'vitest'
import { randomBytes } from 'crypto'
import { decryptSecret, encryptSecret, parseEncryptionKey } from '../shared/crypto/secret-box'

const KEY = randomBytes(32)

describe('secret-box', () => {
  it('cifra y descifra ida y vuelta', () => {
    const payload = encryptSecret('refresh-token-123', KEY)
    expect(payload.startsWith('v1.')).toBe(true)
    expect(payload).not.toContain('refresh-token-123')
    expect(decryptSecret(payload, KEY)).toBe('refresh-token-123')
  })

  it('usa un IV distinto en cada cifrado', () => {
    expect(encryptSecret('mismo', KEY)).not.toBe(encryptSecret('mismo', KEY))
  })

  it('lanza si se descifra con otra clave (GCM autentica)', () => {
    const payload = encryptSecret('secreto', KEY)
    expect(() => decryptSecret(payload, randomBytes(32))).toThrow()
  })

  it('lanza si el payload fue alterado', () => {
    const parts = encryptSecret('secreto', KEY).split('.')
    parts[3] = Buffer.from('otro-contenido').toString('base64url')
    expect(() => decryptSecret(parts.join('.'), KEY)).toThrow()
  })

  it('rechaza payloads con formato desconocido', () => {
    expect(() => decryptSecret('texto-plano', KEY)).toThrow('formato desconocido')
  })

  describe('parseEncryptionKey', () => {
    it('acepta 32 bytes en base64', () => {
      expect(parseEncryptionKey(KEY.toString('base64'))).toEqual(KEY)
    })

    it('acepta 32 bytes en hex', () => {
      expect(parseEncryptionKey(KEY.toString('hex'))).toEqual(KEY)
    })

    it('rechaza claves que no miden 32 bytes', () => {
      expect(() => parseEncryptionKey(randomBytes(16).toString('base64'))).toThrow('32 bytes')
      expect(() => parseEncryptionKey('corta')).toThrow('32 bytes')
    })
  })
})
