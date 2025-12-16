# WireSniff Desktop

A powerful, cross-platform API client for REST, WebSocket, GraphQL, and Server-Sent Events. Built with Electron, React, TypeScript, and Tailwind CSS.

![WireSniff](https://wiresniff.com/og-image.png)

## Features

- 🚀 **Multi-Protocol Support**: REST, WebSocket, GraphQL, and SSE
- 📁 **Collection Management**: Organize requests into collections and folders
- 🌍 **Environment Variables**: Manage variables across different environments
- 🔐 **Authentication**: Support for Basic, Bearer, API Key, and OAuth2
- ☁️ **Cloud Sync**: Sync your data across devices (Pro feature)
- 🔒 **Offline-First**: Works without internet, syncs when online
- 🎨 **Beautiful UI**: Modern dark theme with customizable options
- 📥 **Import/Export**: Import from Postman, OpenAPI, and cURL
- 🖥️ **Cross-Platform**: Available for macOS, Windows, and Linux

## Tech Stack

- **Framework**: Electron 28+
- **Frontend**: React 18+ with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Local Database**: better-sqlite3
- **Cloud Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Payments**: Stripe + CoinPayPortal
- **Build Tool**: Vite
- **Testing**: Vitest + Playwright

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm 8+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/wiresniff/wiresniff-desktop.git
cd wiresniff-desktop
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your Supabase and Stripe credentials.

4. Start the development server:
```bash
pnpm dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm build:mac` | Build for macOS |
| `pnpm build:win` | Build for Windows |
| `pnpm build:linux` | Build for Linux |

## Project Structure

```
wiresniff-desktop/
├── build/                  # Build resources (icons, entitlements)
├── electron/               # Electron main process
│   ├── main/              # Main process code
│   └── preload/           # Preload scripts
├── src/                    # React application source
│   ├── components/        # React components
│   │   ├── common/       # Shared components
│   │   ├── layout/       # Layout components
│   │   ├── request/      # Request builder components
│   │   └── response/     # Response viewer components
│   ├── pages/            # Page components
│   ├── providers/        # React context providers
│   ├── services/         # Business logic services
│   ├── stores/           # Zustand stores
│   ├── styles/           # Global styles
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── plans/                 # Architecture documentation
├── resources/             # Application resources
└── scripts/               # Build scripts
```

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Stripe secret key (server-side only) |

### Supabase Setup

1. Create a new Supabase project
2. Run the database migrations in `supabase/migrations/`
3. Enable Google and GitHub OAuth providers
4. Configure redirect URLs for OAuth

### Stripe Setup

1. Create a Stripe account
2. Set up products and prices for subscription tiers
3. Configure webhook endpoints

## Development

### Code Style

- ESLint for linting
- Prettier for formatting
- TypeScript strict mode enabled

### Testing

- **Unit Tests**: Vitest with React Testing Library
- **E2E Tests**: Playwright

### Building

The application is built using Electron Builder with support for:
- macOS: DMG, ZIP (x64, arm64)
- Windows: NSIS installer, Portable (x64, arm64)
- Linux: AppImage, DEB, RPM (x64, arm64)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

This project is proprietary software. All rights reserved.

## Support

- Documentation: [https://wiresniff.com/docs](https://wiresniff.com/docs)
- Issues: [GitHub Issues](https://github.com/wiresniff/wiresniff-desktop/issues)
- Email: support@wiresniff.com

---

Built with ❤️ by the WireSniff Team
