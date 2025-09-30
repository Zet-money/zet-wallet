// RSA-OAEP encryption/decryption helpers using Web Crypto API

function stripPem(pem: string): Uint8Array {
  const cleaned = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '')
  const binary = atob(cleaned)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer as ArrayBuffer
}

export async function importPublicKeyPEM(pem: string): Promise<CryptoKey> {
  const spki = toArrayBuffer(stripPem(pem))
  return crypto.subtle.importKey(
    'spki',
    spki,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  )
}

export async function importPrivateKeyPEM(pem: string): Promise<CryptoKey> {
  const pkcs8 = toArrayBuffer(stripPem(pem))
  return crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  )
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

export async function rsaEncryptToBase64(plaintext: string, publicKeyPem: string): Promise<string> {
  const pub = await importPublicKeyPEM(publicKeyPem)
  const ct = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, new TextEncoder().encode(plaintext))
  return toBase64(ct)
}

export async function rsaDecryptToString(ciphertextB64: string, privateKeyPem: string): Promise<string> {
  const priv = await importPrivateKeyPEM(privateKeyPem)
  const pt = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, priv, toArrayBuffer(fromBase64(ciphertextB64)))
  return new TextDecoder().decode(pt)
}


