import { evmDeposit, evmDepositAndCall } from '@zetachain/toolkit'
import { ContractTransactionResponse } from 'ethers'
import { getEvmSignerFromPhrase, type SupportedEvm, type Network, type RpcMap } from './providers'

export type Erc20Token = {
  symbol: string
  address: string
  decimals?: number
}

export type EvmDepositParams = {
  originChain: SupportedEvm
  amount: string
  receiver: string // receiver on ZetaChain
  token?: Erc20Token | string // token object or address for convenience
  mnemonicPhrase: string
  network: Network
  rpc?: RpcMap
}

export async function depositToZeta({ originChain, amount, receiver, token, mnemonicPhrase, network, rpc }: EvmDepositParams): Promise<ContractTransactionResponse> {
  const signer = getEvmSignerFromPhrase(mnemonicPhrase, originChain, network, rpc)
  const tx = await evmDeposit(
    {
      amount,
      receiver,
      token: typeof token === 'string' ? token : token?.address,
    },
    { signer }
  )
  return tx
}

export async function depositAndCall({ originChain, amount, receiver, token, mnemonicPhrase, network, rpc }: EvmDepositParams & { function?: string; types?: string[]; values?: (string|bigint|boolean)[] }): Promise<ContractTransactionResponse> {
  const signer = getEvmSignerFromPhrase(mnemonicPhrase, originChain, network, rpc)
  const tx = await evmDepositAndCall(
    {
      amount,
      receiver,
      token: typeof token === 'string' ? token : token?.address,
    },
    { signer }
  )
  return tx
}


