/**
 * Backend API Service
 * Handles all communication with the Zet Wallet backend
 */

const API_BASE_URL = 'https://api.zet.money/api/v1';

export interface User {
  walletAddress: string;
  biometricPublicKey: string;
  name?: string;
  email?: string;
  username?: string;
  sessionTimeout?: number;
  isActive: boolean;
  lastLoginAt?: Date;
  lastActive?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  walletAddress: string;
  biometricPublicKey: string;
  name?: string;
  email?: string;
  username?: string;
  sessionTimeout?: number;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  username?: string;
  sessionTimeout?: number;
}

export interface PaycrestOrder {
  orderId: string;
  amount: string;
  token: string;
  network: string;
  rate: string;
  receiveAddress: string;
  senderFee: string;
  transactionFee: string;
  validUntil: Date;
  status: string;
  recipient: {
    bank: string;
    accountName: string;
    accountNumber: string;
  };
  reference: string;
  returnAddress: string;
  walletAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderRequest {
  amount: string;
  token: string;
  network: string;
  rate: string;
  recipient: {
    bank: string;
    accountName: string;
    accountNumber: string;
  };
  reference: string;
  returnAddress: string;
  walletAddress: string;
  biometricPublicKey: string;
}

export interface Transaction {
  _id: string;
  walletAddress: string;
  type: 'blockchain' | 'ramp';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount: string;
  token: string;
  network: string;
  transactionHash?: string;
  orderId?: string;
  recipientAddress?: string;
  senderAddress?: string;
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
  confirmations?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBlockchainTransactionRequest {
  walletAddress: string;
  biometricPublicKey: string;
  amount: string;
  tokenSymbol: string;
  receiver: string;
  rpcUrl: string;
  targetChain?: string;
  network: 'mainnet' | 'testnet';
  targetTokenAddress?: string;
  targetTokenSymbol?: string;
  isSameChain?: boolean;
  transactionHash?: string;
}

export interface Visitor {
  visitorId: string;
  ipAddress: string;
  userAgent: string;
  country?: string;
  city?: string;
  referrer?: string;
  visitCount: number;
  lastVisitAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVisitorRequest {
  visitorId: string;
  ipAddress: string;
  userAgent: string;
  country?: string;
  city?: string;
  referrer?: string;
}

export interface UpdateTransactionRequest {
  status?: 'pending' | 'completed' | 'failed';
  transactionHash?: string;
  errorMessage?: string;
  walletAddress: string;
  biometricPublicKey: string;
}

class BackendApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      (error as any).status = response.status;
      throw error;
    }

    // Handle empty responses (e.g., void endpoints)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text);
  }

  // User endpoints
  async createUser(data: CreateUserRequest): Promise<User> {
    return this.makeRequest<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserProfile(walletAddress: string, biometricPublicKey: string): Promise<User> {
    const params = new URLSearchParams({
      walletAddress,
      biometricPublicKey,
    });
    return this.makeRequest<User>(`/users/me?${params}`, {
      method: 'GET',
    });
  }

  async updateUserProfile(
    walletAddress: string,
    biometricPublicKey: string,
    data: UpdateUserRequest
  ): Promise<User> {
    return this.makeRequest<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ walletAddress, biometricPublicKey, ...data }),
    });
  }

  async updateLastActive(walletAddress: string, biometricPublicKey: string): Promise<void> {
    const params = new URLSearchParams({
      walletAddress,
      biometricPublicKey,
    });
    return this.makeRequest<void>(`/users/me/active?${params}`, {
      method: 'POST',
    });
  }

  async deleteUser(walletAddress: string, biometricPublicKey: string): Promise<void> {
    return this.makeRequest<void>(`/users/${walletAddress}`, {
      method: 'DELETE',
      body: JSON.stringify({ walletAddress, biometricPublicKey }),
    });
  }

  // Paycrest endpoints
  async createOrder(data: CreateOrderRequest): Promise<PaycrestOrder> {
    return this.makeRequest<PaycrestOrder>('/paycrest/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOrderStatus(orderId: string, walletAddress: string, biometricPublicKey: string): Promise<PaycrestOrder> {
    const params = new URLSearchParams({
      walletAddress,
      biometricPublicKey,
    });
    return this.makeRequest<PaycrestOrder>(`/paycrest/orders/${orderId}?${params}`);
  }

  async getUserOrders(walletAddress: string, biometricPublicKey: string): Promise<PaycrestOrder[]> {
    return this.makeRequest<PaycrestOrder[]>(`/paycrest/orders/user/${walletAddress}`, {
      method: 'GET',
      body: JSON.stringify({ walletAddress, biometricPublicKey }),
    });
  }

  // Transaction endpoints
  async createBlockchainTransaction(data: CreateBlockchainTransactionRequest): Promise<Transaction> {
    return this.makeRequest<Transaction>('/transactions/blockchain', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserTransactions(walletAddress: string, biometricPublicKey: string): Promise<Transaction[]> {
    return this.makeRequest<Transaction[]>(`/transactions/user/${walletAddress}`, {
      method: 'GET',
      body: JSON.stringify({ walletAddress, biometricPublicKey }),
    });
  }

  async getTransactionStats(walletAddress: string, biometricPublicKey: string): Promise<{
    totalTransactions: number;
    totalVolume: string;
    successRate: number;
    averageGasUsed: string;
  }> {
    return this.makeRequest(`/transactions/user/${walletAddress}/stats`, {
      method: 'GET',
      body: JSON.stringify({ walletAddress, biometricPublicKey }),
    });
  }

  async getTransactionById(transactionId: string, walletAddress: string, biometricPublicKey: string): Promise<Transaction> {
    const params = new URLSearchParams({
      walletAddress,
      biometricPublicKey,
    });
    return this.makeRequest<Transaction>(`/transactions/${transactionId}?${params}`);
  }

  async getTransactionByHash(transactionHash: string, walletAddress: string, biometricPublicKey: string): Promise<Transaction> {
    const params = new URLSearchParams({
      walletAddress,
      biometricPublicKey,
    });
    return this.makeRequest<Transaction>(`/transactions/hash/${transactionHash}?${params}`);
  }

  async updateTransaction(transactionId: string, data: UpdateTransactionRequest): Promise<Transaction> {
    return this.makeRequest<Transaction>(`/transactions/${transactionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Notification endpoints
  async subscribeToNotifications(walletAddress: string, biometricPublicKey: string, fcmToken: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify({ 
        fcmToken,
        walletAddress,
        biometricPublicKey
      }),
    });
  }

  async unsubscribeFromNotifications(walletAddress: string, biometricPublicKey: string, fcmToken?: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>('/notifications/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ 
        fcmToken,
        walletAddress,
        biometricPublicKey
      }),
    });
  }

  // Visitor endpoints
  async createVisitor(data: CreateVisitorRequest): Promise<Visitor> {
    return this.makeRequest<Visitor>('/visitors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async trackVisitor(data: CreateVisitorRequest): Promise<Visitor> {
    return this.makeRequest<Visitor>('/visitors/track', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async incrementVisitorVisit(visitorId: string): Promise<Visitor> {
    return this.makeRequest<Visitor>(`/visitors/${visitorId}/visit`, {
      method: 'POST',
    });
  }
}

export const backendApi = new BackendApiService();
