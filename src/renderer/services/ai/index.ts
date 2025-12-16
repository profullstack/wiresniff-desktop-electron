/**
 * AI Service Module
 *
 * Exports AI-powered analysis features including:
 * - Capture Explainer: Analyzes captured requests for auth flows, JWT, cookies
 * - Diff Explainer: Explains differences between responses
 * - Auto-Test Generator: Generates test cases from captured traffic
 */

export {
  AIService,
  aiService,
  type CapturedRequest,
  type CapturedResponse,
  type CaptureExplanation,
  type AuthFlowAnalysis,
  type JWTAnalysis,
  type CookieAnalysis,
  type CORSAnalysis,
  type SecurityAnalysis,
  type DiffExplanation,
  type HeaderDiffExplanation,
  type BodyDiffExplanation,
  type TimingDiffExplanation,
  type GeneratedTest,
  type TestAssertion,
  type AIServiceConfig,
} from './aiService';