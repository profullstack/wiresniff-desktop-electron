/**
 * InviteModal Component
 *
 * Modal dialog for inviting new members to a workspace
 * with email input and role selection.
 */

import React, { useState, useEffect, useRef } from 'react';

export type WorkspaceRole = 'admin' | 'editor' | 'viewer';

interface InviteModalProps {
  isOpen: boolean;
  workspaceName: string;
  onClose: () => void;
  onInvite: (email: string, role: WorkspaceRole) => Promise<void>;
  existingEmails?: string[];
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  workspaceName,
  onClose,
  onInvite,
  existingEmails = [],
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('editor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setRole('editor');
      setError(null);
    }
  }, [isOpen]);

  // Validate email
  const validateEmail = (email: string): string | null => {
    if (!email.trim()) {
      return 'Email is required';
    }
    if (!EMAIL_REGEX.test(email)) {
      return 'Please enter a valid email address';
    }
    if (existingEmails.includes(email.toLowerCase())) {
      return 'This email is already a member or has a pending invitation';
    }
    return null;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onInvite(email.toLowerCase(), role);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-dark-surface border border-dark-border rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold text-white">Invite to {workspaceName}</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email input */}
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-gray-400 mb-2">
              Email Address
            </label>
            <input
              ref={inputRef}
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="colleague@example.com"
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-primary"
              disabled={isSubmitting}
            />
          </div>

          {/* Role selection */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(['viewer', 'editor', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  disabled={isSubmitting}
                  className={`px-3 py-2 text-sm rounded-md transition-colors capitalize ${
                    role === r
                      ? 'bg-accent-primary text-white'
                      : 'bg-dark-bg text-gray-400 hover:text-white hover:bg-dark-bg/80'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {role === 'admin' && 'Can manage workspace settings, members, and all content'}
              {role === 'editor' && 'Can create and edit collections, environments, and requests'}
              {role === 'viewer' && 'Can view collections and environments, but cannot edit'}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !email.trim()}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                isSubmitting || !email.trim()
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-accent-primary text-white hover:bg-accent-primary/90'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Sending...
                </span>
              ) : (
                'Send Invitation'
              )}
            </button>
          </div>
        </form>

        {/* Info footer */}
        <div className="px-6 py-3 bg-dark-bg/50 border-t border-dark-border rounded-b-lg">
          <p className="text-xs text-gray-500">
            An email will be sent with a link to join the workspace. The invitation expires in 7 days.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;