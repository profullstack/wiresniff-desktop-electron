import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { 
  getSubscriptionStatus, 
  redirectToCheckout, 
  redirectToBillingPortal,
  cancelSubscription,
  resumeSubscription,
  getInvoices,
  PRICING_PLANS,
  type PricingTier,
  type PricingPlan,
} from '../services/stripe/client';
import {
  createCryptoPayment,
  checkPaymentStatus,
  getPaymentHistory,
  convertUsdToCrypto,
  type CryptoCurrency,
  type CryptoPaymentResponse,
} from '../services/crypto/coinpay';

export interface SubscriptionState {
  // State
  subscription: {
    id: string;
    status: string;
    tier: PricingTier;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string;
  } | null;
  isLoading: boolean;
  error: string | null;
  
  // Crypto payment state
  pendingCryptoPayment: CryptoPaymentResponse | null;
  
  // Actions
  fetchSubscription: (userId: string) => Promise<void>;
  subscribe: (priceId: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  subscribeCrypto: (
    userId: string,
    planId: string,
    billingPeriod: 'monthly' | 'yearly',
    currency: CryptoCurrency,
    email: string
  ) => Promise<{ success: boolean; payment?: CryptoPaymentResponse; error?: string }>;
  checkCryptoPayment: (paymentId: string) => Promise<CryptoPaymentResponse['status']>;
  openBillingPortal: (customerId: string) => Promise<{ success: boolean; error?: string }>;
  cancelCurrentSubscription: () => Promise<{ success: boolean; error?: string }>;
  resumeCurrentSubscription: () => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  clearPendingPayment: () => void;
  
  // Helpers
  getCurrentPlan: () => PricingPlan;
  canAccessFeature: (feature: string) => boolean;
  isSubscribed: () => boolean;
  isPro: () => boolean;
  isTeam: () => boolean;
  isEnterprise: () => boolean;
}

// Feature access by tier
const TIER_FEATURES: Record<PricingTier, string[]> = {
  free: [
    'local_storage',
    'basic_requests',
    'limited_history',
    'limited_collections',
    'limited_environments',
  ],
  pro: [
    'local_storage',
    'basic_requests',
    'unlimited_history',
    'unlimited_collections',
    'unlimited_environments',
    'cloud_sync',
    'import_export',
    'websocket',
    'graphql',
    'sse',
  ],
  team: [
    'local_storage',
    'basic_requests',
    'unlimited_history',
    'unlimited_collections',
    'unlimited_environments',
    'cloud_sync',
    'import_export',
    'websocket',
    'graphql',
    'sse',
    'team_workspaces',
    'shared_collections',
    'role_based_access',
    'team_activity_logs',
    'collaboration',
  ],
  enterprise: [
    'local_storage',
    'basic_requests',
    'unlimited_history',
    'unlimited_collections',
    'unlimited_environments',
    'cloud_sync',
    'import_export',
    'websocket',
    'graphql',
    'sse',
    'team_workspaces',
    'shared_collections',
    'role_based_access',
    'team_activity_logs',
    'collaboration',
    'sso',
    'audit_logs',
    'custom_integrations',
    'dedicated_support',
    'sla',
    'on_premise',
  ],
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      // Initial state
      subscription: null,
      isLoading: false,
      error: null,
      pendingCryptoPayment: null,

      // Fetch subscription status
      fetchSubscription: async (userId: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const { subscription, error } = await getSubscriptionStatus(userId);
          
          if (error) {
            set({ isLoading: false, error });
            return;
          }
          
          set({ subscription, isLoading: false });
        } catch (err) {
          set({ 
            isLoading: false, 
            error: err instanceof Error ? err.message : 'Failed to fetch subscription' 
          });
        }
      },

