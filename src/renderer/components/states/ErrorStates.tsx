/**
 * Error States Components
 *
 * Reusable error state components for various scenarios:
 * - Network errors
 * - Invalid request errors
 * - Authentication errors
 * - Timeout errors
 * - Generic errors
 */

import React from 'react';
import {
  WifiOff,
  AlertTriangle,
  Lock,
  Clock,
  RefreshCw,
  Settings,
  Key,
  Wrench,
  XCircle,
  Info,
  AlertCircle,
} from 'lucide-react';

// Types
interface ValidationError {
  title: string;
  description: string;
}

// Props interfaces
interface NetworkErrorStateProps {
  errorMessage?: string;
  errorCode?: string;
  url?: string;
  onRetry?: () => void;
  onCheckSettings?: () => void;
}

interface InvalidRequestStateProps {
  errors: ValidationError[];
  onFixIssues?: () => void;
}

interface AuthErrorStateProps {
  statusCode?: number;
  errorMessage?: string;
  responseBody?: string;
  onUpdateCredentials?: () => void;
  onViewAuthSettings?: () => void;
}

interface TimeoutErrorStateProps {
  duration: number;
  maxTimeout: number;
  onRetryWithLongerTimeout?: () => void;
  onAdjustSettings?: () => void;
}

interface GenericErrorStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  borderColor?: string;
  iconBgColor?: string;
  titleColor?: string;
  children?: React.ReactNode;
}

/**
 * Generic Error State Component
 */
export const GenericErrorState: React.FC<GenericErrorStateProps> = ({
  icon,
  title,
  description,
  borderColor = 'border-red-900/50',
  iconBgColor = 'bg-red-500/10',
  titleColor = 'text-red-400',
  children,
}) => {
  return (
    <div className={`bg-dark-surface rounded-xl border ${borderColor} p-12`}>
      <div className="flex items-start space-x-6">
        <div className="flex-shrink-0">
          <div className={`inline-flex items-center justify-center w-16 h-16 ${iconBgColor} rounded-xl`}>
            {icon}
          </div>
        </div>
        <div className="flex-1">
          <h2 className={`text-2xl font-bold mb-2 ${titleColor}`}>{title}</h2>
          <p className="text-gray-400 mb-4">{description}</p>
          {children}
        </div>
      </div>
    </div>
  );
};

/**
 * Network Error State
 * Shown when there's a connection error
 */
