"use client";
import { useEffect, useState } from 'react'
import { canInstallPWA, isIOS, isSafari, isStandalonePWA, onInstallAvailabilityChange, onInstallStatusChange, promptInstallPWA } from '@/lib/pwa'

export default function PwaInstallBanner() {
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (isStandalonePWA()) return

    const checkAndShowBanner = () => {
      const dismissed = typeof window !== 'undefined' ? window.localStorage.getItem('zet.pwa.dismissed') : '1'

      // Handle old format (just '1') and new format (JSON with timestamp)
      let isDismissed = false
      if (dismissed) {
        if (dismissed === '1') {
          isDismissed = true
        } else {
          try {
            const dismissedData = JSON.parse(dismissed)
            if (dismissedData.reminder) {
              // Check if 24 hours have passed
              const now = Date.now()
              const twentyFourHours = 24 * 60 * 60 * 1000
              isDismissed = (now - dismissedData.timestamp) < twentyFourHours
            } else {
              isDismissed = true
            }
          } catch {
            // If JSON parsing fails, treat as dismissed
            isDismissed = true
          }
        }
      }

      if (!isDismissed && canInstallPWA()) {
        setVisible(true)
      }
    }

    checkAndShowBanner()

    onInstallAvailabilityChange((available) => {
      if (available) {
        checkAndShowBanner()
      }
    })

    onInstallStatusChange((installed) => {
      if (installed) setVisible(false)
    })
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

  if (!visible && !canInstallPWA()) return null

  console.log('PWA Banner rendering:', { visible, canInstall: canInstallPWA() })

  return (
    <div className="fixed bottom-4 inset-x-0 flex justify-center z-[60]">
      <div className="bg-card border shadow-lg rounded-xl px-4 py-3 flex items-center space-x-3 relative">
        <div className="text-sm">
          <div className="font-medium">Install Zet Wallet</div>
          <div className="text-muted-foreground">Get the best experience as a PWA. {(!visible && !canInstallPWA()) ? 'Reload once to enable the install prompt.' : ''}</div>
        </div>
        <button
          className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-60"
          disabled={installing}
          onClick={async () => {
            setInstalling(true)
            const ok = await promptInstallPWA()
            if (!ok) {
              try { window.localStorage.setItem('zet.pwa.dismissed', '1') } catch { }
              setVisible(false)
            }
            setInstalling(false)
          }}
        >{installing ? 'Installing…' : 'Install'}</button>
        <button
          className="px-2 py-1 rounded-md border text-sm hover:bg-muted transition-colors"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            console.log('Later button clicked!')
            try {
              setVisible(false)
              // Store timestamp for reminder (show again after 24 hours)
              window.localStorage.setItem('zet.pwa.dismissed', JSON.stringify({
                timestamp: Date.now(),
                reminder: true
              }))
              console.log('Later button: Banner dismissed and reminder set')
            } catch (error) {
              console.error('Later button: Error setting localStorage:', error)
            }
          }}
        >Later</button>
      </div>
    </div>
  )
}


