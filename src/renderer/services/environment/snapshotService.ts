/**
 * Environment Snapshot Service
 *
 * Manages environment snapshots for tracking changes over time,
 * enabling rollback, and detecting drift between environments.
 */

import { supabase } from '../supabase/client';

// Types
export type TriggerType = 'manual' | 'scheduled' | 'before_change' | 'deployment';
export type DriftSeverity = 'info' | 'warning' | 'critical';
export type DriftCategory =
  | 'variable_added'
  | 'variable_removed'
  | 'variable_modified'
  | 'auth_changed'
  | 'tls_changed'
  | 'proxy_changed'
  | 'header_changed';

export interface EnvironmentSnapshot {
  id: string;
  environmentId: string;
  workspaceId?: string;
  userId: string;
  name: string;
  description?: string;
  variables: Record<string, string>;
  version: number;
  isAutoSnapshot: boolean;
  triggerType?: TriggerType;
  createdAt: string;
  triggeredByRequestId?: string;
  triggeredByDeploymentId?: string;
}

export interface DriftRecord {
  id: string;
  environmentId: string;
  workspaceId?: string;
  baselineSnapshotId?: string;
  comparedSnapshotId?: string;
  category: DriftCategory;
  severity: DriftSeverity;
  variableKey?: string;
  baselineValue?: unknown;
  currentValue?: unknown;
  description?: string;
  recommendation?: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  detectedAt: string;
  createdAt: string;
}

export interface EnvironmentComparison {
  id: string;
  leftEnvironmentId: string;
  rightEnvironmentId: string;
  leftSnapshotId?: string;
  rightSnapshotId?: string;
  totalDifferences: number;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  diffDetails: VariableDiff[];
  comparedBy: string;
  workspaceId?: string;
  notes?: string;
  createdAt: string;
}

export interface VariableDiff {
  key: string;
  type: 'added' | 'removed' | 'modified';
  leftValue?: string;
  rightValue?: string;
}

export interface CreateSnapshotInput {
  environmentId: string;
  name: string;
  description?: string;
  triggerType?: TriggerType;
  triggeredByRequestId?: string;
  triggeredByDeploymentId?: string;
}

export interface TimelineEvent {
  eventType: 'snapshot' | 'drift';
  eventId: string;
  environmentId: string;
  workspaceId?: string;
  eventName: string;
  eventDescription?: string;
  eventTime: string;
  userId?: string;
  triggerType?: string;
  severity?: DriftSeverity;
  category?: DriftCategory;
  data: Record<string, unknown>;
}

