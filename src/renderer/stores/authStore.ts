import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Session } from '../services/supabase/client';
import {
  supabase,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  signInWithOAuth,
  resetPassword,
  updatePassword,
  getCurrentSession,
  getCurrentUser,
  onAuthStateChange
} from '../services/supabase/client';

// Subscription tier types
export type SubscriptionTier = 'free' | 'pro' | 'team' | 'enterprise';

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  features: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  subscription: SubscriptionInfo;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  // State
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithGitHub: () => Promise<{ success: boolean; error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshSession: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  
  // Subscription helpers
  hasFeature: (feature: string) => boolean;
  canSync: () => boolean;
  isProOrHigher: () => boolean;
}

// Default subscription for free tier
const defaultSubscription: SubscriptionInfo = {
  tier: 'free',
  status: 'active',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  features: ['local_storage', 'basic_requests', 'limited_history'],
};

// Feature map by tier
const tierFeatures: Record<SubscriptionTier, string[]> = {
  free: ['local_storage', 'basic_requests', 'limited_history'],
  pro: ['local_storage', 'basic_requests', 'unlimited_history', 'cloud_sync', 'environments', 'collections', 'import_export'],
  team: ['local_storage', 'basic_requests', 'unlimited_history', 'cloud_sync', 'environments', 'collections', 'import_export', 'team_sharing', 'collaboration'],
  enterprise: ['local_storage', 'basic_requests', 'unlimited_history', 'cloud_sync', 'environments', 'collections', 'import_export', 'team_sharing', 'collaboration', 'sso', 'audit_logs', 'priority_support'],
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      // Initialize auth state
      initialize: async () => {
        try {
          set({ isLoading: true, error: null });
          
          // Get current session
          const session = await getCurrentSession();
          
          if (session) {
            const user = await getCurrentUser();
            
            if (user) {
              // Fetch user profile from database
              const profile = await fetchUserProfile(user.id);
              set({
                user,
                session,
                profile,
                isLoading: false,
                isInitialized: true
              });
            } else {
              set({ isLoading: false, isInitialized: true });
            }
          } else {
            set({ isLoading: false, isInitialized: true });
          }
          
          // Set up auth state change listener
          onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && session) {
              const user = await getCurrentUser();
              if (user) {
                const profile = await fetchUserProfile(user.id);
                set({ user, session, profile });
              }
            } else if (event === 'SIGNED_OUT') {
              set({ user: null, session: null, profile: null });
            } else if (event === 'TOKEN_REFRESHED' && session) {
              set({ session });
            }
          });
        } catch (err) {
          console.error('Auth initialization error:', err);
          set({
            isLoading: false,
            isInitialized: true,
            error: err instanceof Error ? err.message : 'Failed to initialize auth'
          });
        }
      },

      // Login with email/password
      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const { user, session, error } = await signInWithEmail(email, password);
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }
          
          if (user) {
            const profile = await fetchUserProfile(user.id);
            set({
              user,
              session,
              profile,
              isLoading: false
            });
          }
          
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Login failed';
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      // Register new user
      register: async (email: string, password: string, fullName?: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const { user, session, error } = await signUpWithEmail(email, password, {
            displayName: fullName,
          });
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }
          
          // Note: User may need to confirm email before being fully signed in
          if (user && session) {
            const profile = await fetchUserProfile(user.id);
            set({
              user,
              session,
              profile,
              isLoading: false
            });
          } else {
            set({ isLoading: false });
          }
          
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Registration failed';
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      // Logout
      logout: async () => {
        try {
          set({ isLoading: true, error: null });
          await signOut();
          set({ 
            user: null, 
            session: null, 
            profile: null, 
            isLoading: false 
          });
        } catch (err) {
          console.error('Logout error:', err);
          // Clear state anyway
          set({ 
            user: null, 
            session: null, 
            profile: null, 
            isLoading: false 
          });
        }
      },

      // Login with Google OAuth
      loginWithGoogle: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const { error } = await signInWithOAuth('google');
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }
          
          // OAuth redirects, so we don't set loading to false here
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Google login failed';
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      // Login with GitHub OAuth
      loginWithGitHub: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const { error } = await signInWithOAuth('github');
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }
          
          // OAuth redirects, so we don't set loading to false here
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'GitHub login failed';
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      // Send password reset email
      sendPasswordReset: async (email: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const { error } = await resetPassword(email);
          
          set({ isLoading: false });
          
          if (error) {
            set({ error: error.message });
            return { success: false, error: error.message };
          }
          
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Password reset failed';
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      // Change password
      changePassword: async (newPassword: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const { error } = await updatePassword(newPassword);
          
          set({ isLoading: false });
          
          if (error) {
            set({ error: error.message });
            return { success: false, error: error.message };
          }
          
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Password change failed';
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      // Refresh session
      refreshSession: async () => {
        try {
          const session = await getCurrentSession();
          
          if (session) {
            set({ session });
          }
        } catch (err) {
          console.error('Session refresh error:', err);
        }
      },

      // Update user profile
      updateProfile: async (updates: Partial<UserProfile>) => {
        try {
          set({ isLoading: true, error: null });
          
          const { user } = get();
          if (!user) {
            set({ isLoading: false, error: 'Not authenticated' });
            return { success: false, error: 'Not authenticated' };
          }
          
          const { error } = await supabase
            .from('profiles')
            .update({
              full_name: updates.fullName,
              avatar_url: updates.avatarUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }
          
          // Update local profile
          const { profile } = get();
          if (profile) {
            set({ 
              profile: { ...profile, ...updates },
              isLoading: false 
            });
          }
          
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Profile update failed';
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Check if user has a specific feature
      hasFeature: (feature: string) => {
        const { profile } = get();
        if (!profile) return tierFeatures.free.includes(feature);
        return profile.subscription.features.includes(feature);
      },

      // Check if user can sync to cloud
      canSync: () => {
        const { profile, session } = get();
        if (!session || !profile) return false;
        return profile.subscription.features.includes('cloud_sync');
      },

      // Check if user is pro tier or higher
      isProOrHigher: () => {
        const { profile } = get();
        if (!profile) return false;
        return ['pro', 'team', 'enterprise'].includes(profile.subscription.tier);
      },
    }),
    {
      name: 'wiresniff-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist non-sensitive data
        profile: state.profile,
      }),
    }
  )
);

// Helper function to fetch user profile from database
async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
    
    // Fetch subscription info
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    
    const subscription: SubscriptionInfo = subData ? {
      tier: subData.tier as SubscriptionTier,
      status: subData.status,
      currentPeriodEnd: subData.current_period_end,
      cancelAtPeriodEnd: subData.cancel_at_period_end,
      features: tierFeatures[subData.tier as SubscriptionTier] || tierFeatures.free,
    } : defaultSubscription;
    
    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      subscription,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return null;
  }
}

// Export selectors for common use cases
export const selectUser = (state: AuthState) => state.user;
export const selectProfile = (state: AuthState) => state.profile;
export const selectIsAuthenticated = (state: AuthState) => !!state.session;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectSubscriptionTier = (state: AuthState) => state.profile?.subscription.tier ?? 'free';