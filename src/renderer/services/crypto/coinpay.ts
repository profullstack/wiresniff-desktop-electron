/**
 * CoinPayPortal Integration
 * 
 * This module provides cryptocurrency payment support via CoinPayPortal.
 */

import { supabase } from '../supabase/client';

// Environment variables for CoinPayPortal configuration
const COINPAY_MERCHANT_ID = import.meta.env.VITE_COINPAY_MERCHANT_ID || '';
const COINPAY_API_KEY = import.meta.env.VITE_COINPAY_API_KEY || '';

// Validate configuration
if (!COINPAY_MERCHANT_ID || !COINPAY_API_KEY) {
  console.warn('[CoinPayPortal] Missing configuration. Crypto payment features will be disabled.');
}

/**
 * Check if CoinPayPortal is configured
 */
export function isCoinPayConfigured(): boolean {
  return Boolean(COINPAY_MERCHANT_ID && COINPAY_API_KEY);
}

// Supported cryptocurrencies
export type CryptoCurrency = 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'LTC' | 'SOL' | 'MATIC';

export interface CryptoPaymentOption {
  currency: CryptoCurrency;
  name: string;
  icon: string;
  network?: string;
  minAmount: number;
}

// Available crypto payment options
export const CRYPTO_PAYMENT_OPTIONS: CryptoPaymentOption[] = [
  { currency: 'BTC', name: 'Bitcoin', icon: '₿', minAmount: 0.0001 },
  { currency: 'ETH', name: 'Ethereum', icon: 'Ξ', minAmount: 0.001 },
  { currency: 'USDT', name: 'Tether (ERC-20)', icon: '₮', network: 'ERC-20', minAmount: 1 },
  { currency: 'USDC', name: 'USD Coin', icon: '$', network: 'ERC-20', minAmount: 1 },
  { currency: 'LTC', name: 'Litecoin', icon: 'Ł', minAmount: 0.01 },
  { currency: 'SOL', name: 'Solana', icon: '◎', minAmount: 0.01 },
  { currency: 'MATIC', name: 'Polygon', icon: '⬡', minAmount: 1 },
];

export interface CryptoPaymentRequest {
  userId: string;
  planId: string;
  billingPeriod: 'monthly' | 'yearly';
  currency: CryptoCurrency;
  amount: number;
  email: string;
}

export interface CryptoPaymentResponse {
  paymentId: string;
  address: string;
  amount: number;
  currency: CryptoCurrency;
  expiresAt: string;
  qrCode: string;
  status: 'pending' | 'confirming' | 'completed' | 'expired' | 'failed';
}

/**
 * Create a crypto payment request
 */
export async function createCryptoPayment(
  request: CryptoPaymentRequest
): Promise<{ payment: CryptoPaymentResponse | null; error?: string }> {
  if (!isCoinPayConfigured()) {
    return { payment: null, error: 'Crypto payments are not configured' };
  }

  try {
    // Call Supabase Edge Function to create crypto payment
    const { data, error } = await supabase.functions.invoke('create-crypto-payment', {
      body: {
        merchantId: COINPAY_MERCHANT_ID,
        ...request,
      },
    });

    if (error) {
      console.error('Failed to create crypto payment:', error);
      return { payment: null, error: error.message };
    }

    return {
      payment: {
        paymentId: data.paymentId,
        address: data.address,
        amount: data.amount,
        currency: data.currency,
        expiresAt: data.expiresAt,
        qrCode: data.qrCode,
        status: data.status,
      },
    };
  } catch (err) {
    console.error('Crypto payment error:', err);
    return { payment: null, error: err instanceof Error ? err.message : 'Failed to create payment' };
  }
}

/**
 * Check payment status
 */
export async function checkPaymentStatus(
  paymentId: string
): Promise<{ status: CryptoPaymentResponse['status']; error?: string }> {
  if (!isCoinPayConfigured()) {
    return { status: 'failed', error: 'Crypto payments are not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('check-crypto-payment', {
      body: { paymentId },
    });

    if (error) {
      return { status: 'failed', error: error.message };
    }

    return { status: data.status };
  } catch (err) {
    console.error('Check payment status error:', err);
    return { status: 'failed', error: err instanceof Error ? err.message : 'Failed to check status' };
  }
}

/**
 * Get payment details
 */
export async function getPaymentDetails(
  paymentId: string
): Promise<{ payment: CryptoPaymentResponse | null; error?: string }> {
  if (!isCoinPayConfigured()) {
    return { payment: null, error: 'Crypto payments are not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('get-crypto-payment', {
      body: { paymentId },
    });

    if (error) {
      return { payment: null, error: error.message };
    }

    return { payment: data };
  } catch (err) {
    console.error('Get payment details error:', err);
    return { payment: null, error: err instanceof Error ? err.message : 'Failed to get payment' };
  }
}

/**
 * Cancel a pending payment
 */
export async function cancelPayment(
  paymentId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isCoinPayConfigured()) {
    return { success: false, error: 'Crypto payments are not configured' };
  }

  try {
    const { error } = await supabase.functions.invoke('cancel-crypto-payment', {
      body: { paymentId },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Cancel payment error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to cancel payment' };
  }
}

/**
 * Get user's crypto payment history
 */
export async function getPaymentHistory(
  userId: string
): Promise<{
  payments: Array<{
    id: string;
    planId: string;
    currency: CryptoCurrency;
    amount: number;
    status: CryptoPaymentResponse['status'];
    createdAt: string;
    completedAt: string | null;
  }>;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('crypto_payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return { payments: [], error: error.message };
    }

    return {
      payments: data.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        planId: p.plan_id as string,
        currency: p.currency as CryptoCurrency,
        amount: p.amount as number,
        status: p.status as CryptoPaymentResponse['status'],
        createdAt: p.created_at as string,
        completedAt: p.completed_at as string | null,
      })),
    };
  } catch (err) {
    console.error('Get payment history error:', err);
    return { payments: [], error: err instanceof Error ? err.message : 'Failed to get history' };
  }
}

/**
 * Convert USD to crypto amount
 */
export async function convertUsdToCrypto(
  usdAmount: number,
  currency: CryptoCurrency
): Promise<{ amount: number; rate: number; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('convert-crypto-rate', {
      body: { usdAmount, currency },
    });

    if (error) {
      return { amount: 0, rate: 0, error: error.message };
    }

    return { amount: data.amount, rate: data.rate };
  } catch (err) {
    console.error('Convert rate error:', err);
    return { amount: 0, rate: 0, error: err instanceof Error ? err.message : 'Failed to convert' };
  }
}

/**
 * Verify a completed payment and activate subscription
 */
export async function verifyAndActivateSubscription(
  paymentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('verify-crypto-subscription', {
      body: { paymentId, userId },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Verify subscription error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to verify' };
  }
}