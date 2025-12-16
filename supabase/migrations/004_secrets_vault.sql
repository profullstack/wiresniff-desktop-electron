-- Secrets Vault Migration
-- Encrypted secrets storage with per-workspace access control

-- Create secrets table
CREATE TABLE IF NOT EXISTS secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  -- Encrypted value stored as base64 string
  -- Encryption happens client-side using Electron safeStorage
  encrypted_value TEXT NOT NULL,
  -- Encryption metadata
  encryption_version INTEGER DEFAULT 1,
  -- Secret type for UI categorization
  secret_type VARCHAR(50) DEFAULT 'generic' CHECK (secret_type IN ('generic', 'api_key', 'oauth_token', 'password', 'certificate', 'ssh_key')),
  -- Tags for organization
  tags TEXT[] DEFAULT '{}',
  -- Audit fields
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  -- Ensure unique names within workspace scope
  CONSTRAINT unique_secret_name_workspace UNIQUE (workspace_id, name)
);

-- Create partial unique index for user-scoped secrets (when workspace_id IS NULL)
CREATE UNIQUE INDEX unique_secret_name_user ON secrets (user_id, name) WHERE workspace_id IS NULL;

-- Create index for faster lookups
CREATE INDEX idx_secrets_workspace ON secrets(workspace_id);
CREATE INDEX idx_secrets_user ON secrets(user_id);
CREATE INDEX idx_secrets_type ON secrets(secret_type);
CREATE INDEX idx_secrets_tags ON secrets USING GIN(tags);

-- Create secret access log for audit trail
CREATE TABLE IF NOT EXISTS secret_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID REFERENCES secrets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('read', 'update', 'delete', 'share')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_secret_access_logs_secret ON secret_access_logs(secret_id);
CREATE INDEX idx_secret_access_logs_user ON secret_access_logs(user_id);
CREATE INDEX idx_secret_access_logs_created ON secret_access_logs(created_at);

-- Enable RLS
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for secrets

-- Users can view their own secrets
CREATE POLICY "Users can view own secrets"
  ON secrets FOR SELECT
  USING (
    user_id = auth.uid() AND workspace_id IS NULL
  );

-- Users can insert their own secrets
CREATE POLICY "Users can insert own secrets"
  ON secrets FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND workspace_id IS NULL
  );

-- Users can update their own secrets
CREATE POLICY "Users can update own secrets"
  ON secrets FOR UPDATE
  USING (
    user_id = auth.uid() AND workspace_id IS NULL
  );

-- Users can delete their own secrets
CREATE POLICY "Users can delete own secrets"
  ON secrets FOR DELETE
  USING (
    user_id = auth.uid() AND workspace_id IS NULL
  );

-- Workspace members can view workspace secrets based on role
CREATE POLICY "Workspace members can view workspace secrets"
  ON secrets FOR SELECT
  USING (
    workspace_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = secrets.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Workspace editors and admins can insert workspace secrets
CREATE POLICY "Workspace editors can insert workspace secrets"
  ON secrets FOR INSERT
  WITH CHECK (
    workspace_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = secrets.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('editor', 'admin')
    )
  );

-- Workspace editors and admins can update workspace secrets
CREATE POLICY "Workspace editors can update workspace secrets"
  ON secrets FOR UPDATE
  USING (
    workspace_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = secrets.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('editor', 'admin')
    )
  );

-- Only workspace admins can delete workspace secrets
CREATE POLICY "Workspace admins can delete workspace secrets"
  ON secrets FOR DELETE
  USING (
    workspace_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = secrets.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role = 'admin'
    )
  );

-- RLS Policies for secret_access_logs

-- Users can view access logs for their own secrets
CREATE POLICY "Users can view own secret access logs"
  ON secret_access_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM secrets
      WHERE secrets.id = secret_access_logs.secret_id
      AND secrets.user_id = auth.uid()
      AND secrets.workspace_id IS NULL
    )
  );

-- Workspace admins can view access logs for workspace secrets
CREATE POLICY "Workspace admins can view workspace secret access logs"
  ON secret_access_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM secrets
      JOIN workspace_members ON workspace_members.workspace_id = secrets.workspace_id
      WHERE secrets.id = secret_access_logs.secret_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role = 'admin'
    )
  );

-- System can insert access logs (via service role)
CREATE POLICY "System can insert access logs"
  ON secret_access_logs FOR INSERT
  WITH CHECK (true);

-- Function to update access tracking
CREATE OR REPLACE FUNCTION update_secret_access()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE secrets
  SET 
    last_accessed_at = NOW(),
    access_count = access_count + 1
  WHERE id = NEW.secret_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update access tracking on log insert
CREATE TRIGGER trigger_update_secret_access
  AFTER INSERT ON secret_access_logs
  FOR EACH ROW
  WHEN (NEW.action = 'read')
  EXECUTE FUNCTION update_secret_access();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_secrets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_secrets_updated_at
  BEFORE UPDATE ON secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_secrets_updated_at();