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
  getLimit: (limitName: keyof typeof TIER_LIMITS['free']) => number;
  isWithinLimit: (limitName: keyof typeof TIER_LIMITS['free'], currentCount: number) => boolean;
  isSubscribed: () => boolean;
  isPro: () => boolean;
  isTeam: () => boolean;
  isEnterprise: () => boolean;
  
  // Feature-specific helpers
  canUseAI: () => boolean;
  canUseCloudSync: () => boolean;
  canUseTeamFeatures: () => boolean;
  canUseSecretsVault: () => boolean;
  canUseAdvancedProtocols: () => boolean;
}

// Feature access by tier
// Based on the pricing model:
// - Free (OSS): Local-only, unlimited captures, replay, no cloud
// - Pro ($10-15/mo): Cloud sync, saved history, AI insights, private workspaces
// - Team ($20-30/user/mo): Shared workspaces, role-based access, audit logs, priority support
// - Enterprise: SSO, on-premise, SLA, custom integrations
const TIER_FEATURES: Record<PricingTier, string[]> = {
  free: [
    // Core local features (always available)
    'local_storage',
    'basic_requests',
    'limited_history',
    'limited_collections',
    'limited_environments',
    
    // Feature 1: Request Capture → Replay → Diff (local only)
    'capture_traffic',
    'replay_requests',
    'diff_responses',
    
    // Feature 6: Live Traffic Watch (local only)
    'live_traffic_watch',
    'traffic_filtering',
    
    // Feature 7: Protocol Support (basic)
    'websocket',
    'graphql',
    'sse',
    
    // Feature 8: Import (local only)
    'import_postman',
    'import_insomnia',
    'import_openapi',
    'import_curl',
  ],
  pro: [
    // All free features
    'local_storage',
    'basic_requests',
    'unlimited_history',
    'unlimited_collections',
    'unlimited_environments',
    
    // Feature 1: Request Capture → Replay → Diff (with cloud)
    'capture_traffic',
    'replay_requests',
    'diff_responses',
    'save_captures_cloud',
    'cross_machine_replay',
    'capture_history_timeline',
    
    // Feature 3: Environment Timeline / Drift Detection
    'env_timeline',
    'env_snapshots',
    'drift_detection',
    'config_rollback',
    
    // Feature 4: AI Features
    'ai_capture_explainer',
    'ai_diff_explainer',
    'ai_test_generator',
    'ai_auth_flow_detection',
    'ai_jwt_decoding',
    
    // Feature 5: Secrets Vault
    'secrets_vault',
    'encrypted_env_secrets',
    'per_workspace_secrets',
    
    // Feature 6: Live Traffic Watch (with cloud)
    'live_traffic_watch',
    'traffic_filtering',
    'save_traffic_sessions',
    'export_traffic_sessions',
    
    // Feature 7: Protocol Support (full)
    'websocket',
    'websocket_frame_analysis',
    'graphql',
    'graphql_introspection',
    'sse',
    'grpc',
    'grpc_reflection',
    'raw_tcp',
    
    // Feature 8: Import/Export (full)
    'import_postman',
    'import_insomnia',
    'import_openapi',
    'import_curl',
    'import_har',
    'export_collections',
    'export_environments',
    
    // Cloud features
    'cloud_sync',
    'private_workspaces',
  ],
  team: [
    // All pro features
    'local_storage',
    'basic_requests',
    'unlimited_history',
    'unlimited_collections',
    'unlimited_environments',
    
    // Feature 1: Request Capture → Replay → Diff (team)
    'capture_traffic',
    'replay_requests',
    'diff_responses',
    'save_captures_cloud',
    'cross_machine_replay',
    'capture_history_timeline',
    'shared_captures',
    
    // Feature 2: Team Workspaces
    'team_workspaces',
    'shared_collections',
    'shared_env_vars',
    'shared_capture_sessions',
    'role_based_access',
    'viewer_role',
    'editor_role',
    'admin_role',
    'invite_via_email',
    'org_billing',
    
    // Feature 3: Environment Timeline / Drift Detection (team)
    'env_timeline',
    'env_snapshots',
    'drift_detection',
    'config_rollback',
    'env_audit_history',
    
    // Feature 4: AI Features (team)
    'ai_capture_explainer',
    'ai_diff_explainer',
    'ai_test_generator',
    'ai_auth_flow_detection',
    'ai_jwt_decoding',
    'ai_team_shared_insights',
    
    // Feature 5: Secrets Vault (team)
    'secrets_vault',
    'encrypted_env_secrets',
    'per_workspace_secrets',
    'team_secrets_sharing',
    
    // Feature 6: Live Traffic Watch (team)
    'live_traffic_watch',
    'traffic_filtering',
    'save_traffic_sessions',
    'export_traffic_sessions',
    'share_traffic_sessions',
    'team_traffic_debugging',
    
    // Feature 7: Protocol Support (team)
    'websocket',
    'websocket_frame_analysis',
    'graphql',
    'graphql_introspection',
    'sse',
    'grpc',
    'grpc_reflection',
    'raw_tcp',
    'saved_protocol_streams',
    'ai_ws_frame_explainer',
    
    // Feature 8: Import/Export (team)
    'import_postman',
    'import_insomnia',
    'import_openapi',
    'import_curl',
    'import_har',
    'export_collections',
    'export_environments',
    'team_import_history',
    
    // Cloud features
    'cloud_sync',
    'private_workspaces',
    'team_activity_logs',
    'collaboration',
    'priority_support',
  ],
  enterprise: [
    // All team features
    'local_storage',
    'basic_requests',
    'unlimited_history',
    'unlimited_collections',
    'unlimited_environments',
    
    // Feature 1: Request Capture → Replay → Diff (enterprise)
    'capture_traffic',
    'replay_requests',
    'diff_responses',
    'save_captures_cloud',
    'cross_machine_replay',
    'capture_history_timeline',
    'shared_captures',
    'capture_compliance_audit',
    
    // Feature 2: Team Workspaces (enterprise)
    'team_workspaces',
    'shared_collections',
    'shared_env_vars',
    'shared_capture_sessions',
    'role_based_access',
    'viewer_role',
    'editor_role',
    'admin_role',
    'invite_via_email',
    'org_billing',
    'custom_roles',
    'workspace_templates',
    
    // Feature 3: Environment Timeline / Drift Detection (enterprise)
    'env_timeline',
    'env_snapshots',
    'drift_detection',
    'config_rollback',
    'env_audit_history',
    'compliance_reporting',
    
    // Feature 4: AI Features (enterprise)
    'ai_capture_explainer',
    'ai_diff_explainer',
    'ai_test_generator',
    'ai_auth_flow_detection',
    'ai_jwt_decoding',
    'ai_team_shared_insights',
    'ai_custom_models',
    'ai_on_premise',
    
    // Feature 5: Secrets Vault (enterprise)
    'secrets_vault',
    'encrypted_env_secrets',
    'per_workspace_secrets',
    'team_secrets_sharing',
    'secrets_rotation',
    'secrets_audit_log',
    'external_vault_integration',
    
    // Feature 6: Live Traffic Watch (enterprise)
    'live_traffic_watch',
    'traffic_filtering',
    'save_traffic_sessions',
    'export_traffic_sessions',
    'share_traffic_sessions',
    'team_traffic_debugging',
    'traffic_compliance_audit',
    
    // Feature 7: Protocol Support (enterprise)
    'websocket',
    'websocket_frame_analysis',
    'graphql',
    'graphql_introspection',
    'sse',
    'grpc',
    'grpc_reflection',
    'raw_tcp',
    'saved_protocol_streams',
    'ai_ws_frame_explainer',
    'custom_protocol_plugins',
    
    // Feature 8: Import/Export (enterprise)
    'import_postman',
    'import_insomnia',
    'import_openapi',
    'import_curl',
    'import_har',
    'export_collections',
    'export_environments',
    'team_import_history',
    'bulk_import',
    'automated_sync',
    
    // Cloud features
    'cloud_sync',
    'private_workspaces',
    'team_activity_logs',
    'collaboration',
    'priority_support',
    
    // Enterprise-only
    'sso',
    'saml',
    'scim',
    'audit_logs',
    'custom_integrations',
    'dedicated_support',
    'sla',
    'on_premise',
    'data_residency',
    'custom_branding',
  ],
};

