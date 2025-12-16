/**
 * Export Service
 *
 * Exports collections and environments to various formats:
 * - WireSniff native format (JSON)
 * - Postman Collection v2.1
 * - OpenAPI 3.0
 * - cURL commands
 */

import { nanoid } from 'nanoid';

// WireSniff internal types
interface WireSniffCollection {
  id: string;
  name: string;
  description?: string;
  folders: WireSniffFolder[];
  requests: WireSniffRequest[];
  variables: WireSniffVariable[];
  auth?: WireSniffAuth;
  createdAt: string;
  updatedAt: string;
}

interface WireSniffFolder {
  id: string;
  name: string;
  description?: string;
  folders: WireSniffFolder[];
  requests: WireSniffRequest[];
}

interface WireSniffRequest {
  id: string;
  name: string;
  description?: string;
  method: string;
  url: string;
  headers: WireSniffKeyValue[];
  params: WireSniffKeyValue[];
  body?: WireSniffBody;
  auth?: WireSniffAuth;
  preRequestScript?: string;
  testScript?: string;
}

interface WireSniffKeyValue {
  id: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

interface WireSniffBody {
  type: 'none' | 'json' | 'text' | 'xml' | 'html' | 'form-urlencoded' | 'form-data' | 'binary' | 'graphql';
  content?: string;
  formData?: WireSniffKeyValue[];
  graphql?: {
    query: string;
    variables?: string;
  };
}

interface WireSniffAuth {
  type: 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2';
  bearer?: { token: string };
  basic?: { username: string; password: string };
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' };
  oauth2?: Record<string, string>;
}

interface WireSniffVariable {
  id: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

interface WireSniffEnvironment {
  id: string;
  name: string;
  variables: WireSniffVariable[];
  createdAt: string;
  updatedAt: string;
}

// Export formats
export type ExportFormat = 'wiresniff' | 'postman' | 'openapi' | 'curl';

/**
 * Export collection to specified format
 */
export function exportCollection(
  collection: WireSniffCollection,
  format: ExportFormat
): string {
  switch (format) {
    case 'wiresniff':
      return exportToWireSniff(collection);
    case 'postman':
      return exportToPostman(collection);
    case 'openapi':
      return exportToOpenAPI(collection);
    case 'curl':
      return exportToCurl(collection);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export environment to specified format
 */
export function exportEnvironment(
  environment: WireSniffEnvironment,
  format: 'wiresniff' | 'postman'
): string {
  switch (format) {
    case 'wiresniff':
      return JSON.stringify(environment, null, 2);
    case 'postman':
      return exportEnvironmentToPostman(environment);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export to WireSniff native format
 */
function exportToWireSniff(collection: WireSniffCollection): string {
  return JSON.stringify(collection, null, 2);
}

/**
 * Export to Postman Collection v2.1 format
 */
function exportToPostman(collection: WireSniffCollection): string {
  const postmanCollection = {
    info: {
      _postman_id: nanoid(),
      name: collection.name,
      description: collection.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [
      ...collection.folders.map(convertFolderToPostman),
      ...collection.requests.map(convertRequestToPostman),
    ],
    variable: collection.variables.map((v) => ({
      key: v.key,
      value: v.value,
      description: v.description,
      disabled: !v.enabled,
    })),
    auth: collection.auth ? convertAuthToPostman(collection.auth) : undefined,
  };

  return JSON.stringify(postmanCollection, null, 2);
}

/**
 * Convert folder to Postman format
 */
function convertFolderToPostman(folder: WireSniffFolder): unknown {
  return {
    name: folder.name,
    description: folder.description,
    item: [
      ...folder.folders.map(convertFolderToPostman),
      ...folder.requests.map(convertRequestToPostman),
    ],
  };
}

/**
 * Convert request to Postman format
 */
function convertRequestToPostman(request: WireSniffRequest): unknown {
  // Build URL with query params
  const url = buildPostmanUrl(request);

  const postmanRequest: Record<string, unknown> = {
    name: request.name,
    request: {
      method: request.method,
      header: request.headers
        .filter((h) => h.enabled)
        .map((h) => ({
          key: h.key,
          value: h.value,
          description: h.description,
          disabled: !h.enabled,
        })),
      url,
      description: request.description,
    },
  };

  // Add body
  if (request.body) {
    (postmanRequest.request as Record<string, unknown>).body = convertBodyToPostman(request.body);
  }

  // Add auth
  if (request.auth) {
    (postmanRequest.request as Record<string, unknown>).auth = convertAuthToPostman(request.auth);
  }

  // Add scripts
  const events: unknown[] = [];
  if (request.preRequestScript) {
    events.push({
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: request.preRequestScript.split('\n'),
      },
    });
  }
  if (request.testScript) {
    events.push({
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: request.testScript.split('\n'),
      },
    });
  }
  if (events.length > 0) {
    postmanRequest.event = events;
  }

  return postmanRequest;
}

/**
 * Build Postman URL object
 */
function buildPostmanUrl(request: WireSniffRequest): unknown {
  const enabledParams = request.params.filter((p) => p.enabled);

  // Parse URL
  let urlString = request.url;
  let protocol = 'https';
  let host: string[] = [];
  let path: string[] = [];

  try {
    const urlObj = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`);
    protocol = urlObj.protocol.replace(':', '');
    host = urlObj.hostname.split('.');
    path = urlObj.pathname.split('/').filter(Boolean);
  } catch {
    // Keep as raw URL
  }

  return {
    raw: urlString + (enabledParams.length > 0 ? '?' + enabledParams.map((p) => `${p.key}=${p.value}`).join('&') : ''),
    protocol,
    host,
    path,
    query: enabledParams.map((p) => ({
      key: p.key,
      value: p.value,
      description: p.description,
      disabled: !p.enabled,
    })),
  };
}

/**
 * Convert body to Postman format
 */
function convertBodyToPostman(body: WireSniffBody): unknown {
  switch (body.type) {
    case 'json':
      return {
        mode: 'raw',
        raw: body.content || '',
        options: {
          raw: { language: 'json' },
        },
      };

    case 'text':
      return {
        mode: 'raw',
        raw: body.content || '',
        options: {
          raw: { language: 'text' },
        },
      };

    case 'xml':
      return {
        mode: 'raw',
        raw: body.content || '',
        options: {
          raw: { language: 'xml' },
        },
      };

    case 'html':
      return {
        mode: 'raw',
        raw: body.content || '',
        options: {
          raw: { language: 'html' },
        },
      };

    case 'form-urlencoded':
      return {
        mode: 'urlencoded',
        urlencoded: (body.formData || []).map((f) => ({
          key: f.key,
          value: f.value,
          description: f.description,
          disabled: !f.enabled,
        })),
      };

    case 'form-data':
      return {
        mode: 'formdata',
        formdata: (body.formData || []).map((f) => ({
          key: f.key,
          value: f.value,
          description: f.description,
          disabled: !f.enabled,
          type: 'text',
        })),
      };

    case 'graphql':
      return {
        mode: 'graphql',
        graphql: {
          query: body.graphql?.query || '',
          variables: body.graphql?.variables || '',
        },
      };

    default:
      return undefined;
  }
}

/**
 * Convert auth to Postman format
 */
function convertAuthToPostman(auth: WireSniffAuth): unknown {
  switch (auth.type) {
    case 'bearer':
      return {
        type: 'bearer',
        bearer: [{ key: 'token', value: auth.bearer?.token || '', type: 'string' }],
      };

    case 'basic':
      return {
        type: 'basic',
        basic: [
          { key: 'username', value: auth.basic?.username || '', type: 'string' },
          { key: 'password', value: auth.basic?.password || '', type: 'string' },
        ],
      };

    case 'api-key':
      return {
        type: 'apikey',
        apikey: [
          { key: 'key', value: auth.apiKey?.key || '', type: 'string' },
          { key: 'value', value: auth.apiKey?.value || '', type: 'string' },
          { key: 'in', value: auth.apiKey?.addTo || 'header', type: 'string' },
        ],
      };

    case 'oauth2':
      return {
        type: 'oauth2',
        oauth2: Object.entries(auth.oauth2 || {}).map(([key, value]) => ({
          key,
          value,
          type: 'string',
        })),
      };

    default:
      return { type: 'noauth' };
  }
}

/**
 * Export environment to Postman format
 */
function exportEnvironmentToPostman(environment: WireSniffEnvironment): string {
  const postmanEnv = {
    id: nanoid(),
    name: environment.name,
    values: environment.variables.map((v) => ({
      key: v.key,
      value: v.value,
      enabled: v.enabled,
    })),
    _postman_variable_scope: 'environment',
  };

  return JSON.stringify(postmanEnv, null, 2);
}

/**
 * Export to OpenAPI 3.0 format
 */
function exportToOpenAPI(collection: WireSniffCollection): string {
  const paths: Record<string, Record<string, unknown>> = {};

  // Process all requests
  const allRequests = getAllRequests(collection);

  for (const request of allRequests) {
    // Parse URL to get path
    let path = '/';
    try {
      const urlObj = new URL(request.url.startsWith('http') ? request.url : `https://example.com${request.url}`);
      path = urlObj.pathname || '/';
    } catch {
      // Use URL as path
      path = request.url.startsWith('/') ? request.url : `/${request.url}`;
    }

    // Replace path parameters
    path = path.replace(/\{\{(\w+)\}\}/g, '{$1}');

    if (!paths[path]) {
      paths[path] = {};
    }

    const method = request.method.toLowerCase();
    paths[path][method] = {
      summary: request.name,
      description: request.description,
      operationId: request.id,
      parameters: [
        ...request.params.filter((p) => p.enabled).map((p) => ({
          name: p.key,
          in: 'query',
          description: p.description,
          required: false,
          schema: { type: 'string' },
          example: p.value,
        })),
        ...request.headers.filter((h) => h.enabled).map((h) => ({
          name: h.key,
          in: 'header',
          description: h.description,
          required: false,
          schema: { type: 'string' },
          example: h.value,
        })),
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
    };

    // Add request body
    if (request.body && request.body.type !== 'none') {
      (paths[path][method] as Record<string, unknown>).requestBody = convertBodyToOpenAPI(request.body);
    }
  }

  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: collection.name,
      description: collection.description,
      version: '1.0.0',
    },
    servers: [
      {
        url: '{{baseUrl}}',
        description: 'Base URL',
      },
    ],
    paths,
  };

  return JSON.stringify(openApiSpec, null, 2);
}

/**
 * Get all requests from collection (including nested folders)
 */
function getAllRequests(collection: WireSniffCollection): WireSniffRequest[] {
  const requests: WireSniffRequest[] = [...collection.requests];

  function processFolder(folder: WireSniffFolder) {
    requests.push(...folder.requests);
    folder.folders.forEach(processFolder);
  }

  collection.folders.forEach(processFolder);
  return requests;
}

/**
 * Convert body to OpenAPI format
 */
function convertBodyToOpenAPI(body: WireSniffBody): unknown {
  switch (body.type) {
    case 'json':
      return {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object' },
            example: body.content ? tryParseJSON(body.content) : {},
          },
        },
      };

    case 'xml':
      return {
        required: true,
        content: {
          'application/xml': {
            schema: { type: 'string' },
            example: body.content,
          },
        },
      };

    case 'form-urlencoded':
      return {
        required: true,
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              type: 'object',
              properties: Object.fromEntries(
                (body.formData || []).map((f) => [f.key, { type: 'string', example: f.value }])
              ),
            },
          },
        },
      };

    case 'form-data':
      return {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: Object.fromEntries(
                (body.formData || []).map((f) => [f.key, { type: 'string', example: f.value }])
              ),
            },
          },
        },
      };

    default:
      return {
        required: true,
        content: {
          'text/plain': {
            schema: { type: 'string' },
            example: body.content,
          },
        },
      };
  }
}

