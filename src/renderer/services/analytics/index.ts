/**
 * Analytics Service
 *
 * Privacy-friendly analytics using Datafast.
 */

export {
  analytics,
  trackEvent,
  trackGoal,
  trackCheckout,
  trackSubscription,
  identifyUser,
  clearUserIdentity,
  enableAnalytics,
  disableAnalytics,
  isAnalyticsEnabled,
  default,
} from './analyticsService';

export type { AnalyticsEventName, AnalyticsEvent } from './analyticsService';