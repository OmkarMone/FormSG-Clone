import { SIGNING_KEYS } from '../src/resource/signing-keys'
import formsgPackage from '../src/index'
import {
  plaintext,
  ciphertext,
  formSecretKey,
  formPublicKey,
} from './resources/crypto-data-20200322'

import { plaintextMultiLang } from './resources/crypto-data-20200604'

const formsg = formsgPackage({ mode: 'test' })

const INTERNAL_TEST_VERSION = 1

describe('Crypto', function () {
  const signingSecretKey = SIGNING_KEYS.test.secretKey
  const testFileBuffer = new Uint8Array(Buffer.from('./resources/ogp.svg'))

  it('should generate a keypair', () => {
    const keypair = formsg.crypto.generate()
    expect(Object.keys(keypair)).toContain('secretKey')
    expect(Object.keys(keypair)).toContain('publicKey')
  })

  it('should generate a keypair that is valid', () => {
    const { publicKey, secretKey } = formsg.crypto.generate()
    expect(formsg.crypto.valid(publicKey, secretKey)).toBe(true)
  })

  it('should validate an existing keypair', () => {
    expect(formsg.crypto.valid(formPublicKey, formSecretKey)).toBe(true)
  })

  it('should invalidate unassociated keypairs', () => {
    // Act
    const { secretKey } = formsg.crypto.generate()
    const { publicKey } = formsg.crypto.generate()

    // Assert
    expect(formsg.crypto.valid(publicKey, secretKey)).toBe(false)
  })

  it('should decrypt the submission ciphertext from 2020-03-22 successfully', () => {
    // Act
    const decrypted = formsg.crypto.decrypt(formSecretKey, {
      encryptedContent: ciphertext,
      version: INTERNAL_TEST_VERSION,
    })

    // Assert
    expect(decrypted).toHaveProperty('responses', plaintext)
  })

  it('should return null on unsuccessful decryption', () => {
    expect(
      formsg.crypto.decrypt('random', {
        encryptedContent: ciphertext,
        version: INTERNAL_TEST_VERSION,
      })
    ).toBe(null)
  })

  it('should return null when successfully decrypted content does not fit FormField type shape', () => {
    // Arrange
    const { publicKey, secretKey } = formsg.crypto.generate()
    const malformedContent = 'just a string, not an object with FormField shape'
    const malformedEncrypt = formsg.crypto.encrypt(malformedContent, publicKey)

    // Assert
    // Using correct secret key, but the decrypted object should not fit the
    // expected shape and thus return null.
    expect(
      formsg.crypto.decrypt(secretKey, {
        encryptedContent: malformedEncrypt,
        version: INTERNAL_TEST_VERSION,
      })
    ).toBe(null)
  })

  it('should be able to encrypt and decrypt submissions from 2020-03-22 end-to-end successfully', () => {
    // Arrange
    const { publicKey, secretKey } = formsg.crypto.generate()

    // Act
    const ciphertext = formsg.crypto.encrypt(plaintext, publicKey)
    const decrypted = formsg.crypto.decrypt(secretKey, {
      encryptedContent: ciphertext,
      version: INTERNAL_TEST_VERSION,
    })
    // Assert
    expect(decrypted).toHaveProperty('responses', plaintext)
  })

  it('should be able to encrypt and decrypt multi-language submission from 2020-06-04 end-to-end successfully', () => {
    // Arrange
    const { publicKey, secretKey } = formsg.crypto.generate()

    // Act
    const ciphertext = formsg.crypto.encrypt(plaintextMultiLang, publicKey)
    const decrypted = formsg.crypto.decrypt(secretKey, {
      encryptedContent: ciphertext,
      version: INTERNAL_TEST_VERSION,
    })
    // Assert
    expect(decrypted).toHaveProperty('responses', plaintextMultiLang)
  })

  it('should be able to encrypt submissions without signing if signingPrivateKey is missing', () => {
    // Arrange
    const { publicKey, secretKey } = formsg.crypto.generate()

    // Act
    // Signing key (last parameter) is omitted.
    const ciphertext = formsg.crypto.encrypt(plaintext, publicKey)
    const decrypted = formsg.crypto.decrypt(secretKey, {
      encryptedContent: ciphertext,
      version: INTERNAL_TEST_VERSION,
    })

    // Assert
    expect(decrypted).toHaveProperty('responses', plaintext)
  })

  it('should be able to encrypt and sign submissions if signingPrivateKey is given', () => {
    // Arrange
    const { publicKey, secretKey } = formsg.crypto.generate()
    const mockVerifiedContent = {
      uinFin: 'S12345679Z',
      somethingElse: 99,
    }

    // Act
    // Encrypt content that is not signed.
    const ciphertext = formsg.crypto.encrypt(plaintext, publicKey)
    // Sign and encrypt the desired content.
    const signedAndEncryptedText = formsg.crypto.encrypt(
      mockVerifiedContent,
      publicKey,
      signingSecretKey
    )
    // Decrypt encrypted content along with our signed+encrypted content.
    const decrypted = formsg.crypto.decrypt(secretKey, {
      encryptedContent: ciphertext,
      verifiedContent: signedAndEncryptedText,
      version: INTERNAL_TEST_VERSION,
    })

    // Assert
    expect(decrypted).toHaveProperty('verified', mockVerifiedContent)
    expect(decrypted).toHaveProperty('responses', plaintext)
  })

  it('should be able to encrypt and decrypt files end-to-end', async () => {
    // Arrange
    const { publicKey, secretKey } = formsg.crypto.generate()

    // Act
    // Encrypt
    const encrypted = await formsg.crypto.encryptFile(testFileBuffer, publicKey)
    expect(encrypted).toHaveProperty('submissionPublicKey')
    expect(encrypted).toHaveProperty('nonce')
    expect(encrypted).toHaveProperty('binary')

    // Decrypt
    const decrypted = await formsg.crypto.decryptFile(secretKey, encrypted)

    if (!decrypted) {
      throw new Error('File should be able to decrypt successfully.')
    }

    // Compare
    expect(testFileBuffer).toEqual(decrypted)
  })

  it('should return null if file could not be decrypted', async () => {
    const { publicKey, secretKey } = formsg.crypto.generate()

    const encrypted = await formsg.crypto.encryptFile(testFileBuffer, publicKey)
    // Rewrite binary with invalid Uint8Array.
    encrypted.binary = new Uint8Array([1, 2])

    const decrypted = await formsg.crypto.decryptFile(secretKey, encrypted)

    expect(decrypted).toBeNull()
  })
})
