-- Migration: 002_workspaces
-- Description: Create workspaces and workspace_members tables for team collaboration
-- Created: 2024-12-16

-- ============================================================================
-- WORKSPACES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for owner lookup
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);

-- ============================================================================
-- WORKSPACE MEMBERS TABLE
-- ============================================================================

CREATE TYPE workspace_role AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role workspace_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique membership
    UNIQUE(workspace_id, user_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON workspace_members(role);

-- ============================================================================
-- WORKSPACE INVITATIONS TABLE
-- ============================================================================

CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

CREATE TABLE IF NOT EXISTS workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role workspace_role NOT NULL DEFAULT 'viewer',
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status invitation_status NOT NULL DEFAULT 'pending',
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ
);

-- Indexes for invitation lookups
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_status ON workspace_invitations(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- WORKSPACES POLICIES
-- ============================================================================

-- Users can view workspaces they are members of
CREATE POLICY "Users can view their workspaces"
    ON workspaces FOR SELECT
    USING (
        id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Users can create workspaces
CREATE POLICY "Users can create workspaces"
    ON workspaces FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Only admins can update workspaces
CREATE POLICY "Admins can update workspaces"
    ON workspaces FOR UPDATE
    USING (
        id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Only owners can delete workspaces
CREATE POLICY "Owners can delete workspaces"
    ON workspaces FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- WORKSPACE MEMBERS POLICIES
-- ============================================================================

-- Members can view other members in their workspaces
CREATE POLICY "Members can view workspace members"
    ON workspace_members FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Admins can add members
CREATE POLICY "Admins can add members"
    ON workspace_members FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can update member roles
CREATE POLICY "Admins can update member roles"
    ON workspace_members FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can remove members, or users can remove themselves
CREATE POLICY "Admins can remove members or self-removal"
    ON workspace_members FOR DELETE
    USING (
        user_id = auth.uid() OR
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- WORKSPACE INVITATIONS POLICIES
-- ============================================================================

-- Members can view invitations for their workspaces
CREATE POLICY "Members can view workspace invitations"
    ON workspace_invitations FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Admins can create invitations
CREATE POLICY "Admins can create invitations"
    ON workspace_invitations FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can update invitations (e.g., cancel)
CREATE POLICY "Admins can update invitations"
    ON workspace_invitations FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Admins can delete invitations
CREATE POLICY "Admins can delete invitations"
    ON workspace_invitations FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to automatically add owner as admin member when workspace is created
CREATE OR REPLACE FUNCTION add_workspace_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to add owner as member
DROP TRIGGER IF EXISTS on_workspace_created ON workspaces;
CREATE TRIGGER on_workspace_created
    AFTER INSERT ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION add_workspace_owner_as_member();

-- Function to update workspace updated_at timestamp
CREATE OR REPLACE FUNCTION update_workspace_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp
DROP TRIGGER IF EXISTS on_workspace_update ON workspaces;
CREATE TRIGGER on_workspace_update
    BEFORE UPDATE ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_workspace_timestamp();

-- Function to accept invitation and add user as member
CREATE OR REPLACE FUNCTION accept_workspace_invitation(invitation_token VARCHAR)
RETURNS UUID AS $$
DECLARE
    inv RECORD;
    new_member_id UUID;
BEGIN
    -- Get invitation
    SELECT * INTO inv FROM workspace_invitations
    WHERE token = invitation_token
    AND status = 'pending'
    AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invitation';
    END IF;
    
    -- Check if user email matches
    IF inv.email != (SELECT email FROM auth.users WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'Invitation email does not match';
    END IF;
    
    -- Check if already a member
    IF EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = inv.workspace_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Already a member of this workspace';
    END IF;
    
    -- Add as member
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (inv.workspace_id, auth.uid(), inv.role)
    RETURNING id INTO new_member_id;
    
    -- Update invitation status
    UPDATE workspace_invitations
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = inv.id;
    
    RETURN new_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate secure invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS VARCHAR AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- WORKSPACE-SCOPED DATA TABLES
-- ============================================================================

-- Add workspace_id to existing tables for team sharing

-- Collections can belong to a workspace
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_collections_workspace_id ON collections(workspace_id);

-- Environments can belong to a workspace
ALTER TABLE environments
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_environments_workspace_id ON environments(workspace_id);

-- Update RLS policies for collections to include workspace access
DROP POLICY IF EXISTS "Users can view their collections" ON collections;
CREATE POLICY "Users can view their collections"
    ON collections FOR SELECT
    USING (
        user_id = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their collections" ON collections;
CREATE POLICY "Users can update their collections"
    ON collections FOR UPDATE
    USING (
        user_id = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
        )
    );

-- Update RLS policies for environments to include workspace access
DROP POLICY IF EXISTS "Users can view their environments" ON environments;
CREATE POLICY "Users can view their environments"
    ON environments FOR SELECT
    USING (
        user_id = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their environments" ON environments;
CREATE POLICY "Users can update their environments"
    ON environments FOR UPDATE
    USING (
        user_id = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
        )
    );

-- ============================================================================
-- AUDIT LOG FOR WORKSPACE ACTIVITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS workspace_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_audit_log_workspace_id ON workspace_audit_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_log_user_id ON workspace_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_log_created_at ON workspace_audit_log(created_at);

-- Enable RLS on audit log
ALTER TABLE workspace_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
    ON workspace_audit_log FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- System can insert audit logs (via functions)
CREATE POLICY "System can insert audit logs"
    ON workspace_audit_log FOR INSERT
    WITH CHECK (true);

-- Function to log workspace activity
CREATE OR REPLACE FUNCTION log_workspace_activity(
    p_workspace_id UUID,
    p_action VARCHAR,
    p_resource_type VARCHAR DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO workspace_audit_log (workspace_id, user_id, action, resource_type, resource_id, details)
    VALUES (p_workspace_id, auth.uid(), p_action, p_resource_type, p_resource_id, p_details)
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;