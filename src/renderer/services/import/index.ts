/**
 * Import Services Index
 *
 * Central export point for all import parsers
 */

export { parsePostmanCollection, parsePostmanEnvironment } from './postmanParser';
export { parseOpenApiSpec } from './openApiParser';
export { parseCurlCommand, parseMultipleCurlCommands, generateCurlCommand } from './curlParser';

// Re-export types
export type { default as PostmanParser } from './postmanParser';
export type { default as OpenApiParser } from './openApiParser';
export type { default as CurlParser } from './curlParser';

/**
 * Detect import format from file content
 */
export function detectImportFormat(content: string): 'postman' | 'openapi' | 'curl' | 'unknown' {
  const trimmed = content.trim();

  // Check for cURL command
  if (trimmed.toLowerCase().startsWith('curl ') || trimmed.toLowerCase() === 'curl') {
    return 'curl';
  }

  // Try to parse as JSON
  try {
    const json = JSON.parse(trimmed);

    // Check for Postman collection
    if (json.info?.schema?.includes('postman')) {
      return 'postman';
    }

    // Check for Postman environment
    if (json.name && json.values && Array.isArray(json.values)) {
      return 'postman';
    }

    // Check for OpenAPI 3.x
    if (json.openapi) {
      return 'openapi';
    }

    // Check for Swagger 2.0
    if (json.swagger) {
      return 'openapi';
    }

    return 'unknown';
  } catch {
    // Not JSON, could be YAML or cURL
    
    // Check for YAML OpenAPI indicators
    if (
      trimmed.includes('openapi:') ||
      trimmed.includes('swagger:') ||
      trimmed.includes('paths:')
    ) {
      return 'openapi';
    }

    return 'unknown';
  }
}

/**
 * Import file and return parsed data
 */
export async function importFile(
  content: string,
  format?: 'postman' | 'openapi' | 'curl'
): Promise<{
  type: 'collection' | 'environment' | 'request' | 'requests';
  data: unknown;
}> {
  const detectedFormat = format || detectImportFormat(content);

  switch (detectedFormat) {
    case 'postman': {
      const json = JSON.parse(content);
      
      // Check if it's an environment
      if (json.name && json.values && Array.isArray(json.values)) {
        const { parsePostmanEnvironment } = await import('./postmanParser');
        return {
          type: 'environment',
          data: parsePostmanEnvironment(content),
        };
      }

      // It's a collection
      const { parsePostmanCollection } = await import('./postmanParser');
      return {
        type: 'collection',
        data: parsePostmanCollection(content),
      };
    }

    case 'openapi': {
      const { parseOpenApiSpec } = await import('./openApiParser');
      return {
        type: 'collection',
        data: parseOpenApiSpec(content),
      };
    }

    case 'curl': {
      const { parseCurlCommand, parseMultipleCurlCommands } = await import('./curlParser');
      
      // Check if there are multiple curl commands
      const curlCount = (content.match(/curl\s/gi) || []).length;
      
      if (curlCount > 1) {
        return {
          type: 'requests',
          data: parseMultipleCurlCommands(content),
        };
      }

      return {
        type: 'request',
        data: parseCurlCommand(content),
      };
    }

    default:
      throw new Error('Unable to detect import format. Please specify the format explicitly.');
  }
}