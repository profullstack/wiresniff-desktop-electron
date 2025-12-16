import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { useAuthStore } from './stores';

// Lazy load pages for code splitting
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'));
const EnvironmentsPage = lazy(() => import('./pages/EnvironmentsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NetworkInspectorPage = lazy(() => import('./pages/NetworkInspectorPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const LoginPage = lazy(() => import('./pages/Login'));
const SignupPage = lazy(() => import('./pages/Signup'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPassword'));
const BillingPage = lazy(() => import('./pages/BillingPage'));

// Layout components
import MainLayout from './components/layout/MainLayout';
import LoadingScreen from './components/common/LoadingScreen';

// Providers
import { AuthProvider } from './providers/AuthProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { DatabaseProvider } from './providers/DatabaseProvider';
import { SyncProvider } from './providers/SyncProvider';

/**
 * Root Application Component
 * Sets up routing, providers, and the main application structure
 */
function App() {
  const { initialize, isInitialized } = useAuthStore();

  // Initialize auth state on app load
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <DatabaseProvider>
          <SyncProvider>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                {/* Auth routes */}
                <Route path="/auth" element={<AuthPage />}>
                  <Route index element={<Navigate to="/auth/login" replace />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="signup" element={<SignupPage />} />
                  <Route path="forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="callback" element={<AuthCallbackHandler />} />
                </Route>

                {/* Main application routes */}
                <Route path="/" element={<MainLayout />}>
                  <Route index element={<WelcomePage />} />
                  <Route path="workspace" element={<WorkspacePage />} />
                  <Route path="workspace/:requestId" element={<WorkspacePage />} />
                  <Route path="collections" element={<CollectionsPage />} />
                  <Route path="collections/:collectionId" element={<CollectionsPage />} />
                  <Route path="environments" element={<EnvironmentsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="settings/:section" element={<SettingsPage />} />
                  <Route path="billing" element={<BillingPage />} />
                  <Route path="inspector" element={<NetworkInspectorPage />} />
                </Route>

                {/* Fallback redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </SyncProvider>
        </DatabaseProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * Auth Callback Handler
 * Handles OAuth redirects and email confirmation links
 */
function AuthCallbackHandler() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // The Supabase client will automatically handle the OAuth callback
    // and update the auth state. We just need to redirect to home.
    const timer = setTimeout(() => {
      navigate('/', { replace: true });
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [navigate]);
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-text-secondary">Completing authentication...</p>
      </div>
    </div>
  );
}

export default App;