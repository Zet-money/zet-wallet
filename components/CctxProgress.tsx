"use client"

import { CctxProgress } from '@/lib/zetachain-server'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Clock, AlertCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CctxProgressProps {
  progress: CctxProgress
  originChain: string
  targetChain: string
  duration?: number
  isTimerRunning?: boolean
  receiver?: string
  onViewExplorer?: (hash: string, chain: string) => void
}

const chainNames: Record<string, string> = {
  '1': 'Ethereum',
  '137': 'Polygon',
  '56': 'BSC',
  '43114': 'Avalanche',
  '42161': 'Arbitrum',
  '10': 'Optimism',
  '8453': 'Base',
  '84532': 'Base Testnet',
  '7001': 'ZetaChain',
  'solana': 'Solana',
  'ethereum': 'Ethereum',
  'polygon': 'Polygon',
  'bsc': 'BSC',
  'avalanche': 'Avalanche',
  'arbitrum': 'Arbitrum',
  'optimism': 'Optimism',
  'base': 'Base'
}

const statusIcons = {
  pending: <Clock className="w-4 h-4" />,
  inbound_confirmed: <CheckCircle className="w-4 h-4 text-blue-500" />,
  outbound_broadcasted: <CheckCircle className="w-4 h-4 text-yellow-500" />,
  completed: <CheckCircle className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />
}

const statusColors = {
  pending: 'bg-gray-100 text-gray-800',
  inbound_confirmed: 'bg-blue-100 text-blue-800',
  outbound_broadcasted: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  error: 'bg-red-100 text-red-800'
}

