"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, Calendar, ArrowRightLeft, Users, CheckCircle2, ExternalLink, Sparkles, Copy, Loader2, Trophy, Medal, Award } from 'lucide-react';
import { toast } from 'sonner';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { useWallet } from '@/contexts/WalletContext';
import { useBiometric } from '@/contexts/BiometricContext';
import { backendApi } from '@/lib/services/backend-api';

export default function RewardsView() {
  const { backendUser, loadProfile } = useUserSettings();
  const { wallet } = useWallet();
  const { getBiometricPublicKey, isAppUnlocked } = useBiometric();
  const [checkingIn, setCheckingIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nftStatus, setNftStatus] = useState<{
    isWhitelisted: boolean;
    hasMinted: boolean;
    canMint: boolean;
    loading: boolean;
  }>({
    isWhitelisted: false,
    hasMinted: false,
    canMint: false,
    loading: true,
  });
  const [pointsData, setPointsData] = useState({
    totalPoints: 0,
    dailyCheckInStreak: 0,
    transactionCount: 0,
    referralCount: 0,
  });
  const [leaderboard, setLeaderboard] = useState<Array<{
    rank: number;
    username: string | null;
    walletAddress: string;
    totalPoints: number;
  }>>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const loadLeaderboard = async () => {
    if (!wallet?.address || !isAppUnlocked) {
      return;
    }

    setLoadingLeaderboard(true);
    try {
      const biometricPublicKey = await getBiometricPublicKey();
      if (!biometricPublicKey) {
        setLoadingLeaderboard(false);
        return;
      }

      const data = await backendApi.getLeaderboard(wallet.address, biometricPublicKey);
      setLeaderboard(data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const loadPointsData = async () => {
    if (!wallet?.address || !isAppUnlocked) {
      setLoading(false);
      return;
    }
    
    try {
      const biometricPublicKey = await getBiometricPublicKey();
      if (!biometricPublicKey) {
        setLoading(false);
        return;
      }

      console.log(biometricPublicKey)

      const data = await backendApi.getPoints(wallet.address, biometricPublicKey);
      setPointsData(data);
    } catch (error) {
      console.error('Failed to load points data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNftStatus = async () => {
    if (!wallet?.address || !isAppUnlocked) {
      setNftStatus(prev => ({ ...prev, loading: false }));
      return;
    }
    
    try {
      const biometricPublicKey = await getBiometricPublicKey();
      if (!biometricPublicKey) {
        setNftStatus(prev => ({ ...prev, loading: false }));
        return;
      }

      const status = await backendApi.checkWhitelistStatus(wallet.address, biometricPublicKey);
      setNftStatus({
        ...status,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to load NFT status:', error);
      setNftStatus(prev => ({ ...prev, loading: false }));
    }
  };

  // Reload profile and points data when component mounts or when dependencies change
  useEffect(() => {
    const refreshData = async () => {
      // Reload profile from backend to get latest totalPoints
      await loadProfile();
      // Then load points breakdown
      await loadPointsData();
      // Load NFT status
      await loadNftStatus();
    };
    
    refreshData();
  }, [wallet?.address, isAppUnlocked]);

  const totalPoints = backendUser?.totalPoints || pointsData.totalPoints;
  const dailyCheckInStreak = backendUser?.dailyCheckInStreak || pointsData.dailyCheckInStreak;
  const transactionCount = pointsData.transactionCount;
  const referralCount = backendUser?.referralCount || pointsData.referralCount;
  
  // User is eligible if they have completed first transaction OR have any transactions
  const isEligibleForNFT = backendUser?.hasCompletedFirstTestnetTransaction || transactionCount > 0;

  // Check if user already checked in today
  const hasCheckedInToday = () => {
    if (!backendUser?.lastDailyCheckIn) return false;
    const lastCheckIn = new Date(backendUser.lastDailyCheckIn);
    const today = new Date();
    return (
      lastCheckIn.getFullYear() === today.getFullYear() &&
      lastCheckIn.getMonth() === today.getMonth() &&
      lastCheckIn.getDate() === today.getDate()
    );
  };

  const alreadyCheckedIn = hasCheckedInToday();

  const handleDailyCheckIn = async () => {
    if (!wallet?.address) {
      toast.error('Wallet not connected');
      return;
    }

    setCheckingIn(true);
    try {
      const biometricPublicKey = await getBiometricPublicKey();
      if (!biometricPublicKey) {
        toast.error('Biometric authentication required');
        return;
      }

      await backendApi.dailyCheckIn(wallet.address, biometricPublicKey);
      toast.success('Daily check-in complete! +10 points');
      
      // Reload profile and points data
      await loadProfile();
      await loadPointsData();
    } catch (error: any) {
      if (error.message?.includes('Already checked in')) {
        toast.error('Already checked in today!');
      } else {
        toast.error(error.message || 'Failed to check in');
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const handleClaimNFT = async () => {
    if (!wallet?.address) {
      toast.error('Wallet not connected');
      return;
    }

    if (!isEligibleForNFT) {
      toast.error('Complete your first transaction to be eligible');
      return;
    }

    try {
      const biometricPublicKey = await getBiometricPublicKey();
      if (!biometricPublicKey) {
        toast.error('Biometric authentication required');
        return;
      }

      // Check if already whitelisted
      toast.loading('Checking eligibility...', { id: 'nft-check' });
      const status = await backendApi.checkWhitelistStatus(wallet.address, biometricPublicKey);
      
      // If not whitelisted, whitelist them first
      if (!status.isWhitelisted) {
        toast.loading('Whitelisting your address...', { id: 'nft-check' });
        const whitelistResult = await backendApi.whitelistAddress(wallet.address, biometricPublicKey);
        
        if (!whitelistResult.success) {
          toast.error('Failed to whitelist address. Please try again.', { id: 'nft-check' });
          return;
        }
        
        toast.success('Address whitelisted! Redirecting...', { id: 'nft-check' });
      } else if (status.hasMinted) {
        toast.error('You have already claimed this NFT', { id: 'nft-check' });
        setNftStatus({ ...status, loading: false });
        return;
      } else {
        toast.success('Opening NFT claim page...', { id: 'nft-check' });
      }

      // Redirect to NFT claim page
      window.open('https://reward.zet.money', '_blank');
      
      // Reload NFT status after a delay
      setTimeout(() => {
        loadNftStatus();
      }, 2000);
    } catch (error: any) {
      console.error('Failed to process NFT claim:', error);
      toast.error(error.message || 'Failed to process request', { id: 'nft-check' });
    }
  };

  return (
    <div className="pb-20">
      <Tabs defaultValue="points" className="w-full" onValueChange={(value) => { if (value === 'leaderboard') loadLeaderboard(); }}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="points">Points</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
        </TabsList>

        {/* Points Tab */}
        <TabsContent value="points" className="space-y-4">
          {/* Total Points Card */}
          <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20 relative overflow-hidden p-3">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-full blur-3xl" />
            <CardContent className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Points</p>
                  <p className="text-4xl font-bold gradient-text">{totalPoints}</p>
                  <p className="text-xs text-muted-foreground mt-2">Points will convert to $ZET tokens at launch! 🚀</p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Check-in Card */}
          <Card className="border-purple-500/20 p-3">
            <CardContent>
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
                disabled={checkingIn || alreadyCheckedIn}
                className="w-full gradient-primary text-white"
              >
                {alreadyCheckedIn ? '✓ Already Checked In' : checkingIn ? 'Checking in...' : 'Check In Today'}
              </Button>
            </CardContent>
          </Card>

          {/* Transaction Points Card */}
          <Card className="border-blue-500/20 p-3">
            <CardContent>
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
          <Card className="border-green-500/20 p-3">
            <CardContent>
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
                onClick={async () => {
                  const code = backendUser?.referralCode || wallet?.address.slice(2, 10).toUpperCase();
                  if (code) {
                    try {
                      await navigator.clipboard.writeText(code);
                      toast.success(`Referral code copied: ${code}`, {
                        description: 'Share it with friends to earn 100 points each!',
                        duration: 4000,
                      });
                    } catch (err) {
                      toast.error('Failed to copy code');
                    }
                  } else {
                    toast.error('Referral code not available');
                  }
                }}
                disabled={!backendUser?.referralCode && !wallet?.address}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Referral Code
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
          <Card className="border-purple-500/20 overflow-hidden p-3">
            <div className="relative h-48 bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <div className="absolute inset-0 bg-[url('/Zet money NFT.png')] bg-cover bg-center opacity-30" />
              <div className="relative z-10 text-center text-white">
                <Gift className="w-16 h-16 mx-auto mb-3" />
                <h3 className="text-xl font-bold">Early User NFT</h3>
                <p className="text-sm opacity-90">Exclusive reward for pioneers</p>
              </div>
            </div>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  {nftStatus.loading ? (
                    <Badge variant="secondary">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Loading...
                    </Badge>
                  ) : nftStatus.hasMinted ? (
                    <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Already Claimed
                    </Badge>
                  ) : isEligibleForNFT ? (
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
                  {nftStatus.hasMinted ? (
                    <p>You have already claimed your exclusive Early User NFT. Thank you for being an early supporter!</p>
                  ) : isEligibleForNFT ? (
                    <p>Congratulations! You're eligible to mint your exclusive Early User NFT. Click below to claim it.</p>
                  ) : (
                    <p>Complete your first transaction to become eligible for this exclusive NFT reward.</p>
                  )}
                </div>

                <Button 
                  className="w-full gradient-primary text-white"
                  disabled={!isEligibleForNFT || nftStatus.hasMinted || nftStatus.loading}
                  onClick={handleClaimNFT}
                >
                  {nftStatus.loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Checking Status...
                    </>
                  ) : nftStatus.hasMinted ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Claimed
                    </>
                  ) : isEligibleForNFT ? (
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
          <Card className="border-dashed p-3">
            <CardContent className="text-center">
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

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          {loadingLeaderboard ? (
            <Card className="p-8">
              <CardContent className="flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading leaderboard...</p>
              </CardContent>
            </Card>
          ) : leaderboard.length === 0 ? (
            <Card className="p-8">
              <CardContent className="text-center">
                <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No Rankings Yet</h3>
                <p className="text-sm text-muted-foreground">
                  Be the first to earn points and appear on the leaderboard!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((user) => {
                const isTop3 = user.rank <= 3;
                const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
                const displayName = user.username || truncateAddress(user.walletAddress);
                
                return (
                  <Card 
                    key={user.walletAddress} 
                    className={`p-3 ${
                      user.rank === 1 ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30' :
                      user.rank === 2 ? 'bg-gradient-to-r from-gray-400/10 to-gray-500/10 border-gray-400/30' :
                      user.rank === 3 ? 'bg-gradient-to-r from-orange-600/10 to-amber-700/10 border-orange-600/30' :
                      'border-border/50'
                    }`}
                  >
                    <CardContent className="p-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          {/* Rank Badge */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            user.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                            user.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                            user.rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                            'bg-muted'
                          }`}>
                            {isTop3 ? (
                              user.rank === 1 ? <Trophy className="w-5 h-5 text-white" /> :
                              user.rank === 2 ? <Medal className="w-5 h-5 text-white" /> :
                              <Award className="w-5 h-5 text-white" />
                            ) : (
                              <span className={`font-bold ${isTop3 ? 'text-white' : 'text-muted-foreground'}`}>
                                {user.rank}
                              </span>
                            )}
                          </div>

                          {/* User Info */}
                          <div className="min-w-0 flex-1">
                            <p className={`font-semibold truncate ${isTop3 ? 'text-lg' : 'text-sm'}`}>
                              {displayName}
                            </p>
                            {user.username && (
                              <p className="text-xs text-muted-foreground truncate">
                                {truncateAddress(user.walletAddress)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Points */}
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className={`font-bold gradient-text ${isTop3 ? 'text-xl' : 'text-base'}`}>
                            {user.totalPoints.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">points</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
