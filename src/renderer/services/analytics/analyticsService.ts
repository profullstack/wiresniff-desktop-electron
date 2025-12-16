/**
 * Analytics Service
 *
 * Privacy-friendly analytics using Datafast with:
 * - Opt-in consent management
 * - Offline event queue
 * - Custom event tracking for WireSniff features
 * - Goal tracking for conversion events
 * - User identification (optional, for paid users)
 */

// Extend Window interface for Datafast
declare global {
  interface Window {
    datafast?: (
      eventName: string,
      props?: Record<string, string | number | boolean>
    ) => void;
  }
}

// Storage keys
const ANALYTICS_CONSENT_KEY = 'wiresniff_analytics_consent';
const ANALYTICS_QUEUE_KEY = 'wiresniff_analytics_queue';
const ANALYTICS_USER_ID_KEY = 'wiresniff_analytics_user_id';

// Event types for WireSniff - organized by category
export type AnalyticsEventName =
  // ==================== App Lifecycle ====================
  | 'app_launch'
  | 'app_close'
  | 'app_update_available'
  | 'app_update_installed'
  
  // ==================== Authentication ====================
  | 'user_signup'
  | 'user_login'
  | 'user_logout'
  | 'password_reset_requested'
  | 'email_verified'
  
  // ==================== Subscription & Billing (Goals) ====================
  | 'initiate_checkout'        // Goal: User starts checkout
  | 'subscription_started'     // Goal: Successful subscription
  | 'subscription_upgraded'    // Goal: Plan upgrade
  | 'subscription_downgraded'
  | 'subscription_cancelled'
  | 'subscription_renewed'
  | 'payment_failed'
  | 'trial_started'
  | 'trial_ended'
  
  // ==================== Onboarding ====================
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  
  // ==================== Request Builder ====================
  | 'request_created'
  | 'request_sent'
  | 'request_saved'
  | 'request_duplicated'
  | 'request_deleted'
  | 'request_method_changed'
  | 'request_header_added'
  | 'request_body_edited'
  | 'request_auth_configured'
  
  // ==================== Collections ====================
  | 'collection_created'
  | 'collection_imported'
  | 'collection_exported'
  | 'collection_shared'
  | 'collection_deleted'
  | 'collection_folder_created'
  
  // ==================== Capture & Replay (Core Feature) ====================
  | 'capture_started'
  | 'capture_stopped'
  | 'capture_paused'
  | 'capture_resumed'
  | 'capture_filtered'
  | 'capture_exported'
  | 'replay_executed'
  | 'replay_batch_executed'
  | 'diff_generated'
  | 'diff_exported'
  
  // ==================== Workspaces (Team Feature) ====================
  | 'workspace_created'
  | 'workspace_joined'
  | 'workspace_left'
  | 'workspace_deleted'
  | 'workspace_member_invited'
  | 'workspace_member_removed'
  | 'workspace_role_changed'
  | 'workspace_settings_updated'
  
  // ==================== Environments ====================
  | 'environment_created'
  | 'environment_switched'
  | 'environment_variable_added'
  | 'environment_variable_edited'
  | 'environment_exported'
  | 'environment_imported'
  | 'environment_snapshot_created'
  | 'environment_snapshot_restored'
  | 'drift_detected'
  | 'drift_resolved'
  
  // ==================== Secrets Vault ====================
  | 'secret_created'
  | 'secret_accessed'
  | 'secret_updated'
  | 'secret_deleted'
  | 'secret_shared'
  
  // ==================== Live Traffic Watch ====================
  | 'live_traffic_started'
  | 'live_traffic_stopped'
  | 'live_traffic_filtered'
  | 'live_traffic_request_inspected'
  | 'live_traffic_request_replayed'
  | 'live_traffic_session_saved'
  
  // ==================== Protocol: HTTP/REST ====================
  | 'http_request_sent'
  | 'http_response_received'
  | 'http_error_occurred'
  
  // ==================== Protocol: WebSocket ====================
  | 'websocket_connected'
  | 'websocket_disconnected'
  | 'websocket_message_sent'
  | 'websocket_message_received'
  | 'websocket_session_saved'
  | 'websocket_graphql_subscription'
  
  // ==================== Protocol: gRPC ====================
  | 'grpc_connected'
  | 'grpc_disconnected'
  | 'grpc_proto_loaded'
  | 'grpc_unary_call'
  | 'grpc_streaming_call'
  | 'grpc_call_completed'
  | 'grpc_exported_grpcurl'
  
  // ==================== Protocol: TCP ====================
  | 'tcp_connected'
  | 'tcp_disconnected'
  | 'tcp_data_sent'
  | 'tcp_data_received'
  | 'tcp_session_saved'
  
  // ==================== Protocol: SSE ====================
  | 'sse_connected'
  | 'sse_disconnected'
  | 'sse_event_received'
  | 'sse_session_saved'
  
  // ==================== Protocol: GraphQL ====================
  | 'graphql_query_sent'
  | 'graphql_mutation_sent'
  | 'graphql_subscription_started'
  | 'graphql_schema_loaded'
  
  // ==================== Import/Export ====================
  | 'import_started'
  | 'import_postman'
  | 'import_insomnia'
  | 'import_openapi'
  | 'import_curl'
  | 'import_har'
  | 'import_completed'
  | 'import_failed'
  | 'export_started'
  | 'export_completed'
  
  // ==================== AI Features ====================
  | 'ai_capture_explained'
  | 'ai_diff_explained'
  | 'ai_test_generated'
  | 'ai_request_suggested'
  | 'ai_error_diagnosed'
  
  // ==================== Settings ====================
  | 'settings_opened'
  | 'settings_changed'
  | 'theme_changed'
  | 'proxy_configured'
  | 'ssl_cert_installed'
  
  // ==================== Errors & Support ====================
  | 'error_occurred'
  | 'error_reported'
  | 'feedback_submitted'
  | 'support_contacted'
  | 'docs_opened'
  
  // ==================== UI Interactions ====================
  | 'tab_opened'
  | 'tab_closed'
  | 'sidebar_toggled'
  | 'keyboard_shortcut_used'
  | 'context_menu_used'
  | 'search_performed';

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  props?: Record<string, string | number | boolean>;
  timestamp: number;
}

