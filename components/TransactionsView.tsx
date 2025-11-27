"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowUpRight, ArrowDownLeft, CheckCircle, XCircle, Clock, 
  Filter, Search, ExternalLink, TrendingUp, Activity, ArrowLeft
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { useBiometric } from '@/contexts/BiometricContext';
import { backendApi, type Transaction as ApiTransaction } from '@/lib/services/backend-api';
import { toast } from 'sonner';

// Use Transaction type from backend-api
type Transaction = ApiTransaction;

interface TransactionStats {
  totalTransactions: number;
  totalVolume: string;
  successRate: number;
  averageGasUsed: string;
}

interface TransactionsViewProps {
  onBack: () => void;
}

export default function TransactionsView({ onBack }: TransactionsViewProps) {
  const { wallet } = useWallet();
  const { network } = useNetwork();
  const { getBiometricPublicKey } = useBiometric();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (wallet?.address) {
      loadTransactions();
      loadStats();
    }
  }, [wallet?.address]);

  // Listen for browser back button
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      onBack();
    };

    window.addEventListener('popstate', handlePopState);
    // Push a state to handle back button
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onBack]);

  const loadTransactions = async () => {
    if (!wallet?.address) return;
    
    setLoading(true);
    try {
      const biometricPublicKey = await getBiometricPublicKey();
      if (!biometricPublicKey) {
        throw new Error('Biometric authentication required');
      }

      const txList = await backendApi.getUserTransactions(wallet.address, biometricPublicKey);
      setTransactions(txList);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Failed to load transactions');
      setTransactions([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!wallet?.address) return;
    
    try {
      const biometricPublicKey = await getBiometricPublicKey();
      if (!biometricPublicKey) return;

      const txList = await backendApi.getUserTransactions(wallet.address, biometricPublicKey);
      
      // Calculate stats from transactions
      const totalTransactions = txList.length;
      const completedTxs = txList.filter(tx => tx.status === 'completed');
      const successRate = totalTransactions > 0 
        ? (completedTxs.length / totalTransactions) * 100 
        : 0;
      
      // Calculate total volume (sum of amounts)
      const totalVolume = txList.reduce((sum, tx) => {
        const amount = parseFloat(tx.amount || '0');
        return sum + amount;
      }, 0);

      setStats({
        totalTransactions,
        totalVolume: totalVolume.toFixed(2),
        successRate: Math.round(successRate),
        averageGasUsed: '0.00' // TODO: Calculate from actual gas data if available
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      // Set default stats on error
      setStats({
        totalTransactions: 0,
        totalVolume: '0.00',
        successRate: 0,
        averageGasUsed: '0.00'
      });
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      tx.transactionHash?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.recipientAddress?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.token.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || tx.type === filterType;
    const matchesStatus = filterStatus === 'all' || tx.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-600" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      completed: { label: 'Completed', className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
      failed: { label: 'Failed', className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
      cancelled: { label: 'Cancelled', className: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300' },
      pending: { label: 'Pending', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
    };
    const variant = variants[status] || variants.pending;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj);
  };

  const truncateHash = (hash: string) => {
    if (!hash) return '';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  return (
    <div className="pb-20 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center space-x-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Transactions</h2>
          <p className="text-sm text-muted-foreground">View your transaction history</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="w-4 h-4 text-purple-600" />
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <p className="text-2xl font-bold gradient-text">{stats.totalTransactions}</p>
              <p className="text-xs text-muted-foreground mt-1">Transactions</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-500/10 to-green-500/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
              <p className="text-2xl font-bold gradient-text">{stats.successRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">Completion</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by hash, address, or token..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="blockchain">Blockchain</SelectItem>
                <SelectItem value="ramp">Ramp</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTransactions.length > 0 ? (
        <div className="space-y-3">
          {filteredTransactions.map((tx) => (
            <Card 
              key={tx._id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                if (tx.transactionHash) {
                  const explorerUrl = network === 'mainnet' 
                    ? `https://basescan.org/tx/${tx.transactionHash}`
                    : `https://sepolia.basescan.org/tx/${tx.transactionHash}`;
                  window.open(explorerUrl, '_blank');
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      tx.recipientAddress?.toLowerCase() === wallet?.address.toLowerCase()
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      {tx.recipientAddress?.toLowerCase() === wallet?.address.toLowerCase() ? (
                        <ArrowDownLeft className="w-5 h-5 text-green-600" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">
                        {tx.recipientAddress?.toLowerCase() === wallet?.address.toLowerCase() ? 'Received' : 'Sent'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                  {getStatusIcon(tx.status)}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="font-semibold">{tx.amount} {tx.token}</span>
                  </div>

                  {tx.transactionHash && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Hash</span>
                      <div className="flex items-center space-x-1">
                        <code className="text-xs font-mono">{truncateHash(tx.transactionHash)}</code>
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    {getStatusBadge(tx.status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No Transactions Yet</h3>
            <p className="text-sm text-muted-foreground">
              Your transaction history will appear here once you start using the wallet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
