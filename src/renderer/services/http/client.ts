/**
 * HTTP Client Service (Renderer)
 * 
 * Provides an interface for making HTTP requests from the renderer process.
 * Communicates with the main process via IPC to use Electron's net module.
 */

import type { HttpRequest, KeyValuePair, ResponseData } from '../../stores';

// Request configuration for IPC
interface HttpRequestConfig {
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

// Response from main process
interface HttpResponseResult {
  success: boolean;
  data?: {
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
  };
  error?: string;
}

/**
 * Convert KeyValuePair array to Record
 */
function keyValuePairsToRecord(pairs: KeyValuePair[]): Record<string, string> {
  const record: Record<string, string> = {};
  pairs.forEach(pair => {
    if (pair.enabled && pair.key) {
      record[pair.key] = pair.value;
    }
  });
  return record;
}

/**
 * Build URL with query parameters
 */
function buildUrlWithParams(baseUrl: string, params: KeyValuePair[]): string {
  if (!params.length) return baseUrl;
  
  try {
    const url = new URL(baseUrl);
    params.forEach(param => {
      if (param.enabled && param.key) {
        url.searchParams.append(param.key, param.value);
      }
    });
    return url.toString();
  } catch {
    // If URL parsing fails, try manual concatenation
    const queryString = params
      .filter(p => p.enabled && p.key)
      .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');
    
    if (!queryString) return baseUrl;
    return baseUrl.includes('?') ? `${baseUrl}&${queryString}` : `${baseUrl}?${queryString}`;
  }
}

/**
 * Build request body based on body type
 */
function buildRequestBody(request: HttpRequest): string | undefined {
  switch (request.body.type) {
    case 'none':
      return undefined;
    
    case 'json':
    case 'raw':
      return request.body.raw || undefined;
    
    case 'form-data':
      // For form-data, we'd need to use FormData in a real implementation
      // For now, return as JSON
      if (request.body.formData?.length) {
        const data: Record<string, string> = {};
        request.body.formData.forEach(item => {
          if (item.enabled && item.key) {
            data[item.key] = item.value;
          }
        });
        return JSON.stringify(data);
      }
      return undefined;
    
    case 'x-www-form-urlencoded':
      if (request.body.urlencoded?.length) {
        return request.body.urlencoded
          .filter(item => item.enabled && item.key)
          .map(item => `${encodeURIComponent(item.key)}=${encodeURIComponent(item.value)}`)
          .join('&');
      }
      return undefined;
    
    default:
      return undefined;
  }
}

/**
 * Get content type header based on body type
 */
function getContentTypeHeader(request: HttpRequest): string | undefined {
  switch (request.body.type) {
    case 'json':
      return 'application/json';
    case 'form-data':
      return 'multipart/form-data';
    case 'x-www-form-urlencoded':
      return 'application/x-www-form-urlencoded';
    case 'raw':
      switch (request.body.rawType) {
        case 'json':
          return 'application/json';
        case 'xml':
          return 'application/xml';
        case 'html':
          return 'text/html';
        case 'javascript':
          return 'application/javascript';
        default:
          return 'text/plain';
      }
    default:
      return undefined;
  }
}

/**
 * Convert HttpRequest to HttpRequestConfig for IPC
 */
function buildRequestConfig(requestId: string, request: HttpRequest): HttpRequestConfig {
  // Build headers
  const headers = keyValuePairsToRecord(request.headers);
  
  // Add content type if not already set
  const contentType = getContentTypeHeader(request);
  if (contentType && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = contentType;
  }

  // Build auth config
  let auth: HttpRequestConfig['auth'] | undefined;
  if (request.auth.type !== 'none') {
    switch (request.auth.type) {
      case 'basic':
        auth = {
          type: 'basic',
          username: request.auth.basic?.username,
          password: request.auth.basic?.password,
        };
        break;
      case 'bearer':
        auth = {
          type: 'bearer',
          token: request.auth.bearer?.token,
        };
        break;
      case 'api-key':
        auth = {
          type: 'api-key',
          apiKey: request.auth.apiKey?.value,
          apiKeyHeader: request.auth.apiKey?.key,
        };
        break;
    }
  }

  return {
    id: requestId,
    method: request.method,
    url: buildUrlWithParams(request.url, request.params),
    headers,
    body: buildRequestBody(request),
    timeout: request.settings?.timeout,
    followRedirects: request.settings?.followRedirects,
    maxRedirects: request.settings?.maxRedirects,
    validateSSL: request.settings?.validateSSL,
    auth,
  };
}

/**
 * Convert IPC response to ResponseData
 */
function convertResponse(result: HttpResponseResult): ResponseData | null {
  if (!result.success || !result.data) {
    return null;
  }

  const data = result.data;
  
  // Detect body type
  let bodyType: ResponseData['bodyType'] = 'text';
  const contentType = data.headers['content-type'] || data.headers['Content-Type'] || '';
  
  if (contentType.includes('application/json')) {
    bodyType = 'json';
  } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
    bodyType = 'xml';
  } else if (contentType.includes('text/html')) {
    bodyType = 'html';
  } else if (contentType.includes('image/')) {
    bodyType = 'image';
  } else if (contentType.includes('application/octet-stream')) {
    bodyType = 'binary';
  }

