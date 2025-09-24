"use server";

import * as anchor from '@coral-xyz/anchor'
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

// Correct gateway program addresses
const GATEWAY_PROGRAM_ADDRESSES: Record<Network, string> = {
  mainnet: 'ZETAjseVjuFsxdRxo6MmTCvqFwb3ZHUx56Co3vCmGis',
  testnet: 'ZETAjseVjuFsxdRxo6MmTCvqFwb3ZHUx56Co3vCmGis'
}

function getSolanaRpc(network: Network): string {
  const rpcUrl = network === 'mainnet' ? clusterApiUrl('mainnet-beta') : clusterApiUrl('devnet')
  console.log(`[SolanaDeposit] Network: ${network}, RPC URL: ${rpcUrl}`)
  return rpcUrl
}

async function testRpcConnection(connection: Connection): Promise<boolean> {
  try {
    console.log(`[SolanaDeposit] Testing RPC connection...`)
    const version = await connection.getVersion()
    console.log(`[SolanaDeposit] RPC connection successful! Version:`, version)
    
    const latestBlockhash = await connection.getLatestBlockhash()
    console.log(`[SolanaDeposit] Latest blockhash: ${latestBlockhash.blockhash}`)
    
    return true
  } catch (error) {
    console.error(`[SolanaDeposit] RPC connection failed:`, error)
    return false
  }
}

async function verifyProgramExists(connection: Connection, programId: PublicKey): Promise<boolean> {
  try {
    console.log(`[SolanaDeposit] Verifying program exists: ${programId.toString()}`)
    const accountInfo = await connection.getAccountInfo(programId)
    if (accountInfo) {
      console.log(`[SolanaDeposit] Program exists! Owner: ${accountInfo.owner.toString()}, Executable: ${accountInfo.executable}`)
      return true
    } else {
      console.error(`[SolanaDeposit] Program does not exist: ${programId.toString()}`)
      return false
    }
  } catch (error) {
    console.error(`[SolanaDeposit] Error checking program existence:`, error)
    return false
  }
}

