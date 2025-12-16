/**
 * Workspace Components Module
 *
 * Exports all workspace-related UI components for team collaboration,
 * member management, and workspace selection.
 */

export { WorkspaceSelector } from './WorkspaceSelector';
export type { Workspace as WorkspaceSelectorWorkspace } from './WorkspaceSelector';

export { TeamMembersPanel } from './TeamMembersPanel';
export type { WorkspaceMember } from './TeamMembersPanel';

export { InviteModal } from './InviteModal';
export type { WorkspaceRole } from './InviteModal';