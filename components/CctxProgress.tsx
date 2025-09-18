"use client"

import { CctxProgress } from '@/lib/zetachain'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Clock, AlertCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CctxProgressProps {
  progress: CctxProgress
  originChain: string
  targetChain: string
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
  '7001': 'ZetaChain',
  'solana': 'Solana'
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
  onViewExplorer 
}: CctxProgressProps) {
  const getProgressPercentage = () => {
    switch (progress.status) {
      case 'pending': return 10
      case 'inbound_confirmed': return 40
      case 'outbound_broadcasted': return 80
      case 'completed': return 100
      case 'failed': return 0
      case 'error': return 0
      default: return 0
    }
  }

  const getTargetChainName = () => {
    return chainNames[progress.targetChainId || ''] || targetChain
  }

  const formatAmount = (amount: string | undefined) => {
    if (!amount) return '0'
    const num = Number(amount)
    if (num === 0) return '0'
    return num.toLocaleString()
  }

  const formatGas = (gas: string | undefined) => {
    if (!gas || gas === '0') return 'N/A'
    return Number(gas).toLocaleString()
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

        {/* Transaction Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Amount:</span>
            <p className="font-mono">{formatAmount(progress.amount)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Target Chain:</span>
            <p className="font-medium">{getTargetChainName()}</p>
          </div>
        </div>

        {/* Addresses */}
        {progress.sender && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">From:</span>
            <p className="font-mono text-xs break-all bg-muted p-2 rounded">
              {progress.sender}
            </p>
          </div>
        )}

        {progress.receiver && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">To:</span>
            <p className="font-mono text-xs break-all bg-muted p-2 rounded">
              {progress.receiver}
            </p>
          </div>
        )}

        {/* Outbound Transaction Hash */}
        {progress.outboundHash && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Outbound Transaction:</span>
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
          </div>
        )}

        {/* Gas Information */}
        {(progress.gasUsed || progress.gasLimit) && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Gas Used:</span>
              <p className="font-mono">{formatGas(progress.gasUsed)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Gas Limit:</span>
              <p className="font-mono">{formatGas(progress.gasLimit)}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {progress.errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Error Details</p>
                <p className="text-xs text-red-600 mt-1 break-all">
                  {progress.errorMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Height Information */}
        {(progress.inboundHeight || progress.finalizedHeight) && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            {progress.inboundHeight && (
              <div>
                <span className="text-muted-foreground">Inbound Height:</span>
                <p className="font-mono">{progress.inboundHeight.toLocaleString()}</p>
              </div>
            )}
            {progress.finalizedHeight && (
              <div>
                <span className="text-muted-foreground">Finalized Height:</span>
                <p className="font-mono">{progress.finalizedHeight.toLocaleString()}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
