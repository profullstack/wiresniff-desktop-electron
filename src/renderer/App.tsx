import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Lazy load pages for code splitting
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'));
const EnvironmentsPage = lazy(() => import('./pages/EnvironmentsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NetworkInspectorPage = lazy(() => import('./pages/NetworkInspectorPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));

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
  return (
    <ThemeProvider>
      <AuthProvider>
        <DatabaseProvider>
          <SyncProvider>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                {/* Auth routes */}
                <Route path="/auth/*" element={<AuthPage />} />

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

export default App;