/**
 * cURL Command Import Parser
 *
 * Parses cURL commands and converts to WireSniff request format
 * Supports common cURL options and flags
 */

import { nanoid } from 'nanoid';

// WireSniff internal types
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
}

interface WireSniffAuth {
  type: 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2';
  bearer?: { token: string };
  basic?: { username: string; password: string };
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' };
}

// Parsed cURL options
interface CurlOptions {
  url: string;
  method: string;
  headers: Record<string, string>;
  data?: string;
  dataRaw?: string;
  dataBinary?: string;
  dataUrlencode?: string[];
  form?: string[];
  user?: string;
  compressed?: boolean;
  insecure?: boolean;
  location?: boolean;
  maxRedirs?: number;
  connectTimeout?: number;
  maxTime?: number;
  proxy?: string;
  proxyUser?: string;
  cookie?: string;
  cookieJar?: string;
  userAgent?: string;
  referer?: string;
}

/**
 * Parse a cURL command string
 */
export function parseCurlCommand(curlCommand: string): WireSniffRequest {
  // Normalize the command
  const normalizedCommand = normalizeCurlCommand(curlCommand);

  // Parse the command into tokens
  const tokens = tokenize(normalizedCommand);

  // Parse tokens into options
  const options = parseTokens(tokens);

  // Convert to WireSniff request
  return convertToRequest(options);
}

/**
 * Normalize cURL command (handle line continuations, etc.)
 */
function normalizeCurlCommand(command: string): string {
  // Remove 'curl' prefix if present
  let normalized = command.trim();
  if (normalized.toLowerCase().startsWith('curl ')) {
    normalized = normalized.substring(5);
  } else if (normalized.toLowerCase() === 'curl') {
    throw new Error('Invalid cURL command: no URL provided');
  }

  // Handle line continuations (backslash at end of line)
  normalized = normalized.replace(/\\\s*\n/g, ' ');

  // Handle Windows-style line continuations (caret)
  normalized = normalized.replace(/\^\s*\n/g, ' ');

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Tokenize the command string
 */
function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parse tokens into cURL options
 */
function parseTokens(tokens: string[]): CurlOptions {
  const options: CurlOptions = {
    url: '',
    method: 'GET',
    headers: {},
  };

  const dataUrlencode: string[] = [];
  const form: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    // URL (no flag prefix)
    if (!token.startsWith('-')) {
      if (!options.url) {
        options.url = token;
      }
      i++;
      continue;
    }

    // Handle combined short options (e.g., -sS)
    if (token.startsWith('-') && !token.startsWith('--') && token.length > 2) {
      // These are typically boolean flags
      for (let j = 1; j < token.length; j++) {
        const flag = token[j];
        switch (flag) {
          case 's':
          case 'S':
          case 'f':
          case 'k':
            options.insecure = flag === 'k';
            break;
          case 'L':
            options.location = true;
            break;
          case 'v':
          case 'i':
          case 'I':
            // Verbose/include headers - ignore for parsing
            break;
        }
      }
      i++;
      continue;
    }

    // Parse flags
    switch (token) {
      case '-X':
      case '--request':
        options.method = tokens[++i]?.toUpperCase() || 'GET';
        break;

      case '-H':
      case '--header':
        const headerValue = tokens[++i];
        if (headerValue) {
          const colonIndex = headerValue.indexOf(':');
          if (colonIndex > 0) {
            const key = headerValue.substring(0, colonIndex).trim();
            const value = headerValue.substring(colonIndex + 1).trim();
            options.headers[key] = value;
          }
        }
        break;

      case '-d':
      case '--data':
      case '--data-ascii':
        options.data = tokens[++i];
        if (!options.method || options.method === 'GET') {
          options.method = 'POST';
        }
        break;

      case '--data-raw':
        options.dataRaw = tokens[++i];
        if (!options.method || options.method === 'GET') {
          options.method = 'POST';
        }
        break;

      case '--data-binary':
        options.dataBinary = tokens[++i];
        if (!options.method || options.method === 'GET') {
          options.method = 'POST';
        }
        break;

      case '--data-urlencode':
        dataUrlencode.push(tokens[++i] || '');
        if (!options.method || options.method === 'GET') {
          options.method = 'POST';
        }
        break;

      case '-F':
      case '--form':
        form.push(tokens[++i] || '');
        if (!options.method || options.method === 'GET') {
          options.method = 'POST';
        }
        break;

      case '-u':
      case '--user':
        options.user = tokens[++i];
        break;

      case '-A':
      case '--user-agent':
        options.userAgent = tokens[++i];
        break;

      case '-e':
      case '--referer':
        options.referer = tokens[++i];
        break;

      case '-b':
      case '--cookie':
        options.cookie = tokens[++i];
        break;

      case '-c':
      case '--cookie-jar':
        options.cookieJar = tokens[++i];
        break;

      case '-L':
      case '--location':
        options.location = true;
        break;

      case '--max-redirs':
        options.maxRedirs = parseInt(tokens[++i] || '10', 10);
        break;

      case '-k':
      case '--insecure':
        options.insecure = true;
        break;

      case '--compressed':
        options.compressed = true;
        break;

      case '--connect-timeout':
        options.connectTimeout = parseInt(tokens[++i] || '30', 10);
        break;

      case '-m':
      case '--max-time':
        options.maxTime = parseInt(tokens[++i] || '0', 10);
        break;

      case '-x':
      case '--proxy':
        options.proxy = tokens[++i];
        break;

      case '-U':
      case '--proxy-user':
        options.proxyUser = tokens[++i];
        break;

      case '-G':
      case '--get':
        options.method = 'GET';
        break;

      case '-I':
      case '--head':
        options.method = 'HEAD';
        break;

      case '-s':
      case '--silent':
      case '-S':
      case '--show-error':
      case '-v':
      case '--verbose':
      case '-i':
      case '--include':
      case '-o':
      case '--output':
      case '-O':
      case '--remote-name':
        // Skip these flags and their values if they take one
        if (token === '-o' || token === '--output') {
          i++; // Skip the output filename
        }
        break;

      default:
        // Unknown flag, skip
        break;
    }

    i++;
  }

  if (dataUrlencode.length > 0) {
    options.dataUrlencode = dataUrlencode;
  }

  if (form.length > 0) {
    options.form = form;
  }

  return options;
}