      // Subscribe with Stripe
      subscribe: async (priceId: string, userId: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const result = await redirectToCheckout(priceId, userId);
          
          if (result.error) {
            set({ isLoading: false, error: result.error });
            return { success: false, error: result.error };
          }
          
          // Redirect happens, so we don't set loading to false
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Subscription failed';
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      // Subscribe with crypto
      subscribeCrypto: async (
        userId: string,
        planId: string,
        billingPeriod: 'monthly' | 'yearly',
        currency: CryptoCurrency,
        email: string
      ) => {
        try {
          set({ isLoading: true, error: null });
          
          // Get the plan price
          const plan = PRICING_PLANS.find(p => p.id === planId);
          if (!plan) {
            set({ isLoading: false, error: 'Invalid plan' });
            return { success: false, error: 'Invalid plan' };
          }
          
          const usdAmount = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
          
          // Convert to crypto
          const { amount, error: convertError } = await convertUsdToCrypto(usdAmount, currency);
          if (convertError) {
            set({ isLoading: false, error: convertError });
            return { success: false, error: convertError };
          }
          
          // Create payment
          const { payment, error } = await createCryptoPayment({
            userId,
            planId,
            billingPeriod,
            currency,
            amount,
            email,
          });
          
          if (error || !payment) {
            set({ isLoading: false, error: error || 'Failed to create payment' });
            return { success: false, error: error || 'Failed to create payment' };
          }
          
          set({ pendingCryptoPayment: payment, isLoading: false });
          return { success: true, payment };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Crypto payment failed';
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      // Check crypto payment status
      checkCryptoPayment: async (paymentId: string) => {
        const { status } = await checkPaymentStatus(paymentId);
        
        // Update pending payment status
        const { pendingCryptoPayment } = get();
        if (pendingCryptoPayment && pendingCryptoPayment.paymentId === paymentId) {
          set({ pendingCryptoPayment: { ...pendingCryptoPayment, status } });
        }
        
        return status;
      },

      // Open billing portal
      openBillingPortal: async (customerId: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const result = await redirectToBillingPortal(customerId);
          
          if (result.error) {
            set({ isLoading: false, error: result.error });
            return { success: false, error: result.error };
          }
          
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to open billing portal';
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      // Cancel subscription
      cancelCurrentSubscription: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const { subscription } = get();
          if (!subscription) {
            set({ isLoading: false, error: 'No active subscription' });
            return { success: false, error: 'No active subscription' };
          }
          
          const { success, error } = await cancelSubscription(subscription.id);
          
          if (!success) {
            set({ isLoading: false, error: error || 'Failed to cancel' });
            return { success: false, error };
          }
          
          // Update local state
          set({ 
            subscription: { ...subscription, cancelAtPeriodEnd: true },
            isLoading: false 
          });
          
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to cancel subscription';
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      // Resume subscription
      resumeCurrentSubscription: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const { subscription } = get();
          if (!subscription) {
            set({ isLoading: false, error: 'No subscription to resume' });
            return { success: false, error: 'No subscription to resume' };
          }
          
          const { success, error } = await resumeSubscription(subscription.id);
          
          if (!success) {
            set({ isLoading: false, error: error || 'Failed to resume' });
            return { success: false, error };
          }
          
          // Update local state
          set({ 
            subscription: { ...subscription, cancelAtPeriodEnd: false },
            isLoading: false 
          });
          
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to resume subscription';
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Clear pending payment
      clearPendingPayment: () => set({ pendingCryptoPayment: null }),

      // Get current plan
      getCurrentPlan: () => {
        const { subscription } = get();
        const tier = subscription?.tier || 'free';
        return PRICING_PLANS.find(p => p.tier === tier) || PRICING_PLANS[0];
      },

      // Check feature access
      canAccessFeature: (feature: string) => {
        const { subscription } = get();
        const tier = subscription?.tier || 'free';
        return TIER_FEATURES[tier]?.includes(feature) || false;
      },

      // Check if subscribed (any paid tier)
      isSubscribed: () => {
        const { subscription } = get();
        return subscription?.status === 'active' && subscription?.tier !== 'free';
      },

      // Check specific tiers
      isPro: () => {
        const { subscription } = get();
        return ['pro', 'team', 'enterprise'].includes(subscription?.tier || '');
      },

      isTeam: () => {
        const { subscription } = get();
        return ['team', 'enterprise'].includes(subscription?.tier || '');
      },

      isEnterprise: () => {
        const { subscription } = get();
        return subscription?.tier === 'enterprise';
      },
    }),
    {
      name: 'wiresniff-subscription',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        subscription: state.subscription,
      }),
    }
  )
);

// Export pricing plans for use in components
export { PRICING_PLANS };
export type { PricingPlan, PricingTier };