import { ethers, AbiCoder, ZeroAddress } from "ethers";
import { z } from "zod";
import { BASE_GATEWAY_ABI } from "./base-gateway.abi";

export const ZETPROTOCOL_ADDRESS = '0x7689b1a47fb4c5F16aBA476E4D315b8421CAebD2'

// Revert options type matching the official implementation
interface RevertOptions {
  abortAddress?: string;
  revertMessage?: string;
}

// Helper function to convert string to hex
const toHexString = (str: string): string => {
  return '0x' + Buffer.from(str, 'utf8').toString('hex');
};

// Creates a revert data object from revert options
export const createRevertData = (revertOptions: RevertOptions): RevertOptions => {
  return {
    ...revertOptions,
    abortAddress: revertOptions.abortAddress || ZeroAddress,
    revertMessage: revertOptions.revertMessage ? toHexString(revertOptions.revertMessage) : '0x',
  };
};

// Available gateway method names
type GatewayMethodName =
  | "call"
  | "depositNative"
  | "depositAndCallNative"
  | "depositErc20"
  | "depositAndCallErc20";

// Interface for gateway contract using the imported ABI
const gatewayInterface = new ethers.Interface(BASE_GATEWAY_ABI);

/**
 * Retrieves function fragments from the gateway interface by method name.
 */
export const getGatewayFunctionsByName = (
  methodName: string
): ethers.FunctionFragment[] => {
  const gatewayInterfaceFragments =
    gatewayInterface.fragments as ethers.FunctionFragment[];

  const matchingFunctions = gatewayInterfaceFragments.filter(
    (fragment) => fragment.type === "function" && fragment.name === methodName
  );

  return matchingFunctions;
};

/**
 * Retrieves function signatures from the gateway interface
 */
export const getGatewayFunctionSignatureByName = (
  methodName: GatewayMethodName
): ethers.FunctionFragment | undefined => {
  // Get functions by type
  const callFunctions = getGatewayFunctionsByName("call");
  const depositFunctions = getGatewayFunctionsByName("deposit");
  const depositAndCallFunctions = getGatewayFunctionsByName("depositAndCall");

  // Map of function signatures
  const signatures = {
    call: callFunctions[0],

    depositAndCallErc20: depositAndCallFunctions.find((f) =>
      f.inputs.some((i) => i.name === "asset")
    ),

    depositAndCallNative: depositAndCallFunctions.find((f) =>
      f.inputs.every((i) => i.name !== "asset")
    ),

    depositErc20: depositFunctions.find((f) =>
      f.inputs.some((i) => i.name === "asset")
    ),
    depositNative: depositFunctions.find((f) =>
      f.inputs.every((i) => i.name !== "asset")
    ),
  };

  return signatures[methodName];
};

/**
 * Generates calldata for a specific gateway method
 */
export const generateGatewayCallData = (
  methodName: GatewayMethodName,
  args: unknown[]
): string => {
  try {
    const signature = getGatewayFunctionSignatureByName(methodName);

    if (!signature) {
      throw new Error(`Invalid method name: ${methodName}`);
    }

    const encodedData = gatewayInterface.encodeFunctionData(signature, args);

    return encodedData;
  } catch (error) {
    console.error(`Error encoding calldata for ${methodName}:`, error);
    throw error;
  }
};

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

// Remove duplicate RevertOptions interface - using the official one above

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
 * Generates calldata for EVM deposit and call without broadcasting the transaction
 * Following the official ZetaChain pattern
 */
export const generateEvmDepositAndCallData = (args: {
  amount: string;
  decimals?: number;
  erc20?: string;
  receiver: string;
  revertOptions: RevertOptions;
  types: string[];
  values: any[];
}): {
  data: string;
  value?: string;
} => {
  console.log('[generateEvmDepositAndCallData] ===== GENERATING CALLDATA =====');
  console.log('[generateEvmDepositAndCallData] Input args:', JSON.stringify(args, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value, 2));
  
  // Encode the ZetProtocol function call parameters
  const abiCoder = AbiCoder.defaultAbiCoder();
  const encodedParameters = abiCoder.encode(args.types, args.values);
  console.log('[generateEvmDepositAndCallData] Encoded parameters:', encodedParameters);
  
  // Create revert data
  const revertData = createRevertData(args.revertOptions);
  console.log('[generateEvmDepositAndCallData] Revert data:', revertData);
  
  const decimals = args.decimals || 18; // Default to 18 if not specified

  if (args.erc20) {
    const value = ethers.parseUnits(args.amount, decimals);
    console.log('[generateEvmDepositAndCallData] ERC20 amount:', value.toString());

    const data = generateGatewayCallData("depositAndCallErc20", [
      args.receiver,
      value,
      args.erc20,
      encodedParameters,
      revertData,
    ]);
    
    return {
      data,
      value: value.toString(),
    };
  } else {
    const value = ethers.parseEther(args.amount);
    console.log('[generateEvmDepositAndCallData] Native amount:', value.toString());

    const data = generateGatewayCallData("depositAndCallNative", [
      args.receiver,
      encodedParameters,
      revertData,
    ]);
    
    return {
      data,
      value: value.toString(),
    };
  }
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
    nonce?: number;
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
    // Use explicit nonce if provided, otherwise get current nonce
    const nonce = params.txOptions?.nonce ?? await params.signer.getNonce();
    console.log('[broadcastGatewayTx] Using nonce:', nonce, params.txOptions?.nonce ? '(explicit)' : '(fetched)');
    
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
  return evmDepositAndCallWithRetry(params, options);
};