  return {
    status: data.status,
    statusText: data.statusText,
    headers: data.headers,
    body: data.body,
    bodyType,
    size: data.size,
    time: data.timing.total,
    timing: {
      dns: data.timing.dns,
      tcp: data.timing.tcp,
      tls: data.timing.tls,
      firstByte: data.timing.firstByte,
      download: data.timing.download,
      total: data.timing.total,
    },
    cookies: data.cookies,
  };
}

/**
 * Send an HTTP request
 */
export async function sendRequest(
  requestId: string, 
  request: HttpRequest
): Promise<{ success: boolean; response?: ResponseData; error?: string }> {
  try {
    // Check if we're in Electron environment
    if (typeof window !== 'undefined' && window.electronAPI) {
      const config = buildRequestConfig(requestId, request);
      const result = await window.electronAPI.invoke('http:request', config) as HttpResponseResult;
      
      if (result.success && result.data) {
        const response = convertResponse(result);
        return { success: true, response: response || undefined };
      } else {
        return { success: false, error: result.error || 'Request failed' };
      }
    } else {
      // Fallback to fetch API for development/testing
      return await sendRequestWithFetch(requestId, request);
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Fallback implementation using fetch API
 */
async function sendRequestWithFetch(
  requestId: string,
  request: HttpRequest
): Promise<{ success: boolean; response?: ResponseData; error?: string }> {
  const startTime = Date.now();
  
  try {
    const url = buildUrlWithParams(request.url, request.params);
    const headers = keyValuePairsToRecord(request.headers);
    
    // Add content type
    const contentType = getContentTypeHeader(request);
    if (contentType && !headers['Content-Type']) {
      headers['Content-Type'] = contentType;
    }

    // Add auth headers
    if (request.auth.type === 'basic' && request.auth.basic) {
      const credentials = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (request.auth.type === 'bearer' && request.auth.bearer) {
      const prefix = request.auth.bearer.prefix || 'Bearer';
      headers['Authorization'] = `${prefix} ${request.auth.bearer.token}`;
    } else if (request.auth.type === 'api-key' && request.auth.apiKey) {
      if (request.auth.apiKey.addTo === 'header') {
        headers[request.auth.apiKey.key] = request.auth.apiKey.value;
      }
    }

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      redirect: request.settings?.followRedirects !== false ? 'follow' : 'manual',
    };

    // Add body for appropriate methods
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      fetchOptions.body = buildRequestBody(request);
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    if (request.settings?.timeout) {
      timeoutId = setTimeout(() => controller.abort(), request.settings.timeout);
      fetchOptions.signal = controller.signal;
    }

    const fetchResponse = await fetch(url, fetchOptions);
    
    if (timeoutId) clearTimeout(timeoutId);

    const endTime = Date.now();
    const responseBody = await fetchResponse.text();
    
    // Parse response headers
    const responseHeaders: Record<string, string> = {};
    fetchResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Detect body type
    let bodyType: ResponseData['bodyType'] = 'text';
    const respContentType = responseHeaders['content-type'] || '';
    
    if (respContentType.includes('application/json')) {
      bodyType = 'json';
    } else if (respContentType.includes('xml')) {
      bodyType = 'xml';
    } else if (respContentType.includes('text/html')) {
      bodyType = 'html';
    }

    const response: ResponseData = {
      status: fetchResponse.status,
      statusText: fetchResponse.statusText,
      headers: responseHeaders,
      body: responseBody,
      bodyType,
      size: new Blob([responseBody]).size,
      time: endTime - startTime,
      timing: {
        dns: 0,
        tcp: 0,
        tls: 0,
        firstByte: endTime - startTime,
        download: 0,
        total: endTime - startTime,
      },
    };

    return { success: true, response };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timeout' };
    }
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Cancel an active request
 */
export async function cancelRequest(requestId: string): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const result = await window.electronAPI.invoke('http:cancel', requestId) as { success: boolean };
      return result.success;
    }
    return false;
  } catch {
    return false;
  }
}

export default {
  sendRequest,
  cancelRequest,
};