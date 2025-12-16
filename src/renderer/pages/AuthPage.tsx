import { Outlet } from 'react-router-dom';

/**
 * AuthPage Component
 * Layout wrapper for authentication screens (login, signup, password reset)
 * Uses Outlet to render nested routes defined in App.tsx
 */
function AuthPage() {
  return <Outlet />;
}

export default AuthPage;