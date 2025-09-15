import { evmDeposit, evmDepositAndCall } from '@zetachain/toolkit'
import { ContractTransactionResponse } from 'ethers'
import { getEvmSignerFromPhrase, type SupportedEvm } from './providers'

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
}

export async function depositToZeta({ originChain, amount, receiver, token, mnemonicPhrase }: EvmDepositParams): Promise<ContractTransactionResponse> {
  const signer = getEvmSignerFromPhrase(mnemonicPhrase, originChain)
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

export async function depositAndCall({ originChain, amount, receiver, token, mnemonicPhrase }: EvmDepositParams & { function?: string; types?: string[]; values?: (string|bigint|boolean)[] }): Promise<ContractTransactionResponse> {
  const signer = getEvmSignerFromPhrase(mnemonicPhrase, originChain)
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


