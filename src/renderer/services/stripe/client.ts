/**
 * Stripe Client Configuration
 * 
 * This module provides Stripe integration for subscription management.
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { supabase } from '../supabase/client';

// Environment variables for Stripe configuration
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// Validate configuration
if (!STRIPE_PUBLISHABLE_KEY) {
  console.warn('[Stripe] Missing publishable key. Payment features will be disabled.');
}

// Stripe instance (lazy loaded)
let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Get the Stripe instance
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise && STRIPE_PUBLISHABLE_KEY) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise || Promise.resolve(null);
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return Boolean(STRIPE_PUBLISHABLE_KEY);
}

// Subscription tier types
export type PricingTier = 'free' | 'pro' | 'team' | 'enterprise';

export interface PricingPlan {
  id: string;
  name: string;
  tier: PricingTier;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  popular?: boolean;
}

// Pricing plans configuration
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tier: 'free',
    description: 'For individual developers getting started',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Local storage only',
      'Basic HTTP requests',
      '100 history items',
      '3 collections',
      '2 environments',
      'Community support',
    ],
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
  },
  {
    id: 'pro',
    name: 'Pro',
    tier: 'pro',
    description: 'For professional developers',
    monthlyPrice: 12,
    yearlyPrice: 120,
    features: [
      'Everything in Free',
      'Cloud sync',
      'Unlimited history',
      'Unlimited collections',
      'Unlimited environments',
      'Import/Export',
      'WebSocket support',
      'GraphQL support',
      'SSE support',
      'Priority support',
    ],
    stripePriceIdMonthly: import.meta.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID || '',
    stripePriceIdYearly: import.meta.env.VITE_STRIPE_PRO_YEARLY_PRICE_ID || '',
    popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    tier: 'team',
    description: 'For teams collaborating on APIs',
    monthlyPrice: 29,
    yearlyPrice: 290,
    features: [
      'Everything in Pro',
      'Team workspaces',
      'Shared collections',
      'Role-based access',
      'Team activity logs',
      'Collaboration features',
      'Admin dashboard',
    ],
    stripePriceIdMonthly: import.meta.env.VITE_STRIPE_TEAM_MONTHLY_PRICE_ID || '',
    stripePriceIdYearly: import.meta.env.VITE_STRIPE_TEAM_YEARLY_PRICE_ID || '',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 'enterprise',
    description: 'For large organizations',
    monthlyPrice: 99,
    yearlyPrice: 990,
    features: [
      'Everything in Team',
      'SSO/SAML',
      'Audit logs',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
      'On-premise option',
    ],
    stripePriceIdMonthly: import.meta.env.VITE_STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || '',
    stripePriceIdYearly: import.meta.env.VITE_STRIPE_ENTERPRISE_YEARLY_PRICE_ID || '',
  },
];

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(
  priceId: string,
  userId: string,
  successUrl: string = `${window.location.origin}/settings/billing?success=true`,
  cancelUrl: string = `${window.location.origin}/settings/billing?canceled=true`
): Promise<{ sessionId: string; url: string } | { error: string }> {
  if (!isStripeConfigured()) {
    return { error: 'Stripe is not configured' };
  }

  try {
    // Call Supabase Edge Function to create checkout session
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        priceId,
        userId,
        successUrl,
        cancelUrl,
      },
    });

    if (error) {
      console.error('Failed to create checkout session:', error);
      return { error: error.message };
    }

    return { sessionId: data.sessionId, url: data.url };
  } catch (err) {
    console.error('Checkout session error:', err);
    return { error: err instanceof Error ? err.message : 'Failed to create checkout session' };
  }
}

/**
 * Redirect to Stripe checkout
 */
export async function redirectToCheckout(priceId: string, userId: string): Promise<{ error?: string }> {
  const result = await createCheckoutSession(priceId, userId);
  
  if ('error' in result) {
    return { error: result.error };
  }

  // Redirect to Stripe checkout
  window.location.href = result.url;
  return {};
}

/**
 * Create a billing portal session
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string = `${window.location.origin}/settings/billing`
): Promise<{ url: string } | { error: string }> {
  if (!isStripeConfigured()) {
    return { error: 'Stripe is not configured' };
  }

  try {
    // Call Supabase Edge Function to create portal session
    const { data, error } = await supabase.functions.invoke('create-portal-session', {
      body: {
        customerId,
        returnUrl,
      },
    });

    if (error) {
      console.error('Failed to create portal session:', error);
      return { error: error.message };
    }

    return { url: data.url };
  } catch (err) {
    console.error('Portal session error:', err);
    return { error: err instanceof Error ? err.message : 'Failed to create portal session' };
  }
}

/**
 * Redirect to Stripe billing portal
 */
export async function redirectToBillingPortal(customerId: string): Promise<{ error?: string }> {
  const result = await createBillingPortalSession(customerId);
  
  if ('error' in result) {
    return { error: result.error };
  }

  // Redirect to Stripe billing portal
  window.location.href = result.url;
  return {};
}

/**
 * Get subscription status for a user
 */
export async function getSubscriptionStatus(userId: string): Promise<{
  subscription: {
    id: string;
    status: string;
    tier: PricingTier;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string;
  } | null;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No subscription found
        return { subscription: null };
      }
      return { subscription: null, error: error.message };
    }

    return {
      subscription: {
        id: data.id,
        status: data.status,
        tier: data.tier as PricingTier,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        stripeCustomerId: data.stripe_customer_id,
      },
    };
  } catch (err) {
    console.error('Get subscription error:', err);
    return { subscription: null, error: err instanceof Error ? err.message : 'Failed to get subscription' };
  }
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('cancel-subscription', {
      body: { subscriptionId },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Cancel subscription error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to cancel subscription' };
  }
}

/**
 * Resume a canceled subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('resume-subscription', {
      body: { subscriptionId },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Resume subscription error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to resume subscription' };
  }
}

/**
 * Get invoices for a customer
 */
export async function getInvoices(customerId: string): Promise<{
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    amount: number;
    currency: string;
    created: string;
    pdfUrl: string;
  }>;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('get-invoices', {
      body: { customerId },
    });

    if (error) {
      return { invoices: [], error: error.message };
    }

    return { invoices: data.invoices };
  } catch (err) {
    console.error('Get invoices error:', err);
    return { invoices: [], error: err instanceof Error ? err.message : 'Failed to get invoices' };
  }
}