// Feature limits by tier
export const TIER_LIMITS: Record<PricingTier, {
  maxCollections: number;
  maxEnvironments: number;
  maxHistoryDays: number;
  maxTeamMembers: number;
  maxCaptureSessions: number;
  maxTrafficSessions: number;
  maxSecretsPerWorkspace: number;
  aiRequestsPerMonth: number;
}> = {
  free: {
    maxCollections: 5,
    maxEnvironments: 3,
    maxHistoryDays: 7,
    maxTeamMembers: 1,
    maxCaptureSessions: 10,
    maxTrafficSessions: 5,
    maxSecretsPerWorkspace: 0,
    aiRequestsPerMonth: 0,
  },
  pro: {
    maxCollections: -1, // unlimited
    maxEnvironments: -1,
    maxHistoryDays: 365,
    maxTeamMembers: 1,
    maxCaptureSessions: -1,
    maxTrafficSessions: -1,
    maxSecretsPerWorkspace: 100,
    aiRequestsPerMonth: 1000,
  },
  team: {
    maxCollections: -1,
    maxEnvironments: -1,
    maxHistoryDays: -1, // unlimited
    maxTeamMembers: 50,
    maxCaptureSessions: -1,
    maxTrafficSessions: -1,
    maxSecretsPerWorkspace: 500,
    aiRequestsPerMonth: 10000,
  },
  enterprise: {
    maxCollections: -1,
    maxEnvironments: -1,
    maxHistoryDays: -1,
    maxTeamMembers: -1, // unlimited
    maxCaptureSessions: -1,
    maxTrafficSessions: -1,
    maxSecretsPerWorkspace: -1,
    aiRequestsPerMonth: -1, // unlimited
  },
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

      // Get a specific limit value
      getLimit: (limitName: keyof typeof TIER_LIMITS['free']) => {
        const { subscription } = get();
        const tier = subscription?.tier || 'free';
        return TIER_LIMITS[tier][limitName];
      },

      // Check if current usage is within limit
      isWithinLimit: (limitName: keyof typeof TIER_LIMITS['free'], currentCount: number) => {
        const { subscription } = get();
        const tier = subscription?.tier || 'free';
        const limit = TIER_LIMITS[tier][limitName];
        // -1 means unlimited
        return limit === -1 || currentCount < limit;
      },

      // Feature-specific helpers for common checks
      canUseAI: () => {
        const { subscription } = get();
        const tier = subscription?.tier || 'free';
        return TIER_FEATURES[tier]?.includes('ai_capture_explainer') || false;
      },

      canUseCloudSync: () => {
        const { subscription } = get();
        const tier = subscription?.tier || 'free';
        return TIER_FEATURES[tier]?.includes('cloud_sync') || false;
      },

      canUseTeamFeatures: () => {
        const { subscription } = get();
        const tier = subscription?.tier || 'free';
        return TIER_FEATURES[tier]?.includes('team_workspaces') || false;
      },

      canUseSecretsVault: () => {
        const { subscription } = get();
        const tier = subscription?.tier || 'free';
        return TIER_FEATURES[tier]?.includes('secrets_vault') || false;
      },

      canUseAdvancedProtocols: () => {
        const { subscription } = get();
        const tier = subscription?.tier || 'free';
        return TIER_FEATURES[tier]?.includes('grpc') || false;
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

// Export pricing plans and features for use in components
export { PRICING_PLANS, TIER_FEATURES };
export type { PricingPlan, PricingTier };

// Helper function to get all features for a tier (useful for feature comparison)
export const getFeaturesForTier = (tier: PricingTier): string[] => {
  return TIER_FEATURES[tier] || [];
};

// Helper function to check if a feature requires upgrade
export const getRequiredTierForFeature = (feature: string): PricingTier | null => {
  const tiers: PricingTier[] = ['free', 'pro', 'team', 'enterprise'];
  for (const tier of tiers) {
    if (TIER_FEATURES[tier]?.includes(feature)) {
      return tier;
    }
  }
  return null;
};

// Helper function to get upgrade message for a feature
export const getUpgradeMessage = (feature: string, currentTier: PricingTier): string | null => {
  const requiredTier = getRequiredTierForFeature(feature);
  if (!requiredTier) return null;
  
  const tierOrder: PricingTier[] = ['free', 'pro', 'team', 'enterprise'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const requiredIndex = tierOrder.indexOf(requiredTier);
  
  if (currentIndex >= requiredIndex) return null;
  
  const tierNames: Record<PricingTier, string> = {
    free: 'Free',
    pro: 'Pro',
    team: 'Team',
    enterprise: 'Enterprise',
  };
  
  return `Upgrade to ${tierNames[requiredTier]} to access this feature`;
};