function createGatewayProgram(network: Network, signer: anchor.web3.Keypair) {
  console.log(`[SolanaDeposit] Creating gateway program for network: ${network}`)
  
  const idl = network === 'mainnet' ? (GATEWAY_PROD_IDL as anchor.Idl) : (GATEWAY_DEV_IDL as anchor.Idl)
  // console.log(`[SolanaDeposit] IDL:`, idl)
  console.log(`[SolanaDeposit] Using IDL for ${network}:`, {
    name: (idl as any).metadata?.name,
    version: (idl as any).metadata?.version,
    instructions: idl.instructions?.length || 0
  })
  
  // Show the program ID from IDL vs correct address
  const idlProgramId = (idl as any).address || (idl as any).programId
  const expectedProgramAddress = GATEWAY_PROGRAM_ADDRESSES[network]
  console.log(`[SolanaDeposit] Program ID comparison:`)
  console.log(`  - IDL Program ID: ${idlProgramId}`)
  console.log(`  - Correct Program Address: ${expectedProgramAddress}`)
  console.log(`  - IDs match: ${idlProgramId === expectedProgramAddress}`)
  
  // Validate IDL structure
  if (!(idl as any).metadata?.name) {
    throw new Error(`Invalid IDL: missing metadata.name field for ${network} network`)
  }
  if (!idl.instructions || idl.instructions.length === 0) {
    throw new Error(`Invalid IDL: no instructions found for ${network} network`)
  }
  
  // Check for required instructions
  const instructionNames = idl.instructions.map((ix: any) => ix.name)
  console.log(`[SolanaDeposit] Available instructions:`, instructionNames)
  
  const requiredInstructions = ['deposit_and_call', 'deposit_spl_token_and_call']
  const missingInstructions = requiredInstructions.filter(name => !instructionNames.includes(name))
  if (missingInstructions.length > 0) {
    throw new Error(`IDL missing required instructions: ${missingInstructions.join(', ')}`)
  }
  
  // Log the complete deposit_spl_token_and_call instruction details
  const depositSplTokenAndCallInstruction = idl.instructions.find((ix: any) => ix.name === 'deposit_spl_token_and_call')
  if (depositSplTokenAndCallInstruction) {
    console.log(`[SolanaDeposit] ===== COMPLETE INSTRUCTION DETAILS =====`)
    console.log(`[SolanaDeposit] Instruction Name: ${depositSplTokenAndCallInstruction.name}`)
    console.log(`[SolanaDeposit] Instruction Docs:`, depositSplTokenAndCallInstruction.docs)
    console.log(`[SolanaDeposit] Instruction Discriminator:`, depositSplTokenAndCallInstruction.discriminator)
    
    console.log(`[SolanaDeposit] ===== ACCOUNTS =====`)
    depositSplTokenAndCallInstruction.accounts.forEach((acc: any, index: number) => {
      console.log(`[SolanaDeposit] Account ${index + 1}:`)
      console.log(`  - Name: ${acc.name}`)
      console.log(`  - isMut: ${acc.isMut}`)
      console.log(`  - isSigner: ${acc.isSigner}`)
      if (acc.docs) console.log(`  - Docs: ${acc.docs}`)
      if (acc.pda) console.log(`  - PDA: ${JSON.stringify(acc.pda)}`)
    })
    
    console.log(`[SolanaDeposit] ===== ARGUMENTS =====`)
    depositSplTokenAndCallInstruction.args.forEach((arg: any, index: number) => {
      console.log(`[SolanaDeposit] Argument ${index + 1}:`)
      console.log(`  - Name: ${arg.name}`)
      console.log(`  - Type: ${JSON.stringify(arg.type)}`)
      if (arg.docs) console.log(`  - Docs: ${arg.docs}`)
    })
    
    console.log(`[SolanaDeposit] ===== COMPLETE INSTRUCTION OBJECT =====`)
    console.log(JSON.stringify(depositSplTokenAndCallInstruction, null, 2))
    console.log(`[SolanaDeposit] ===== END INSTRUCTION DETAILS =====`)
  } else {
    console.log(`[SolanaDeposit] ❌ deposit_spl_token_and_call instruction not found in IDL!`)
  }
  
  const rpcUrl = getSolanaRpc(network)
  console.log(`[SolanaDeposit] RPC URL: ${rpcUrl}`)
  
  const connection = new Connection(rpcUrl)
  console.log(`[SolanaDeposit] Connection created successfully`)
  
  // Handle environments where anchor.Wallet isn't exported in ESM bundle
  const wallet = (anchor as any).Wallet
    ? new (anchor as any).Wallet(signer)
    : ({
        publicKey: signer.publicKey,
        signTransaction: async (tx: any) => {
          tx.partialSign(signer); return tx
        },
        signAllTransactions: async (txs: any[]) => {
          txs.forEach((t) => t.partialSign(signer)); return txs
        }
      })
  
  console.log(`[SolanaDeposit] Wallet created for public key: ${wallet.publicKey.toString()}`)
  
  const provider = new anchor.AnchorProvider(connection, wallet as any)
  console.log(`[SolanaDeposit] Anchor provider created`)
  
  // Use the correct program address instead of the one from IDL
  const actualProgramAddress = GATEWAY_PROGRAM_ADDRESSES[network]
  console.log(`[SolanaDeposit] Using correct program address: ${actualProgramAddress}`)
  
  // Rebuild the IDL with the correct address
  const correctedIdl = {
    ...idl,
    address: actualProgramAddress
  }
  console.log(`[SolanaDeposit] Original IDL address: ${(idl as any).address}`)
  console.log(`[SolanaDeposit] Corrected IDL address: ${correctedIdl.address}`)
  
  // Create program with the corrected IDL
  const program = new anchor.Program(correctedIdl as any, provider)
  console.log(`[SolanaDeposit] Program created with correct ID: ${program.programId.toString()}`)
  console.log(`[SolanaDeposit] Program IDL address: ${program.idl.address}`)
  
  return { program, provider, connection }
}

