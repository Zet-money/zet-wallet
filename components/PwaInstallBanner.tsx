"use client";
import { useEffect, useState } from 'react'
import { canInstallPWA, isIOS, isSafari, isStandalonePWA, onInstallAvailabilityChange, onInstallStatusChange, promptInstallPWA } from '@/lib/pwa'

export default function PwaInstallBanner() {
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [isDismissed, setIsDismissed] = useState(true)

  const checkDismissedStatus = () => {
    if (typeof window === 'undefined') return true
    
    const dismissed = window.localStorage.getItem('zet.pwa.dismissed')
    
    // Handle old format (just '1') and new format (JSON with timestamp)
    if (!dismissed) return false
    
    if (dismissed === '1') {
      return true
    }
    
    try {
      const dismissedData = JSON.parse(dismissed)
      if (dismissedData.reminder) {
        // Check if 24 hours have passed
        const now = Date.now()
        const twentyFourHours = 24 * 60 * 60 * 1000
        return (now - dismissedData.timestamp) < twentyFourHours
      }
      return true
    } catch {
      // If JSON parsing fails, treat as dismissed
      return true
    }
  }

  const updateVisibility = () => {
    const dismissed = checkDismissedStatus()
    const installable = canInstallPWA()
    
    setIsDismissed(dismissed)
    setCanInstall(installable)
    setVisible(!dismissed && installable)
  }

  useEffect(() => {
    if (isStandalonePWA()) return

    // Initial check
    updateVisibility()

    // Listen for install availability changes
    const handleAvailabilityChange = (available: boolean) => {
      setCanInstall(available)
      if (available) {
        updateVisibility()
      }
    }

    // Listen for install status changes
    const handleInstallStatusChange = (installed: boolean) => {
      if (installed) {
        setVisible(false)
      }
    }

    // Listen for storage changes (when user dismisses from another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'zet.pwa.dismissed') {
        updateVisibility()
      }
    }

    // Set up listeners
    onInstallAvailabilityChange(handleAvailabilityChange)
    onInstallStatusChange(handleInstallStatusChange)
    window.addEventListener('storage', handleStorageChange)

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  if (isStandalonePWA()) return null

  // iOS Safari: show "Add to Home Screen" instructions instead of prompt
  if (isIOS() && isSafari()) {
    return (
      <div className="fixed bottom-4 inset-x-0 flex justify-center z-[60]">
        <div className="bg-card border shadow-lg rounded-xl px-4 py-3 text-sm max-w-sm">
          <div className="font-medium mb-1">Add Zet Wallet to Home Screen</div>
          <div className="text-muted-foreground">Open the Share menu
            <span className="inline-block mx-1">⬆️</span> and choose “Add to Home Screen”.
          </div>
        </div>
      </div>
    )
  }

  // Don't render if not visible or can't install
  if (!visible || !canInstall) return null

  console.log('PWA Banner rendering:', { visible, canInstall, isDismissed })

  return (
    <div className="fixed bottom-4 inset-x-0 flex justify-center z-[60]">
      <div className="bg-card border shadow-lg rounded-xl px-4 py-3 flex items-center space-x-3 relative">
        <div className="text-sm">
          <div className="font-medium">Install Zet Wallet</div>
          <div className="text-muted-foreground">Get the best experience as a PWA.</div>
        </div>
        <button
          className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-60"
          disabled={installing}
          onClick={async () => {
            setInstalling(true)
            const ok = await promptInstallPWA()
            if (!ok) {
              try { 
                window.localStorage.setItem('zet.pwa.dismissed', '1') 
                updateVisibility() // Update state immediately
              } catch { }
            }
            setInstalling(false)
          }}
        >{installing ? 'Installing…' : 'Install'}</button>
        <button
          className="px-2 py-1 rounded-md border text-sm hover:bg-muted transition-colors"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            try {
              // Store timestamp for reminder (show again after 24 hours)
              window.localStorage.setItem('zet.pwa.dismissed', JSON.stringify({
                timestamp: Date.now(),
                reminder: true
              }))
              // Update state immediately
              updateVisibility()
            } catch (error) {
              console.error('Error setting localStorage:', error)
            }
          }}
        >Later</button>
      </div>
    </div>
  )
}


