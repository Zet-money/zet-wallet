"use client";

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, Calendar, ArrowRightLeft, Users, CheckCircle2, ExternalLink, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useUserSettings } from '@/contexts/UserSettingsContext';

export default function RewardsView() {
  const { profile } = useUserSettings();
  const [checkingIn, setCheckingIn] = useState(false);

  // Placeholder data - will be replaced with real API data
  const totalPoints = 0;
  const dailyCheckInStreak = 0;
  const transactionCount = 0;
  const referralCount = 0;
  const hasClaimedNFT = profile?.hasCompletedFirstTestnetTransaction || false;

  const handleDailyCheckIn = async () => {
    setCheckingIn(true);
    try {
      // TODO: Call backend API for daily check-in
      // await backendApi.dailyCheckIn();
      toast.success('Daily check-in complete! +10 points');
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in');
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="pb-20">
      <Tabs defaultValue="points" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="points">Points</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
        </TabsList>

        {/* Points Tab */}
        <TabsContent value="points" className="space-y-4">
          {/* Total Points Card */}
          <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-full blur-3xl" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Points</p>
                  <p className="text-4xl font-bold gradient-text">{totalPoints}</p>
                  <p className="text-xs text-muted-foreground mt-2">Keep earning to unlock rewards!</p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Check-in Card */}
          <Card className="border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Daily Check-in</h3>
                    <p className="text-sm text-muted-foreground">Earn 10 points every day</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                  +10 pts
                </Badge>
              </div>
              
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Current Streak</span>
                  <span className="font-semibold">{dailyCheckInStreak} days 🔥</span>
                </div>
              </div>

              <Button 
                onClick={handleDailyCheckIn}
                disabled={checkingIn}
                className="w-full gradient-primary text-white"
              >
                {checkingIn ? 'Checking in...' : 'Check In Today'}
              </Button>
            </CardContent>
          </Card>

          {/* Transaction Points Card */}
          <Card className="border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <ArrowRightLeft className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Transactions</h3>
                    <p className="text-sm text-muted-foreground">Earn 5 points per transaction</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  +5 pts each
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Transactions</span>
                  <span className="font-semibold">{transactionCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Points Earned</span>
                  <span className="font-semibold gradient-text">{transactionCount * 5} pts</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Referral Points Card */}
          <Card className="border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Referrals</h3>
                    <p className="text-sm text-muted-foreground">Earn 100 points per referral</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  +100 pts each
                </Badge>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Referrals</span>
                  <span className="font-semibold">{referralCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Points Earned</span>
                  <span className="font-semibold gradient-text">{referralCount * 100} pts</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => toast.info('Referral system coming soon!')}
              >
                Get Referral Code
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets" className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold mb-2">Your Reward Assets</h3>
            <p className="text-sm text-muted-foreground">Exclusive NFTs and rewards for early users</p>
          </div>

          {/* Early User NFT Card */}
          <Card className="border-purple-500/20 overflow-hidden">
            <div className="relative h-48 bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <div className="absolute inset-0 bg-[url('/Zet money NFT.png')] bg-cover bg-center opacity-30" />
              <div className="relative z-10 text-center text-white">
                <Gift className="w-16 h-16 mx-auto mb-3" />
                <h3 className="text-xl font-bold">Early User NFT</h3>
                <p className="text-sm opacity-90">Exclusive reward for pioneers</p>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  {hasClaimedNFT ? (
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Eligible to Claim
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      Complete first transaction
                    </Badge>
                  )}
                </div>

                <div className="text-sm text-muted-foreground">
                  {hasClaimedNFT ? (
                    <p>Congratulations! You're eligible to mint your exclusive Early User NFT. Click below to claim it.</p>
                  ) : (
                    <p>Complete your first testnet transaction to become eligible for this exclusive NFT reward.</p>
                  )}
                </div>

                <Button 
                  className="w-full gradient-primary text-white"
                  disabled={!hasClaimedNFT}
                  onClick={() => window.open('https://reward.zet.money', '_blank')}
                >
                  {hasClaimedNFT ? (
                    <>
                      Claim NFT <ExternalLink className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    'Not Yet Eligible'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon Card */}
          <Card className="border-dashed">
            <CardContent className="p-4 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">More Rewards Coming Soon</h3>
              <p className="text-sm text-muted-foreground">
                We're working on exciting new rewards for our community. Stay tuned!
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
