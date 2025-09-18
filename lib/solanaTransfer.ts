import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js'
import { derivePath } from 'ed25519-hd-key'
import * as bip39 from 'bip39'

export type Network = 'mainnet' | 'testnet'

export type SolanaTransferParams = {
  amount: string
  sourceTokenSymbol: string // SOL, USDC, USDT
  recipientOnZeta: string // EVM address in hex
  targetZrc20: string // ZRC-20 address on Zeta
  mnemonicPhrase: string
  network: Network
}

function getRpc(network: Network) {
  return network === 'mainnet' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com'
}

function getKeypairFromMnemonic(mnemonic: string): Keypair {
  const seed = bip39.mnemonicToSeedSync(mnemonic, '')
  const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key
  return Keypair.fromSeed(derivedSeed)
}

export async function performSolanaDepositAndCall(params: SolanaTransferParams): Promise<{ hash: string }> {
  const { amount, sourceTokenSymbol, mnemonicPhrase, network } = params
  const conn = new Connection(getRpc(network), 'confirmed')
  const keypair = getKeypairFromMnemonic(mnemonicPhrase)

  // Placeholder implementation: send a 0-lamport ping transaction to self to verify signing works.
  // TODO: replace with proper deposit-and-call to Zeta gateway program when available.
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: keypair.publicKey,
      lamports: 0,
    })
  )
  tx.feePayer = keypair.publicKey
  const latest = await conn.getLatestBlockhash()
  tx.recentBlockhash = latest.blockhash
  const sig = await conn.sendTransaction(tx, [keypair])
  return { hash: sig }
}


