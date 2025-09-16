import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zet Wallet',
    short_name: 'Zet',
    description: 'Cross-chain wallet powered by ZetaChain',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B0B0F',
    theme_color: '#0B0B0F',
    icons: [
      { src: '/favicon.ico', sizes: '16x16 24x24 32x32 48x48 64x64', type: 'image/x-icon' },
      { src: '/next.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/vercel.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' }
    ]
  }
}


