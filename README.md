# Zet Wallet

A modern, responsive cross-chain wallet UI built with Next.js, TypeScript, and Shadcn UI. This wallet interface supports multiple blockchain networks including Ethereum, Solana, Sui, and TON.

## Features

### 🚀 Core Functionality
- **Wallet Creation & Import**: Generate new wallets with 12-word mnemonic phrases or import existing ones
- **Multi-Chain Support**: Switch between different blockchain networks (Ethereum, Solana, Sui, TON, Polygon, BSC)
- **Asset Management**: View balances and manage assets across different chains
- **Send Transactions**: Cross-chain token transfers with destination chain selection
- **Receive Funds**: QR code generation for easy address sharing
- **Search & Filter**: Find assets quickly with real-time search

### 🎨 User Experience
- **Dark/Light Theme**: Automatic theme switching based on system preferences
- **Mobile Responsive**: Optimized for both desktop and mobile devices
- **Modern UI**: Built with Shadcn UI components for a polished experience
- **Smooth Animations**: Subtle transitions and hover effects
- **Accessibility**: Screen reader friendly with proper ARIA labels

### 🔧 Technical Features
- **TypeScript**: Full type safety throughout the application
- **Context API**: Centralized wallet state management
- **Next.js 15**: Latest Next.js features with App Router
- **Tailwind CSS**: Utility-first styling with custom design system
- **QR Code Generation**: Built-in QR code support for address sharing

## Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd zet-wallet
```

2. Install dependencies:
```bash
pnpm install
```

3. Start the development server:
```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
zet-wallet/
├── app/
│   ├── asset/[id]/          # Dynamic asset detail pages
│   ├── globals.css          # Global styles and theme variables
│   ├── layout.tsx           # Root layout with theme provider
│   └── page.tsx             # Main app entry point
├── components/
│   ├── ui/                  # Shadcn UI components
│   ├── AssetDetails.tsx     # Asset detail screen
│   ├── Dashboard.tsx        # Main dashboard
│   ├── ReceiveFlow.tsx      # Receive funds modal
│   ├── SendFlow.tsx         # Send transaction modal
│   ├── SplashScreen.tsx     # App loading screen
│   ├── ThemeToggle.tsx      # Theme switcher
│   └── WalletSetup.tsx      # Wallet creation/import
├── contexts/
│   └── WalletContext.tsx    # Wallet state management
└── lib/
    └── utils.ts             # Utility functions
```

## Usage

### Creating a Wallet
1. Launch the app and wait for the splash screen
2. Click "Create Wallet" to generate a new 12-word mnemonic
3. **Important**: Save your recovery phrase in a secure location
4. Click "I've saved my recovery phrase" to proceed

### Importing a Wallet
1. Click "Import Wallet" tab
2. Enter your 12-word recovery phrase
3. Click "Import Wallet" to restore your wallet

### Managing Assets
1. Select a blockchain network from the dropdown
2. View your assets and their balances
3. Use the search bar to find specific assets
4. Click on any asset to view details

### Sending Tokens
1. Navigate to an asset detail page
2. Click "Send" button
3. Enter recipient address and amount
4. Select destination chain for cross-chain transfers
5. Review transaction details and confirm

### Receiving Tokens
1. Navigate to an asset detail page
2. Click "Receive" button
3. Share the QR code or wallet address
4. Ensure sender uses the correct network

## Supported Networks

- **Ethereum** 🔷
- **Solana** ☀️
- **Sui** 🔵
- **TON** 💎
- **Polygon** 🟣
- **BSC** 🟡

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn UI
- **Theme**: Next Themes
- **Icons**: Lucide React
- **QR Codes**: react-qr-code
- **Notifications**: Sonner

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

### Code Style

This project uses:
- ESLint for code linting
- Prettier for code formatting
- TypeScript for type checking
- Tailwind CSS for styling

## Security Notes

⚠️ **Important**: This is a UI-only implementation for demonstration purposes. In a production environment, you would need to:

- Implement proper cryptographic wallet generation
- Add secure key management
- Integrate with actual blockchain networks
- Add transaction signing capabilities
- Implement proper security measures

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Roadmap

- [ ] Integration with Zeta Chain SDK
- [ ] Real blockchain connectivity
- [ ] Transaction history
- [ ] Portfolio analytics
- [ ] DeFi integrations
- [ ] Multi-signature support
- [ ] Hardware wallet support

---

Built with ❤️ for the Zet Wallet project