export default function CctxProgressComponent({ 
  progress, 
  originChain, 
  targetChain, 
  duration = 0,
  isTimerRunning = false,
  receiver,
  onViewExplorer 
}: CctxProgressProps) {
  console.log('[UI][CCTX][PROGRESS] CctxProgressComponent rendered', {
    progress,
    originChain,
    targetChain,
    hasOnViewExplorer: !!onViewExplorer
  })
  
  const getProgressPercentage = () => {
    const percentage = (() => {
      switch (progress.status) {
        case 'pending': return 10
        case 'inbound_confirmed': return 40
        case 'outbound_broadcasted': return 80
        case 'completed': return 100
        case 'failed': return 0
        case 'error': return 0
        default: return 0
      }
    })()
    
    console.log('[UI][CCTX][PROGRESS] Progress percentage calculated', {
      status: progress.status,
      percentage
    })
    
    return percentage
  }

  const getTargetChainName = () => {
    // Try to resolve by targetChainId first, then by targetChain name
    let chainName = chainNames[progress.targetChainId || '']
    if (!chainName) {
      // Try exact match first
      chainName = chainNames[targetChain.toLowerCase()]
      if (!chainName) {
        // Try partial matches for common variations
        const targetLower = targetChain.toLowerCase()
        if (targetLower.includes('base')) {
          chainName = 'Base'
        } else if (targetLower.includes('polygon') || targetLower.includes('matic')) {
          chainName = 'Polygon'
        } else if (targetLower.includes('ethereum') || targetLower.includes('eth')) {
          chainName = 'Ethereum'
        } else if (targetLower.includes('arbitrum') || targetLower.includes('arb')) {
          chainName = 'Arbitrum'
        } else if (targetLower.includes('optimism') || targetLower.includes('op')) {
          chainName = 'Optimism'
        } else if (targetLower.includes('avalanche') || targetLower.includes('avax')) {
          chainName = 'Avalanche'
        } else if (targetLower.includes('bsc') || targetLower.includes('binance')) {
          chainName = 'BSC'
        } else if (targetLower.includes('solana') || targetLower.includes('sol')) {
          chainName = 'Solana'
        } else {
          chainName = targetChain // Fallback to original value
        }
      }
    }
    
    console.log('[UI][CCTX][PROGRESS] Target chain name resolved', {
      targetChainId: progress.targetChainId,
      targetChain,
      chainName,
      availableChains: Object.keys(chainNames)
    })
    return chainName
  }

  const formatAmount = (amount: string | undefined, asset?: string) => {
    if (!amount) {
      console.log('[UI][CCTX][PROGRESS] Amount is undefined, returning 0')
      return '0'
    }
    
    // Check if amount is already in human-readable format (has decimal point)
    if (amount.includes('.')) {
      console.log('[UI][CCTX][PROGRESS] Amount already formatted, returning as-is', { amount })
      return amount
    }
    
    // Determine decimals based on asset type
    let decimals = 18 // Default for most tokens
    if (asset) {
      const assetLower = asset.toLowerCase()
      if (assetLower.includes('usdc') || assetLower.includes('usdt')) {
        decimals = 6
      } else if (assetLower.includes('dai')) {
        decimals = 18
      } else if (assetLower.includes('weth') || assetLower.includes('wbtc')) {
        decimals = 18
      }
    }
    
    // Convert from smallest unit to human readable
    const num = Number(amount) / Math.pow(10, decimals)
    const formatted = num === 0 ? '0' : num.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 6 
    })
    
    console.log('[UI][CCTX][PROGRESS] Amount formatted', { 
      amount, 
      decimals, 
      num, 
      formatted,
      asset,
      hasDecimalPoint: amount.includes('.')
    })
    return formatted
  }

  const formatGas = (gas: string | undefined) => {
    if (!gas || gas === '0') {
      console.log('[UI][CCTX][PROGRESS] Gas is undefined or 0, returning N/A', { gas })
      return 'N/A'
    }
    const formatted = Number(gas).toLocaleString()
    console.log('[UI][CCTX][PROGRESS] Gas formatted', { gas, formatted })
    return formatted
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {statusIcons[progress.status]}
            Cross-Chain Transfer Status
          </CardTitle>
          <Badge className={statusColors[progress.status]}>
            {progress.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{getProgressPercentage()}%</span>
          </div>
          <Progress value={getProgressPercentage()} className="h-2" />
        </div>

        {/* Status Text */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{progress.statusText}</p>
        </div>

        {/* Confirmations */}
        {progress.confirmations > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Confirmations</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{progress.confirmations}</span>
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}

        {/* Transaction Duration */}
        {duration > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-sm font-medium">Transaction Duration</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono">{formatDuration(duration)}</span>
              {isTimerRunning && (
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              )}
            </div>
          </div>
        )}

        {/* Transaction Details */}
        <div className="space-y-3">
          <div className="text-center p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Transfer Details</div>
            <div className="text-lg font-bold">
              {progress.amount} {progress.asset} {getTargetChainName().toLowerCase()}
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">From:</span>
          {progress.sender ? (
            <p className="font-mono text-xs break-all bg-muted p-2 rounded">
              {progress.sender}
            </p>
          ) : (
            <div className="bg-muted p-2 rounded animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">To:</span>
          {receiver ? (
            <p className="font-mono text-xs break-all bg-muted p-2 rounded">
              {receiver}
            </p>
          ) : (
            <div className="bg-muted p-2 rounded animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            </div>
          )}
        </div>

        {/* Outbound Transaction Hash */}
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Outbound Transaction:</span>
          {progress.outboundHash ? (
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs break-all bg-muted p-2 rounded flex-1">
                {progress.outboundHash}
              </p>
              {onViewExplorer && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewExplorer(progress.outboundHash!, getTargetChainName())}
                  className="shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-muted p-2 rounded animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-full"></div>
            </div>
          )}
        </div>

        {/* Gas Information */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Gas Used:</span>
            {progress.gasUsed ? (
              <p className="font-mono">{formatGas(progress.gasUsed)}</p>
            ) : (
              <div className="bg-muted p-2 rounded animate-pulse mt-1">
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Gas Limit:</span>
            {progress.gasLimit ? (
              <p className="font-mono">{formatGas(progress.gasLimit)}</p>
            ) : (
              <div className="bg-muted p-2 rounded animate-pulse mt-1">
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {progress.errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Error Details</p>
                <p className="text-xs text-red-600 mt-1 break-all">
                  An error occurred: Transaction failed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Height Information */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Inbound Height:</span>
            {progress.inboundHeight ? (
              <p className="font-mono">{progress.inboundHeight.toLocaleString()}</p>
            ) : (
              <div className="bg-muted p-2 rounded animate-pulse mt-1">
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Finalized Height:</span>
            {progress.finalizedHeight ? (
              <p className="font-mono">{progress.finalizedHeight.toLocaleString()}</p>
            ) : (
              <div className="bg-muted p-2 rounded animate-pulse mt-1">
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