/**
 * Internal implementation of evmDepositAndCall with automatic retry logic.
 * This function automatically retries the entire operation if approval or nonce errors occur.
 */
const evmDepositAndCallWithRetry = async (
  params: EvmDepositAndCallParams,
  options: EvmOptions,
  attemptNumber: number = 1,
  maxAttempts: number = 3
): Promise<ethers.TransactionResponse> => {
  try {
    return await evmDepositAndCallInternal(params, options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    const isRetryableError = 
      errorMessage.includes('nonce') || 
      errorMessage.includes('allowance') || 
      errorMessage.includes('approval') ||
      errorMessage.includes('transfer amount exceeds');
    
    if (isRetryableError && attemptNumber < maxAttempts) {
      console.log(`[evmDepositAndCall] Retryable error detected on attempt ${attemptNumber}/${maxAttempts}`);
      console.log(`[evmDepositAndCall] Error: ${errorMessage}`);
      console.log(`[evmDepositAndCall] Waiting ${attemptNumber * 2} seconds before retrying...`);
      
      // Wait progressively longer between retries
      await new Promise(resolve => setTimeout(resolve, attemptNumber * 2000));
      
      console.log(`[evmDepositAndCall] Retrying entire operation (attempt ${attemptNumber + 1}/${maxAttempts})...`);
      return evmDepositAndCallWithRetry(params, options, attemptNumber + 1, maxAttempts);
    }
    
    // If not retryable or max attempts reached, throw the error
    if (attemptNumber >= maxAttempts) {
      console.error(`[evmDepositAndCall] Max retry attempts (${maxAttempts}) reached. Operation failed.`);
    }
    throw error;
  }
};

/**
 * Internal implementation of the deposit and call logic.
 */
const evmDepositAndCallInternal = async (
  params: EvmDepositAndCallParams,
  options: EvmOptions
): Promise<ethers.TransactionResponse> => {
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

  // For ZetProtocol calls, ALWAYS use ZetProtocol contract as receiver
  // The user's recipient address goes in the payload data (types/values)
  console.log('[evmDepositAndCall] ===== ZETPROTOCOL CALL =====');
  console.log('[evmDepositAndCall] Using ZetProtocol contract as receiver:', ZETPROTOCOL_ADDRESS);
  console.log('[evmDepositAndCall] User recipient will be in payload data');
  console.log('[evmDepositAndCall] Types:', validatedParams.types);
  console.log('[evmDepositAndCall] Values:', validatedParams.values);

  // Validate that types and values are provided for ZetProtocol calls
  if (!validatedParams.types || !validatedParams.values) {
    throw new Error('Types and values are required for ZetProtocol calls');
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
    const signerAddress = await validatedOptions.signer.getAddress();
    
    console.log('[evmDepositAndCall] Token decimals:', decimals);
    console.log('[evmDepositAndCall] Parsed amount:', value.toString());
    console.log('[evmDepositAndCall] Gateway address for approval:', gatewayAddress);
    console.log('[evmDepositAndCall] Signer address:', signerAddress);

    // Step 1: Check if approval already exists
    console.log('[evmDepositAndCall] Checking existing allowance...');
    let currentAllowance = await erc20Contract.allowance(signerAddress, gatewayAddress);
    console.log('[evmDepositAndCall] Current allowance:', currentAllowance.toString());
    
    if (currentAllowance < value) {
      console.log('[evmDepositAndCall] Insufficient allowance, need to approve');
      
      // Step 2: Make approval and verify with retries
      let approvalVerified = false;
      let approvalAttempts = 0;
      const maxApprovalAttempts = 2;
      
      while (!approvalVerified && approvalAttempts < maxApprovalAttempts) {
        approvalAttempts++;
        console.log(`[evmDepositAndCall] Approval attempt ${approvalAttempts}/${maxApprovalAttempts}`);
        
        // Get fresh nonce for each approval attempt to avoid "nonce already used" errors
        const approvalNonce = await validatedOptions.signer.getNonce();
        console.log('[evmDepositAndCall] Using nonce for approval:', approvalNonce);
        
        // Create a new contract instance with explicit nonce in the signer
        // This ensures each retry uses a fresh nonce
        const wallet = validatedOptions.signer as ethers.Wallet;
        const provider = wallet.provider;
        
        // Send approval transaction - ethers will automatically use the current nonce
        const approval = await erc20Contract.approve(gatewayAddress, value);
        console.log('[evmDepositAndCall] Approval transaction hash:', approval.hash);
        
        // Wait for approval to be mined
        await approval.wait();
        console.log('[evmDepositAndCall] Approval transaction confirmed');
        
        // Timeout for 2 seconds for blockchain state to propagate
        console.log('[evmDepositAndCall] Waiting 2 seconds for approval to propagate...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if approval exists
        currentAllowance = await erc20Contract.allowance(signerAddress, gatewayAddress);
        console.log('[evmDepositAndCall] Allowance after approval:', currentAllowance.toString(), 'Required:', value.toString());
        
        if (currentAllowance >= value) {
          approvalVerified = true;
          console.log('[evmDepositAndCall] ✓ Approval verified successfully');
        } else {
          console.log('[evmDepositAndCall] ✗ Approval not yet reflected, will retry with fresh nonce...');
        }
      }
      
      if (!approvalVerified) {
        throw new Error(`Failed to verify token approval after ${maxApprovalAttempts} attempts. Last allowance: ${currentAllowance.toString()}, Required: ${value.toString()}`);
      }
      
      // Additional wait after verification to ensure approval is fully propagated
      console.log('[evmDepositAndCall] Approval verified, waiting additional 1 second for safety...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('[evmDepositAndCall] Sufficient allowance already exists, skipping approval');
    }

    // Generate calldata for deposit and call
    console.log('[evmDepositAndCall] Generating calldata for ERC20 deposit...');
    const callData = generateEvmDepositAndCallData({
      amount: validatedParams.amount,
      decimals: decimals,
      erc20: validatedParams.token,
      receiver: ZETPROTOCOL_ADDRESS, // Always use ZetProtocol contract as receiver
      revertOptions: validatedParams.revertOptions || createDefaultRevertOptions(),
      types: validatedParams.types,
      values: validatedParams.values,
    });
    
    console.log('[evmDepositAndCall] Generated calldata:', {
      data: callData.data,
      value: callData.value?.toString() || '0',
      dataLength: callData.data.length
    });

    // Step 3: FINAL verification before making the deposit transaction
    console.log('[evmDepositAndCall] Final allowance check before deposit...');
    const finalAllowance = await erc20Contract.allowance(signerAddress, gatewayAddress);
    console.log('[evmDepositAndCall] Final allowance:', finalAllowance.toString(), 'Required:', value.toString());
    
    if (finalAllowance < value) {
      throw new Error(`Insufficient allowance confirmed. Have: ${finalAllowance.toString()}, Need: ${value.toString()}. Cannot proceed with deposit.`);
    }
    
    console.log('[evmDepositAndCall] ✓ Allowance confirmed, proceeding with deposit transaction...');
    console.log('[evmDepositAndCall] Broadcasting ERC20 gateway transaction...');
    
    // Fetch fresh nonce to ensure no conflicts with approval transaction
    const currentNonce = await validatedOptions.signer.getNonce();
    console.log('[evmDepositAndCall] Fresh nonce for deposit transaction:', currentNonce);
    
    // Retry mechanism for nonce errors (should be rare now)
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
            value: callData.value ? BigInt(callData.value) : BigInt(0),
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
    
    if (!tx) {
      throw new Error('Failed to submit transaction after all retries');
    }
    
    console.log('[evmDepositAndCall] ERC20 transaction hash:', tx.hash);
    return tx;
  } else {
    // Native token deposit and call
    console.log('[evmDepositAndCall] ===== NATIVE TOKEN PATH =====');
    console.log('[evmDepositAndCall] Amount:', validatedParams.amount);
    
    const callData = generateEvmDepositAndCallData({
      amount: validatedParams.amount,
      receiver: ZETPROTOCOL_ADDRESS, // Always use ZetProtocol contract as receiver
      revertOptions: validatedParams.revertOptions || createDefaultRevertOptions(),
      types: validatedParams.types,
      values: validatedParams.values,
    });
    
    console.log('[evmDepositAndCall] Generated calldata for native token:', {
      data: callData.data,
      value: callData.value?.toString() || '0',
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
            value: callData.value ? BigInt(callData.value) : BigInt(0),
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
    
    if (!tx) {
      throw new Error('Failed to submit transaction after all retries');
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
    abortAddress: ZeroAddress,
    revertMessage: "0x"
  };
};

/**
 * Helper function to create custom revert options
 */
export const createRevertOptions = (
  abortAddress: string = ZeroAddress,
  revertMessage: string = "0x"
): RevertOptions => {
  return {
    abortAddress,
    revertMessage
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

export type { EvmDepositAndCallParams, EvmOptions };
