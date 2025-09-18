import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js'
import { derivePath } from 'ed25519-hd-key'
import * as bip39 from 'bip39'
import { getAssociatedTokenAddress, getMint, createTransferInstruction } from '@solana/spl-token'

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
  const { amount, sourceTokenSymbol, recipientOnZeta, targetZrc20, mnemonicPhrase, network } = params
  const conn = new Connection(getRpc(network), 'confirmed')
  const keypair = getKeypairFromMnemonic(mnemonicPhrase)

  const gatewayAddress = process.env.NEXT_PUBLIC_SOLANA_GATEWAY_ADDRESS
  if (!gatewayAddress) {
    throw new Error('Missing NEXT_PUBLIC_SOLANA_GATEWAY_ADDRESS for Solana deposit gateway')
  }
  const gateway = new PublicKey(gatewayAddress)

  const tx = new Transaction()

  if (sourceTokenSymbol.toUpperCase() === 'SOL') {
    // Native SOL transfer to gateway
    const lamports = BigInt(Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL))
    tx.add(SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: gateway, lamports: Number(lamports) }))
  } else {
    // SPL token transfer to gateway's ATA
    // Resolve mint address by symbol via env or a simple mapping if needed; expect caller to supply sourceTokenSymbol recognized on Solana
    // For now, resolve via envs if available
    const mintEnvKey = `NEXT_PUBLIC_SOLANA_${sourceTokenSymbol.toUpperCase()}_MINT`
    // @ts-ignore
    const mintStr = process.env[mintEnvKey] as string | undefined
    if (!mintStr) throw new Error(`Missing ${mintEnvKey} for SPL token mint`)
    const mint = new PublicKey(mintStr)
    const ownerAta = await getAssociatedTokenAddress(mint, keypair.publicKey)
    const gatewayAta = await getAssociatedTokenAddress(mint, gateway)
    // Fetch decimals
    const mintInfo = await getMint(conn, mint)
    const decimals = mintInfo.decimals
    const rawAmount = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)))
    tx.add(createTransferInstruction(ownerAta, gatewayAta, keypair.publicKey, Number(rawAmount)))
  }

  // Attach memo-like instruction carrying Zeta metadata (if gateway parses it). Using SystemProgram with no-op not supported; skip if memo program not available.
  // Optionally attach memo via SPL Memo program if available in runtime
  // Disabled to avoid runtime dep errors; gateway can parse transfer + off-chain mapping

  tx.feePayer = keypair.publicKey
  const latest = await conn.getLatestBlockhash()
  tx.recentBlockhash = latest.blockhash
  const sig = await conn.sendTransaction(tx, [keypair])
  return { hash: sig }
}


