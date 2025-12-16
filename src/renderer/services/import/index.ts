/**
 * Import Services Index
 *
 * Central export point for all import parsers
 */

export { parsePostmanCollection, parsePostmanEnvironment } from './postmanParser';
export { parseOpenApiSpec } from './openApiParser';
export { parseCurlCommand, parseMultipleCurlCommands, generateCurlCommand } from './curlParser';
export { parseInsomniaExport, InsomniaParser } from './insomniaParser';
export {
  EnvVarMapper,
  mapEnvironmentVariables,
  detectVariableSyntax,
  convertVariableSyntax,
} from './envVarMapper';

// Re-export types
export type { default as PostmanParser } from './postmanParser';
export type { default as OpenApiParser } from './openApiParser';
export type { default as CurlParser } from './curlParser';
export type {
  InsomniaExport,
  InsomniaResource,
  InsomniaRequest,
  InsomniaEnvironment,
  ParsedCollection,
  ParsedRequest,
  ParsedEnvironment,
  ImportWarning,
  ParseResult,
} from './insomniaParser';
export type {
  VariableSyntax,
  VariableMapping,
  MappedEnvironment,
  MappingWarning,
  MappingResult,
} from './envVarMapper';

/**
 * Detect import format from file content
 */
export function detectImportFormat(content: string): 'postman' | 'insomnia' | 'openapi' | 'curl' | 'har' | 'unknown' {
  const trimmed = content.trim();

  // Check for cURL command
  if (trimmed.toLowerCase().startsWith('curl ') || trimmed.toLowerCase() === 'curl') {
    return 'curl';
  }

  // Try to parse as JSON
  try {
    const json = JSON.parse(trimmed);

    // Check for Insomnia export
    if (json._type === 'export' && json.__export_format) {
      return 'insomnia';
    }

    // Check for Postman collection
    if (json.info?.schema?.includes('postman')) {
      return 'postman';
    }

    // Check for Postman environment
    if (json.name && json.values && Array.isArray(json.values)) {
      return 'postman';
    }

    // Check for HAR format
    if (json.log?.version && json.log?.entries) {
      return 'har';
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
 * Import result with warnings
 */
export interface ImportResult {
  type: 'collection' | 'environment' | 'request' | 'requests';
  data: unknown;
  warnings?: ImportWarning[];
  environments?: ParsedEnvironment[];
}

/**
 * Import file and return parsed data
 */
export async function importFile(
  content: string,
  format?: 'postman' | 'insomnia' | 'openapi' | 'curl' | 'har'
): Promise<ImportResult> {
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

    case 'insomnia': {
      const { parseInsomniaExport } = await import('./insomniaParser');
      const result = parseInsomniaExport(content);
      
      return {
        type: 'collection',
        data: result.collections,
        warnings: result.warnings,
        environments: result.environments,
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

    case 'har': {
      // HAR import not yet implemented
      throw new Error('HAR import is not yet supported. Coming soon!');
    }

    default:
      throw new Error('Unable to detect import format. Please specify the format explicitly.');
  }
}

/**
 * Get supported import formats
 */
export function getSupportedFormats(): Array<{
  id: string;
  name: string;
  description: string;
  extensions: string[];
}> {
  return [
    {
      id: 'postman',
      name: 'Postman',
      description: 'Import Postman collections and environments',
      extensions: ['.json', '.postman_collection.json', '.postman_environment.json'],
    },
    {
      id: 'insomnia',
      name: 'Insomnia',
      description: 'Import Insomnia workspaces and environments',
      extensions: ['.json', '.yaml', '.yml'],
    },
    {
      id: 'openapi',
      name: 'OpenAPI / Swagger',
      description: 'Import OpenAPI 3.x or Swagger 2.0 specifications',
      extensions: ['.json', '.yaml', '.yml'],
    },
    {
      id: 'curl',
      name: 'cURL',
      description: 'Import cURL commands',
      extensions: ['.txt', '.sh'],
    },
    {
      id: 'har',
      name: 'HAR',
      description: 'Import HTTP Archive files (coming soon)',
      extensions: ['.har'],
    },
  ];
}