/**
 * Try to parse JSON, return original string if fails
 */
function tryParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * Export to cURL commands
 */
function exportToCurl(collection: WireSniffCollection): string {
  const allRequests = getAllRequests(collection);
  const curlCommands = allRequests.map(generateCurlCommand);
  return curlCommands.join('\n\n');
}

/**
 * Generate cURL command from request
 */
function generateCurlCommand(request: WireSniffRequest): string {
  const parts: string[] = ['curl'];

  // Method
  if (request.method !== 'GET') {
    parts.push('-X', request.method);
  }

  // URL with query params
  let url = request.url;
  const enabledParams = request.params.filter((p) => p.enabled);
  if (enabledParams.length > 0) {
    const queryString = enabledParams
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');
    url += (url.includes('?') ? '&' : '?') + queryString;
  }

  // Headers
  for (const header of request.headers.filter((h) => h.enabled)) {
    parts.push('-H', `'${header.key}: ${header.value}'`);
  }

  // Auth
  if (request.auth) {
    switch (request.auth.type) {
      case 'basic':
        if (request.auth.basic) {
          parts.push('-u', `'${request.auth.basic.username}:${request.auth.basic.password}'`);
        }
        break;
      case 'bearer':
        if (request.auth.bearer) {
          parts.push('-H', `'Authorization: Bearer ${request.auth.bearer.token}'`);
        }
        break;
      case 'api-key':
        if (request.auth.apiKey) {
          if (request.auth.apiKey.addTo === 'header') {
            parts.push('-H', `'${request.auth.apiKey.key}: ${request.auth.apiKey.value}'`);
          } else {
            url += (url.includes('?') ? '&' : '?') +
              `${encodeURIComponent(request.auth.apiKey.key)}=${encodeURIComponent(request.auth.apiKey.value)}`;
          }
        }
        break;
    }
  }

  // Body
  if (request.body) {
    switch (request.body.type) {
      case 'json':
      case 'text':
      case 'xml':
      case 'html':
        if (request.body.content) {
          parts.push('-d', `'${request.body.content.replace(/'/g, "\\'")}'`);
        }
        break;
      case 'form-urlencoded':
        if (request.body.formData) {
          for (const field of request.body.formData.filter((f) => f.enabled)) {
            parts.push('--data-urlencode', `'${field.key}=${field.value}'`);
          }
        }
        break;
      case 'form-data':
        if (request.body.formData) {
          for (const field of request.body.formData.filter((f) => f.enabled)) {
            parts.push('-F', `'${field.key}=${field.value}'`);
          }
        }
        break;
    }
  }

  // URL (quoted)
  parts.push(`'${url}'`);

  // Add comment with request name
  return `# ${request.name}\n${parts.join(' \\\n  ')}`;
}

/**
 * Download exported content as file
 */
export function downloadExport(
  content: string,
  filename: string,
  mimeType: string = 'application/json'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default {
  exportCollection,
  exportEnvironment,
  downloadExport,
};