async function getSplSourceAccount(provider: anchor.AnchorProvider, mint: string) {
  console.log(`[SolanaDeposit] Getting SPL source account for mint: ${mint}`)
  
  const connection = provider.connection
  const owner = provider.wallet.publicKey
  console.log(`[SolanaDeposit] Owner public key: ${owner.toString()}`)
  
  const tokenAccounts = await connection.getTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID })
  console.log(`[SolanaDeposit] Found ${tokenAccounts.value.length} token accounts for owner`)
  
  const mintKey = new PublicKey(mint)
  console.log(`[SolanaDeposit] Mint key: ${mintKey.toString()}`)
  
  const mintInfo = await connection.getTokenSupply(mintKey)
  const decimals = mintInfo.value.decimals
  console.log(`[SolanaDeposit] Mint info - decimals: ${decimals}, supply: ${mintInfo.value.amount}`)
  
  const match = tokenAccounts.value.find(({ account }) => {
    const data = AccountLayout.decode(account.data)
    return new PublicKey(data.mint).equals(mintKey)
  })
  
  if (!match) {
    console.error(`[SolanaDeposit] No token account found for mint ${mint}`)
    console.log(`[SolanaDeposit] Available token accounts:`, tokenAccounts.value.map(({ pubkey, account }) => {
      const data = AccountLayout.decode(account.data)
      return {
        pubkey: pubkey.toString(),
        mint: new PublicKey(data.mint).toString()
      }
    }))
    throw new Error(`No token account for mint ${mint}`)
  }
  
  console.log(`[SolanaDeposit] Found matching token account: ${match.pubkey.toString()}`)
  return { from: match.pubkey, decimals }
}

async function ensureSolBalance(provider: anchor.AnchorProvider, amount: string) {
  console.log(`[SolanaDeposit] Checking SOL balance for amount: ${amount}`)
  
  const lamportsNeeded = ethers.parseUnits(amount, 9)
  const balance = await provider.connection.getBalance(provider.wallet.publicKey)
  
  console.log(`[SolanaDeposit] Balance check - Available: ${balance / 1e9} SOL, Required: ${amount} SOL`)
  
  if (BigInt(balance) < lamportsNeeded) {
    throw new Error(`Insufficient SOL balance. Available: ${balance / 1e9}, Required: ${amount}`)
  }
  
  console.log(`[SolanaDeposit] SOL balance sufficient`)
}

