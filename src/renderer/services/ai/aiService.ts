/**
 * AI Service
 *
 * Provides AI-powered analysis features including:
 * - Capture Explainer: Analyzes captured requests for auth flows, JWT, cookies
 * - Diff Explainer: Explains differences between responses
 * - Auto-Test Generator: Generates test cases from captured traffic
 */

import { supabase } from '../supabase/client';

// Types
export interface CapturedRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: string;
}

export interface CapturedResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
  timing?: {
    dns?: number;
    connect?: number;
    tls?: number;
    ttfb?: number;
    download?: number;
    total: number;
  };
}

export interface CaptureExplanation {
  summary: string;
  authFlow?: AuthFlowAnalysis;
  jwt?: JWTAnalysis;
  cookies?: CookieAnalysis[];
  cors?: CORSAnalysis;
  security?: SecurityAnalysis;
  recommendations?: string[];
}

export interface AuthFlowAnalysis {
  type: 'bearer' | 'basic' | 'api_key' | 'oauth2' | 'session' | 'none' | 'unknown';
  description: string;
  location?: 'header' | 'query' | 'cookie' | 'body';
  headerName?: string;
  isValid?: boolean;
  expiresAt?: string;
}

export interface JWTAnalysis {
  isValid: boolean;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  algorithm: string;
  issuer?: string;
  subject?: string;
  audience?: string;
  expiresAt?: string;
  issuedAt?: string;
  isExpired: boolean;
  claims: string[];
}

export interface CookieAnalysis {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  purpose?: string;
}

export interface CORSAnalysis {
  isEnabled: boolean;
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  allowCredentials?: boolean;
  maxAge?: number;
  issues?: string[];
}

export interface SecurityAnalysis {
  https: boolean;
  hsts?: boolean;
  csp?: string;
  xFrameOptions?: string;
  xContentTypeOptions?: boolean;
  xXssProtection?: boolean;
  issues: string[];
  score: number;
}

export interface DiffExplanation {
  summary: string;
  headerDifferences?: HeaderDiffExplanation[];
  bodyDifferences?: BodyDiffExplanation;
  timingDifferences?: TimingDiffExplanation;
  possibleCauses: string[];
  recommendations: string[];
}

export interface HeaderDiffExplanation {
  header: string;
  leftValue?: string;
  rightValue?: string;
  type: 'added' | 'removed' | 'modified';
  explanation: string;
  significance: 'low' | 'medium' | 'high';
}

export interface BodyDiffExplanation {
  type: 'json' | 'text' | 'binary' | 'html' | 'xml';
  changes: number;
  explanation: string;
  keyDifferences?: string[];
}

export interface TimingDiffExplanation {
  totalDiff: number;
  percentChange: number;
  explanation: string;
  possibleCauses: string[];
}

export interface GeneratedTest {
  name: string;
  description: string;
  framework: 'vitest' | 'jest' | 'mocha' | 'playwright';
  code: string;
  assertions: TestAssertion[];
}

export interface TestAssertion {
  type: 'status' | 'header' | 'body' | 'timing' | 'schema';
  description: string;
  expected: unknown;
}

export interface AIServiceConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

export class AIService {
  private config: AIServiceConfig;

  constructor(config?: Partial<AIServiceConfig>) {
    this.config = {
      provider: config?.provider || 'local',
      model: config?.model || 'gpt-4',
      maxTokens: config?.maxTokens || 2000,
      ...config,
    };
  }

  /**
   * Analyze a captured request and provide explanations
   */
  async explainCapture(
    request: CapturedRequest,
    response?: CapturedResponse
  ): Promise<CaptureExplanation> {
    const explanation: CaptureExplanation = {
      summary: this.generateCaptureSummary(request, response),
      recommendations: [],
    };

    explanation.authFlow = this.analyzeAuthFlow(request);

    const jwtToken = this.extractJWT(request);
    if (jwtToken) {
      explanation.jwt = this.analyzeJWT(jwtToken);
    }

    explanation.cookies = this.analyzeCookies(request, response);

    if (response) {
      explanation.cors = this.analyzeCORS(request, response);
      explanation.security = this.analyzeSecurityHeaders(response);
    }

    explanation.recommendations = this.generateRecommendations(explanation);

    return explanation;
  }

