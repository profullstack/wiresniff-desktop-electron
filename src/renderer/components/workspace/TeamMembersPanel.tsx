/**
 * TeamMembersPanel Component
 *
 * Displays workspace members with their roles and provides
 * management options for admins (change role, remove member).
 */

import React, { useState } from 'react';

export interface WorkspaceMember {
  id: string;
  userId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  role: 'admin' | 'editor' | 'viewer';
  joinedAt: string;
  isOwner?: boolean;
}

interface TeamMembersPanelProps {
  members: WorkspaceMember[];
  currentUserId: string;
  isAdmin: boolean;
  isOwner: boolean;
  onUpdateRole?: (memberId: string, newRole: 'admin' | 'editor' | 'viewer') => Promise<void>;
  onRemoveMember?: (memberId: string) => Promise<void>;
  onInvite?: () => void;
  isLoading?: boolean;
}

export const TeamMembersPanel: React.FC<TeamMembersPanelProps> = ({
  members,
  currentUserId,
  isAdmin,
  isOwner,
  onUpdateRole,
  onRemoveMember,
  onInvite,
  isLoading = false,
}) => {
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [showRoleMenu, setShowRoleMenu] = useState<string | null>(null);

  // Get role badge styling
  const getRoleBadge = (role: string, isOwner?: boolean) => {
    if (isOwner) {
      return {
        bg: 'bg-yellow-500/20',
        text: 'text-yellow-400',
        label: 'Owner',
      };
    }
    switch (role) {
      case 'admin':
        return {
          bg: 'bg-purple-500/20',
          text: 'text-purple-400',
          label: 'Admin',
        };
      case 'editor':
        return {
          bg: 'bg-blue-500/20',
          text: 'text-blue-400',
          label: 'Editor',
        };
      case 'viewer':
        return {
          bg: 'bg-gray-500/20',
          text: 'text-gray-400',
          label: 'Viewer',
        };
      default:
        return {
          bg: 'bg-gray-500/20',
          text: 'text-gray-400',
          label: role,
        };
    }
  };

  // Handle role change
  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'editor' | 'viewer') => {
    if (!onUpdateRole) return;

    setUpdatingMemberId(memberId);
    setShowRoleMenu(null);

    try {
      await onUpdateRole(memberId, newRole);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  // Handle member removal
  const handleRemove = async (memberId: string) => {
    if (!onRemoveMember) return;

    setRemovingMemberId(memberId);

    try {
      await onRemoveMember(memberId);
    } finally {
      setRemovingMemberId(null);
    }
  };

  // Get initials from email or name
  const getInitials = (member: WorkspaceMember): string => {
    if (member.name) {
      return member.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return member.email.charAt(0).toUpperCase();
  };

  // Sort members: owner first, then admins, then by name/email
  const sortedMembers = [...members].sort((a, b) => {
    if (a.isOwner) return -1;
    if (b.isOwner) return 1;
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    return (a.name || a.email).localeCompare(b.name || b.email);
  });

  return (
    <div className="bg-dark-surface rounded-lg border border-dark-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
        <div>
          <h3 className="text-white font-medium">Team Members</h3>
          <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && onInvite && (
          <button
            onClick={onInvite}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent-primary text-white text-sm rounded-md hover:bg-accent-primary/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Invite
          </button>
        )}
      </div>

      {/* Members list */}
      <div className="divide-y divide-dark-border">
        {isLoading ? (
          <div className="p-8 text-center">
            <svg className="w-8 h-8 animate-spin text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24">
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
            <p className="text-gray-500 mt-2">Loading members...</p>
          </div>
        ) : sortedMembers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No members yet</p>
          </div>
        ) : (
          sortedMembers.map((member) => {
            const roleBadge = getRoleBadge(member.role, member.isOwner);
            const isCurrentUser = member.userId === currentUserId;
            const canManage = isAdmin && !member.isOwner && !isCurrentUser;
            const canRemove = isAdmin && !member.isOwner && (isOwner || !isCurrentUser);

            return (
              <div
                key={member.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-dark-bg/50 transition-colors"
              >
                {/* Avatar */}
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.name || member.email}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent-primary/20 flex items-center justify-center">
                    <span className="text-accent-primary font-medium">{getInitials(member)}</span>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium truncate">
                      {member.name || member.email}
                    </span>
                    {isCurrentUser && (
                      <span className="text-xs text-gray-500">(you)</span>
                    )}
                  </div>
                  {member.name && (
                    <div className="text-sm text-gray-500 truncate">{member.email}</div>
                  )}
                </div>

                {/* Role badge */}
                <div className="relative">
                  {canManage && onUpdateRole ? (
                    <button
                      onClick={() => setShowRoleMenu(showRoleMenu === member.id ? null : member.id)}
                      disabled={updatingMemberId === member.id}
                      className={`px-2 py-1 text-xs rounded ${roleBadge.bg} ${roleBadge.text} hover:opacity-80 transition-opacity flex items-center gap-1`}
                    >
                      {updatingMemberId === member.id ? (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
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
                      ) : (
                        <>
                          {roleBadge.label}
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                  ) : (
                    <span className={`px-2 py-1 text-xs rounded ${roleBadge.bg} ${roleBadge.text}`}>
                      {roleBadge.label}
                    </span>
                  )}

                  {/* Role dropdown */}
                  {showRoleMenu === member.id && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-dark-surface border border-dark-border rounded-md shadow-lg z-10">
                      {(['admin', 'editor', 'viewer'] as const).map((role) => (
                        <button
                          key={role}
                          onClick={() => handleRoleChange(member.id, role)}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-bg transition-colors capitalize ${
                            member.role === role ? 'text-accent-primary' : 'text-white'
                          }`}
                        >
                          {role}
                          {member.role === role && (
                            <svg className="w-4 h-4 inline ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Remove button */}
                {canRemove && onRemoveMember && (
                  <button
                    onClick={() => handleRemove(member.id)}
                    disabled={removingMemberId === member.id}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                    title="Remove member"
                  >
                    {removingMemberId === member.id ? (
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
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TeamMembersPanel;