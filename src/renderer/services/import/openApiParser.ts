/**
 * OpenAPI/Swagger Import Parser
 *
 * Parses OpenAPI 3.0/3.1 and Swagger 2.0 specifications
 * Converts to WireSniff internal format
 */

import { nanoid } from 'nanoid';

// OpenAPI 3.x types
interface OpenAPI3Spec {
  openapi: string;
  info: {
    title: string;
    description?: string;
    version: string;
  };
  servers?: OpenAPIServer[];
  paths: Record<string, OpenAPIPathItem>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, OpenAPISecurityScheme>;
    parameters?: Record<string, OpenAPIParameter>;
    requestBodies?: Record<string, OpenAPIRequestBody>;
  };
  security?: OpenAPISecurityRequirement[];
  tags?: OpenAPITag[];
}

// Swagger 2.0 types
interface Swagger2Spec {
  swagger: string;
  info: {
    title: string;
    description?: string;
    version: string;
  };
  host?: string;
  basePath?: string;
  schemes?: string[];
  paths: Record<string, OpenAPIPathItem>;
  definitions?: Record<string, unknown>;
  securityDefinitions?: Record<string, OpenAPISecurityScheme>;
  security?: OpenAPISecurityRequirement[];
  tags?: OpenAPITag[];
}

interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<string, { default: string; enum?: string[]; description?: string }>;
}

interface OpenAPIPathItem {
  summary?: string;
  description?: string;
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
  trace?: OpenAPIOperation;
  parameters?: OpenAPIParameter[];
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: Record<string, OpenAPIResponse>;
  security?: OpenAPISecurityRequirement[];
  deprecated?: boolean;
}

interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: OpenAPISchema;
  example?: unknown;
  // Swagger 2.0 specific
  type?: string;
  default?: unknown;
}

interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, OpenAPIMediaType>;
  // Swagger 2.0 specific
  schema?: OpenAPISchema;
}

interface OpenAPIMediaType {
  schema?: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, { value: unknown }>;
}

interface OpenAPIResponse {
  description: string;
  content?: Record<string, OpenAPIMediaType>;
  headers?: Record<string, OpenAPIParameter>;
}

interface OpenAPISchema {
  type?: string;
  format?: string;
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  required?: string[];
  example?: unknown;
  default?: unknown;
  enum?: unknown[];
  $ref?: string;
}

interface OpenAPISecurityScheme {
  type: string;
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, unknown>;
}

interface OpenAPISecurityRequirement {
  [name: string]: string[];
}

interface OpenAPITag {
  name: string;
  description?: string;
}

// WireSniff internal types (same as postmanParser)
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
 * Parse OpenAPI/Swagger specification
 */
export function parseOpenApiSpec(jsonOrYamlString: string): WireSniffCollection {
  // Try to parse as JSON first
  let spec: OpenAPI3Spec | Swagger2Spec;
  try {
    spec = JSON.parse(jsonOrYamlString);
  } catch {
    // If JSON parsing fails, try YAML (would need yaml library)
    throw new Error('Invalid JSON format. YAML support requires additional parsing.');
  }

  // Detect version
  if ('openapi' in spec && spec.openapi) {
    return parseOpenAPI3(spec as OpenAPI3Spec);
  } else if ('swagger' in spec && spec.swagger) {
    return parseSwagger2(spec as Swagger2Spec);
  } else {
    throw new Error('Invalid OpenAPI/Swagger specification: missing version field');
  }
}

/**
 * Parse OpenAPI 3.x specification
 */
