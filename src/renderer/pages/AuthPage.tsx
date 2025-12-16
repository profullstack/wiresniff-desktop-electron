import { Routes, Route, Navigate } from 'react-router-dom';

/**
 * AuthPage Component
 * Authentication screens (login, signup, password reset)
 */
function AuthPage() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-dark-bg">
      <div className="w-full max-w-md p-8">
        <Routes>
          <Route path="login" element={<LoginForm />} />
          <Route path="signup" element={<SignupForm />} />
          <Route path="reset-password" element={<ResetPasswordForm />} />
          <Route path="callback" element={<AuthCallback />} />
          <Route path="*" element={<Navigate to="login" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function LoginForm() {
  return (
    <div className="card">
      <div className="card-body">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Sign In</h1>
        <p className="text-gray-400 text-center">Sign in to sync your data across devices</p>
      </div>
    </div>
  );
}

function SignupForm() {
  return (
    <div className="card">
      <div className="card-body">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Create Account</h1>
        <p className="text-gray-400 text-center">Create an account to get started</p>
      </div>
    </div>
  );
}

function ResetPasswordForm() {
  return (
    <div className="card">
      <div className="card-body">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Reset Password</h1>
        <p className="text-gray-400 text-center">Enter your email to reset your password</p>
      </div>
    </div>
  );
}

function AuthCallback() {
  return (
    <div className="flex items-center justify-center">
      <div className="spinner" />
      <span className="ml-3 text-gray-400">Completing authentication...</span>
    </div>
  );
}

export default AuthPage;