export class SnapshotService {
  /**
   * Get the current authenticated user ID
   */
  private async getCurrentUserId(): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }
    return user.id;
  }

  /**
   * Create a new environment snapshot
   */
  async createSnapshot(input: CreateSnapshotInput): Promise<EnvironmentSnapshot> {
    const userId = await this.getCurrentUserId();

    // Validate input
    if (!input.environmentId) {
      throw new Error('Environment ID is required');
    }
    if (!input.name || input.name.trim() === '') {
      throw new Error('Snapshot name is required');
    }

    // Get current environment data
    const { data: environment, error: envError } = await supabase
      .from('environments')
      .select('variables, workspace_id')
      .eq('id', input.environmentId)
      .single();

    if (envError) {
      throw new Error(`Failed to get environment: ${envError.message}`);
    }

    // Get next version number
    const { data: versionData } = await supabase.rpc('get_next_snapshot_version', {
      p_environment_id: input.environmentId,
    });

    const version = versionData || 1;

    // Create snapshot
    const { data, error } = await supabase
      .from('environment_snapshots')
      .insert({
        environment_id: input.environmentId,
        workspace_id: environment.workspace_id,
        user_id: userId,
        name: input.name.trim(),
        description: input.description?.trim(),
        variables: environment.variables || {},
        version,
        is_auto_snapshot: false,
        trigger_type: input.triggerType || 'manual',
        triggered_by_request_id: input.triggeredByRequestId,
        triggered_by_deployment_id: input.triggeredByDeploymentId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create snapshot: ${error.message}`);
    }

    return this.mapSnapshot(data);
  }

  /**
   * Get a snapshot by ID
   */
  async getSnapshot(snapshotId: string): Promise<EnvironmentSnapshot | null> {
    const { data, error } = await supabase
      .from('environment_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get snapshot: ${error.message}`);
    }

    return this.mapSnapshot(data);
  }

  /**
   * Get all snapshots for an environment
   */
  async getEnvironmentSnapshots(
    environmentId: string,
    options?: {
      limit?: number;
      offset?: number;
      includeAutoSnapshots?: boolean;
    }
  ): Promise<EnvironmentSnapshot[]> {
    let query = supabase
      .from('environment_snapshots')
      .select('*')
      .eq('environment_id', environmentId)
      .order('created_at', { ascending: false });

    if (options?.includeAutoSnapshots === false) {
      query = query.eq('is_auto_snapshot', false);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get snapshots: ${error.message}`);
    }

    return (data || []).map((s: Record<string, unknown>) => this.mapSnapshot(s));
  }

  /**
   * Get the latest snapshot for an environment
   */
  async getLatestSnapshot(environmentId: string): Promise<EnvironmentSnapshot | null> {
    const { data, error } = await supabase
      .from('environment_snapshots')
      .select('*')
      .eq('environment_id', environmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get latest snapshot: ${error.message}`);
    }

    return this.mapSnapshot(data);
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    const userId = await this.getCurrentUserId();

    // Check ownership
    const { data: snapshot, error: fetchError } = await supabase
      .from('environment_snapshots')
      .select('user_id')
      .eq('id', snapshotId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to get snapshot: ${fetchError.message}`);
    }

    if (snapshot.user_id !== userId) {
      throw new Error('Only snapshot creator can delete');
    }

    const { error } = await supabase.from('environment_snapshots').delete().eq('id', snapshotId);

    if (error) {
      throw new Error(`Failed to delete snapshot: ${error.message}`);
    }
  }

  /**
   * Restore environment to a snapshot
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    // Get snapshot
    const snapshot = await this.getSnapshot(snapshotId);
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    // Update environment with snapshot variables
    const { error } = await supabase
      .from('environments')
      .update({ variables: snapshot.variables })
      .eq('id', snapshot.environmentId);

    if (error) {
      throw new Error(`Failed to restore snapshot: ${error.message}`);
    }
  }

  /**
   * Compare two snapshots
   */
  async compareSnapshots(
    baselineSnapshotId: string,
    comparedSnapshotId: string
  ): Promise<VariableDiff[]> {
    const { data, error } = await supabase.rpc('compare_snapshots', {
      p_baseline_snapshot_id: baselineSnapshotId,
      p_compared_snapshot_id: comparedSnapshotId,
    });

    if (error) {
      throw new Error(`Failed to compare snapshots: ${error.message}`);
    }

    return (data || []).map(
      (d: { variable_key: string; change_type: string; baseline_value: unknown; compared_value: unknown }) => ({
        key: d.variable_key,
        type: d.change_type as 'added' | 'removed' | 'modified',
        leftValue: d.baseline_value as string | undefined,
        rightValue: d.compared_value as string | undefined,
      })
    );
  }

  /**
   * Compare two environments
   */
  async compareEnvironments(
    leftEnvironmentId: string,
    rightEnvironmentId: string,
    options?: {
      leftSnapshotId?: string;
      rightSnapshotId?: string;
      notes?: string;
    }
  ): Promise<EnvironmentComparison> {
    const userId = await this.getCurrentUserId();

    // Get variables from environments or snapshots
    let leftVars: Record<string, string>;
    let rightVars: Record<string, string>;

    if (options?.leftSnapshotId) {
      const snapshot = await this.getSnapshot(options.leftSnapshotId);
      if (!snapshot) throw new Error('Left snapshot not found');
      leftVars = snapshot.variables;
    } else {
      const { data, error } = await supabase
        .from('environments')
        .select('variables')
        .eq('id', leftEnvironmentId)
        .single();
      if (error) throw new Error(`Failed to get left environment: ${error.message}`);
      leftVars = data.variables || {};
    }

    if (options?.rightSnapshotId) {
      const snapshot = await this.getSnapshot(options.rightSnapshotId);
      if (!snapshot) throw new Error('Right snapshot not found');
      rightVars = snapshot.variables;
    } else {
      const { data, error } = await supabase
        .from('environments')
        .select('variables')
        .eq('id', rightEnvironmentId)
        .single();
      if (error) throw new Error(`Failed to get right environment: ${error.message}`);
      rightVars = data.variables || {};
    }

    // Calculate differences
    const diffDetails: VariableDiff[] = [];
    const allKeys = new Set([...Object.keys(leftVars), ...Object.keys(rightVars)]);

    for (const key of allKeys) {
      const leftValue = leftVars[key];
      const rightValue = rightVars[key];

      if (leftValue === undefined) {
        diffDetails.push({ key, type: 'added', rightValue });
      } else if (rightValue === undefined) {
        diffDetails.push({ key, type: 'removed', leftValue });
      } else if (leftValue !== rightValue) {
        diffDetails.push({ key, type: 'modified', leftValue, rightValue });
      }
    }

    const addedCount = diffDetails.filter((d) => d.type === 'added').length;
    const removedCount = diffDetails.filter((d) => d.type === 'removed').length;
    const modifiedCount = diffDetails.filter((d) => d.type === 'modified').length;

    // Save comparison
    const { data, error } = await supabase
      .from('environment_comparisons')
      .insert({
        left_environment_id: leftEnvironmentId,
        right_environment_id: rightEnvironmentId,
        left_snapshot_id: options?.leftSnapshotId,
        right_snapshot_id: options?.rightSnapshotId,
        total_differences: diffDetails.length,
        added_count: addedCount,
        removed_count: removedCount,
        modified_count: modifiedCount,
        diff_details: diffDetails,
        compared_by: userId,
        notes: options?.notes,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save comparison: ${error.message}`);
    }

    return this.mapComparison(data);
  }

  /**
   * Detect drift for an environment
   */
  async detectDrift(environmentId: string): Promise<DriftRecord[]> {
    const { data, error } = await supabase.rpc('detect_environment_drift', {
      p_environment_id: environmentId,
    });

    if (error) {
      throw new Error(`Failed to detect drift: ${error.message}`);
    }

    // Convert drift results to records
    const driftRecords: DriftRecord[] = [];

    for (const drift of data || []) {
      // Save drift record
      const { data: record, error: insertError } = await supabase
        .from('environment_drift_records')
        .insert({
          environment_id: environmentId,
          category: `variable_${drift.drift_type}` as DriftCategory,
          severity: drift.severity as DriftSeverity,
          variable_key: drift.variable_key,
          baseline_value: drift.snapshot_value,
          current_value: drift.current_value,
          description: `Variable '${drift.variable_key}' was ${drift.drift_type}`,
        })
        .select()
        .single();

      if (!insertError && record) {
        driftRecords.push(this.mapDriftRecord(record));
      }
    }

    return driftRecords;
  }

  /**
   * Get drift records for an environment
   */
  async getDriftRecords(
    environmentId: string,
    options?: {
      includeResolved?: boolean;
      severity?: DriftSeverity;
      limit?: number;
    }
  ): Promise<DriftRecord[]> {
    let query = supabase
      .from('environment_drift_records')
      .select('*')
      .eq('environment_id', environmentId)
      .order('detected_at', { ascending: false });

    if (options?.includeResolved === false) {
      query = query.eq('is_resolved', false);
    }

    if (options?.severity) {
      query = query.eq('severity', options.severity);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get drift records: ${error.message}`);
    }

    return (data || []).map((d: Record<string, unknown>) => this.mapDriftRecord(d));
  }

  /**
   * Resolve a drift record
   */
  async resolveDrift(driftId: string): Promise<void> {
    const { error } = await supabase.rpc('resolve_drift_record', {
      p_drift_id: driftId,
    });

    if (error) {
      throw new Error(`Failed to resolve drift: ${error.message}`);
    }
  }

  /**
   * Get environment timeline (snapshots + drift events)
   */
  async getTimeline(
    environmentId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<TimelineEvent[]> {
    let query = supabase
      .from('environment_timeline')
      .select('*')
      .eq('environment_id', environmentId)
      .order('event_time', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get timeline: ${error.message}`);
    }

    return (data || []).map((e: Record<string, unknown>) => this.mapTimelineEvent(e));
  }

  /**
   * Map database snapshot to EnvironmentSnapshot type
   */
  private mapSnapshot(data: Record<string, unknown>): EnvironmentSnapshot {
    return {
      id: data.id as string,
      environmentId: (data.environment_id ?? data.environmentId) as string,
      workspaceId: (data.workspace_id ?? data.workspaceId) as string | undefined,
      userId: (data.user_id ?? data.userId) as string,
      name: data.name as string,
      description: data.description as string | undefined,
      variables: (data.variables || {}) as Record<string, string>,
      version: data.version as number,
      isAutoSnapshot: (data.is_auto_snapshot ?? data.isAutoSnapshot ?? false) as boolean,
      triggerType: (data.trigger_type ?? data.triggerType) as TriggerType | undefined,
      createdAt: (data.created_at ?? data.createdAt) as string,
      triggeredByRequestId: (data.triggered_by_request_id ?? data.triggeredByRequestId) as
        | string
        | undefined,
      triggeredByDeploymentId: (data.triggered_by_deployment_id ?? data.triggeredByDeploymentId) as
        | string
        | undefined,
    };
  }

  /**
   * Map database drift record to DriftRecord type
   */
  private mapDriftRecord(data: Record<string, unknown>): DriftRecord {
    return {
      id: data.id as string,
      environmentId: (data.environment_id ?? data.environmentId) as string,
      workspaceId: (data.workspace_id ?? data.workspaceId) as string | undefined,
      baselineSnapshotId: (data.baseline_snapshot_id ?? data.baselineSnapshotId) as
        | string
        | undefined,
      comparedSnapshotId: (data.compared_snapshot_id ?? data.comparedSnapshotId) as
        | string
        | undefined,
      category: data.category as DriftCategory,
      severity: data.severity as DriftSeverity,
      variableKey: (data.variable_key ?? data.variableKey) as string | undefined,
      baselineValue: (data.baseline_value ?? data.baselineValue) as unknown,
      currentValue: (data.current_value ?? data.currentValue) as unknown,
      description: data.description as string | undefined,
      recommendation: data.recommendation as string | undefined,
      isResolved: (data.is_resolved ?? data.isResolved ?? false) as boolean,
      resolvedAt: (data.resolved_at ?? data.resolvedAt) as string | undefined,
      resolvedBy: (data.resolved_by ?? data.resolvedBy) as string | undefined,
      detectedAt: (data.detected_at ?? data.detectedAt) as string,
      createdAt: (data.created_at ?? data.createdAt) as string,
    };
  }

  /**
   * Map database comparison to EnvironmentComparison type
   */
  private mapComparison(data: Record<string, unknown>): EnvironmentComparison {
    return {
      id: data.id as string,
      leftEnvironmentId: (data.left_environment_id ?? data.leftEnvironmentId) as string,
      rightEnvironmentId: (data.right_environment_id ?? data.rightEnvironmentId) as string,
      leftSnapshotId: (data.left_snapshot_id ?? data.leftSnapshotId) as string | undefined,
      rightSnapshotId: (data.right_snapshot_id ?? data.rightSnapshotId) as string | undefined,
      totalDifferences: (data.total_differences ?? data.totalDifferences ?? 0) as number,
      addedCount: (data.added_count ?? data.addedCount ?? 0) as number,
      removedCount: (data.removed_count ?? data.removedCount ?? 0) as number,
      modifiedCount: (data.modified_count ?? data.modifiedCount ?? 0) as number,
      diffDetails: (data.diff_details ?? data.diffDetails ?? []) as VariableDiff[],
      comparedBy: (data.compared_by ?? data.comparedBy) as string,
      workspaceId: (data.workspace_id ?? data.workspaceId) as string | undefined,
      notes: data.notes as string | undefined,
      createdAt: (data.created_at ?? data.createdAt) as string,
    };
  }

  /**
   * Map database timeline event to TimelineEvent type
   */
  private mapTimelineEvent(data: Record<string, unknown>): TimelineEvent {
    return {
      eventType: (data.event_type ?? data.eventType) as 'snapshot' | 'drift',
      eventId: (data.event_id ?? data.eventId) as string,
      environmentId: (data.environment_id ?? data.environmentId) as string,
      workspaceId: (data.workspace_id ?? data.workspaceId) as string | undefined,
      eventName: (data.event_name ?? data.eventName) as string,
      eventDescription: (data.event_description ?? data.eventDescription) as string | undefined,
      eventTime: (data.event_time ?? data.eventTime) as string,
      userId: (data.user_id ?? data.userId) as string | undefined,
      triggerType: (data.trigger_type ?? data.triggerType) as string | undefined,
      severity: data.severity as DriftSeverity | undefined,
      category: data.category as DriftCategory | undefined,
      data: (data.data ?? {}) as Record<string, unknown>,
    };
  }
}

// Export singleton instance
export const snapshotService = new SnapshotService();