  /**
   * Explain differences between two responses
   */
  async explainDiff(
    leftResponse: CapturedResponse,
    rightResponse: CapturedResponse,
    context?: { leftLabel?: string; rightLabel?: string }
  ): Promise<DiffExplanation> {
    const headerDiffs = this.explainHeaderDifferences(leftResponse, rightResponse);
    const bodyDiff = this.explainBodyDifferences(leftResponse, rightResponse);
    const timingDiff = this.explainTimingDifferences(leftResponse, rightResponse);

    const possibleCauses = this.inferDiffCauses(headerDiffs, bodyDiff, timingDiff);
    const recommendations = this.generateDiffRecommendations(headerDiffs, bodyDiff, timingDiff);

    return {
      summary: this.generateDiffSummary(
        headerDiffs,
        bodyDiff,
        timingDiff,
        context?.leftLabel,
        context?.rightLabel
      ),
      headerDifferences: headerDiffs,
      bodyDifferences: bodyDiff,
      timingDifferences: timingDiff,
      possibleCauses,
      recommendations,
    };
  }

  /**
   * Generate test cases from captured traffic
   */
  async generateTests(
    request: CapturedRequest,
    response: CapturedResponse,
    options?: {
      framework?: 'vitest' | 'jest' | 'mocha' | 'playwright';
      includeSchema?: boolean;
      includeTiming?: boolean;
    }
  ): Promise<GeneratedTest[]> {
    const framework = options?.framework || 'vitest';
    const tests: GeneratedTest[] = [];

    tests.push(this.generateStatusTest(request, response, framework));

    const headerTests = this.generateHeaderTests(request, response, framework);
    tests.push(...headerTests);

    if (response.body) {
      const bodyTests = this.generateBodyTests(request, response, framework, options?.includeSchema);
      tests.push(...bodyTests);
    }

    if (options?.includeTiming && response.timing) {
      tests.push(this.generateTimingTest(request, response, framework));
    }

    return tests;
  }

  /**
   * Save AI insight to cloud (for paid users)
   */
  async saveInsight(
    type: 'capture' | 'diff' | 'test',
    data: CaptureExplanation | DiffExplanation | GeneratedTest[],
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error('User must be authenticated to save insights');
    }