function parseOpenAPI3(spec: OpenAPI3Spec): WireSniffCollection {
  const baseUrl = spec.servers?.[0]?.url || 'https://api.example.com';

  const collection: WireSniffCollection = {
    id: nanoid(),
    name: spec.info.title,
    description: spec.info.description,
    folders: [],
    requests: [],
    variables: [
      {
        id: nanoid(),
        key: 'baseUrl',
        value: baseUrl,
        description: 'Base URL for API requests',
        enabled: true,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Group requests by tags
  const taggedRequests: Record<string, WireSniffRequest[]> = {};
  const untaggedRequests: WireSniffRequest[] = [];

  // Parse paths
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      const request = parseOperation(
        method.toUpperCase(),
        path,
        operation,
        pathItem.parameters,
        spec.components
      );

      // Group by first tag
      const tag = operation.tags?.[0];
      if (tag) {
        if (!taggedRequests[tag]) {
          taggedRequests[tag] = [];
        }
        taggedRequests[tag].push(request);
      } else {
        untaggedRequests.push(request);
      }
    }
  }

  // Create folders for tags
  for (const [tagName, requests] of Object.entries(taggedRequests)) {
    const tagInfo = spec.tags?.find((t) => t.name === tagName);
    collection.folders.push({
      id: nanoid(),
      name: tagName,
      description: tagInfo?.description,
      folders: [],
      requests,
    });
  }

  // Add untagged requests to root
  collection.requests = untaggedRequests;

  return collection;
}

/**
 * Parse Swagger 2.0 specification
 */
function parseSwagger2(spec: Swagger2Spec): WireSniffCollection {
  const scheme = spec.schemes?.[0] || 'https';
  const host = spec.host || 'api.example.com';
  const basePath = spec.basePath || '';
  const baseUrl = `${scheme}://${host}${basePath}`;

  const collection: WireSniffCollection = {
    id: nanoid(),
    name: spec.info.title,
    description: spec.info.description,
    folders: [],
    requests: [],
    variables: [
      {
        id: nanoid(),
        key: 'baseUrl',
        value: baseUrl,
        description: 'Base URL for API requests',
        enabled: true,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Group requests by tags
  const taggedRequests: Record<string, WireSniffRequest[]> = {};
  const untaggedRequests: WireSniffRequest[] = [];

  // Parse paths
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      const request = parseSwagger2Operation(method.toUpperCase(), path, operation, pathItem.parameters);

      // Group by first tag
      const tag = operation.tags?.[0];
      if (tag) {
        if (!taggedRequests[tag]) {
          taggedRequests[tag] = [];
        }
        taggedRequests[tag].push(request);
      } else {
        untaggedRequests.push(request);
      }
    }
  }

  // Create folders for tags
  for (const [tagName, requests] of Object.entries(taggedRequests)) {
    const tagInfo = spec.tags?.find((t) => t.name === tagName);
    collection.folders.push({
      id: nanoid(),
      name: tagName,
      description: tagInfo?.description,
      folders: [],
      requests,
    });
  }

  // Add untagged requests to root
  collection.requests = untaggedRequests;

  return collection;
}

/**
 * Parse OpenAPI 3.x operation
 */
function parseOperation(
  method: string,
  path: string,
  operation: OpenAPIOperation,
  pathParameters?: OpenAPIParameter[],
  components?: OpenAPI3Spec['components']
): WireSniffRequest {
  const allParameters = [...(pathParameters || []), ...(operation.parameters || [])];

  // Parse parameters
  const queryParams: WireSniffKeyValue[] = [];
  const headers: WireSniffKeyValue[] = [];
  const pathParams: WireSniffKeyValue[] = [];

  for (const param of allParameters) {
    const kv: WireSniffKeyValue = {
      id: nanoid(),
      key: param.name,
      value: getExampleValue(param.schema, param.example),
      description: param.description,
      enabled: param.required !== false,
    };

    switch (param.in) {
      case 'query':
        queryParams.push(kv);
        break;
      case 'header':
        headers.push(kv);
        break;
      case 'path':
        pathParams.push(kv);
        break;
    }
  }

  // Build URL with path parameters
  let url = `{{baseUrl}}${path}`;
  for (const param of pathParams) {
    url = url.replace(`{${param.key}}`, `{{${param.key}}}`);
  }

  // Parse request body
  let body: WireSniffBody | undefined;
  if (operation.requestBody?.content) {
    body = parseRequestBody(operation.requestBody.content);
  }

  return {
    id: nanoid(),
    name: operation.summary || operation.operationId || `${method} ${path}`,
    description: operation.description,
    method,
    url,
    headers,
    params: queryParams,
    body,
  };
}

/**
 * Parse Swagger 2.0 operation
 */
function parseSwagger2Operation(
  method: string,
  path: string,
  operation: OpenAPIOperation,
  pathParameters?: OpenAPIParameter[]
): WireSniffRequest {
  const allParameters = [...(pathParameters || []), ...(operation.parameters || [])];

  // Parse parameters
  const queryParams: WireSniffKeyValue[] = [];
  const headers: WireSniffKeyValue[] = [];
  const pathParams: WireSniffKeyValue[] = [];
  let bodyParam: OpenAPIParameter | undefined;

  for (const param of allParameters) {
    if (param.in === 'body') {
      bodyParam = param;
      continue;
    }

    const kv: WireSniffKeyValue = {
      id: nanoid(),
      key: param.name,
      value: String(param.default || param.example || ''),
      description: param.description,
      enabled: param.required !== false,
    };

    switch (param.in) {
      case 'query':
        queryParams.push(kv);
        break;
      case 'header':
        headers.push(kv);
        break;
      case 'path':
        pathParams.push(kv);
        break;
    }
  }

  // Build URL with path parameters
  let url = `{{baseUrl}}${path}`;
  for (const param of pathParams) {
    url = url.replace(`{${param.key}}`, `{{${param.key}}}`);
  }

  // Parse body parameter (Swagger 2.0 style)
  let body: WireSniffBody | undefined;
  if (bodyParam) {
    body = {
      type: 'json',
      content: JSON.stringify(generateExampleFromSchema(bodyParam.schema), null, 2),
    };
  }

  return {
    id: nanoid(),
    name: operation.summary || operation.operationId || `${method} ${path}`,
    description: operation.description,
    method,
    url,
    headers,
    params: queryParams,
    body,
  };
}

/**
 * Parse request body content
 */
function parseRequestBody(content: Record<string, OpenAPIMediaType>): WireSniffBody | undefined {
  // Prefer JSON
  if (content['application/json']) {
    const mediaType = content['application/json'];
    const example = mediaType.example || generateExampleFromSchema(mediaType.schema);
    return {
      type: 'json',
      content: typeof example === 'string' ? example : JSON.stringify(example, null, 2),
    };
  }

  // Form data
  if (content['application/x-www-form-urlencoded']) {
    const mediaType = content['application/x-www-form-urlencoded'];
    const formData = generateFormDataFromSchema(mediaType.schema);
    return {
      type: 'form-urlencoded',
      formData,
    };
  }

  // Multipart form data
  if (content['multipart/form-data']) {
    const mediaType = content['multipart/form-data'];
    const formData = generateFormDataFromSchema(mediaType.schema);
    return {
      type: 'form-data',
      formData,
    };
  }

  // XML
  if (content['application/xml'] || content['text/xml']) {
    const mediaType = content['application/xml'] || content['text/xml'];
    return {
      type: 'xml',
      content: String(mediaType.example || ''),
    };
  }

  // Plain text
  if (content['text/plain']) {
    return {
      type: 'text',
      content: String(content['text/plain'].example || ''),
    };
  }

  return undefined;
}

/**
 * Get example value from schema
 */
function getExampleValue(schema?: OpenAPISchema, example?: unknown): string {
  if (example !== undefined) {
    return String(example);
  }

  if (!schema) {
    return '';
  }

  if (schema.example !== undefined) {
    return String(schema.example);
  }

  if (schema.default !== undefined) {
    return String(schema.default);
  }

  if (schema.enum && schema.enum.length > 0) {
    return String(schema.enum[0]);
  }

  // Generate based on type
  switch (schema.type) {
    case 'string':
      return schema.format === 'date' ? '2024-01-01' : schema.format === 'date-time' ? '2024-01-01T00:00:00Z' : 'string';
    case 'integer':
    case 'number':
      return '0';
    case 'boolean':
      return 'true';
    default:
      return '';
  }
}

/**
 * Generate example object from schema
 */
function generateExampleFromSchema(schema?: OpenAPISchema): unknown {
  if (!schema) {
    return {};
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.$ref) {
    // Would need to resolve $ref - simplified for now
    return {};
  }

  switch (schema.type) {
    case 'object': {
      const obj: Record<string, unknown> = {};
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          obj[key] = generateExampleFromSchema(propSchema);
        }
      }
      return obj;
    }

    case 'array':
      return [generateExampleFromSchema(schema.items)];

    case 'string':
      if (schema.enum && schema.enum.length > 0) return schema.enum[0];
      if (schema.format === 'date') return '2024-01-01';
      if (schema.format === 'date-time') return '2024-01-01T00:00:00Z';
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'uuid') return '550e8400-e29b-41d4-a716-446655440000';
      return 'string';

    case 'integer':
      return 0;

    case 'number':
      return 0.0;

    case 'boolean':
      return true;

    default:
      return null;
  }
}

/**
 * Generate form data from schema
 */
function generateFormDataFromSchema(schema?: OpenAPISchema): WireSniffKeyValue[] {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return [];
  }

  return Object.entries(schema.properties).map(([key, propSchema]) => ({
    id: nanoid(),
    key,
    value: getExampleValue(propSchema),
    enabled: schema.required?.includes(key) !== false,
  }));
}

export default {
  parseOpenApiSpec,
};