/**
 * Convert parsed options to WireSniff request
 */
function convertToRequest(options: CurlOptions): WireSniffRequest {
  // Parse URL and extract query params
  const { url, params } = parseUrl(options.url);

  // Convert headers
  const headers: WireSniffKeyValue[] = Object.entries(options.headers).map(([key, value]) => ({
    id: nanoid(),
    key,
    value,
    enabled: true,
  }));

  // Add user agent if specified
  if (options.userAgent && !options.headers['User-Agent']) {
    headers.push({
      id: nanoid(),
      key: 'User-Agent',
      value: options.userAgent,
      enabled: true,
    });
  }

  // Add referer if specified
  if (options.referer && !options.headers['Referer']) {
    headers.push({
      id: nanoid(),
      key: 'Referer',
      value: options.referer,
      enabled: true,
    });
  }

  // Add cookie if specified
  if (options.cookie && !options.headers['Cookie']) {
    headers.push({
      id: nanoid(),
      key: 'Cookie',
      value: options.cookie,
      enabled: true,
    });
  }

  // Parse body
  const body = parseBody(options, headers);

  // Parse auth
  const auth = parseAuth(options, headers);

  // Generate name from URL
  const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
  const name = `${options.method} ${urlObj.pathname}`;

  return {
    id: nanoid(),
    name,
    method: options.method,
    url,
    headers,
    params,
    body,
    auth,
  };
}

/**
 * Parse URL and extract query parameters
 */
function parseUrl(urlString: string): { url: string; params: WireSniffKeyValue[] } {
  // Add protocol if missing
  let fullUrl = urlString;
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = `https://${fullUrl}`;
  }

  try {
    const urlObj = new URL(fullUrl);
    const params: WireSniffKeyValue[] = [];

    urlObj.searchParams.forEach((value, key) => {
      params.push({
        id: nanoid(),
        key,
        value,
        enabled: true,
      });
    });

    // Return URL without query string
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

    return { url: baseUrl, params };
  } catch {
    // If URL parsing fails, return as-is
    return { url: urlString, params: [] };
  }
}

/**
 * Parse request body from cURL options
 */