export const NetworkErrorState: React.FC<NetworkErrorStateProps> = ({
  errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.',
  errorCode,
  url,
  onRetry,
  onCheckSettings,
}) => {
  return (
    <GenericErrorState
      icon={<WifiOff className="w-6 h-6 text-red-500" />}
      title="Network Error"
      description={errorMessage}
      borderColor="border-red-900/50"
      iconBgColor="bg-red-500/10"
      titleColor="text-red-400"
    >
      {(errorCode || url) && (
        <div className="bg-dark-bg rounded-lg p-4 mb-4 border border-dark-border">
          <div className="flex items-start space-x-3">
            <Info className="w-4 h-4 text-gray-500 mt-1" />
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-2">Error Details:</p>
              <code className="text-xs text-red-400 font-mono block">
                {errorCode && `${errorCode}: `}
                {url && `Connection refused at ${url}`}
              </code>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center space-x-3">
        <button
          onClick={onRetry}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-2 rounded-lg transition-all flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Request
        </button>
        <button
          onClick={onCheckSettings}
          className="text-gray-400 hover:text-gray-200 font-medium px-5 py-2 transition-colors"
        >
          Check Network Settings
        </button>
      </div>
    </GenericErrorState>
  );
};

/**
 * Invalid Request State
 * Shown when request configuration has errors
 */
export const InvalidRequestState: React.FC<InvalidRequestStateProps> = ({ errors, onFixIssues }) => {
  return (
    <GenericErrorState
      icon={<AlertTriangle className="w-6 h-6 text-yellow-500" />}
      title="Invalid Request"
      description="The request configuration contains errors. Please review and fix the issues below."
      borderColor="border-yellow-900/50"
      iconBgColor="bg-yellow-500/10"
      titleColor="text-yellow-400"
    >
      <div className="bg-dark-bg rounded-lg p-4 mb-4 border border-dark-border space-y-3">
        {errors.map((error, index) => (
          <div key={index} className="flex items-start space-x-3">
            <XCircle className="w-4 h-4 text-red-400 mt-1" />
            <div>
              <p className="text-sm font-medium text-gray-300">{error.title}</p>
              <p className="text-xs text-gray-500">{error.description}</p>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onFixIssues}
        className="bg-yellow-500 hover:bg-yellow-600 text-dark-bg font-semibold px-5 py-2 rounded-lg transition-all flex items-center"
      >
        <Wrench className="w-4 h-4 mr-2" />
        Fix Issues
      </button>
    </GenericErrorState>
  );
};

/**
 * Authentication Error State
 * Shown when authentication fails (401/403)
 */
export const AuthErrorState: React.FC<AuthErrorStateProps> = ({
  statusCode = 401,
  errorMessage = 'Access denied. Your credentials are invalid or have expired.',
  responseBody,
  onUpdateCredentials,
  onViewAuthSettings,
}) => {
  return (
    <GenericErrorState
      icon={<Lock className="w-6 h-6 text-orange-500" />}
      title="Authentication Failed"
      description={errorMessage}
      borderColor="border-orange-900/50"
      iconBgColor="bg-orange-500/10"
      titleColor="text-orange-400"
    >
      {responseBody && (
        <div className="bg-dark-bg rounded-lg p-4 mb-4 border border-dark-border">
          <div className="flex items-start space-x-3">
            <Info className="w-4 h-4 text-gray-500 mt-1" />
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-2">Response:</p>
              <div className="bg-dark-surface rounded p-3 border border-dark-border">
                <code className="text-xs text-gray-300 font-mono">
                  <span className="text-orange-400">{statusCode} Unauthorized</span>
                  <br />
                  <pre className="mt-2 whitespace-pre-wrap">{responseBody}</pre>
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center space-x-3">
        <button
          onClick={onUpdateCredentials}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2 rounded-lg transition-all flex items-center"
        >
          <Key className="w-4 h-4 mr-2" />
          Update Credentials
        </button>
        <button
          onClick={onViewAuthSettings}
          className="text-gray-400 hover:text-gray-200 font-medium px-5 py-2 transition-colors"
        >
          View Auth Settings
        </button>
      </div>
    </GenericErrorState>
  );
};

/**
 * Timeout Error State
 * Shown when request times out
 */
export const TimeoutErrorState: React.FC<TimeoutErrorStateProps> = ({
  duration,
  maxTimeout,
  onRetryWithLongerTimeout,
  onAdjustSettings,
}) => {
  const percentage = Math.min((duration / maxTimeout) * 100, 100);

  return (
    <GenericErrorState
      icon={<Clock className="w-6 h-6 text-purple-500" />}
      title="Request Timeout"
      description={`The request took too long to complete and was cancelled after ${maxTimeout} seconds.`}
      borderColor="border-purple-900/50"
      iconBgColor="bg-purple-500/10"
      titleColor="text-purple-400"
    >
      <div className="bg-dark-bg rounded-lg p-4 mb-4 border border-dark-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-400">Request Duration</span>
          <span className="text-sm font-mono text-purple-400">{duration.toFixed(2)}s</span>
        </div>
        <div className="w-full bg-dark-surface rounded-full h-2 mb-2">
          <div
            className="bg-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <p className="text-xs text-gray-500">Exceeded maximum timeout of {maxTimeout} seconds</p>
      </div>
      <div className="flex items-center space-x-3">
        <button
          onClick={onRetryWithLongerTimeout}
          className="bg-purple-500 hover:bg-purple-600 text-white font-semibold px-5 py-2 rounded-lg transition-all flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry with Longer Timeout
        </button>
        <button
          onClick={onAdjustSettings}
          className="text-gray-400 hover:text-gray-200 font-medium px-5 py-2 transition-colors"
        >
          Adjust Timeout Settings
        </button>
      </div>
    </GenericErrorState>
  );
};

/**
 * Server Error State
 * Shown for 5xx errors
 */
export const ServerErrorState: React.FC<{
  statusCode: number;
  statusText: string;
  errorMessage?: string;
  onRetry?: () => void;
}> = ({ statusCode, statusText, errorMessage, onRetry }) => {
  return (
    <GenericErrorState
      icon={<AlertCircle className="w-6 h-6 text-red-500" />}
      title={`Server Error (${statusCode})`}
      description={errorMessage || `The server returned an error: ${statusText}`}
      borderColor="border-red-900/50"
      iconBgColor="bg-red-500/10"
      titleColor="text-red-400"
    >
      <div className="flex items-center space-x-3">
        <button
          onClick={onRetry}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-2 rounded-lg transition-all flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Request
        </button>
      </div>
    </GenericErrorState>
  );
};

/**
 * SSL/Certificate Error State
 */
export const SSLErrorState: React.FC<{
  errorMessage?: string;
  onRetryWithoutVerification?: () => void;
  onViewSettings?: () => void;
}> = ({
  errorMessage = 'SSL certificate verification failed. The server certificate may be invalid or expired.',
  onRetryWithoutVerification,
  onViewSettings,
}) => {
  return (
    <GenericErrorState
      icon={<Lock className="w-6 h-6 text-red-500" />}
      title="SSL Certificate Error"
      description={errorMessage}
      borderColor="border-red-900/50"
      iconBgColor="bg-red-500/10"
      titleColor="text-red-400"
    >
      <div className="flex items-center space-x-3">
        <button
          onClick={onRetryWithoutVerification}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-2 rounded-lg transition-all flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry (Skip Verification)
        </button>
        <button
          onClick={onViewSettings}
          className="text-gray-400 hover:text-gray-200 font-medium px-5 py-2 transition-colors flex items-center"
        >
          <Settings className="w-4 h-4 mr-2" />
          SSL Settings
        </button>
      </div>
    </GenericErrorState>
  );
};

export default {
  GenericErrorState,
  NetworkErrorState,
  InvalidRequestState,
  AuthErrorState,
  TimeoutErrorState,
  ServerErrorState,
  SSLErrorState,
};