    const { data: insight, error } = await supabase
      .from('ai_insights')
      .insert({
        user_id: user.user.id,
        type,
        data,
        metadata,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save insight: ${error.message}`);
    }

    return insight.id;
  }

  // Private helper methods

  private generateCaptureSummary(request: CapturedRequest, response?: CapturedResponse): string {
    const method = request.method.toUpperCase();
    const url = new URL(request.url);
    const status = response ? `${response.statusCode} ${response.statusText}` : 'No response';
    return `${method} request to ${url.pathname} returned ${status}`;
  }

  private analyzeAuthFlow(request: CapturedRequest): AuthFlowAnalysis {
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];
    
    if (authHeader) {
      if (authHeader.toLowerCase().startsWith('bearer ')) {
        return {
          type: 'bearer',
          description: 'Bearer token authentication detected',
          location: 'header',
          headerName: 'Authorization',
        };
      }
      if (authHeader.toLowerCase().startsWith('basic ')) {
        return {
          type: 'basic',
          description: 'Basic authentication detected (username:password encoded)',
          location: 'header',
          headerName: 'Authorization',
        };
      }
    }

    const apiKeyHeaders = ['x-api-key', 'api-key', 'apikey', 'x-auth-token'];
    for (const header of apiKeyHeaders) {
      if (request.headers[header] || request.headers[header.toLowerCase()]) {
        return {
          type: 'api_key',
          description: `API key authentication detected in ${header} header`,
          location: 'header',
          headerName: header,
        };
      }
    }

    const url = new URL(request.url);
    const apiKeyParams = ['api_key', 'apikey', 'key', 'token', 'access_token'];
    for (const param of apiKeyParams) {
      if (url.searchParams.has(param)) {
        return {
          type: 'api_key',
          description: `API key detected in query parameter: ${param}`,
          location: 'query',
        };
      }
    }

    const cookies = request.headers['cookie'] || request.headers['Cookie'];
    if (cookies) {
      const sessionCookies = ['session', 'sessionid', 'sid', 'connect.sid', 'PHPSESSID', 'JSESSIONID'];
      for (const sessionCookie of sessionCookies) {
        if (cookies.toLowerCase().includes(sessionCookie.toLowerCase())) {
          return {
            type: 'session',
            description: `Session-based authentication detected via ${sessionCookie} cookie`,
            location: 'cookie',
          };
        }
      }
    }

    return { type: 'none', description: 'No authentication detected' };
  }

  private extractJWT(request: CapturedRequest): string | null {
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];
    
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.substring(7);
      if (this.isJWT(token)) return token;
    }

    const cookies = request.headers['cookie'] || request.headers['Cookie'];
    if (cookies) {
      const cookiePairs = cookies.split(';').map((c) => c.trim().split('='));
      for (const [, value] of cookiePairs) {
        if (value && this.isJWT(value)) return value;
      }
    }

    return null;
  }

  private isJWT(token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    try {
      JSON.parse(atob(parts[0]));
      JSON.parse(atob(parts[1]));
      return true;
    } catch {
      return false;
    }
  }

  private analyzeJWT(token: string): JWTAnalysis {
    const parts = token.split('.');
    try {
      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp ? payload.exp < now : false;
      
      return {
        isValid: true,
        header,
        payload,
        algorithm: header.alg || 'unknown',
        issuer: payload.iss,
        subject: payload.sub,
        audience: payload.aud,
        expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined,
        issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : undefined,
        isExpired,
        claims: Object.keys(payload),
      };
    } catch {
      return {
        isValid: false,
        header: {},
        payload: {},
        algorithm: 'unknown',
        isExpired: false,
        claims: [],
      };
    }
  }

  private analyzeCookies(request: CapturedRequest, response?: CapturedResponse): CookieAnalysis[] {
    const cookies: CookieAnalysis[] = [];
    
    if (response) {
      const setCookieHeaders = response.headers['set-cookie'] || response.headers['Set-Cookie'];
      if (setCookieHeaders) {
        const cookieStrings = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
        for (const cookieStr of cookieStrings) {
          const cookie = this.parseCookie(cookieStr);
          if (cookie) cookies.push(cookie);
        }
      }
    }

    return cookies;
  }

  private parseCookie(cookieStr: string): CookieAnalysis | null {
    const parts = cookieStr.split(';').map((p) => p.trim());
    if (parts.length === 0) return null;

    const [nameValue, ...attributes] = parts;
    const [name, value] = nameValue.split('=');
    if (!name) return null;

    const cookie: CookieAnalysis = {
      name,
      value: value || '',
      httpOnly: false,
      secure: false,
    };

    for (const attr of attributes) {
      const [key, val] = attr.split('=');
      const keyLower = key.toLowerCase();
      
      switch (keyLower) {
        case 'domain': cookie.domain = val; break;
        case 'path': cookie.path = val; break;
        case 'expires': cookie.expires = val; break;
        case 'httponly': cookie.httpOnly = true; break;
        case 'secure': cookie.secure = true; break;
        case 'samesite': cookie.sameSite = val?.toLowerCase() as 'strict' | 'lax' | 'none'; break;
      }
    }

    cookie.purpose = this.inferCookiePurpose(cookie.name);
    return cookie;
  }

  private inferCookiePurpose(name: string): string {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('session') || nameLower.includes('sid')) return 'Session management';
    if (nameLower.includes('csrf') || nameLower.includes('xsrf')) return 'CSRF protection';
    if (nameLower.includes('auth') || nameLower.includes('token')) return 'Authentication';
    if (nameLower.includes('pref') || nameLower.includes('settings')) return 'User preferences';
    if (nameLower.includes('analytics') || nameLower.includes('ga')) return 'Analytics tracking';
    return 'Unknown';
  }

  private analyzeCORS(_request: CapturedRequest, response: CapturedResponse): CORSAnalysis {
    const analysis: CORSAnalysis = { isEnabled: false, issues: [] };

    const acao = response.headers['access-control-allow-origin'] || response.headers['Access-Control-Allow-Origin'];
    if (acao) {
      analysis.isEnabled = true;
      analysis.allowedOrigins = acao === '*' ? ['*'] : [acao];
      if (acao === '*') {
        analysis.issues?.push('Wildcard origin (*) allows any website to make requests');
      }
    }

    const acam = response.headers['access-control-allow-methods'] || response.headers['Access-Control-Allow-Methods'];
    if (acam) analysis.allowedMethods = acam.split(',').map((m) => m.trim());

    const acah = response.headers['access-control-allow-headers'] || response.headers['Access-Control-Allow-Headers'];
    if (acah) analysis.allowedHeaders = acah.split(',').map((h) => h.trim());

    const acac = response.headers['access-control-allow-credentials'] || response.headers['Access-Control-Allow-Credentials'];
    if (acac) {
      analysis.allowCredentials = acac.toLowerCase() === 'true';
      if (analysis.allowCredentials && acao === '*') {
        analysis.issues?.push('Cannot use credentials with wildcard origin');
      }
    }

    return analysis;
  }

  private analyzeSecurityHeaders(response: CapturedResponse): SecurityAnalysis {
    const issues: string[] = [];
    let score = 100;

    const analysis: SecurityAnalysis = { https: true, issues, score: 0 };

    const hsts = response.headers['strict-transport-security'] || response.headers['Strict-Transport-Security'];
    analysis.hsts = !!hsts;
    if (!hsts) { issues.push('Missing Strict-Transport-Security header'); score -= 15; }

    const csp = response.headers['content-security-policy'] || response.headers['Content-Security-Policy'];
    analysis.csp = csp;
    if (!csp) { issues.push('Missing Content-Security-Policy header'); score -= 20; }

    const xfo = response.headers['x-frame-options'] || response.headers['X-Frame-Options'];
    analysis.xFrameOptions = xfo;
    if (!xfo) { issues.push('Missing X-Frame-Options header'); score -= 10; }

    const xcto = response.headers['x-content-type-options'] || response.headers['X-Content-Type-Options'];
    analysis.xContentTypeOptions = xcto?.toLowerCase() === 'nosniff';
    if (!analysis.xContentTypeOptions) { issues.push('Missing X-Content-Type-Options: nosniff header'); score -= 10; }

    const xxss = response.headers['x-xss-protection'] || response.headers['X-XSS-Protection'];
    analysis.xXssProtection = !!xxss;

    analysis.score = Math.max(0, score);
    return analysis;
  }

  private generateRecommendations(explanation: CaptureExplanation): string[] {
    const recommendations: string[] = [];

    if (explanation.authFlow?.type === 'none') {
      recommendations.push('Consider adding authentication to protect this endpoint');
    }
    if (explanation.authFlow?.type === 'basic') {
      recommendations.push('Basic auth transmits credentials in base64 - ensure HTTPS is used');
    }

    if (explanation.jwt?.isExpired) {
      recommendations.push('JWT token has expired - refresh the token');
    }
    if (explanation.jwt?.algorithm === 'none') {
      recommendations.push('JWT uses "none" algorithm - this is insecure');
    }

    for (const cookie of explanation.cookies || []) {
      if (!cookie.httpOnly && cookie.purpose === 'Session management') {
        recommendations.push(`Cookie "${cookie.name}" should have HttpOnly flag`);
      }
      if (!cookie.secure) {
        recommendations.push(`Cookie "${cookie.name}" should have Secure flag`);
      }
    }

    if (explanation.security && explanation.security.score < 70) {
      recommendations.push('Security headers are incomplete - review security analysis');
    }

    if (explanation.cors?.issues) {
      recommendations.push(...explanation.cors.issues);
    }

    return recommendations;
  }

  private explainHeaderDifferences(left: CapturedResponse, right: CapturedResponse): HeaderDiffExplanation[] {
    const diffs: HeaderDiffExplanation[] = [];
    const allHeaders = new Set([...Object.keys(left.headers), ...Object.keys(right.headers)]);

    for (const header of allHeaders) {
      const leftVal = left.headers[header];
      const rightVal = right.headers[header];
      if (leftVal === rightVal) continue;

      const headerLower = header.toLowerCase();
      const significance = this.getHeaderSignificance(headerLower);

      if (!leftVal) {
        diffs.push({ header, rightValue: rightVal, type: 'added', explanation: `Header "${header}" was added`, significance });
      } else if (!rightVal) {
        diffs.push({ header, leftValue: leftVal, type: 'removed', explanation: `Header "${header}" was removed`, significance });
      } else {
        const explanation = this.explainHeaderChange(headerLower, leftVal, rightVal);
        diffs.push({ header, leftValue: leftVal, rightValue: rightVal, type: 'modified', explanation, significance });
      }
    }

    return diffs;
  }

  private getHeaderSignificance(header: string): 'low' | 'medium' | 'high' {
    const high = ['content-type', 'authorization', 'set-cookie', 'cache-control', 'etag'];
    const medium = ['content-length', 'last-modified', 'expires', 'vary', 'x-request-id'];
    if (high.includes(header)) return 'high';
    if (medium.includes(header)) return 'medium';
    return 'low';
  }

  private explainHeaderChange(header: string, leftVal: string, rightVal: string): string {
    switch (header) {
      case 'cache-control': return `Cache policy changed from "${leftVal}" to "${rightVal}"`;
      case 'content-type': return `Response content type changed from "${leftVal}" to "${rightVal}"`;
      case 'etag': return 'ETag changed - content has been modified';
      case 'last-modified': return 'Last-Modified date changed - resource was updated';
      case 'content-length': return `Response size changed from ${leftVal} to ${rightVal} bytes`;
      default: return `Value changed from "${leftVal}" to "${rightVal}"`;
    }
  }

  private explainBodyDifferences(left: CapturedResponse, right: CapturedResponse): BodyDiffExplanation | undefined {
    if (!left.body && !right.body) return undefined;
    if (left.body === right.body) return undefined;

    const contentType = left.headers['content-type'] || left.headers['Content-Type'] || '';
    let type: 'json' | 'text' | 'binary' | 'html' | 'xml' = 'text';
    
    if (contentType.includes('json')) type = 'json';
    else if (contentType.includes('html')) type = 'html';
    else if (contentType.includes('xml')) type = 'xml';
    else if (contentType.includes('octet-stream')) type = 'binary';

    const keyDifferences: string[] = [];
    let changes = 0;

    if (type === 'json' && left.body && right.body) {
      try {
        const leftJson = JSON.parse(left.body);
        const rightJson = JSON.parse(right.body);
        const diffs = this.compareObjects(leftJson, rightJson);
        changes = diffs.length;
        keyDifferences.push(...diffs.slice(0, 5));
      } catch {
        changes = 1;
      }
    } else {
      changes = 1;
    }

    return {
      type,
      changes,
      explanation: `Response body has ${changes} difference${changes !== 1 ? 's' : ''}`,
      keyDifferences: keyDifferences.length > 0 ? keyDifferences : undefined,
    };
  }

  private compareObjects(left: unknown, right: unknown, path = ''): string[] {
    const diffs: string[] = [];

    if (typeof left !== typeof right) {
      diffs.push(`${path || 'root'}: type changed from ${typeof left} to ${typeof right}`);
      return diffs;
    }

    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) {
        diffs.push(`${path || 'root'}: array length changed from ${left.length} to ${right.length}`);
      }
      return diffs;
    }

    if (typeof left === 'object' && left !== null && right !== null) {
      const leftObj = left as Record<string, unknown>;
      const rightObj = right as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(leftObj), ...Object.keys(rightObj)]);
      
      for (const key of allKeys) {
        const newPath = path ? `${path}.${key}` : key;
        if (!(key in leftObj)) {
          diffs.push(`${newPath}: added`);
        } else if (!(key in rightObj)) {
          diffs.push(`${newPath}: removed`);
        } else if (leftObj[key] !== rightObj[key]) {
          if (typeof leftObj[key] === 'object') {
            diffs.push(...this.compareObjects(leftObj[key], rightObj[key], newPath));
          } else {
            diffs.push(`${newPath}: value changed`);
          }
        }
      }
    }

    return diffs;
  }

  private explainTimingDifferences(left: CapturedResponse, right: CapturedResponse): TimingDiffExplanation | undefined {
    if (!left.timing || !right.timing) return undefined;

    const totalDiff = right.timing.total - left.timing.total;
    const percentChange = (totalDiff / left.timing.total) * 100;
    const possibleCauses: string[] = [];

    if (Math.abs(percentChange) < 5) return undefined;

    if (totalDiff > 0) {
      if (right.timing.dns && left.timing.dns && right.timing.dns > left.timing.dns * 1.5) {
        possibleCauses.push('DNS resolution took longer');
      }
      if (right.timing.connect && left.timing.connect && right.timing.connect > left.timing.connect * 1.5) {
        possibleCauses.push('Connection establishment was slower');
      }
      if (right.timing.ttfb && left.timing.ttfb && right.timing.ttfb > left.timing.ttfb * 1.5) {
        possibleCauses.push('Server processing time increased');
      }
      if (right.timing.download && left.timing.download && right.timing.download > left.timing.download * 1.5) {
        possibleCauses.push('Download time increased');
      }
    } else {
      possibleCauses.push('Response was faster - possibly cached or optimized');
    }

    return {
      totalDiff,
      percentChange,
      explanation: `Response time ${totalDiff > 0 ? 'increased' : 'decreased'} by ${Math.abs(percentChange).toFixed(1)}%`,
      possibleCauses,
    };
  }

  private inferDiffCauses(
    headerDiffs: HeaderDiffExplanation[],
    bodyDiff?: BodyDiffExplanation,
    timingDiff?: TimingDiffExplanation
  ): string[] {
    const causes: string[] = [];

    const cacheHeader = headerDiffs.find((d) => d.header.toLowerCase() === 'cache-control');
    const etagHeader = headerDiffs.find((d) => d.header.toLowerCase() === 'etag');
    
    if (cacheHeader || etagHeader) {
      causes.push('Caching behavior differs between environments');
    }

    if (bodyDiff && bodyDiff.changes > 0) {
      causes.push('Response content differs - data may have changed');
    }

    if (timingDiff) {
      causes.push(...timingDiff.possibleCauses);
    }

    return causes;
  }

  private generateDiffRecommendations(
    headerDiffs: HeaderDiffExplanation[],
    bodyDiff?: BodyDiffExplanation,
    _timingDiff?: TimingDiffExplanation
  ): string[] {
    const recommendations: string[] = [];

    const highSigDiffs = headerDiffs.filter((d) => d.significance === 'high');
    if (highSigDiffs.length > 0) {
      recommendations.push('Review high-significance header differences');
    }

    if (bodyDiff && bodyDiff.changes > 5) {
      recommendations.push('Significant body differences detected - verify data consistency');
    }

    return recommendations;
  }

  private generateDiffSummary(
    headerDiffs: HeaderDiffExplanation[],
    bodyDiff?: BodyDiffExplanation,
    timingDiff?: TimingDiffExplanation,
    leftLabel?: string,
    rightLabel?: string
  ): string {
    const parts: string[] = [];
    const left = leftLabel || 'Left';
    const right = rightLabel || 'Right';

    if (headerDiffs.length > 0) {
      parts.push(`${headerDiffs.length} header difference${headerDiffs.length !== 1 ? 's' : ''}`);
    }

    if (bodyDiff) {
      parts.push(`${bodyDiff.changes} body change${bodyDiff.changes !== 1 ? 's' : ''}`);
    }

    if (timingDiff) {
      parts.push(`timing ${timingDiff.totalDiff > 0 ? 'slower' : 'faster'} by ${Math.abs(timingDiff.percentChange).toFixed(1)}%`);
    }

    if (parts.length === 0) {
      return `${left} and ${right} responses are identical`;
    }

    return `Comparing ${left} vs ${right}: ${parts.join(', ')}`;
  }

  private generateStatusTest(
    request: CapturedRequest,
    response: CapturedResponse,
    framework: string
  ): GeneratedTest {
    const url = new URL(request.url);
    const testName = `should return ${response.statusCode} for ${request.method} ${url.pathname}`;

    let code = '';
    if (framework === 'vitest' || framework === 'jest') {
      code = `
import { describe, it, expect } from '${framework}';

describe('${url.pathname}', () => {
  it('${testName}', async () => {
    const response = await fetch('${request.url}', {
      method: '${request.method}',
      headers: ${JSON.stringify(request.headers, null, 2)}
    });
    expect(response.status).toBe(${response.statusCode});
  });
});
`.trim();
    } else if (framework === 'mocha') {
      code = `
import { expect } from 'chai';

describe('${url.pathname}', () => {
  it('${testName}', async () => {
    const response = await fetch('${request.url}', {
      method: '${request.method}',
      headers: ${JSON.stringify(request.headers, null, 2)}
    });
    expect(response.status).to.equal(${response.statusCode});
  });
});
`.trim();
    } else if (framework === 'playwright') {
      code = `
import { test, expect } from '@playwright/test';

test('${testName}', async ({ request }) => {
  const response = await request.${request.method.toLowerCase()}('${request.url}', {
    headers: ${JSON.stringify(request.headers, null, 2)}
  });
  expect(response.status()).toBe(${response.statusCode});
});
`.trim();
    }

    return {
      name: testName,
      description: `Verify that ${request.method} ${url.pathname} returns status ${response.statusCode}`,
      framework: framework as 'vitest' | 'jest' | 'mocha' | 'playwright',
      code,
      assertions: [
        {
          type: 'status',
          description: `Status code should be ${response.statusCode}`,
          expected: response.statusCode,
        },
      ],
    };
  }

  private generateHeaderTests(
    request: CapturedRequest,
    response: CapturedResponse,
    framework: string
  ): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const url = new URL(request.url);

    // Test important headers
    const importantHeaders = ['content-type', 'cache-control', 'x-request-id'];
    
    for (const headerName of importantHeaders) {
      const headerValue = response.headers[headerName] || response.headers[headerName.toLowerCase()];
      if (!headerValue) continue;

      const testName = `should return correct ${headerName} header`;
      let code = '';

      if (framework === 'vitest' || framework === 'jest') {
        code = `
import { describe, it, expect } from '${framework}';

describe('${url.pathname}', () => {
  it('${testName}', async () => {
    const response = await fetch('${request.url}', {
      method: '${request.method}',
      headers: ${JSON.stringify(request.headers, null, 2)}
    });
    expect(response.headers.get('${headerName}')).toBe('${headerValue}');
  });
});
`.trim();
      } else if (framework === 'mocha') {
        code = `
import { expect } from 'chai';

describe('${url.pathname}', () => {
  it('${testName}', async () => {
    const response = await fetch('${request.url}', {
      method: '${request.method}',
      headers: ${JSON.stringify(request.headers, null, 2)}
    });
    expect(response.headers.get('${headerName}')).to.equal('${headerValue}');
  });
});
`.trim();
      } else if (framework === 'playwright') {
        code = `
import { test, expect } from '@playwright/test';

test('${testName}', async ({ request }) => {
  const response = await request.${request.method.toLowerCase()}('${request.url}', {
    headers: ${JSON.stringify(request.headers, null, 2)}
  });
  expect(response.headers()['${headerName}']).toBe('${headerValue}');
});
`.trim();
      }

      tests.push({
        name: testName,
        description: `Verify that ${headerName} header is "${headerValue}"`,
        framework: framework as 'vitest' | 'jest' | 'mocha' | 'playwright',
        code,
        assertions: [
          {
            type: 'header',
            description: `${headerName} header should be "${headerValue}"`,
            expected: headerValue,
          },
        ],
      });
    }

    return tests;
  }

  private generateBodyTests(
    request: CapturedRequest,
    response: CapturedResponse,
    framework: string,
    includeSchema?: boolean
  ): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const url = new URL(request.url);

    if (!response.body) return tests;

    const contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';
    const isJson = contentType.includes('json');

    if (isJson) {
      try {
        const bodyJson = JSON.parse(response.body);
        const testName = `should return valid JSON response`;
        let code = '';

        if (framework === 'vitest' || framework === 'jest') {
          code = `
import { describe, it, expect } from '${framework}';

describe('${url.pathname}', () => {
  it('${testName}', async () => {
    const response = await fetch('${request.url}', {
      method: '${request.method}',
      headers: ${JSON.stringify(request.headers, null, 2)}
    });
    const data = await response.json();
    expect(data).toBeDefined();
    ${this.generateJsonAssertions(bodyJson, framework, includeSchema)}
  });
});
`.trim();
        } else if (framework === 'mocha') {
          code = `
import { expect } from 'chai';

describe('${url.pathname}', () => {
  it('${testName}', async () => {
    const response = await fetch('${request.url}', {
      method: '${request.method}',
      headers: ${JSON.stringify(request.headers, null, 2)}
    });
    const data = await response.json();
    expect(data).to.exist;
    ${this.generateJsonAssertions(bodyJson, framework, includeSchema)}
  });
});
`.trim();
        } else if (framework === 'playwright') {
          code = `
import { test, expect } from '@playwright/test';

test('${testName}', async ({ request }) => {
  const response = await request.${request.method.toLowerCase()}('${request.url}', {
    headers: ${JSON.stringify(request.headers, null, 2)}
  });
  const data = await response.json();
  expect(data).toBeDefined();
  ${this.generateJsonAssertions(bodyJson, framework, includeSchema)}
});
`.trim();
        }

        tests.push({
          name: testName,
          description: 'Verify that response body is valid JSON with expected structure',
          framework: framework as 'vitest' | 'jest' | 'mocha' | 'playwright',
          code,
          assertions: [
            {
              type: 'body',
              description: 'Response body should be valid JSON',
              expected: typeof bodyJson,
            },
          ],
        });
      } catch {
        // Not valid JSON, skip body tests
      }
    }

    return tests;
  }

  private generateJsonAssertions(
    json: unknown,
    framework: string,
    includeSchema?: boolean
  ): string {
    const assertions: string[] = [];

    if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
      const obj = json as Record<string, unknown>;
      const keys = Object.keys(obj).slice(0, 5); // Limit to first 5 keys

      for (const key of keys) {
        const value = obj[key];
        const valueType = typeof value;

        if (framework === 'vitest' || framework === 'jest' || framework === 'playwright') {
          if (includeSchema) {
            assertions.push(`expect(typeof data.${key}).toBe('${valueType}');`);
          }
          if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
            assertions.push(`expect(data.${key}).toBe(${JSON.stringify(value)});`);
          } else if (value !== null && valueType === 'object') {
            assertions.push(`expect(data.${key}).toBeDefined();`);
          }
        } else if (framework === 'mocha') {
          if (includeSchema) {
            assertions.push(`expect(typeof data.${key}).to.equal('${valueType}');`);
          }
          if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
            assertions.push(`expect(data.${key}).to.equal(${JSON.stringify(value)});`);
          } else if (value !== null && valueType === 'object') {
            assertions.push(`expect(data.${key}).to.exist;`);
          }
        }
      }
    } else if (Array.isArray(json)) {
      if (framework === 'vitest' || framework === 'jest' || framework === 'playwright') {
        assertions.push(`expect(Array.isArray(data)).toBe(true);`);
        assertions.push(`expect(data.length).toBe(${json.length});`);
      } else if (framework === 'mocha') {
        assertions.push(`expect(data).to.be.an('array');`);
        assertions.push(`expect(data).to.have.lengthOf(${json.length});`);
      }
    }

    return assertions.join('\n    ');
  }

  private generateTimingTest(
    request: CapturedRequest,
    response: CapturedResponse,
    framework: string
  ): GeneratedTest {
    const url = new URL(request.url);
    const maxTime = response.timing?.total ? Math.ceil(response.timing.total * 1.5) : 5000;
    const testName = `should respond within ${maxTime}ms`;

    let code = '';
    if (framework === 'vitest' || framework === 'jest') {
      code = `
import { describe, it, expect } from '${framework}';

describe('${url.pathname}', () => {
  it('${testName}', async () => {
    const start = performance.now();
    const response = await fetch('${request.url}', {
      method: '${request.method}',
      headers: ${JSON.stringify(request.headers, null, 2)}
    });
    const duration = performance.now() - start;
    expect(response.ok).toBe(true);
    expect(duration).toBeLessThan(${maxTime});
  });
});
`.trim();
    } else if (framework === 'mocha') {
      code = `
import { expect } from 'chai';

describe('${url.pathname}', () => {
  it('${testName}', async () => {
    const start = performance.now();
    const response = await fetch('${request.url}', {
      method: '${request.method}',
      headers: ${JSON.stringify(request.headers, null, 2)}
    });
    const duration = performance.now() - start;
    expect(response.ok).to.be.true;
    expect(duration).to.be.lessThan(${maxTime});
  });
});
`.trim();
    } else if (framework === 'playwright') {
      code = `
import { test, expect } from '@playwright/test';

test('${testName}', async ({ request }) => {
  const start = Date.now();
  const response = await request.${request.method.toLowerCase()}('${request.url}', {
    headers: ${JSON.stringify(request.headers, null, 2)}
  });
  const duration = Date.now() - start;
  expect(response.ok()).toBe(true);
  expect(duration).toBeLessThan(${maxTime});
});
`.trim();
    }

    return {
      name: testName,
      description: `Verify that response time is under ${maxTime}ms`,
      framework: framework as 'vitest' | 'jest' | 'mocha' | 'playwright',
      code,
      assertions: [
        {
          type: 'timing',
          description: `Response time should be under ${maxTime}ms`,
          expected: maxTime,
        },
      ],
    };
  }
}

// Export singleton instance
export const aiService = new AIService();