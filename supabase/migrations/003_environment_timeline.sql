-- Migration: 003_environment_timeline
-- Description: Create environment snapshots and drift detection tables
-- Created: 2024-12-16

-- ============================================================================
-- ENVIRONMENT SNAPSHOTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS environment_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Snapshot data
    name VARCHAR(255) NOT NULL,
    description TEXT,
    variables JSONB NOT NULL DEFAULT '{}',
    
    -- Metadata
    version INTEGER NOT NULL DEFAULT 1,
    is_auto_snapshot BOOLEAN NOT NULL DEFAULT false,
    trigger_type VARCHAR(50), -- 'manual', 'scheduled', 'before_change', 'deployment'
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Optional reference to what triggered the snapshot
    triggered_by_request_id UUID,
    triggered_by_deployment_id VARCHAR(255)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_environment_snapshots_environment_id ON environment_snapshots(environment_id);
CREATE INDEX IF NOT EXISTS idx_environment_snapshots_workspace_id ON environment_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_environment_snapshots_user_id ON environment_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_environment_snapshots_created_at ON environment_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_environment_snapshots_version ON environment_snapshots(environment_id, version);

-- ============================================================================
-- ENVIRONMENT DRIFT RECORDS TABLE
-- ============================================================================

CREATE TYPE drift_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE drift_category AS ENUM ('variable_added', 'variable_removed', 'variable_modified', 'auth_changed', 'tls_changed', 'proxy_changed', 'header_changed');

CREATE TABLE IF NOT EXISTS environment_drift_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    
    -- Comparison references
    baseline_snapshot_id UUID REFERENCES environment_snapshots(id) ON DELETE SET NULL,
    compared_snapshot_id UUID REFERENCES environment_snapshots(id) ON DELETE SET NULL,
    
    -- Drift details
    category drift_category NOT NULL,
    severity drift_severity NOT NULL DEFAULT 'info',
    variable_key VARCHAR(255),
    
    -- Values (stored as JSONB for flexibility)
    baseline_value JSONB,
    current_value JSONB,
    
    -- Analysis
    description TEXT,
    recommendation TEXT,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    
    -- Timestamps
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for drift records
CREATE INDEX IF NOT EXISTS idx_drift_records_environment_id ON environment_drift_records(environment_id);
CREATE INDEX IF NOT EXISTS idx_drift_records_workspace_id ON environment_drift_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_drift_records_severity ON environment_drift_records(severity);
CREATE INDEX IF NOT EXISTS idx_drift_records_category ON environment_drift_records(category);
CREATE INDEX IF NOT EXISTS idx_drift_records_is_resolved ON environment_drift_records(is_resolved);
CREATE INDEX IF NOT EXISTS idx_drift_records_detected_at ON environment_drift_records(detected_at);

-- ============================================================================
-- ENVIRONMENT COMPARISON HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS environment_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What was compared
    left_environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    right_environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    left_snapshot_id UUID REFERENCES environment_snapshots(id) ON DELETE SET NULL,
    right_snapshot_id UUID REFERENCES environment_snapshots(id) ON DELETE SET NULL,
    
    -- Comparison results
    total_differences INTEGER NOT NULL DEFAULT 0,
    added_count INTEGER NOT NULL DEFAULT 0,
    removed_count INTEGER NOT NULL DEFAULT 0,
    modified_count INTEGER NOT NULL DEFAULT 0,
    
    -- Detailed diff stored as JSONB
    diff_details JSONB NOT NULL DEFAULT '[]',
    
    -- Metadata
    compared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for comparisons
