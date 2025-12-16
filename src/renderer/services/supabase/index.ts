/**
 * Supabase Services Index
 * 
 * Exports all Supabase-related services.
 */

export {
  supabase,
  isSupabaseConfigured,
  getCurrentUser,
  getCurrentSession,
  signInWithEmail,
  signUpWithEmail,
  signInWithOAuth,
  signOut,
  resetPassword,
  updatePassword,
  updateProfile,
  onAuthStateChange,
  type User,
  type Session,
} from './client';

export {
  syncService,
  type SyncStatus,
  type SyncResult,
  type SyncableTable,
} from './sync';