function parseBody(options: CurlOptions, headers: WireSniffKeyValue[]): WireSniffBody | undefined {
  // Form data (-F)
  if (options.form && options.form.length > 0) {
    const formData: WireSniffKeyValue[] = options.form.map((item) => {
      const eqIndex = item.indexOf('=');
      if (eqIndex > 0) {
        return {
          id: nanoid(),
          key: item.substring(0, eqIndex),
          value: item.substring(eqIndex + 1),
          enabled: true,
        };
      }
      return {
        id: nanoid(),
        key: item,
        value: '',
        enabled: true,
      };
    });

    return {
      type: 'form-data',
      formData,
    };
  }

  // URL-encoded data (--data-urlencode)
  if (options.dataUrlencode && options.dataUrlencode.length > 0) {
    const formData: WireSniffKeyValue[] = options.dataUrlencode.map((item) => {
      const eqIndex = item.indexOf('=');
      if (eqIndex > 0) {
        return {
          id: nanoid(),
          key: item.substring(0, eqIndex),
          value: item.substring(eqIndex + 1),
          enabled: true,
        };
      }
      return {
        id: nanoid(),
        key: item,
        value: '',
        enabled: true,
      };
    });

    return {
      type: 'form-urlencoded',
      formData,
    };
  }

  // Raw data (-d, --data, --data-raw)
  const data = options.data || options.dataRaw || options.dataBinary;
  if (data) {
    // Determine body type from Content-Type header
    const contentType = headers.find(
      (h) => h.key.toLowerCase() === 'content-type'
    )?.value?.toLowerCase();

    if (contentType?.includes('application/json')) {
      return {
        type: 'json',
        content: data,
      };
    }

    if (contentType?.includes('application/xml') || contentType?.includes('text/xml')) {
      return {
        type: 'xml',
        content: data,
      };
    }

    if (contentType?.includes('text/html')) {
      return {
        type: 'html',
        content: data,
      };
    }

    if (contentType?.includes('application/x-www-form-urlencoded')) {
      // Parse as form data
      const formData: WireSniffKeyValue[] = data.split('&').map((pair) => {
        const [key, value] = pair.split('=');
        return {
          id: nanoid(),
          key: decodeURIComponent(key || ''),
          value: decodeURIComponent(value || ''),
          enabled: true,
        };
      });

      return {
        type: 'form-urlencoded',
        formData,
      };
    }

    // Try to detect JSON
    if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
      try {
        JSON.parse(data);
        // Add Content-Type header if not present
        if (!contentType) {
          headers.push({
            id: nanoid(),
            key: 'Content-Type',
            value: 'application/json',
            enabled: true,
          });
        }
        return {
          type: 'json',
          content: data,
        };
      } catch {
        // Not valid JSON, treat as text
      }
    }

    // Default to text
    return {
      type: 'text',
      content: data,
    };
  }

  return undefined;
}

/**
 * Parse authentication from cURL options
 */
function parseAuth(options: CurlOptions, headers: WireSniffKeyValue[]): WireSniffAuth | undefined {
  // Basic auth from -u flag
  if (options.user) {
    const [username, password] = options.user.split(':');
    return {
      type: 'basic',
      basic: {
        username: username || '',
        password: password || '',
      },
    };
  }

  // Check for Authorization header
  const authHeader = headers.find((h) => h.key.toLowerCase() === 'authorization');
  if (authHeader) {
    const value = authHeader.value;

    // Bearer token
    if (value.toLowerCase().startsWith('bearer ')) {
      // Remove from headers since we're using auth
      const index = headers.indexOf(authHeader);
      if (index > -1) {
        headers.splice(index, 1);
      }

      return {
        type: 'bearer',
        bearer: {
          token: value.substring(7).trim(),
        },
      };
    }

    // Basic auth
    if (value.toLowerCase().startsWith('basic ')) {
      const index = headers.indexOf(authHeader);
      if (index > -1) {
        headers.splice(index, 1);
      }

      try {
        const decoded = atob(value.substring(6).trim());
        const [username, password] = decoded.split(':');
        return {
          type: 'basic',
          basic: {
            username: username || '',
            password: password || '',
          },
        };
      } catch {
        // Invalid base64, keep as header
      }
    }
  }

  return undefined;
}

/**
 * Parse multiple cURL commands (separated by newlines)
 */
export function parseMultipleCurlCommands(commands: string): WireSniffRequest[] {
  // Split by 'curl' keyword (case insensitive)
  const curlCommands = commands
    .split(/(?=curl\s)/i)
    .filter((cmd) => cmd.trim().toLowerCase().startsWith('curl'));

  return curlCommands.map((cmd) => parseCurlCommand(cmd));
}

/**
 * Generate cURL command from WireSniff request
 */
export function generateCurlCommand(request: WireSniffRequest): string {
  const parts: string[] = ['curl'];

  // Method
  if (request.method !== 'GET') {
    parts.push('-X', request.method);
  }

  // URL with query params
  let url = request.url;
  if (request.params.length > 0) {
    const enabledParams = request.params.filter((p) => p.enabled);
    if (enabledParams.length > 0) {
      const queryString = enabledParams
        .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
        .join('&');
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
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

  return parts.join(' ');
}

export default {
  parseCurlCommand,
  parseMultipleCurlCommands,
  generateCurlCommand,
};