// AES-GCM encryption/decryption helpers with obfuscated payload encoding
// NOTE: Uses Web Crypto API available in modern browsers and Node 18+ (via globalThis.crypto)

export type ObfuscatedSecret = {
  // Obfuscated base64 fields
  d: string // ciphertext
  i: string // iv
  s: string // salt
  n: string // nonce used in password mix
  k: string // biometric public key (base64) mixed into password
  m: string // method id (base64 encoded small int)
}

export type PasswordParams = {
  tokenSymbol?: string
  amount: string
  sender: string
  recipient: string
  targetChain?: string
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function utf8Encode(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(data))
  return new Uint8Array(digest)
}

function randomBytes(length: number): Uint8Array {
  const a = new Uint8Array(length)
  crypto.getRandomValues(a)
  return a
}

// Select one of several permutations to mix params into password; determined by methodId
function mixParams(params: PasswordParams, biometricPubKeyB64: string, nonceB64: string, methodId: number): string {
  const { tokenSymbol = '', amount, sender, recipient, targetChain = '' } = params
  const pieces = [tokenSymbol, amount, sender, recipient, targetChain, biometricPubKeyB64, nonceB64]
  switch (methodId % 5) {
    case 0:
      return [pieces[1], pieces[3], pieces[0], pieces[5], pieces[2], pieces[6], pieces[4]].join('|')
    case 1:
      return [pieces[5], pieces[0], pieces[2], pieces[6], pieces[1], pieces[4], pieces[3]].join('|')
    case 2:
      return [pieces[2], pieces[1], pieces[4], pieces[0], pieces[6], pieces[3], pieces[5]].join('|')
    case 3:
      return [pieces[6], pieces[4], pieces[3], pieces[2], pieces[1], pieces[0], pieces[5]].join('|')
    default:
      return [pieces[0], pieces[1], pieces[2], pieces[3], pieces[4], pieces[5], pieces[6]].join('|')
  }
}

async function deriveKey(passwordStr: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(utf8Encode(passwordStr)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: 150000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptMnemonicObfuscated(mnemonic: string, params: PasswordParams, biometricPubKeyB64: string): Promise<ObfuscatedSecret> {
  const methodId = crypto.getRandomValues(new Uint32Array(1))[0] % 7
  const nonce = randomBytes(16)
  const nonceB64 = toBase64(nonce)
  const mixed = mixParams(params, biometricPubKeyB64, nonceB64, methodId)
  const pwdHash = await sha256(utf8Encode(mixed))
  const salt = randomBytes(16)
  const key = await deriveKey(toBase64(pwdHash), salt)
  const iv = randomBytes(12)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(utf8Encode(mnemonic)))
  return {
    d: toBase64(ciphertext),
    i: toBase64(iv),
    s: toBase64(salt),
    n: nonceB64,
    k: biometricPubKeyB64,
    m: toBase64(new Uint8Array([methodId])),
  }
}

export async function decryptMnemonicObfuscated(secret: ObfuscatedSecret, params: PasswordParams): Promise<string> {
  const methodArr = fromBase64(secret.m)
  const methodId = methodArr[0] ?? 0
  const mixed = mixParams(params, secret.k, secret.n, methodId)
  const pwdHash = await sha256(utf8Encode(mixed))
  const key = await deriveKey(toBase64(pwdHash), fromBase64(secret.s))
  const plaintextBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(fromBase64(secret.i)) }, key, toArrayBuffer(fromBase64(secret.d)))
  return new TextDecoder().decode(plaintextBuf)
}

// Convert a Uint8Array into a standalone ArrayBuffer slice compatible with subtle APIs
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer as ArrayBuffer
}


