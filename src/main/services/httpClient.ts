/**
 * HTTP Client Service
 * 
 * Handles HTTP requests from the renderer process using Electron's net module.
 * Provides support for all HTTP methods, custom headers, body types, authentication,
 * timeout, cancellation, SSL options, and proxy support.
 */

import { net, session } from 'electron';
import { URL } from 'url';
import { ipcMain } from 'electron';

// Request configuration
export interface HttpRequestConfig {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  validateSSL?: boolean;
  proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  auth?: {
    type: 'basic' | 'bearer' | 'api-key';
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
}

// Response data
export interface HttpResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  size: number;
  timing: {
    start: number;
    dns: number;
    tcp: number;
    tls: number;
    firstByte: number;
    download: number;
    total: number;
  };
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: string;
    httpOnly: boolean;
    secure: boolean;
  }>;
}

// Active requests map for cancellation
const activeRequests = new Map<string, { abort: () => void }>();

/**
 * Make an HTTP request
 */
export async function makeHttpRequest(config: HttpRequestConfig): Promise<HttpResponseData> {
  return new Promise((resolve, reject) => {
    const timing = {
      start: Date.now(),
      dns: 0,
      tcp: 0,
      tls: 0,
      firstByte: 0,
      download: 0,
      total: 0,
    };

    try {
      // Validate URL
      const url = new URL(config.url);
      
      // Build headers
      const headers: Record<string, string> = { ...config.headers };
      
      // Add authentication headers
      if (config.auth) {
        switch (config.auth.type) {
          case 'basic':
            if (config.auth.username && config.auth.password) {
              const credentials = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
              headers['Authorization'] = `Basic ${credentials}`;
            }
            break;
          case 'bearer':
            if (config.auth.token) {
              headers['Authorization'] = `Bearer ${config.auth.token}`;
            }
            break;
          case 'api-key':
            if (config.auth.apiKey && config.auth.apiKeyHeader) {
              headers[config.auth.apiKeyHeader] = config.auth.apiKey;
            }
            break;
        }
      }

      // Create request options
      const requestOptions: Electron.ClientRequestConstructorOptions = {
        method: config.method,
        url: config.url,
        redirect: config.followRedirects !== false ? 'follow' : 'manual',
      };

      // Configure session for SSL validation
      if (config.validateSSL === false) {
        // Use a custom session that ignores SSL errors
        const customSession = session.fromPartition('http-client-insecure');
        customSession.setCertificateVerifyProc((request, callback) => {
          callback(0); // Accept all certificates
        });
        requestOptions.session = customSession;
      }

      // Create the request
      const request = net.request(requestOptions);

      // Set headers
      Object.entries(headers).forEach(([key, value]) => {
        request.setHeader(key, value);
      });

      // Set up timeout
      let timeoutId: NodeJS.Timeout | null = null;
      if (config.timeout && config.timeout > 0) {
        timeoutId = setTimeout(() => {
          request.abort();
          reject(new Error(`Request timeout after ${config.timeout}ms`));
        }, config.timeout);
      }

      // Store abort function for cancellation
      activeRequests.set(config.id, {
        abort: () => {
          if (timeoutId) clearTimeout(timeoutId);
          request.abort();
        },
      });

      // Response data
      let responseBody = '';
      let responseHeaders: Record<string, string> = {};
      let responseStatus = 0;
      let responseStatusText = '';
      let responseCookies: HttpResponseData['cookies'] = [];

      // Handle response
      request.on('response', (response) => {
        timing.firstByte = Date.now() - timing.start;
        
        responseStatus = response.statusCode;
        responseStatusText = response.statusMessage || '';
        
        // Parse headers
        response.headers && Object.entries(response.headers).forEach(([key, value]) => {
          responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
        });

        // Parse cookies from Set-Cookie header
        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
          const cookieStrings = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
          responseCookies = cookieStrings.map(parseCookie).filter(Boolean) as HttpResponseData['cookies'];
        }

        // Collect response body
        response.on('data', (chunk: Buffer) => {
          responseBody += chunk.toString();
        });

        response.on('end', () => {
          if (timeoutId) clearTimeout(timeoutId);
          activeRequests.delete(config.id);

          timing.download = Date.now() - timing.start - timing.firstByte;
          timing.total = Date.now() - timing.start;

          resolve({
            status: responseStatus,
            statusText: responseStatusText,
            headers: responseHeaders,
            body: responseBody,
            size: Buffer.byteLength(responseBody, 'utf8'),
            timing,
            cookies: responseCookies,
          });
        });

        response.on('error', (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          activeRequests.delete(config.id);
          reject(error);
        });
      });

      // Handle request errors
      request.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        activeRequests.delete(config.id);
        reject(error);
      });

      // Handle redirect (for manual redirect mode)
      request.on('redirect', (statusCode, method, redirectUrl) => {
        if (config.followRedirects === false) {
          // Don't follow, return redirect response
          timing.total = Date.now() - timing.start;
          resolve({
            status: statusCode,
            statusText: 'Redirect',
            headers: { 'Location': redirectUrl },
            body: '',
            size: 0,
            timing,
            cookies: [],
          });
        } else {
          request.followRedirect();
        }
      });

      // Send request body if present
      if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
        request.write(config.body);
      }

      request.end();

    } catch (error) {
      activeRequests.delete(config.id);
      reject(error);
    }
  });
}

/**
 * Cancel an active request
 */
export function cancelRequest(requestId: string): boolean {
  const request = activeRequests.get(requestId);
  if (request) {
    request.abort();
    activeRequests.delete(requestId);
    return true;
  }
  return false;
}

/**
 * Parse a Set-Cookie header string into a cookie object
 */
function parseCookie(cookieString: string): HttpResponseData['cookies'][0] | null {
  try {
    const parts = cookieString.split(';').map(p => p.trim());
    const [nameValue, ...attributes] = parts;
    const [name, ...valueParts] = nameValue.split('=');
    const value = valueParts.join('=');

    const cookie: HttpResponseData['cookies'][0] = {
      name: name.trim(),
      value: value,
      domain: '',
      path: '/',
      httpOnly: false,
      secure: false,
    };

    attributes.forEach(attr => {
      const [attrName, ...attrValueParts] = attr.split('=');
      const attrValue = attrValueParts.join('=');
      const lowerAttrName = attrName.toLowerCase().trim();

      switch (lowerAttrName) {
        case 'domain':
          cookie.domain = attrValue;
          break;
        case 'path':
          cookie.path = attrValue;
          break;
        case 'expires':
          cookie.expires = attrValue;
          break;
        case 'httponly':
          cookie.httpOnly = true;
          break;
        case 'secure':
          cookie.secure = true;
          break;
      }
    });

    return cookie;
  } catch {
    return null;
  }
}

/**
 * Register IPC handlers for HTTP client
 */
export function registerHttpClientHandlers(): void {
  // Handle HTTP request
  ipcMain.handle('http:request', async (event, config: HttpRequestConfig) => {
    try {
      const response = await makeHttpRequest(config);
      return { success: true, data: response };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Handle request cancellation
  ipcMain.handle('http:cancel', async (event, requestId: string) => {
    const cancelled = cancelRequest(requestId);
    return { success: cancelled };
  });

  // Get active requests count
  ipcMain.handle('http:activeCount', async () => {
    return { count: activeRequests.size };
  });
}

export default {
  makeHttpRequest,
  cancelRequest,
  registerHttpClientHandlers,
};