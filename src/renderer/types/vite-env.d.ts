/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  
  // Stripe
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_STRIPE_PRO_MONTHLY_PRICE_ID: string;
  readonly VITE_STRIPE_PRO_YEARLY_PRICE_ID: string;
  readonly VITE_STRIPE_TEAM_MONTHLY_PRICE_ID: string;
  readonly VITE_STRIPE_TEAM_YEARLY_PRICE_ID: string;
  readonly VITE_STRIPE_ENTERPRISE_MONTHLY_PRICE_ID: string;
  readonly VITE_STRIPE_ENTERPRISE_YEARLY_PRICE_ID: string;
  
  // CoinPayPortal (Crypto payments)
  readonly VITE_COINPAY_MERCHANT_ID: string;
  readonly VITE_COINPAY_API_KEY: string;
  
  // App info
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_NAME: string;
  
  // Vite built-ins
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly hot?: {
    accept: () => void;
    dispose: (callback: () => void) => void;
    invalidate: () => void;
    on: (event: string, callback: () => void) => void;
  };
}

// Electron API exposed via preload script
interface ElectronAPI {
  // IPC invoke for async communication
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
  
  // IPC send for one-way communication
  send: (channel: string, ...args: unknown[]) => void;
  
  // IPC on for receiving messages
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  
  // IPC off for removing listeners
  off: (channel: string, callback: (...args: unknown[]) => void) => void;
  
  // Platform info
  platform: NodeJS.Platform;
  
  // App version
  version: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}