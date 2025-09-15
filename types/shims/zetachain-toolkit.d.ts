declare module '@zetachain/toolkit' {
  import type { ContractTransactionResponse, AbstractSigner } from 'ethers'

  export function evmDeposit(
    params: {
      amount: string
      receiver: string
      token?: string
      revertOptions?: unknown
    },
    options: { signer: AbstractSigner; gateway?: string; txOptions?: unknown }
  ): Promise<ContractTransactionResponse>

  export function evmDepositAndCall(
    params: {
      amount: string
      receiver: string
      token?: string
      types?: string[]
      values?: (string | bigint | boolean)[]
      revertOptions?: unknown
    },
    options: { signer: AbstractSigner; gateway?: string; txOptions?: unknown }
  ): Promise<ContractTransactionResponse>
}


