"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { X, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Bank {
  name: string;
  code: string;
  type: string;
}

interface SellCryptoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type OrderStatus = 'payment_order.pending' | 'payment_order.validated' | 'payment_order.expired' | 'payment_order.settled' | 'payment_order.refunded';

type ModalStep = 'rate' | 'form' | 'monitoring';

export default function SellCryptoModal({ isOpen, onClose }: SellCryptoModalProps) {
  const [step, setStep] = useState<ModalStep>('rate');
  const [rate, setRate] = useState<string>('0.00');
  const [rateLoading, setRateLoading] = useState(false);
  const [lastRateUpdate, setLastRateUpdate] = useState<Date | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  
  // Form state
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('USDC');
  const [selectedBank, setSelectedBank] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  
  // Order monitoring state
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('payment_order.pending');
  const [orderId, setOrderId] = useState('');
  const [orderStartTime, setOrderStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const rateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch exchange rate
  const fetchRate = async () => {
    setRateLoading(true);
    try {
      const response = await fetch('https://api.paycrest.io/v1/rates/USDC/100/NGN?network=base', {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.status === 'success') {
        setRate(data.data);
        setLastRateUpdate(new Date());
      }
    } catch (error) {
      console.error('Error fetching rate:', error);
      toast.error('Failed to fetch exchange rate');
    } finally {
      setRateLoading(false);
    }
  };

  // Fetch banks list
  const fetchBanks = async () => {
    setBanksLoading(true);
    try {
      const response = await fetch('https://api.paycrest.io/v1/institutions/NGN', {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.status === 'success') {
        setBanks(data.data);
      }
    } catch (error) {
      console.error('Error fetching banks:', error);
      toast.error('Failed to fetch banks list');
    } finally {
      setBanksLoading(false);
    }
  };

  // Start rate refresh interval
  useEffect(() => {
    if (isOpen && step === 'rate') {
      fetchRate();
      rateIntervalRef.current = setInterval(fetchRate, 60000); // 60 seconds
    }
    
    return () => {
      if (rateIntervalRef.current) {
        clearInterval(rateIntervalRef.current);
      }
    };
  }, [isOpen, step]);

  // Start timer for order monitoring
  useEffect(() => {
    if (step === 'monitoring' && orderStartTime) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - orderStartTime.getTime()) / 1000));
      }, 1000);
    }
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [step, orderStartTime]);

  // Simulate order status polling
  useEffect(() => {
    if (step === 'monitoring' && orderStatus === 'payment_order.pending') {
      const pollInterval = setInterval(() => {
        // Simulate status change after 30 seconds
        if (elapsedTime > 30) {
          setOrderStatus('payment_order.validated');
          clearInterval(pollInterval);
        }
      }, 5000);
      
      return () => clearInterval(pollInterval);
    }
  }, [step, orderStatus, elapsedTime]);

  const handleProceed = () => {
    fetchBanks();
    setStep('form');
  };

  const handleCreateOrder = async () => {
    if (!amount || !token || !selectedBank || !accountName || !accountNumber) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      // Simulate API call to create sell order
      const orderId = `order_${Date.now()}`;
      setOrderId(orderId);
      setOrderStartTime(new Date());
      setElapsedTime(0);
      setStep('monitoring');
      
      toast.success('Sell order created successfully!');
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create sell order');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'payment_order.validated':
      case 'payment_order.settled':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'payment_order.expired':
      case 'payment_order.refunded':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'payment_order.validated':
      case 'payment_order.settled':
        return 'bg-green-500';
      case 'payment_order.expired':
      case 'payment_order.refunded':
        return 'bg-red-500';
      default:
        return 'bg-yellow-500';
    }
  };

  const getProgressValue = () => {
    switch (orderStatus) {
      case 'payment_order.validated':
      case 'payment_order.settled':
        return 100;
      case 'payment_order.expired':
      case 'payment_order.refunded':
        return 0;
      default:
        return Math.min((elapsedTime / 30) * 100, 90); // Simulate progress
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Sell Crypto</CardTitle>
            <CardDescription>
              {step === 'rate' && 'Convert your crypto to Naira'}
              {step === 'form' && 'Enter your details'}
              {step === 'monitoring' && 'Order Status'}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 'rate' && (
            <>
              <div className="text-center space-y-4">
                <h3 className="text-lg font-semibold">Sell Your Crypto</h3>
                <p className="text-sm text-muted-foreground">
                  Convert your cNGN or USDC to Naira and get paid directly to your bank account
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Current Rate</span>
                  <div className="flex items-center gap-2">
                    {rateLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span className="text-lg font-bold">₦{rate}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Rate updates every 60 seconds
                  {lastRateUpdate && (
                    <span className="block">
                      Last updated: {lastRateUpdate.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Supported Tokens</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded">
                    <img 
                      src="https://assets.parqet.com/logos/crypto/USDC?format=png" 
                      alt="USDC" 
                      className="w-6 h-6"
                    />
                    <span className="text-sm font-medium">USDC</span>
                  </div>
                  <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded">
                    <img 
                      src="/cngn.svg" 
                      alt="cNGN" 
                      className="w-6 h-6"
                    />
                    <span className="text-sm font-medium">cNGN</span>
                  </div>
                </div>
              </div>

              <Button onClick={handleProceed} className="w-full">
                Proceed to Sell
              </Button>
            </>
          )}

          {step === 'form' && (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount to Sell</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="token">Token</Label>
                  <Select value={token} onValueChange={setToken}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USDC">
                        <div className="flex items-center space-x-2">
                          <img 
                            src="https://assets.parqet.com/logos/crypto/USDC?format=png" 
                            alt="USDC" 
                            className="w-4 h-4"
                          />
                          <span>USDC</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="cNGN">
                        <div className="flex items-center space-x-2">
                          <img 
                            src="/cngn.svg" 
                            alt="cNGN" 
                            className="w-4 h-4"
                          />
                          <span>cNGN</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank">Bank</Label>
                  <Select value={selectedBank} onValueChange={setSelectedBank} disabled={banksLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={banksLoading ? "Loading banks..." : "Select bank"} />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank) => (
                        <SelectItem key={bank.code} value={bank.code}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input
                    id="accountName"
                    placeholder="Enter account name"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    placeholder="Enter account number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setStep('rate')} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleCreateOrder} className="flex-1">
                  Create Sell Order
                </Button>
              </div>
            </>
          )}

          {step === 'monitoring' && (
            <>
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center space-x-2">
                  {getStatusIcon(orderStatus)}
                  <h3 className="text-lg font-semibold">Order #{orderId}</h3>
                </div>
                
                <div className="space-y-2">
                  <Badge variant="outline" className="text-sm">
                    {orderStatus.replace('payment_order.', '').toUpperCase()}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    Elapsed time: {formatTime(elapsedTime)}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{Math.round(getProgressValue())}%</span>
                  </div>
                  <Progress value={getProgressValue()} className="w-full" />
                </div>

                <div className="bg-muted p-4 rounded-lg text-left space-y-2">
                  <h4 className="font-medium">Order Details</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Amount:</span>
                      <span>{amount} {token}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bank:</span>
                      <span>{banks.find(b => b.code === selectedBank)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Account:</span>
                      <span>{accountNumber}</span>
                    </div>
                  </div>
                </div>

                {orderStatus === 'payment_order.validated' && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-800 dark:text-green-200">
                        Order completed! Funds have been sent to your bank account.
                      </span>
                    </div>
                  </div>
                )}

                {orderStatus === 'payment_order.expired' && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="text-sm text-red-800 dark:text-red-200">
                        Order expired. Please try again.
                      </span>
                    </div>
                  </div>
                )}

                <Button onClick={onClose} className="w-full">
                  Close
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
