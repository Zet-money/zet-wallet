/**
 * Admin API Service
 * Handles admin authentication and dashboard data
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:2002/api/v1';

export interface Admin {
  email: string;
  name: string;
  lastLoginAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminAuthResponse {
  success: boolean;
  token?: string;
  admin?: Admin;
  message?: string;
}

export interface UserStats {
  totalUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
}

export interface VisitorStats {
  totalVisitors: number;
  uniqueVisitorsToday: number;
  uniqueVisitorsThisWeek: number;
  uniqueVisitorsThisMonth: number;
  totalVisits: number;
  averageVisitsPerVisitor: number;
}

export interface TransactionStats {
  totalTransactions: number;
  totalVolume: string;
  successRate: number;
  averageGasUsed: string;
  blockchainTransactions: number;
  rampTransactions: number;
}

export interface DashboardStats {
  users: UserStats;
  visitors: VisitorStats;
  transactions: TransactionStats;
  timestamp: string;
}

class AdminApiService {
  private token: string | null = null;

  /**
   * Set admin token
   */
  setToken(token: string): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_token', token);
    }
  }

  /**
   * Get admin token
   */
  getToken(): string | null {
    if (this.token) {
      return this.token;
    }

    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('admin_token');
    }

    return this.token;
  }

  /**
   * Clear admin token
   */
  clearToken(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
    }
  }

  /**
   * Check if admin is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Admin authentication endpoints
  async sendOtp(email: string): Promise<{ success: boolean; message?: string }> {
    return this.makeRequest('/admin/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyOtp(email: string, otp: string): Promise<AdminAuthResponse> {
    const response = await this.makeRequest<AdminAuthResponse>('/admin/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });

    if (response.success && response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async getProfile(): Promise<Admin> {
    return this.makeRequest<Admin>('/admin/profile');
  }

  // Dashboard endpoints
  async getDashboardStats(): Promise<DashboardStats> {
    return this.makeRequest<DashboardStats>('/admin/dashboard');
  }

  async getUserStats(): Promise<UserStats> {
    return this.makeRequest<UserStats>('/admin/users/stats');
  }

  async getVisitorStats(): Promise<VisitorStats> {
    return this.makeRequest<VisitorStats>('/visitors/stats');
  }

  async getTransactionStats(): Promise<TransactionStats> {
    return this.makeRequest<TransactionStats>('/transactions/stats');
  }

  // Admin management endpoints
  async getAllAdmins(): Promise<Admin[]> {
    return this.makeRequest<Admin[]>('/admin/admins');
  }

  // Logout
  logout(): void {
    this.clearToken();
  }
}

export const adminApi = new AdminApiService();
