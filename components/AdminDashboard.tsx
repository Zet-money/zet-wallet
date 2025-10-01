"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Eye, 
  TrendingUp, 
  Activity, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type DashboardStats, type Admin } from '@/lib/services/admin-api';

interface AdminDashboardProps {
  onLogout: () => void;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    try {
      const [dashboardStats, adminProfile] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getProfile()
      ]);
      
      setStats(dashboardStats);
      setAdmin(adminProfile);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDashboard();
      toast.success('Dashboard refreshed');
    } catch (error) {
      toast.error('Failed to refresh dashboard');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    adminApi.logout();
    onLogout();
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats || !admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load dashboard data</p>
          <Button onClick={handleRefresh}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Welcome back, {admin.name}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Users Stats */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.users.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                +{stats.users.newUsersToday} today
              </p>
            </CardContent>
          </Card>

          {/* Visitors Stats */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Visitors</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.visitors.totalVisitors}</div>
              <p className="text-xs text-muted-foreground">
                {stats.visitors.uniqueVisitorsToday} today
              </p>
            </CardContent>
          </Card>

          {/* Transactions Stats */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.transactions.totalTransactions}</div>
              <p className="text-xs text-muted-foreground">
                {stats.transactions.successRate.toFixed(1)}% success rate
              </p>
            </CardContent>
          </Card>

          {/* Volume Stats */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${parseFloat(stats.transactions.totalVolume).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Growth */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                User Growth
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">This Week</span>
                <Badge variant="secondary">+{stats.users.newUsersThisWeek}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">This Month</span>
                <Badge variant="secondary">+{stats.users.newUsersThisMonth}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Visitor Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Eye className="w-5 h-5 mr-2" />
                Visitor Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Visits</span>
                <span className="font-medium">{stats.visitors.totalVisits}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg. Visits/Visitor</span>
                <span className="font-medium">{stats.visitors.averageVisitsPerVisitor.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">This Week</span>
                <Badge variant="secondary">{stats.visitors.uniqueVisitorsThisWeek}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Transaction Types
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Blockchain</span>
                <Badge variant="outline">{stats.transactions.blockchainTransactions}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Ramp (Buy/Sell)</span>
                <Badge variant="outline">{stats.transactions.rampTransactions}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <div className="flex items-center">
                  {stats.transactions.successRate >= 90 ? (
                    <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 mr-1" />
                  )}
                  <span className="font-medium">{stats.transactions.successRate.toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Last Updated */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(stats.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
