/**
 * Postman Collection Import Parser
 *
 * Parses Postman Collection v2.0 and v2.1 formats
 * Converts to WireSniff internal format
 */

import { nanoid } from 'nanoid';

// Types for Postman Collection format
interface PostmanCollection {
  info: {
    _postman_id?: string;
    name: string;
    description?: string;
    schema: string;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth;
}

interface PostmanItem {
  name: string;
  description?: string;
  item?: PostmanItem[]; // For folders
  request?: PostmanRequest;
  response?: PostmanResponse[];
  event?: PostmanEvent[];
}

interface PostmanRequest {
  method: string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  url: PostmanUrl | string;
  auth?: PostmanAuth;
  description?: string;
}

interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string[];
  path?: string[];
  query?: PostmanQueryParam[];
  variable?: PostmanVariable[];
}

interface PostmanHeader {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface PostmanQueryParam {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface PostmanBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql';
  raw?: string;
  urlencoded?: PostmanFormParam[];
  formdata?: PostmanFormParam[];
  file?: { src: string };
  graphql?: { query: string; variables?: string };
  options?: {
    raw?: { language: string };
  };
}

interface PostmanFormParam {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
  type?: 'text' | 'file';
  src?: string;
}

interface PostmanAuth {
  type: string;
  bearer?: { key: string; value: string }[];
  basic?: { key: string; value: string }[];
  apikey?: { key: string; value: string }[];
  oauth2?: { key: string; value: string }[];
}

interface PostmanVariable {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface PostmanResponse {
  name: string;
  originalRequest?: PostmanRequest;
  status?: string;
  code?: number;
  header?: PostmanHeader[];
  body?: string;
}

interface PostmanEvent {
  listen: 'prerequest' | 'test';
  script: {
    type: string;
    exec: string[];
  };
}

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

/**
 * Parse Postman Collection JSON
 */
export function parsePostmanCollection(jsonString: string): WireSniffCollection {
  const data = JSON.parse(jsonString) as PostmanCollection;

  // Validate schema
  if (!data.info?.schema) {
    throw new Error('Invalid Postman collection: missing schema');
  }

  const schemaVersion = data.info.schema;
  if (
    !schemaVersion.includes('v2.0.0') &&
    !schemaVersion.includes('v2.1.0')
  ) {
    throw new Error(`Unsupported Postman collection schema: ${schemaVersion}. Only v2.0 and v2.1 are supported.`);
  }

  const collection: WireSniffCollection = {
    id: nanoid(),
    name: data.info.name,
    description: data.info.description,
    folders: [],
    requests: [],
    variables: parseVariables(data.variable || []),
    auth: data.auth ? parseAuth(data.auth) : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Parse items (folders and requests)
  const { folders, requests } = parseItems(data.item || []);
  collection.folders = folders;
  collection.requests = requests;

  return collection;
}

/**
 * Parse Postman items recursively
 */
function parseItems(items: PostmanItem[]): { folders: WireSniffFolder[]; requests: WireSniffRequest[] } {
  const folders: WireSniffFolder[] = [];
  const requests: WireSniffRequest[] = [];

  for (const item of items) {
    if (item.item) {
      // This is a folder
      const { folders: subFolders, requests: subRequests } = parseItems(item.item);
      folders.push({
        id: nanoid(),
        name: item.name,
        description: item.description,
        folders: subFolders,
        requests: subRequests,
      });
    } else if (item.request) {
      // This is a request
      requests.push(parseRequest(item));
    }
  }

  return { folders, requests };
}

/**
 * Parse a single Postman request
 */
function parseRequest(item: PostmanItem): WireSniffRequest {
  const req = item.request!;
  const url = parseUrl(req.url);

  const request: WireSniffRequest = {
    id: nanoid(),
    name: item.name,
    description: item.description || req.description,
    method: req.method?.toUpperCase() || 'GET',
    url: url.raw,
    headers: parseHeaders(req.header || []),
    params: parseQueryParams(url.query || []),
    body: parseBody(req.body),
    auth: req.auth ? parseAuth(req.auth) : undefined,
  };

  // Parse scripts
  if (item.event) {
    for (const event of item.event) {
      if (event.listen === 'prerequest') {
        request.preRequestScript = event.script.exec.join('\n');
      } else if (event.listen === 'test') {
        request.testScript = event.script.exec.join('\n');
      }
    }
  }

  return request;
}

/**
 * Parse Postman URL
 */
function parseUrl(url: PostmanUrl | string): { raw: string; query: PostmanQueryParam[] } {
  if (typeof url === 'string') {
    return { raw: url, query: [] };
  }

  let raw = url.raw || '';

  // Build URL from parts if raw is not available
  if (!raw && url.host) {
    const protocol = url.protocol || 'https';
    const host = Array.isArray(url.host) ? url.host.join('.') : url.host;
    const path = url.path ? '/' + url.path.join('/') : '';
    raw = `${protocol}://${host}${path}`;
  }

  return {
    raw,
    query: url.query || [],
  };
}

/**
 * Parse Postman headers
 */
function parseHeaders(headers: PostmanHeader[]): WireSniffKeyValue[] {
  return headers.map((header) => ({
    id: nanoid(),
    key: header.key,
    value: header.value,
    description: header.description,
    enabled: !header.disabled,
  }));
}

/**
 * Parse Postman query params
 */
function parseQueryParams(params: PostmanQueryParam[]): WireSniffKeyValue[] {
  return params.map((param) => ({
    id: nanoid(),
    key: param.key,
    value: param.value,
    description: param.description,
    enabled: !param.disabled,
  }));
}

/**
 * Parse Postman body
 */
function parseBody(body?: PostmanBody): WireSniffBody | undefined {
  if (!body) {
    return undefined;
  }

  switch (body.mode) {
    case 'raw': {
      const language = body.options?.raw?.language || 'text';
      let type: WireSniffBody['type'] = 'text';
      if (language === 'json') type = 'json';
      else if (language === 'xml') type = 'xml';
      else if (language === 'html') type = 'html';

      return {
        type,
        content: body.raw || '',
      };
    }

    case 'urlencoded':
      return {
        type: 'form-urlencoded',
        formData: (body.urlencoded || []).map((param) => ({
          id: nanoid(),
          key: param.key,
          value: param.value,
          description: param.description,
          enabled: !param.disabled,
        })),
      };

    case 'formdata':
      return {
        type: 'form-data',
        formData: (body.formdata || []).map((param) => ({
          id: nanoid(),
          key: param.key,
          value: param.type === 'file' ? param.src || '' : param.value,
          description: param.description,
          enabled: !param.disabled,
        })),
      };

    case 'graphql':
      return {
        type: 'graphql',
        graphql: {
          query: body.graphql?.query || '',
          variables: body.graphql?.variables,
        },
      };

    case 'file':
      return {
        type: 'binary',
        content: body.file?.src || '',
      };

    default:
      return undefined;
  }
}

/**
 * Parse Postman auth
 */
function parseAuth(auth: PostmanAuth): WireSniffAuth | undefined {
  if (!auth || auth.type === 'noauth') {
    return { type: 'none' };
  }

  switch (auth.type) {
    case 'bearer': {
      const tokenItem = auth.bearer?.find((item) => item.key === 'token');
      return {
        type: 'bearer',
        bearer: { token: tokenItem?.value || '' },
      };
    }

    case 'basic': {
      const usernameItem = auth.basic?.find((item) => item.key === 'username');
      const passwordItem = auth.basic?.find((item) => item.key === 'password');
      return {
        type: 'basic',
        basic: {
          username: usernameItem?.value || '',
          password: passwordItem?.value || '',
        },
      };
    }

    case 'apikey': {
      const keyItem = auth.apikey?.find((item) => item.key === 'key');
      const valueItem = auth.apikey?.find((item) => item.key === 'value');
      const inItem = auth.apikey?.find((item) => item.key === 'in');
      return {
        type: 'api-key',
        apiKey: {
          key: keyItem?.value || '',
          value: valueItem?.value || '',
          addTo: inItem?.value === 'query' ? 'query' : 'header',
        },
      };
    }

    case 'oauth2': {
      const oauth2Config: Record<string, string> = {};
      auth.oauth2?.forEach((item) => {
        oauth2Config[item.key] = item.value;
      });
      return {
        type: 'oauth2',
        oauth2: oauth2Config,
      };
    }

    default:
      return { type: 'none' };
  }
}

/**
 * Parse Postman variables
 */
function parseVariables(variables: PostmanVariable[]): WireSniffVariable[] {
  return variables.map((variable) => ({
    id: nanoid(),
    key: variable.key,
    value: variable.value,
    description: variable.description,
    enabled: !variable.disabled,
  }));
}

/**
 * Parse Postman Environment JSON
 */
export function parsePostmanEnvironment(jsonString: string): {
  name: string;
  variables: WireSniffVariable[];
} {
  const data = JSON.parse(jsonString);

  if (!data.name || !data.values) {
    throw new Error('Invalid Postman environment format');
  }

  return {
    name: data.name,
    variables: data.values.map((v: { key: string; value: string; enabled?: boolean }) => ({
      id: nanoid(),
      key: v.key,
      value: v.value,
      enabled: v.enabled !== false,
    })),
  };
}

export default {
  parsePostmanCollection,
  parsePostmanEnvironment,
};