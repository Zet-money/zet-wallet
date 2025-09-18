import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { derivePath } from 'ed25519-hd-key'
import * as bip39 from 'bip39'

export type SolanaNetwork = 'mainnet' | 'testnet'

export function getSolanaRpc(network: SolanaNetwork) {
  // Prefer custom public RPC over clusterApiUrl for stability
  return network === 'mainnet' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com'
}

export function getSolanaConnection(network: SolanaNetwork) {
  return new Connection(getSolanaRpc(network), 'confirmed')
}

// Derive Solana keypair from BIP39 mnemonic using path m/44'/501'/0'/0'
export async function solanaMnemonicToKeypairForGeneration(mnemonic: string) {
  const seed = bip39.mnemonicToSeedSync(mnemonic, '')
  const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key
  const keypair = Keypair.fromSeed(derivedSeed)
  const publicKey = keypair.publicKey.toBase58()
  return { publicKey, keypair }
}

export async function solanaMnemonicToKeypairForRetrieval(mnemonic: string) {
  const seed = bip39.mnemonicToSeedSync(mnemonic, '')
  const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key
  const keypair = Keypair.fromSeed(derivedSeed)
  return { keypair, address: keypair.publicKey.toBase58() }
}

export async function getSolanaAddressFromMnemonic(mnemonic: string): Promise<string> {
  const { address } = await solanaMnemonicToKeypairForRetrieval(mnemonic)
  return address
}

export async function fetchSolBalance(address: string, network: SolanaNetwork): Promise<number> {
  const conn = getSolanaConnection(network)
  const lamports = await conn.getBalance(new PublicKey(address))
  return lamports / LAMPORTS_PER_SOL
}

// Fetch SPL token balance given owner and mint address
export async function fetchSplBalance(owner: string, mint: string, network: SolanaNetwork): Promise<number> {
  const conn = getSolanaConnection(network)
  const ownerPk = new PublicKey(owner)
  const mintPk = new PublicKey(mint)
  const ataProgram = await import('@solana/spl-token')
  const ata = await ataProgram.getAssociatedTokenAddress(mintPk, ownerPk)
  const account = await conn.getTokenAccountBalance(ata).catch(() => null)
  if (!account || !account.value) return 0
  const decimals = account.value.decimals
  const amount = parseFloat(account.value.amount)
  return amount / Math.pow(10, decimals)
}

export async function getSolTxStatus(params: {
  signature: string
  network: SolanaNetwork
}): Promise<{ status: 'pending' | 'confirmed' | 'finalized' | 'failed' } > {
  const { signature, network } = params
  const conn = getSolanaConnection(network)
  try {
    const status = await conn.getSignatureStatus(signature, { searchTransactionHistory: true })
    const conf = status?.value
    if (!conf) return { status: 'pending' }
    if (conf.err) return { status: 'failed' }
    // confirmationStatus can be 'processed' | 'confirmed' | 'finalized'
    if (conf.confirmationStatus === 'finalized') return { status: 'finalized' }
    if (conf.confirmationStatus === 'confirmed') return { status: 'confirmed' }
    return { status: 'pending' }
  } catch {
    return { status: 'pending' }
  }
}

export async function waitForSolTxConfirmation(params: {
  signature: string
  network: SolanaNetwork
  timeoutMs?: number
}): Promise<{ status: 'finalized' | 'failed' | 'timeout' }> {
  const { signature, network, timeoutMs = 300000 } = params
  const conn = getSolanaConnection(network)
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await conn.getSignatureStatus(signature, { searchTransactionHistory: true })
    const val = res.value
    if (val) {
      if (val.err) return { status: 'failed' }
      if (val.confirmationStatus === 'finalized') return { status: 'finalized' }
    }
    await new Promise(r => setTimeout(r, 1500))
  }
  return { status: 'timeout' }
}