CREATE INDEX IF NOT EXISTS idx_comparisons_left_env ON environment_comparisons(left_environment_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_right_env ON environment_comparisons(right_environment_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_workspace_id ON environment_comparisons(workspace_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_created_at ON environment_comparisons(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE environment_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_drift_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_comparisons ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ENVIRONMENT SNAPSHOTS POLICIES
-- ============================================================================

-- Users can view snapshots for their environments or workspace environments
CREATE POLICY "Users can view environment snapshots"
    ON environment_snapshots FOR SELECT
    USING (
        user_id = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
        OR environment_id IN (
            SELECT id FROM environments
            WHERE user_id = auth.uid()
        )
    );

-- Users can create snapshots for their environments or workspace environments (editor+)
CREATE POLICY "Users can create environment snapshots"
    ON environment_snapshots FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND (
            environment_id IN (
                SELECT id FROM environments
                WHERE user_id = auth.uid()
            )
            OR workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
            )
        )
    );

-- Users can delete their own snapshots or workspace snapshots (admin only)
CREATE POLICY "Users can delete environment snapshots"
    ON environment_snapshots FOR DELETE
    USING (
        user_id = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- DRIFT RECORDS POLICIES
-- ============================================================================

-- Users can view drift records for their environments or workspace environments
CREATE POLICY "Users can view drift records"
    ON environment_drift_records FOR SELECT
    USING (
        environment_id IN (
            SELECT id FROM environments
            WHERE user_id = auth.uid()
        )
        OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- System can insert drift records
CREATE POLICY "System can insert drift records"
    ON environment_drift_records FOR INSERT
    WITH CHECK (true);

-- Users can update drift records (mark as resolved)
CREATE POLICY "Users can update drift records"
    ON environment_drift_records FOR UPDATE
    USING (
        environment_id IN (
            SELECT id FROM environments
            WHERE user_id = auth.uid()
        )
        OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
        )
    );

-- ============================================================================
-- COMPARISONS POLICIES
-- ============================================================================

-- Users can view their comparisons or workspace comparisons
CREATE POLICY "Users can view comparisons"
    ON environment_comparisons FOR SELECT
    USING (
        compared_by = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Users can create comparisons
CREATE POLICY "Users can create comparisons"
    ON environment_comparisons FOR INSERT
    WITH CHECK (compared_by = auth.uid());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to create an automatic snapshot before environment changes
CREATE OR REPLACE FUNCTION create_auto_snapshot_before_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create snapshot if variables are changing
    IF OLD.variables IS DISTINCT FROM NEW.variables THEN
        INSERT INTO environment_snapshots (
            environment_id,
            workspace_id,
            user_id,
            name,
            description,
            variables,
            is_auto_snapshot,
            trigger_type
        )
        VALUES (
            OLD.id,
            OLD.workspace_id,
            auth.uid(),
            'Auto-snapshot before change',
            'Automatically created before environment variables were modified',
            OLD.variables,
            true,
            'before_change'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-snapshot before environment changes
DROP TRIGGER IF EXISTS on_environment_change ON environments;
CREATE TRIGGER on_environment_change
    BEFORE UPDATE ON environments
    FOR EACH ROW
    EXECUTE FUNCTION create_auto_snapshot_before_change();

-- Function to get the next version number for a snapshot
CREATE OR REPLACE FUNCTION get_next_snapshot_version(p_environment_id UUID)
RETURNS INTEGER AS $$
DECLARE
    max_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version), 0) INTO max_version
    FROM environment_snapshots
    WHERE environment_id = p_environment_id;
    
    RETURN max_version + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to compare two snapshots and return differences
CREATE OR REPLACE FUNCTION compare_snapshots(
    p_baseline_snapshot_id UUID,
    p_compared_snapshot_id UUID
)
RETURNS TABLE (
    variable_key TEXT,
    change_type TEXT,
    baseline_value JSONB,
    compared_value JSONB
) AS $$
DECLARE
    baseline_vars JSONB;
    compared_vars JSONB;
    key TEXT;
BEGIN
    -- Get variables from both snapshots
    SELECT variables INTO baseline_vars
    FROM environment_snapshots
    WHERE id = p_baseline_snapshot_id;
    
    SELECT variables INTO compared_vars
    FROM environment_snapshots
    WHERE id = p_compared_snapshot_id;
    
    -- Find added and modified variables
    FOR key IN SELECT jsonb_object_keys(compared_vars)
    LOOP
        IF NOT baseline_vars ? key THEN
            RETURN QUERY SELECT key, 'added'::TEXT, NULL::JSONB, compared_vars->key;
        ELSIF baseline_vars->key IS DISTINCT FROM compared_vars->key THEN
            RETURN QUERY SELECT key, 'modified'::TEXT, baseline_vars->key, compared_vars->key;
        END IF;
    END LOOP;
    
    -- Find removed variables
    FOR key IN SELECT jsonb_object_keys(baseline_vars)
    LOOP
        IF NOT compared_vars ? key THEN
            RETURN QUERY SELECT key, 'removed'::TEXT, baseline_vars->key, NULL::JSONB;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to detect drift between current environment and latest snapshot
CREATE OR REPLACE FUNCTION detect_environment_drift(p_environment_id UUID)
RETURNS TABLE (
    variable_key TEXT,
    drift_type TEXT,
    snapshot_value JSONB,
    current_value JSONB,
    severity TEXT
) AS $$
DECLARE
    latest_snapshot_vars JSONB;
    current_vars JSONB;
    key TEXT;
BEGIN
    -- Get latest snapshot variables
    SELECT variables INTO latest_snapshot_vars
    FROM environment_snapshots
    WHERE environment_id = p_environment_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Get current environment variables
    SELECT variables INTO current_vars
    FROM environments
    WHERE id = p_environment_id;
    
    -- If no snapshot exists, return empty
    IF latest_snapshot_vars IS NULL THEN
        RETURN;
    END IF;
    
    -- Find drifted variables
    FOR key IN SELECT jsonb_object_keys(current_vars)
    LOOP
        IF NOT latest_snapshot_vars ? key THEN
            RETURN QUERY SELECT key, 'added'::TEXT, NULL::JSONB, current_vars->key, 'info'::TEXT;
        ELSIF latest_snapshot_vars->key IS DISTINCT FROM current_vars->key THEN
            -- Determine severity based on key name patterns
            RETURN QUERY SELECT 
                key, 
                'modified'::TEXT, 
                latest_snapshot_vars->key, 
                current_vars->key,
                CASE 
                    WHEN key ILIKE '%secret%' OR key ILIKE '%password%' OR key ILIKE '%key%' OR key ILIKE '%token%' THEN 'critical'
                    WHEN key ILIKE '%auth%' OR key ILIKE '%api%' THEN 'warning'
                    ELSE 'info'
                END::TEXT;
        END IF;
    END LOOP;
    
    -- Find removed variables
    FOR key IN SELECT jsonb_object_keys(latest_snapshot_vars)
    LOOP
        IF NOT current_vars ? key THEN
            RETURN QUERY SELECT 
                key, 
                'removed'::TEXT, 
                latest_snapshot_vars->key, 
                NULL::JSONB,
                CASE 
                    WHEN key ILIKE '%secret%' OR key ILIKE '%password%' OR key ILIKE '%key%' OR key ILIKE '%token%' THEN 'critical'
                    WHEN key ILIKE '%auth%' OR key ILIKE '%api%' THEN 'warning'
                    ELSE 'info'
                END::TEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to resolve a drift record
CREATE OR REPLACE FUNCTION resolve_drift_record(p_drift_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE environment_drift_records
    SET 
        is_resolved = true,
        resolved_at = NOW(),
        resolved_by = auth.uid()
    WHERE id = p_drift_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for environment timeline with snapshots and drift
CREATE OR REPLACE VIEW environment_timeline AS
SELECT 
    'snapshot' as event_type,
    s.id as event_id,
    s.environment_id,
    s.workspace_id,
    s.name as event_name,
    s.description as event_description,
    s.created_at as event_time,
    s.user_id,
    s.trigger_type,
    NULL::drift_severity as severity,
    NULL::drift_category as category,
    s.variables as data
FROM environment_snapshots s

UNION ALL

SELECT 
    'drift' as event_type,
    d.id as event_id,
    d.environment_id,
    d.workspace_id,
    d.variable_key as event_name,
    d.description as event_description,
    d.detected_at as event_time,
    NULL::UUID as user_id,
    d.category::TEXT as trigger_type,
    d.severity,
    d.category,
    jsonb_build_object(
        'baseline_value', d.baseline_value,
        'current_value', d.current_value,
        'is_resolved', d.is_resolved
    ) as data
FROM environment_drift_records d

ORDER BY event_time DESC;