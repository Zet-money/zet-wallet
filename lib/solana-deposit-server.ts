"use server";

import * as anchor from '@coral-xyz/anchor'
import { Wallet } from '@coral-xyz/anchor'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, AccountLayout } from '@solana/spl-token'
import { PublicKey, SystemProgram, clusterApiUrl, Connection } from '@solana/web3.js'
import { ethers } from 'ethers'
import { solanaMnemonicToKeypairForRetrieval } from './solana'
// IDLs published by ZetaChain
// Mainnet and Devnet IDLs share layout; choose by network
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import GATEWAY_DEV_IDL from '@zetachain/protocol-contracts-solana/dev/idl/gateway.json'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import GATEWAY_PROD_IDL from '@zetachain/protocol-contracts-solana/prod/idl/gateway.json'

type Network = 'mainnet' | 'testnet'

function getSolanaRpc(network: Network): string {
  return network === 'mainnet' ? clusterApiUrl('mainnet-beta') : clusterApiUrl('devnet')
}

function createGatewayProgram(network: Network, signer: anchor.web3.Keypair) {
  const idl = network === 'mainnet' ? (GATEWAY_PROD_IDL as anchor.Idl) : (GATEWAY_DEV_IDL as anchor.Idl)
  const rpcUrl = getSolanaRpc(network)
  const connection = new Connection(rpcUrl)
  const provider = new anchor.AnchorProvider(connection, new Wallet(signer))
  const program = new anchor.Program(idl, provider)
  return { program, provider }
}

async function getSplSourceAccount(provider: anchor.AnchorProvider, mint: string) {
  const connection = provider.connection
  const owner = provider.wallet.publicKey
  const tokenAccounts = await connection.getTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID })
  const mintKey = new PublicKey(mint)
  const mintInfo = await connection.getTokenSupply(mintKey)
  const decimals = mintInfo.value.decimals
  const match = tokenAccounts.value.find(({ account }) => {
    const data = AccountLayout.decode(account.data)
    return new PublicKey(data.mint).equals(mintKey)
  })
  if (!match) throw new Error(`No token account for mint ${mint}`)
  return { from: match.pubkey, decimals }
}

async function ensureSolBalance(provider: anchor.AnchorProvider, amount: string) {
  const lamportsNeeded = ethers.parseUnits(amount, 9)
  const balance = await provider.connection.getBalance(provider.wallet.publicKey)
  if (BigInt(balance) < lamportsNeeded) {
    throw new Error(`Insufficient SOL balance. Available: ${balance / 1e9}, Required: ${amount}`)
  }
}

function buildRevertOptions(opts: {
  callOnRevert?: boolean
  revertMessage?: string
  revertAddress?: string
  abortAddress?: string
  onRevertGasLimit?: string | number
}, signerPk: PublicKey) {
  return {
    abortAddress: ethers.getBytes(opts.abortAddress ?? ethers.ZeroAddress),
    callOnRevert: !!opts.callOnRevert,
    onRevertGasLimit: new anchor.BN((opts.onRevertGasLimit ?? 0).toString()),
    revertAddress: opts.revertAddress ? new PublicKey(opts.revertAddress) : signerPk,
    revertMessage: Buffer.from(opts.revertMessage ?? '', 'utf8'),
  }
}

export async function solanaDepositAndCallServer(params: {
  amount: string
  receiver: string // 0x-hex EVM address
  token?: string // SPL mint or undefined for SOL
  types: string[]
  values: Array<string | boolean>
  revertOptions: {
    callOnRevert?: boolean
    revertMessage?: string
    revertAddress?: string
    abortAddress?: string
    onRevertGasLimit?: string | number
  }
  mnemonicPhrase: string
  network: Network
}): Promise<string> {
  const { amount, receiver, token, types, values, revertOptions, mnemonicPhrase, network } = params
  const { keypair } = await solanaMnemonicToKeypairForRetrieval(mnemonicPhrase)
  const { program: gatewayProgram, provider } = createGatewayProgram(network, keypair)

  // Encode receiver and message
  const receiverBytes = ethers.getBytes(receiver)
  const abiCoder = ethers.AbiCoder.defaultAbiCoder()
  const encodedParameters = abiCoder.encode(types, values)
  const message = Buffer.from(encodedParameters.slice(2), 'hex')
  const revert = buildRevertOptions(revertOptions, keypair.publicKey)

  if (token) {
    // SPL transfer path
    const { from, decimals } = await getSplSourceAccount(provider, token)
    // TSS PDA and ATA for mint
    const [tssPda] = PublicKey.findProgramAddressSync([Buffer.from('meta', 'utf8')], gatewayProgram.programId)
    const [tssAta] = await PublicKey.findProgramAddress(
      [tssPda.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), new PublicKey(token).toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
    const to = tssAta.toBase58()

    const sig = await (gatewayProgram as any).methods
      .depositSplTokenAndCall(new anchor.BN(ethers.parseUnits(amount, decimals).toString()), receiverBytes, message, revert)
      .accounts({
        from,
        mintAccount: token,
        signer: keypair.publicKey,
        systemProgram: SystemProgram.programId,
        to,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc()
    return sig as string
  } else {
    // SOL transfer path
    await ensureSolBalance(provider, amount)
    const sig = await (gatewayProgram as any).methods
      .depositAndCall(new anchor.BN(ethers.parseUnits(amount, 9).toString()), receiverBytes, message, revert)
      .accounts({})
      .rpc()
    return sig as string
  }
}



