export function registerServiceWorker() {
  if (typeof window === 'undefined') return
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}

let deferredPrompt: any
const listeners: Array<(installed: boolean) => void> = []
const availabilityListeners: Array<(available: boolean) => void> = []
export function setupInstallPrompt(cb?: (installed: boolean) => void) {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault()
    deferredPrompt = e
    cb?.(false)
    listeners.forEach((fn) => {
      try { fn(false) } catch {}
    })
    availabilityListeners.forEach((fn) => {
      try { fn(true) } catch {}
    })
  })

  window.addEventListener('appinstalled', () => {
    cb?.(true)
    listeners.forEach((fn) => {
      try { fn(true) } catch {}
    })
    deferredPrompt = null
  })
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
}

export function canInstallPWA(): boolean {
  return typeof deferredPrompt !== 'undefined' && deferredPrompt !== null
}

export async function promptInstallPWA(): Promise<boolean> {
  if (!deferredPrompt) return false
  try {
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    const accepted = choice?.outcome === 'accepted'
    if (!accepted) {
      try { 
        // Store timestamp for reminder (show again after 24 hours)
        window.localStorage.setItem('zet.pwa.dismissed', JSON.stringify({
          timestamp: Date.now(),
          reminder: true
        }))
      } catch {}
    }
    deferredPrompt = null
    return !!accepted
  } catch {
    return false
  }
}

export function onInstallStatusChange(listener: (installed: boolean) => void) {
  listeners.push(listener)
}

export function onInstallAvailabilityChange(listener: (available: boolean) => void) {
  availabilityListeners.push(listener)
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || navigator.vendor
  return /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window)
}

export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  // crude but sufficient for banner logic
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}


