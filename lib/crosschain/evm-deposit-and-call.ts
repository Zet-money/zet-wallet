import { ethers } from "ethers";
import { z } from "zod";

// ERC20 ABI - simplified version
const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)"
];

// Types for our implementation
interface ERC20Contract extends ethers.Contract {
  decimals(): Promise<number>;
  approve(spender: string, amount: bigint): Promise<ethers.ContractTransactionResponse>;
  [key: string]: any; // Allow other properties
}

interface EvmDepositAndCallParams {
  amount: string;
  receiver: string;
  token?: string; // If undefined, it's a native token deposit
  types?: string[];
  values?: any[];
  revertOptions?: {
    revertOnError?: boolean;
    gasLimit?: string;
  };
}

interface EvmOptions {
  signer: ethers.Signer;
  gateway?: string;
  txOptions?: {
    gasLimit?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
}

// Schema validation
const evmDepositAndCallParamsSchema = z.object({
  amount: z.string(),
  receiver: z.string(),
  token: z.string().optional(),
  types: z.array(z.string()).optional(),
  values: z.array(z.any()).optional(),
  revertOptions: z.object({
    revertOnError: z.boolean().optional(),
    gasLimit: z.string().optional(),
  }).optional(),
});

const evmOptionsSchema = z.object({
  signer: z.any(), // ethers.Signer
  gateway: z.string().optional(),
  txOptions: z.object({
    gasLimit: z.string().optional(),
    gasPrice: z.string().optional(),
    maxFeePerGas: z.string().optional(),
    maxPriorityFeePerGas: z.string().optional(),
  }).optional(),
});

type EvmDepositAndCallParamsType = z.infer<typeof evmDepositAndCallParamsSchema>;
type EvmOptionsType = z.infer<typeof evmOptionsSchema>;

/**
 * Get gateway address from signer's network
 */
const getGatewayAddressFromSigner = async (signer: ethers.Signer): Promise<string> => {
  const provider = signer.provider;
  if (!provider) {
    throw new Error("Signer must have a provider to get network information");
  }
  
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  
  // Gateway addresses for different networks
  const gatewayAddresses: Record<number, string> = {
    8453: "0x48B9AACC350b20147001f88821d31731Ba4C30ed", // Base Mainnet
    84532: "0x0c487a766110c85d301d96e33579c5b317fa4995", // Base Sepolia (testnet)
    // Add more networks as needed
  };
  
  const gatewayAddress = gatewayAddresses[chainId];
  if (!gatewayAddress) {
    throw new Error(`Gateway address not found for chain ID ${chainId}`);
  }
  
  return gatewayAddress;
};

/**
 * Generate calldata for deposit and call
 */
const generateEvmDepositAndCallData = (params: {
  amount: string;
  decimals?: number;
  erc20?: string;
  receiver: string;
  revertOptions?: {
    revertOnError?: boolean;
    gasLimit?: string;
  };
  types?: string[];
  values?: any[];
}) => {
  // This is a simplified implementation
  // In a real implementation, you would encode the function call data properly
  const iface = new ethers.Interface([
    "function depositAndCall(address receiver, uint256 amount, bytes calldata data) external payable",
    "function depositAndCallERC20(address token, address receiver, uint256 amount, bytes calldata data) external",
  ]);
  
  let callData: string;
  let value: bigint = BigInt(0);
  
  if (params.erc20) {
    // ERC20 deposit and call
    const functionData = iface.encodeFunctionData("depositAndCallERC20", [
      params.erc20,
      params.receiver,
      ethers.parseUnits(params.amount, params.decimals || 18),
      "0x" // Empty data for now
    ]);
    callData = functionData;
  } else {
    // Native token deposit and call
    value = ethers.parseEther(params.amount);
    const functionData = iface.encodeFunctionData("depositAndCall", [
      params.receiver,
      value,
      "0x" // Empty data for now
    ]);
    callData = functionData;
  }
  
  return {
    data: callData,
    value: value,
  };
};

/**
 * Broadcast gateway transaction
 */
const broadcastGatewayTx = async (params: {
  signer: ethers.Signer;
  txData: {
    data: string;
    to: string;
    value: bigint;
  };
  txOptions?: {
    gasLimit?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
}) => {
  const tx = await params.signer.sendTransaction({
    to: params.txData.to,
    data: params.txData.data,
    value: params.txData.value,
    gasLimit: params.txOptions?.gasLimit ? BigInt(params.txOptions.gasLimit) : undefined,
    gasPrice: params.txOptions?.gasPrice ? BigInt(params.txOptions.gasPrice) : undefined,
    maxFeePerGas: params.txOptions?.maxFeePerGas ? BigInt(params.txOptions.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: params.txOptions?.maxPriorityFeePerGas ? BigInt(params.txOptions.maxPriorityFeePerGas) : undefined,
  });
  
  return tx;
};

/**
 * Validate and parse schema
 */
const validateAndParseSchema = <T>(data: any, schema: z.ZodSchema<T>): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.issues.map((e: any) => e.message).join(', ')}`);
    }
    throw error;
  }
};

/**
 * Deposits tokens and makes a cross-chain call from an EVM chain to a universal contract on ZetaChain.
 *
 * This function combines token deposit with a contract call in a single transaction.
 * It allows you to transfer tokens from an EVM chain to ZetaChain and immediately
 * execute a function call on the universal contract. Supports both native tokens
 * and ERC20 tokens.
 *
 * @param params - The deposit and call parameters including amount, receiver, token address, function types/values, and revert options
 * @param options - Configuration options including signer and optional gateway address
 * @returns Promise that resolves to the transaction response
 */
export const evmDepositAndCall = async (
  params: EvmDepositAndCallParams,
  options: EvmOptions
) => {
  const validatedParams = validateAndParseSchema(
    params,
    evmDepositAndCallParamsSchema
  ) as EvmDepositAndCallParamsType;
  const validatedOptions = validateAndParseSchema(options, evmOptionsSchema) as EvmOptionsType;

  const gatewayAddress =
    validatedOptions.gateway ||
    (await getGatewayAddressFromSigner(validatedOptions.signer));

  if (validatedParams.token) {
    const erc20Contract = new ethers.Contract(
      validatedParams.token,
      ERC20_ABI,
      validatedOptions.signer
    ) as ERC20Contract;

    const decimals = await erc20Contract.decimals();
    const value = ethers.parseUnits(validatedParams.amount, decimals);

    // Approve the gateway to spend the tokens
    const approval = await erc20Contract.approve(gatewayAddress, value);
    await approval.wait();

    // Generate calldata for deposit and call
    const callData = generateEvmDepositAndCallData({
      amount: validatedParams.amount,
      decimals: decimals,
      erc20: validatedParams.token,
      receiver: validatedParams.receiver,
      revertOptions: validatedParams.revertOptions,
      types: validatedParams.types,
      values: validatedParams.values,
    });

    const tx = await broadcastGatewayTx({
      signer: validatedOptions.signer,
      txData: {
        data: callData.data,
        to: gatewayAddress,
        value: callData.value,
      },
      txOptions: validatedOptions.txOptions || {},
    });
    return tx;
  } else {
    // Native token deposit and call
    const callData = generateEvmDepositAndCallData({
      amount: validatedParams.amount,
      receiver: validatedParams.receiver,
      revertOptions: validatedParams.revertOptions,
      types: validatedParams.types,
      values: validatedParams.values,
    });

    const tx = await broadcastGatewayTx({
      signer: validatedOptions.signer,
      txData: {
        data: callData.data,
        to: gatewayAddress,
        value: callData.value,
      },
      txOptions: validatedOptions.txOptions || {},
    });
    return tx;
  }
};

export type { EvmDepositAndCallParams, EvmOptions };