function buildRevertOptions(opts: {
  callOnRevert?: boolean
  revertMessage?: string
  revertAddress?: string
  abortAddress?: string
  onRevertGasLimit?: string | number
}, signerPk: PublicKey) {
  console.log(`[SolanaDeposit] Building revert options:`, {
    callOnRevert: opts.callOnRevert,
    revertMessage: opts.revertMessage,
    revertAddress: opts.revertAddress,
    abortAddress: opts.abortAddress,
    onRevertGasLimit: opts.onRevertGasLimit,
    signerPk: signerPk.toString()
  })
  
  const revertOptions = {
    abortAddress: ethers.getBytes(opts.abortAddress ?? ethers.ZeroAddress),
    callOnRevert: !!opts.callOnRevert,
    onRevertGasLimit: new anchor.BN((opts.onRevertGasLimit ?? 0).toString()),
    revertAddress: opts.revertAddress ? new PublicKey(opts.revertAddress) : signerPk,
    revertMessage: Buffer.from(opts.revertMessage ?? '', 'utf8'),
  }
  
  console.log(`[SolanaDeposit] Built revert options:`, {
    callOnRevert: revertOptions.callOnRevert,
    onRevertGasLimit: revertOptions.onRevertGasLimit.toString(),
    revertAddress: revertOptions.revertAddress.toString(),
    revertMessage: revertOptions.revertMessage.toString('utf8')
  })
  
  return revertOptions
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
  console.log(`[SolanaDeposit] Starting solanaDepositAndCallServer with params:`, {
    amount: params.amount,
    receiver: params.receiver,
    token: params.token,
    types: params.types,
    values: params.values,
    network: params.network,
    hasMnemonic: !!params.mnemonicPhrase
  })
  
  const { amount, receiver, token, types, values, revertOptions, mnemonicPhrase, network } = params
  
  console.log(`[SolanaDeposit] Converting mnemonic to keypair...`)
  const { keypair } = await solanaMnemonicToKeypairForRetrieval(mnemonicPhrase)
  console.log(`[SolanaDeposit] Keypair created for public key: ${keypair.publicKey.toString()}`)
  
  console.log(`[SolanaDeposit] Creating gateway program...`)
  const { program: gatewayProgram, provider, connection } = createGatewayProgram(network, keypair)
  
  // Test RPC connection first
  console.log(`[SolanaDeposit] Testing RPC connection...`)
  const rpcConnected = await testRpcConnection(connection)
  if (!rpcConnected) {
    throw new Error(`Failed to connect to Solana RPC endpoint. Please check your network connection and RPC configuration.`)
  }
  
  // Verify the program exists on the network
  console.log(`[SolanaDeposit] Verifying program exists on network...`)
  const programExists = await verifyProgramExists(connection, gatewayProgram.programId)
  if (!programExists) {
    throw new Error(`Gateway program ${gatewayProgram.programId.toString()} does not exist on ${network} network. Please check the network configuration and program deployment.`)
  }

  // Encode receiver and message
  console.log(`[SolanaDeposit] Encoding receiver and message...`)
  console.log(`[SolanaDeposit] Receiver address: ${receiver}`)
  const receiverBytes = ethers.getBytes(receiver)
  console.log(`[SolanaDeposit] Receiver bytes length: ${receiverBytes.length}`)
  console.log(`[SolanaDeposit] Receiver bytes: ${Array.from(receiverBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`)
  
  console.log(`[SolanaDeposit] Types: ${types}`)
  console.log(`[SolanaDeposit] Values: ${values}`)
  
  const abiCoder = ethers.AbiCoder.defaultAbiCoder()
  const encodedParameters = abiCoder.encode(types, values)
  console.log(`[SolanaDeposit] Encoded parameters: ${encodedParameters}`)
  
  const message = Buffer.from(encodedParameters.slice(2), 'hex')
  console.log(`[SolanaDeposit] Message buffer length: ${message.length}`)
  console.log(`[SolanaDeposit] Message buffer: ${message.toString('hex')}`)
  
  const revert = buildRevertOptions(revertOptions, keypair.publicKey)

  if (token) {
    console.log(`[SolanaDeposit] Processing SPL token transfer for token: ${token}`)
    
    // SPL transfer path
    const { from, decimals } = await getSplSourceAccount(provider, token)
    
    console.log(`[SolanaDeposit] Getting TSS PDA and ATA for mint (ZetaChain style)...`)
    // Find the TSS PDA (meta) - matching ZetaChain implementation
    const [tssPda] = PublicKey.findProgramAddressSync([Buffer.from('meta', 'utf8')], gatewayProgram.programId)
    console.log(`[SolanaDeposit] TSS PDA: ${tssPda.toString()}`)
    
    // Find the TSS's ATA for the mint - using async method like ZetaChain
    const tssAta = await PublicKey.findProgramAddress(
      [
        tssPda.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        new PublicKey(token).toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
    console.log(`[SolanaDeposit] TSS ATA: ${tssAta[0].toString()}`)
    
    const to = tssAta[0].toBase58()
    
    const amountBN = new anchor.BN(ethers.parseUnits(amount, decimals).toString())
    console.log(`[SolanaDeposit] Amount in BN: ${amountBN.toString()}`)
    
    // Following official ZetaChain implementation - no whitelist testing needed
    
    // Try without whitelist entry first - maybe it's not needed
    console.log(`[SolanaDeposit] ===== ACCOUNT MAPPING =====`)
    console.log(`[SolanaDeposit] Expected accounts from IDL:`)
    const depositInstruction = (gatewayProgram.idl as any).instructions.find((ix: any) => ix.name === 'deposit_spl_token_and_call')
    if (depositInstruction) {
      depositInstruction.accounts.forEach((acc: any, index: number) => {
        console.log(`[SolanaDeposit] ${index + 1}. ${acc.name} (isMut: ${acc.isMut}, isSigner: ${acc.isSigner})`)
      })
    }
    
    // Match the official ZetaChain implementation exactly
    console.log(`[SolanaDeposit] Using official ZetaChain implementation structure...`)
    console.log(`[SolanaDeposit] Our provided accounts (matching ZetaChain):`)
    console.log(`[SolanaDeposit] 1. from: ${from.toString()}`)
    console.log(`[SolanaDeposit] 2. mintAccount: ${token}`)
    console.log(`[SolanaDeposit] 3. signer: ${keypair.publicKey.toString()}`)
    console.log(`[SolanaDeposit] 4. systemProgram: ${SystemProgram.programId.toString()}`)
    console.log(`[SolanaDeposit] 5. to: ${to}`)
    console.log(`[SolanaDeposit] 6. tokenProgram: ${TOKEN_PROGRAM_ID.toString()}`)
    console.log(`[SolanaDeposit] ===== END ACCOUNT MAPPING =====`)
    
    console.log(`[SolanaDeposit] Calling depositSplTokenAndCall (ZetaChain style)...`)
    try {
      const sig = await (gatewayProgram as any).methods
        .depositSplTokenAndCall(amountBN, receiverBytes, message, revert)
        .accounts({
          from,
          mintAccount: token,
          signer: keypair.publicKey,
          systemProgram: SystemProgram.programId,
          to,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
      
      console.log(`[SolanaDeposit] SPL token transfer successful! Signature: ${sig}`)
      return sig as string
    } catch (error) {
      console.error(`[SolanaDeposit] SPL token transfer failed (ZetaChain style):`, error)
      
      // Enhanced error handling for other errors
      if (error instanceof Error) {
        if (error.message.includes('program that does not exist')) {
          throw new Error(`Gateway program ${gatewayProgram.programId.toString()} does not exist on ${network} network. This could be due to:\n1. Wrong network configuration (using mainnet IDL on testnet or vice versa)\n2. Program not deployed on this network\n3. Program ID mismatch in the IDL\n\nPlease verify your network setting and ensure the program is deployed.`)
        } else if (error.message.includes('insufficient funds')) {
          throw new Error(`Insufficient funds for SPL token transfer. Please check your token balance.`)
        } else if (error.message.includes('invalid account')) {
          throw new Error(`Invalid token account. Please ensure you have a valid token account for mint ${token}.`)
        } else {
          throw new Error(`SPL token transfer failed: ${error.message}`)
        }
      }
      throw error
    }
  } else {
    console.log(`[SolanaDeposit] Processing SOL transfer`)
    
    // SOL transfer path
    await ensureSolBalance(provider, amount)
    
    const amountBN = new anchor.BN(ethers.parseUnits(amount, 9).toString())
    console.log(`[SolanaDeposit] SOL amount in BN: ${amountBN.toString()}`)
    
    console.log(`[SolanaDeposit] Calling depositAndCall method...`)
    try {
      const sig = await (gatewayProgram as any).methods
        .depositAndCall(amountBN, receiverBytes, message, revert)
        .accounts({})
        .rpc()
      
      console.log(`[SolanaDeposit] SOL transfer successful! Signature: ${sig}`)
      return sig as string
    } catch (error) {
      console.error(`[SolanaDeposit] SOL transfer failed:`, error)
      
      // Enhanced error handling
      if (error instanceof Error) {
        if (error.message.includes('program that does not exist')) {
          throw new Error(`Gateway program ${gatewayProgram.programId.toString()} does not exist on ${network} network. This could be due to:\n1. Wrong network configuration (using mainnet IDL on testnet or vice versa)\n2. Program not deployed on this network\n3. Program ID mismatch in the IDL\n\nPlease verify your network setting and ensure the program is deployed.`)
        } else if (error.message.includes('insufficient funds')) {
          throw new Error(`Insufficient SOL balance for transfer. Please check your SOL balance.`)
        } else if (error.message.includes('invalid account')) {
          throw new Error(`Invalid account configuration for SOL transfer.`)
        } else {
          throw new Error(`SOL transfer failed: ${error.message}`)
        }
      }
      throw error
    }
  }
}



