/**
 * GraphQL Client Service
 * 
 * Provides GraphQL query, mutation, and subscription functionality
 * with schema introspection support.
 */

import { nanoid } from 'nanoid';

// Types
export interface GraphQLRequest {
  id: string;
  url: string;
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
  headers?: Record<string, string>;
}

export interface GraphQLResponse {
  data?: unknown;
  errors?: GraphQLError[];
  extensions?: Record<string, unknown>;
}

export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface GraphQLResult {
  success: boolean;
  response?: GraphQLResponse;
  error?: string;
  timing?: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

export interface GraphQLSchema {
  queryType?: GraphQLType;
  mutationType?: GraphQLType;
  subscriptionType?: GraphQLType;
  types: GraphQLType[];
  directives: GraphQLDirective[];
}

export interface GraphQLType {
  kind: string;
  name: string;
  description?: string;
  fields?: GraphQLField[];
  inputFields?: GraphQLInputValue[];
  interfaces?: GraphQLTypeRef[];
  enumValues?: GraphQLEnumValue[];
  possibleTypes?: GraphQLTypeRef[];
  ofType?: GraphQLTypeRef;
}

export interface GraphQLField {
  name: string;
  description?: string;
  args: GraphQLInputValue[];
  type: GraphQLTypeRef;
  isDeprecated: boolean;
  deprecationReason?: string;
}

export interface GraphQLInputValue {
  name: string;
  description?: string;
  type: GraphQLTypeRef;
  defaultValue?: string;
}

export interface GraphQLTypeRef {
  kind: string;
  name?: string;
  ofType?: GraphQLTypeRef;
}

export interface GraphQLEnumValue {
  name: string;
  description?: string;
  isDeprecated: boolean;
  deprecationReason?: string;
}

export interface GraphQLDirective {
  name: string;
  description?: string;
  locations: string[];
  args: GraphQLInputValue[];
}

// Introspection query
const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
      directives {
        name
        description
        locations
        args {
          ...InputValue
        }
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }

  fragment InputValue on __InputValue {
    name
    description
    type {
      ...TypeRef
    }
    defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Execute a GraphQL query or mutation
 */
export async function executeGraphQL(request: GraphQLRequest): Promise<GraphQLResult> {
  const startTime = Date.now();

  try {
    const body: Record<string, unknown> = {
      query: request.query,
    };

    if (request.variables && Object.keys(request.variables).length > 0) {
      body.variables = request.variables;
    }

    if (request.operationName) {
      body.operationName = request.operationName;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...request.headers,
    };

    // Use Electron IPC if available, otherwise use fetch
    let response: Response;
    
    if (window.electronAPI) {
      // Use main process HTTP client for better control
      const result = await window.electronAPI.invoke<{
        success: boolean;
        data?: {
          statusCode: number;
          headers: Record<string, string>;
          body: string;
        };
        error?: string;
      }>('http:request', {
        requestId: request.id,
        url: request.url,
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        timeout: 30000,
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Request failed',
          timing: {
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
          },
        };
      }

      const graphqlResponse: GraphQLResponse = JSON.parse(result.data.body);
      
      return {
        success: !graphqlResponse.errors || graphqlResponse.errors.length === 0,
        response: graphqlResponse,
        timing: {
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
        },
      };
    }

    // Fallback to fetch for development
    response = await fetch(request.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const endTime = Date.now();
    const graphqlResponse: GraphQLResponse = await response.json();

    return {
      success: !graphqlResponse.errors || graphqlResponse.errors.length === 0,
      response: graphqlResponse,
      timing: {
        startTime,
        endTime,
        duration: endTime - startTime,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timing: {
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
      },
    };
  }
}

/**
 * Fetch GraphQL schema via introspection
 */
export async function fetchSchema(
  url: string,
  headers?: Record<string, string>
): Promise<{ success: boolean; schema?: GraphQLSchema; error?: string }> {
  const result = await executeGraphQL({
    id: nanoid(),
    url,
    query: INTROSPECTION_QUERY,
    headers,
  });

  if (!result.success || !result.response?.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch schema',
    };
  }

  const schemaData = (result.response.data as { __schema: GraphQLSchema }).__schema;

  return {
    success: true,
    schema: schemaData,
  };
}

/**
 * Parse GraphQL query to extract operation name and type
 */
export function parseQuery(query: string): {
  operationType?: 'query' | 'mutation' | 'subscription';
  operationName?: string;
  isValid: boolean;
  error?: string;
} {
  try {
    // Simple regex-based parsing (for a full implementation, use graphql-js)
    const trimmed = query.trim();
    
    // Check for operation type
    const operationMatch = trimmed.match(/^(query|mutation|subscription)\s*(\w+)?/i);
    
    if (operationMatch) {
      return {
        operationType: operationMatch[1].toLowerCase() as 'query' | 'mutation' | 'subscription',
        operationName: operationMatch[2],
        isValid: true,
      };
    }

    // Check if it's a shorthand query (no operation type)
    if (trimmed.startsWith('{')) {
      return {
        operationType: 'query',
        isValid: true,
      };
    }

    return {
      isValid: false,
      error: 'Invalid GraphQL query',
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Parse error',
    };
  }
}

/**
 * Format GraphQL query with proper indentation
 */
export function formatQuery(query: string): string {
  try {
    let formatted = '';
    let indent = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      const prevChar = query[i - 1];

      // Handle strings
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        formatted += char;
        continue;
      }

      if (inString) {
        formatted += char;
        continue;
      }

      // Handle braces
      if (char === '{') {
        formatted += ' {\n' + '  '.repeat(++indent);
      } else if (char === '}') {
        formatted = formatted.trimEnd() + '\n' + '  '.repeat(--indent) + '}';
      } else if (char === '(') {
        formatted += '(';
      } else if (char === ')') {
        formatted += ')';
      } else if (char === ',') {
        formatted += ',\n' + '  '.repeat(indent);
      } else if (char === ':') {
        formatted += ': ';
      } else if (char === '\n' || char === '\r') {
        // Skip existing newlines
      } else if (char === ' ' || char === '\t') {
        // Collapse whitespace
        if (formatted.length > 0 && !formatted.endsWith(' ') && !formatted.endsWith('\n')) {
          formatted += ' ';
        }
      } else {
        formatted += char;
      }
    }

    return formatted.trim();
  } catch {
    return query;
  }
}

/**
 * Get type name from GraphQL type reference
 */
export function getTypeName(typeRef: GraphQLTypeRef): string {
  if (typeRef.name) {
    return typeRef.name;
  }
  if (typeRef.ofType) {
    const innerType = getTypeName(typeRef.ofType);
    switch (typeRef.kind) {
      case 'NON_NULL':
        return `${innerType}!`;
      case 'LIST':
        return `[${innerType}]`;
      default:
        return innerType;
    }
  }
  return 'Unknown';
}

/**
 * Get base type from GraphQL type reference (unwrapping NON_NULL and LIST)
 */
export function getBaseType(typeRef: GraphQLTypeRef): string {
  if (typeRef.name) {
    return typeRef.name;
  }
  if (typeRef.ofType) {
    return getBaseType(typeRef.ofType);
  }
  return 'Unknown';
}

/**
 * Check if a type is a scalar type
 */
export function isScalarType(typeName: string): boolean {
  const scalarTypes = ['String', 'Int', 'Float', 'Boolean', 'ID'];
  return scalarTypes.includes(typeName);
}

/**
 * Generate a sample query from schema
 */
export function generateSampleQuery(
  schema: GraphQLSchema,
  operationType: 'query' | 'mutation' | 'subscription' = 'query'
): string {
  let rootType: GraphQLType | undefined;

  switch (operationType) {
    case 'query':
      rootType = schema.types.find((t) => t.name === schema.queryType?.name);
      break;
    case 'mutation':
      rootType = schema.types.find((t) => t.name === schema.mutationType?.name);
      break;
    case 'subscription':
      rootType = schema.types.find((t) => t.name === schema.subscriptionType?.name);
      break;
  }

  if (!rootType || !rootType.fields || rootType.fields.length === 0) {
    return `${operationType} {\n  # No fields available\n}`;
  }

  const firstField = rootType.fields[0];
  const fieldName = firstField.name;
  const args = firstField.args
    .map((arg) => `${arg.name}: ${getDefaultValue(arg.type)}`)
    .join(', ');

  const argsStr = args ? `(${args})` : '';

  return `${operationType} {\n  ${fieldName}${argsStr}\n}`;
}

/**
 * Get default value for a type
 */
function getDefaultValue(typeRef: GraphQLTypeRef): string {
  const baseType = getBaseType(typeRef);

  switch (baseType) {
    case 'String':
      return '""';
    case 'Int':
      return '0';
    case 'Float':
      return '0.0';
    case 'Boolean':
      return 'false';
    case 'ID':
      return '""';
    default:
      return 'null';
  }
}