interface QueuedEvent extends AnalyticsEvent {
  retryCount: number;
}

// Goal events that should be tracked for conversion
const GOAL_EVENTS: AnalyticsEventName[] = [
  'initiate_checkout',
  'subscription_started',
  'subscription_upgraded',
  'user_signup',
  'workspace_created',
  'import_completed',
  'capture_started',
  'ai_capture_explained',
];

class AnalyticsService {
  private isEnabled: boolean = false;
  private userId: string | null = null;
  private userEmail: string | null = null;
  private userName: string | null = null;
  private eventQueue: QueuedEvent[] = [];
  private isProcessingQueue: boolean = false;
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.loadState();
    this.startQueueProcessor();
  }

  /**
   * Load persisted state from localStorage
   */
  private loadState(): void {
    try {
      const consent = localStorage.getItem(ANALYTICS_CONSENT_KEY);
      this.isEnabled = consent === 'true';
      this.userId = localStorage.getItem(ANALYTICS_USER_ID_KEY);

      const queueData = localStorage.getItem(ANALYTICS_QUEUE_KEY);
      if (queueData) {
        this.eventQueue = JSON.parse(queueData);
      }
    } catch (error) {
      console.warn('Failed to load analytics state:', error);
    }
  }

  /**
   * Save event queue to localStorage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(this.eventQueue));
    } catch (error) {
      console.warn('Failed to save analytics queue:', error);
    }
  }

  /**
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    this.flushInterval = setInterval(() => {
      this.processQueue();
    }, 30000);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.processQueue();
        }
      });
    }
  }

  /**
   * Process queued events
   */
  private async processQueue(): Promise<void> {
    if (!this.isEnabled || this.isProcessingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const eventsToProcess = [...this.eventQueue];
      const successfulEvents: QueuedEvent[] = [];

      for (const event of eventsToProcess) {
        try {
          this.sendToDatafast(event.name, event.props);
          successfulEvents.push(event);
        } catch (error) {
          event.retryCount++;
          if (event.retryCount >= 3) {
            successfulEvents.push(event);
          }
        }
      }

      this.eventQueue = this.eventQueue.filter(
        (e) => !successfulEvents.includes(e)
      );
      this.saveQueue();
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Send event to Datafast using native API
   */
  private sendToDatafast(
    eventName: string,
    props?: Record<string, string | number | boolean>
  ): void {
    if (typeof window !== 'undefined' && window.datafast) {
      const enrichedProps = {
        ...props,
        ...(this.userId ? { user_id: this.userId } : {}),
        ...(this.userEmail ? { email: this.userEmail } : {}),
        ...(this.userName ? { name: this.userName } : {}),
        app_version: this.getAppVersion(),
        platform: this.getPlatform(),
        timestamp: new Date().toISOString(),
      };

      window.datafast(eventName, enrichedProps);
    }
  }

  /**
   * Get app version
   */
  private getAppVersion(): string {
    try {
      if (typeof window !== 'undefined' && (window as any).electron?.getVersion) {
        return (window as any).electron.getVersion();
      }
      return '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  /**
   * Get platform
   */
  private getPlatform(): string {
    if (typeof navigator !== 'undefined') {
      const platform = navigator.platform.toLowerCase();
      if (platform.includes('mac')) return 'macos';
      if (platform.includes('win')) return 'windows';
      if (platform.includes('linux')) return 'linux';
    }
    return 'unknown';
  }

  // ==================== Public API ====================

  /**
   * Check if analytics is enabled
   */
  isAnalyticsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Enable analytics (user opted in)
   */
  enableAnalytics(): void {
    this.isEnabled = true;
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'true');
    this.track('app_launch', { opted_in: true });
  }

  /**
   * Disable analytics (user opted out)
   */
  disableAnalytics(): void {
    this.isEnabled = false;
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'false');
    this.eventQueue = [];
    this.saveQueue();
  }

  /**
   * Set user identity for tracking
   */
  identify(userId: string, email?: string, name?: string): void {
    this.userId = userId;
    this.userEmail = email || null;
    this.userName = name || null;
    localStorage.setItem(ANALYTICS_USER_ID_KEY, userId);
  }

  /**
   * Clear user identity
   */
  clearIdentity(): void {
    this.userId = null;
    this.userEmail = null;
    this.userName = null;
    localStorage.removeItem(ANALYTICS_USER_ID_KEY);
  }

  /**
   * Track an event
   */
  track(
    name: AnalyticsEventName,
    props?: Record<string, string | number | boolean>
  ): void {
    if (!this.isEnabled) {
      return;
    }

    // Send immediately if Datafast is available
    if (typeof window !== 'undefined' && window.datafast) {
      this.sendToDatafast(name, props);
    } else {
      // Queue for later
      const event: QueuedEvent = {
        name,
        props,
        timestamp: Date.now(),
        retryCount: 0,
      };
      this.eventQueue.push(event);
      this.saveQueue();
    }
  }

  /**
   * Track a goal event (for conversion tracking)
   */
  trackGoal(
    name: AnalyticsEventName,
    props?: Record<string, string | number | boolean>
  ): void {
    if (!GOAL_EVENTS.includes(name)) {
      console.warn(`Event "${name}" is not a registered goal event`);
    }
    this.track(name, { ...props, is_goal: true });
  }

  /**
   * Track checkout initiation (Datafast goal)
   */
  trackCheckout(productId: string, planName: string, price?: number): void {
    this.track('initiate_checkout', {
      product_id: productId,
      plan_name: planName,
      ...(price ? { price } : {}),
      ...(this.userName ? { name: this.userName } : {}),
      ...(this.userEmail ? { email: this.userEmail } : {}),
    });
  }

  /**
   * Track subscription started (Datafast goal)
   */
  trackSubscription(
    productId: string,
    planName: string,
    billingCycle: 'monthly' | 'yearly'
  ): void {
    this.track('subscription_started', {
      product_id: productId,
      plan_name: planName,
      billing_cycle: billingCycle,
      ...(this.userName ? { name: this.userName } : {}),
      ...(this.userEmail ? { email: this.userEmail } : {}),
    });
  }

  /**
   * Track page view
   */
  trackPageView(pageName: string): void {
    this.track('tab_opened', { page: pageName });
  }

  /**
   * Flush all queued events
   */
  async flush(): Promise<void> {
    await this.processQueue();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.saveQueue();
  }
}

// Singleton instance
export const analytics = new AnalyticsService();

// ==================== Convenience Functions ====================

export const trackEvent = (
  name: AnalyticsEventName,
  props?: Record<string, string | number | boolean>
): void => {
  analytics.track(name, props);
};

export const trackGoal = (
  name: AnalyticsEventName,
  props?: Record<string, string | number | boolean>
): void => {
  analytics.trackGoal(name, props);
};

export const trackCheckout = (
  productId: string,
  planName: string,
  price?: number
): void => {
  analytics.trackCheckout(productId, planName, price);
};

export const trackSubscription = (
  productId: string,
  planName: string,
  billingCycle: 'monthly' | 'yearly'
): void => {
  analytics.trackSubscription(productId, planName, billingCycle);
};

export const identifyUser = (
  userId: string,
  email?: string,
  name?: string
): void => {
  analytics.identify(userId, email, name);
};

export const clearUserIdentity = (): void => {
  analytics.clearIdentity();
};

export const enableAnalytics = (): void => {
  analytics.enableAnalytics();
};

export const disableAnalytics = (): void => {
  analytics.disableAnalytics();
};

export const isAnalyticsEnabled = (): boolean => {
  return analytics.isAnalyticsEnabled();
};

export default analytics;