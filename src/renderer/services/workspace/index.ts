/**
 * Workspace Service Module
 *
 * Exports workspace management functionality including CRUD operations,
 * member management, role-based access control, and invitations.
 */

export {
  WorkspaceService,
  workspaceService,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceRole,
  type Permission,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from './workspaceService';

export {
  InvitationService,
  invitationService,
  type WorkspaceInvitation,
  type CreateInvitationInput,
  type InvitationStatus,
} from './invitationService';