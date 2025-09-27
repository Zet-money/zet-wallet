import { ethers } from "ethers";
import { z } from "zod";
import { BASE_GATEWAY_ABI } from "./base-gateway.abi";

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

interface RevertOptions {
  revertAddress: string;
  callOnRevert: boolean;
  abortAddress: string;
  revertMessage: string;
  onRevertGasLimit: string;
}

interface EvmDepositAndCallParams {
  amount: string;
  receiver: string;
  token?: string; // If undefined, it's a native token deposit
  types?: string[];
  values?: any[];
  revertOptions?: RevertOptions;
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
const revertOptionsSchema = z.object({
  revertAddress: z.string(),
  callOnRevert: z.boolean(),
  abortAddress: z.string(),
  revertMessage: z.string(),
  onRevertGasLimit: z.string(),
});

const evmDepositAndCallParamsSchema = z.object({
  amount: z.string(),
  receiver: z.string(),
  token: z.string().optional(),
  types: z.array(z.string()).optional(),
  values: z.array(z.any()).optional(),
  revertOptions: revertOptionsSchema.optional(),
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
  revertOptions?: RevertOptions;
  types?: string[];
  values?: any[];
}) => {
  // Use the real ZetaChain Gateway ABI
  const gatewayInterface = new ethers.Interface(BASE_GATEWAY_ABI);
  
  // Generate the calldata for the function that will be called on ZetaChain
  let zetaChainCallData = "0x";
  
  if (params.types && params.values && params.types.length > 0 && params.values.length > 0) {
    // If we have function call data to encode
    try {
      // Create interface for the target function on ZetaChain
      const functionSignature = `function execute(${params.types.join(', ')})`;
      const targetInterface = new ethers.Interface([functionSignature]);
      
      // Encode the function call data
      zetaChainCallData = targetInterface.encodeFunctionData("execute", params.values);
    } catch (error) {
      console.warn("Failed to encode function call data:", error);
      // Fallback to empty data
      zetaChainCallData = "0x";
    }
  }
  
  // Default revert options if not provided
  const defaultRevertOptions: RevertOptions = {
    revertAddress: ethers.ZeroAddress,
    callOnRevert: false,
    abortAddress: ethers.ZeroAddress,
    revertMessage: "0x",
    onRevertGasLimit: "0"
  };
  
  const revertOptions = params.revertOptions || defaultRevertOptions;
  
  let callData: string;
  let value: bigint = BigInt(0);
  
  if (params.erc20) {
    // ERC20 deposit and call using the real ABI
    const amount = ethers.parseUnits(params.amount, params.decimals || 18);
    callData = gatewayInterface.encodeFunctionData("depositAndCall(address,uint256,address,bytes,(address,bool,address,bytes,uint256))", [
      params.receiver,
      amount,
      params.erc20,
      zetaChainCallData,
      revertOptions
    ]);
  } else {
    // Native token deposit and call using the real ABI
    value = ethers.parseEther(params.amount);
    callData = gatewayInterface.encodeFunctionData("depositAndCall(address,bytes,(address,bool,address,bytes,uint256))", [
      params.receiver,
      zetaChainCallData,
      revertOptions
    ]);
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

/**
 * Helper function to create default revert options
 */
export const createDefaultRevertOptions = (): RevertOptions => {
  return {
    revertAddress: ethers.ZeroAddress,
    callOnRevert: false,
    abortAddress: ethers.ZeroAddress,
    revertMessage: "0x",
    onRevertGasLimit: "0"
  };
};

/**
 * Helper function to create custom revert options
 */
export const createRevertOptions = (
  revertAddress: string = ethers.ZeroAddress,
  callOnRevert: boolean = false,
  abortAddress: string = ethers.ZeroAddress,
  revertMessage: string = "0x",
  onRevertGasLimit: string = "0"
): RevertOptions => {
  return {
    revertAddress,
    callOnRevert,
    abortAddress,
    revertMessage,
    onRevertGasLimit
  };
};

/**
 * Helper function to create a simple transfer call
 */
export const createTransferCall = (to: string, amount: string) => {
  return {
    types: ["address", "uint256"],
    values: [to, ethers.parseEther(amount)]
  };
};

/**
 * Helper function to create a contract call with custom function
 */
export const createContractCall = (functionName: string, types: string[], values: any[]) => {
  return {
    types: ["string", ...types],
    values: [functionName, ...values]
  };
};

/**
 * Helper function to create a swap call (example)
 */
export const createSwapCall = (
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  minAmountOut: string,
  recipient: string
) => {
  return {
    types: ["address", "address", "uint256", "uint256", "address"],
    values: [tokenIn, tokenOut, ethers.parseEther(amountIn), ethers.parseEther(minAmountOut), recipient]
  };
};

export type { EvmDepositAndCallParams, EvmOptions, RevertOptions };
