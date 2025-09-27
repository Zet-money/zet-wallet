import { ethers } from "ethers";
import { z } from "zod";
import { BASE_GATEWAY_ABI } from "./base-gateway.abi";

export const ZETPROTOCOL_ADDRESS = '0x7689b1a47fb4c5F16aBA476E4D315b8421CAebD2'

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
  console.log('[generateEvmDepositAndCallData] ===== GENERATING CALLDATA =====');
  console.log('[generateEvmDepositAndCallData] Input params:', JSON.stringify(params, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value, 2));
  
  // Use the real ZetaChain Gateway ABI
  const gatewayInterface = new ethers.Interface(BASE_GATEWAY_ABI);
  console.log('[generateEvmDepositAndCallData] Gateway interface created');
  
  // Generate the calldata for the function that will be called on ZetaChain
  let zetaChainCallData = "0x";
  
  if (params.types && params.values && params.types.length > 0 && params.values.length > 0) {
    console.log('[generateEvmDepositAndCallData] Encoding ZetaChain function call...');
    console.log('[generateEvmDepositAndCallData] Types:', params.types);
    console.log('[generateEvmDepositAndCallData] Values:', params.values);
    
    // If we have function call data to encode
    try {
      // Create interface for the target function on ZetaChain
      // The function signature should be: function execute(address,bytes,bool)
      const functionSignature = `function execute(${params.types.join(', ')})`;
      console.log('[generateEvmDepositAndCallData] Function signature:', functionSignature);
      const targetInterface = new ethers.Interface([functionSignature]);
      
      // Encode the function call data
      zetaChainCallData = targetInterface.encodeFunctionData("execute", params.values);
      console.log('[generateEvmDepositAndCallData] Encoded ZetaChain call data:', zetaChainCallData);
    } catch (error) {
      console.warn("Failed to encode function call data:", error);
      // Fallback to empty data
      zetaChainCallData = "0x";
    }
  } else {
    console.log('[generateEvmDepositAndCallData] No ZetaChain function call data, using empty data');
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
  console.log('[generateEvmDepositAndCallData] Revert options:', JSON.stringify(revertOptions, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value, 2));
  
  let callData: string;
  let value: bigint = BigInt(0);
  
  if (params.erc20) {
    console.log('[generateEvmDepositAndCallData] ===== ERC20 FUNCTION SIGNATURE =====');
    console.log('[generateEvmDepositAndCallData] Using function: depositAndCall(address,uint256,address,bytes,(address,bool,address,bytes,uint256))');
    
    // ERC20 deposit and call using the real ABI
    const amount = ethers.parseUnits(params.amount, params.decimals || 18);
    console.log('[generateEvmDepositAndCallData] Parsed amount:', amount.toString());
    console.log('[generateEvmDepositAndCallData] Function parameters:', {
      receiver: params.receiver,
      amount: amount.toString(),
      erc20: params.erc20,
      zetaChainCallData: zetaChainCallData,
      revertOptions: revertOptions
    });
    
    callData = gatewayInterface.encodeFunctionData("depositAndCall(address,uint256,address,bytes,(address,bool,address,bytes,uint256))", [
      params.receiver,
      amount,
      params.erc20,
      zetaChainCallData,
      revertOptions
    ]);
  } else {
    console.log('[generateEvmDepositAndCallData] ===== NATIVE TOKEN FUNCTION SIGNATURE =====');
    console.log('[generateEvmDepositAndCallData] Using function: depositAndCall(address,bytes,(address,bool,address,bytes,uint256))');
    
    // Native token deposit and call using the real ABI
    value = ethers.parseEther(params.amount);
    console.log('[generateEvmDepositAndCallData] Parsed ETH amount:', value.toString());
    console.log('[generateEvmDepositAndCallData] Function parameters:', {
      receiver: params.receiver,
      zetaChainCallData: zetaChainCallData,
      revertOptions: revertOptions
    });
    
    callData = gatewayInterface.encodeFunctionData("depositAndCall(address,bytes,(address,bool,address,bytes,uint256))", [
      params.receiver,
      zetaChainCallData,
      revertOptions
    ]);
  }
  
  console.log('[generateEvmDepositAndCallData] Final calldata:', callData);
  console.log('[generateEvmDepositAndCallData] Final value:', value.toString());
  
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
  console.log('[broadcastGatewayTx] ===== BROADCASTING TRANSACTION =====');
  console.log('[broadcastGatewayTx] Transaction data:', {
    to: params.txData.to,
    data: params.txData.data,
    value: params.txData.value.toString(),
    dataLength: params.txData.data.length
  });
  console.log('[broadcastGatewayTx] Transaction options:', params.txOptions);
  
  const txRequest = {
    to: params.txData.to,
    data: params.txData.data,
    value: params.txData.value,
    gasLimit: params.txOptions?.gasLimit ? BigInt(params.txOptions.gasLimit) : undefined,
    gasPrice: params.txOptions?.gasPrice ? BigInt(params.txOptions.gasPrice) : undefined,
    maxFeePerGas: params.txOptions?.maxFeePerGas ? BigInt(params.txOptions.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: params.txOptions?.maxPriorityFeePerGas ? BigInt(params.txOptions.maxPriorityFeePerGas) : undefined,
  };
  
  console.log('[broadcastGatewayTx] Final transaction request:', JSON.stringify(txRequest, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value, 2));
  
  try {
    // Get the current nonce to avoid nonce conflicts
    const nonce = await params.signer.getNonce();
    console.log('[broadcastGatewayTx] Current nonce:', nonce);
    
    const tx = await params.signer.sendTransaction({
      ...txRequest,
      nonce: nonce
    });
    console.log('[broadcastGatewayTx] Transaction sent successfully:', tx.hash);
    return tx;
  } catch (error) {
    console.error('[broadcastGatewayTx] Transaction failed:', error);
    
    // If it's a nonce error, provide more helpful information
    if (error instanceof Error && error.message.includes('nonce')) {
      console.error('[broadcastGatewayTx] Nonce error detected. This usually means:');
      console.error('[broadcastGatewayTx] 1. A transaction with the same nonce was already submitted');
      console.error('[broadcastGatewayTx] 2. The transaction was submitted multiple times');
      console.error('[broadcastGatewayTx] 3. There might be a race condition');
    }
    
    throw error;
  }
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
  console.log('[evmDepositAndCall] ===== STARTING TRANSACTION =====');
  console.log('[evmDepositAndCall] Input params:', JSON.stringify(params, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value, 2));
  console.log('[evmDepositAndCall] Input options:', JSON.stringify(options, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value, 2));
  
  const validatedParams = validateAndParseSchema(
    params,
    evmDepositAndCallParamsSchema
  ) as EvmDepositAndCallParamsType;
  const validatedOptions = validateAndParseSchema(options, evmOptionsSchema) as EvmOptionsType;

  console.log('[evmDepositAndCall] Validated params:', JSON.stringify(validatedParams, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value, 2));
  console.log('[evmDepositAndCall] Validated options:', JSON.stringify(validatedOptions, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value, 2));

  const gatewayAddress =
    validatedOptions.gateway ||
    (await getGatewayAddressFromSigner(validatedOptions.signer));
    
  console.log('[evmDepositAndCall] Gateway address:', gatewayAddress);

  // Check if this is a ZetProtocol call (has types and values)
  const isZetProtocolCall = validatedParams.types && validatedParams.values && 
    validatedParams.types.length > 0 && validatedParams.values.length > 0;
  
  if (isZetProtocolCall) {
    console.log('[evmDepositAndCall] ===== ZETPROTOCOL CALL DETECTED =====');
    console.log('[evmDepositAndCall] Using ZetProtocol contract as receiver:', ZETPROTOCOL_ADDRESS);
    console.log('[evmDepositAndCall] User recipient will be in payload data');
    
    // For ZetProtocol calls, we need to restructure the parameters
    // The receiver should be the ZetProtocol contract, not the user's address
    const zetProtocolParams = {
      ...validatedParams,
      receiver: ZETPROTOCOL_ADDRESS, // Override receiver to ZetProtocol contract
    };
    
    console.log('[evmDepositAndCall] ZetProtocol params:', JSON.stringify(zetProtocolParams, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2));
  }

  if (validatedParams.token) {
    console.log('[evmDepositAndCall] ===== ERC20 TOKEN PATH =====');
    console.log('[evmDepositAndCall] Token address:', validatedParams.token);
    
    const erc20Contract = new ethers.Contract(
      validatedParams.token,
      ERC20_ABI,
      validatedOptions.signer
    ) as ERC20Contract;

    const decimals = await erc20Contract.decimals();
    const value = ethers.parseUnits(validatedParams.amount, decimals);
    
    console.log('[evmDepositAndCall] Token decimals:', decimals);
    console.log('[evmDepositAndCall] Parsed amount:', value.toString());
    console.log('[evmDepositAndCall] Gateway address for approval:', gatewayAddress);

    // Approve the gateway to spend the tokens
    console.log('[evmDepositAndCall] Approving gateway to spend tokens...');
    const approval = await erc20Contract.approve(gatewayAddress, value);
    console.log('[evmDepositAndCall] Approval transaction hash:', approval.hash);
    await approval.wait();
    console.log('[evmDepositAndCall] Approval confirmed');

    // Generate calldata for deposit and call
    console.log('[evmDepositAndCall] Generating calldata for ERC20 deposit...');
    const callData = generateEvmDepositAndCallData({
      amount: validatedParams.amount,
      decimals: decimals,
      erc20: validatedParams.token,
      receiver: isZetProtocolCall ? ZETPROTOCOL_ADDRESS : validatedParams.receiver,
      revertOptions: validatedParams.revertOptions,
      types: validatedParams.types,
      values: validatedParams.values,
    });
    
    console.log('[evmDepositAndCall] Generated calldata:', {
      data: callData.data,
      value: callData.value.toString(),
      dataLength: callData.data.length
    });

    console.log('[evmDepositAndCall] Broadcasting ERC20 gateway transaction...');
    
    // Retry mechanism for nonce errors
    let tx;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        tx = await broadcastGatewayTx({
          signer: validatedOptions.signer,
          txData: {
            data: callData.data,
            to: gatewayAddress,
            value: callData.value,
          },
          txOptions: validatedOptions.txOptions || {},
        });
        break; // Success, exit retry loop
      } catch (error) {
        if (error instanceof Error && error.message.includes('nonce') && retryCount < maxRetries - 1) {
          retryCount++;
          console.log(`[evmDepositAndCall] Nonce error, retrying (${retryCount}/${maxRetries})...`);
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
        throw error; // Re-throw if not a nonce error or max retries reached
      }
    }
    
    console.log('[evmDepositAndCall] ERC20 transaction hash:', tx.hash);
    return tx;
  } else {
    // Native token deposit and call
    console.log('[evmDepositAndCall] ===== NATIVE TOKEN PATH =====');
    console.log('[evmDepositAndCall] Amount:', validatedParams.amount);
    
    const callData = generateEvmDepositAndCallData({
      amount: validatedParams.amount,
      receiver: isZetProtocolCall ? ZETPROTOCOL_ADDRESS : validatedParams.receiver,
      revertOptions: validatedParams.revertOptions,
      types: validatedParams.types,
      values: validatedParams.values,
    });
    
    console.log('[evmDepositAndCall] Generated calldata for native token:', {
      data: callData.data,
      value: callData.value.toString(),
      dataLength: callData.data.length
    });

    console.log('[evmDepositAndCall] Broadcasting native token gateway transaction...');
    
    // Retry mechanism for nonce errors
    let tx;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        tx = await broadcastGatewayTx({
          signer: validatedOptions.signer,
          txData: {
            data: callData.data,
            to: gatewayAddress,
            value: callData.value,
          },
          txOptions: validatedOptions.txOptions || {},
        });
        break; // Success, exit retry loop
      } catch (error) {
        if (error instanceof Error && error.message.includes('nonce') && retryCount < maxRetries - 1) {
          retryCount++;
          console.log(`[evmDepositAndCall] Nonce error, retrying (${retryCount}/${maxRetries})...`);
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
        throw error; // Re-throw if not a nonce error or max retries reached
      }
    }
    
    console.log('[evmDepositAndCall] Native token transaction hash:', tx.hash);
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
