"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/services/admin-api';

interface AdminLoginProps {
  onSuccess: (token: string) => void;
}

export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await adminApi.sendOtp(email);
      setStep('otp');
      toast.success('OTP sent to your email');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send OTP';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      setError('Please enter the OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await adminApi.verifyOtp(email, otp);
      
      if (response.success && response.token) {
        toast.success('Login successful');
        onSuccess(response.token);
      } else {
        setError('Invalid OTP');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify OTP';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setOtp('');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="w-12 h-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>
            {step === 'email' 
              ? 'Enter your admin email to receive an OTP'
              : 'Enter the OTP sent to your email'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'email' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                />
              </div>
              <Button 
                onClick={handleSendOtp} 
                disabled={loading}
                className="w-full"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send OTP
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="otp">One-Time Password</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                  maxLength={6}
                />
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={handleBackToEmail}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleVerifyOtp} 
                  disabled={loading}
                  className="flex-1"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Verify OTP
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
