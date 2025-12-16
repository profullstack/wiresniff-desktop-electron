/**
 * Environment Variable Auto-Mapper
 *
 * Automatically maps environment variables from imported collections
 * (Postman, Insomnia) to WireSniff format with syntax conversion,
 * secret detection, and validation.
 */

// ==================== Types ====================

export type VariableSyntax = 'postman' | 'env' | 'env-braces' | 'curl' | 'wiresniff';

export interface VariableMapping {
  key: string;
  value: string;
  enabled: boolean;
  type: 'text' | 'secret';
  originalKey?: string;
}

export interface MappedEnvironment {
  name: string;
  variables: VariableMapping[];
}

export interface MappingWarning {
  type:
    | 'undefined_variable'
    | 'unused_variable'
    | 'dynamic_variable'
    | 'conversion_note'
    | 'unsupported_feature'
    | 'variable_renamed'
    | 'duplicate_variable';
  message: string;
  variableName?: string;
  originalName?: string;
  newName?: string;
}

export interface MappingResult {
  environments: MappedEnvironment[];
  warnings: MappingWarning[];
}

export interface ValidationResult {
  warnings: MappingWarning[];
}

export interface SourceEnvironment {
  name: string;
  variables: Array<{ key: string; value: string; enabled?: boolean }>;
}

export interface SourceRequest {
  url: string;
  method: string;
  headers: Array<{ key: string; value: string }>;
  params: Array<{ key: string; value: string }>;
  body?: {
    type: string;
    content?: string;
    formData?: Array<{ key: string; value: string }>;
  };
}

// ==================== Regex Patterns ====================

const PATTERNS = {
  // Postman/Insomnia: {{variableName}}
  postman: /\{\{([^}]+)\}\}/g,
  // Environment: $VARIABLE_NAME
  env: /\$([A-Z_][A-Z0-9_]*)/g,
  // Environment with braces: ${VARIABLE_NAME}
  envBraces: /\$\{([^}]+)\}/g,
  // cURL style: :variableName
  curl: /:([a-zA-Z_][a-zA-Z0-9_]*)/g,
  // Postman dynamic variables: {{$guid}}, {{$timestamp}}, etc.
  postmanDynamic: /\{\{\$([a-zA-Z]+)\}\}/g,
  // Insomnia template tags: {% tag %}
  insomniaTemplate: /\{%\s*([^%]+)\s*%\}/g,
};

// Secret variable name patterns
const SECRET_PATTERNS = [
  /api[_-]?key/i,
  /apikey/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /auth/i,
  /credential/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /bearer/i,
];

// ==================== Helper Functions ====================

/**
 * Detect the variable syntax used in a string
 */
export function detectVariableSyntax(text: string): VariableSyntax | null {
  // Check for Postman/Insomnia syntax first (most common)
  if (PATTERNS.postman.test(text)) {
    PATTERNS.postman.lastIndex = 0;
    return 'postman';
  }

  // Check for env-braces syntax
  if (PATTERNS.envBraces.test(text)) {
    PATTERNS.envBraces.lastIndex = 0;
    return 'env-braces';
  }

  // Check for env syntax
  if (PATTERNS.env.test(text)) {
    PATTERNS.env.lastIndex = 0;
    return 'env';
  }

  // Check for cURL syntax
  if (PATTERNS.curl.test(text)) {
    PATTERNS.curl.lastIndex = 0;
    return 'curl';
  }

  return null;
}

/**
 * Convert variable syntax from one format to another
 */
export function convertVariableSyntax(
  text: string,
  from: VariableSyntax,
  to: VariableSyntax
): string {
  if (from === to || to !== 'wiresniff') {
    return text;
  }

  let result = text;

  switch (from) {
    case 'postman':
      // Postman uses same syntax as WireSniff
      break;

    case 'env':
      // Convert $VAR to {{VAR}}
      result = result.replace(PATTERNS.env, '{{$1}}');
      break;

    case 'env-braces':
      // Convert ${VAR} to {{VAR}}
      result = result.replace(PATTERNS.envBraces, '{{$1}}');
      break;

    case 'curl':
      // Convert :var to {{var}}
      result = result.replace(PATTERNS.curl, '{{$1}}');
      break;
  }

  return result;
}

/**
 * Check if a variable name looks like a secret
 */
function isSecretVariable(name: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Extract variable names from text
 */
function extractVariables(text: string): string[] {
  const variables: string[] = [];

  // Reset regex lastIndex
  PATTERNS.postman.lastIndex = 0;

  let match;
  while ((match = PATTERNS.postman.exec(text)) !== null) {
    const varName = match[1];
    // Skip dynamic variables
    if (!varName.startsWith('$')) {
      variables.push(varName);
    }
  }

  return variables;
}

/**
 * Normalize a variable name to be valid
 */
function normalizeVariableName(name: string): string {
  // Replace invalid characters with underscores
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// ==================== EnvVarMapper Class ====================

export class EnvVarMapper {
  /**
   * Map source environments to WireSniff format
   */
  mapEnvironments(sourceEnvs: SourceEnvironment[]): MappingResult {
    const environments: MappedEnvironment[] = [];
    const warnings: MappingWarning[] = [];

    for (const sourceEnv of sourceEnvs) {
      const mappedVariables: VariableMapping[] = [];

      for (const variable of sourceEnv.variables) {
        const type = isSecretVariable(variable.key) ? 'secret' : 'text';

        mappedVariables.push({
          key: variable.key,
          value: variable.value,
          enabled: variable.enabled !== false,
          type,
        });
      }

      environments.push({
        name: sourceEnv.name,
        variables: mappedVariables,
      });
    }

    return { environments, warnings };
  }

  /**
   * Extract all variables used in requests
   */
  extractUsedVariables(requests: SourceRequest[]): string[] {
    const variables = new Set<string>();

    for (const request of requests) {
      // Extract from URL
      extractVariables(request.url).forEach((v) => variables.add(v));

      // Extract from headers
      for (const header of request.headers) {
        extractVariables(header.key).forEach((v) => variables.add(v));
        extractVariables(header.value).forEach((v) => variables.add(v));
      }

      // Extract from params
      for (const param of request.params) {
        extractVariables(param.key).forEach((v) => variables.add(v));
        extractVariables(param.value).forEach((v) => variables.add(v));
      }

      // Extract from body
      if (request.body?.content) {
        extractVariables(request.body.content).forEach((v) => variables.add(v));
      }

      if (request.body?.formData) {
        for (const field of request.body.formData) {
          extractVariables(field.key).forEach((v) => variables.add(v));
          extractVariables(field.value).forEach((v) => variables.add(v));
        }
      }
    }

    return Array.from(variables);
  }

  /**
   * Validate that all used variables are defined
   */
  validateVariables(
    usedVariables: string[],
    definedVariables: string[]
  ): ValidationResult {
    const warnings: MappingWarning[] = [];
    const definedSet = new Set(definedVariables);
    const usedSet = new Set(usedVariables);

    // Check for undefined variables
    for (const variable of usedVariables) {
      if (!definedSet.has(variable)) {
        warnings.push({
          type: 'undefined_variable',
          message: `Variable "${variable}" is used but not defined in any environment`,
          variableName: variable,
        });
      }
    }

    // Check for unused variables
    for (const variable of definedVariables) {
      if (!usedSet.has(variable)) {
        warnings.push({
          type: 'unused_variable',
          message: `Variable "${variable}" is defined but never used`,
          variableName: variable,
        });
      }
    }

    return { warnings };
  }

  /**
   * Check for Postman dynamic variables
   */
  checkDynamicVariables(requests: SourceRequest[]): MappingWarning[] {
    const warnings: MappingWarning[] = [];
    const dynamicVars = new Set<string>();

    for (const request of requests) {
      const textsToCheck = [
        request.url,
        ...request.headers.map((h) => h.value),
        request.body?.content || '',
      ];

      for (const text of textsToCheck) {
        PATTERNS.postmanDynamic.lastIndex = 0;
        let match;
        while ((match = PATTERNS.postmanDynamic.exec(text)) !== null) {
          dynamicVars.add(match[1]);
        }
      }
    }

    if (dynamicVars.size > 0) {
      warnings.push({
        type: 'dynamic_variable',
        message: `Postman dynamic variables detected: ${Array.from(dynamicVars).map((v) => `$${v}`).join(', ')}. These will need to be replaced with static values or WireSniff equivalents.`,
      });
    }

    return warnings;
  }

  /**
   * Check for Insomnia template tags
   */
  checkInsomniaTemplateTags(requests: SourceRequest[]): MappingWarning[] {
    const warnings: MappingWarning[] = [];
    const templateTags = new Set<string>();
    let hasResponseRef = false;

    for (const request of requests) {
      const textsToCheck = [
        request.url,
        ...request.headers.map((h) => h.value),
        request.body?.content || '',
      ];

      for (const text of textsToCheck) {
        PATTERNS.insomniaTemplate.lastIndex = 0;
        let match;
        while ((match = PATTERNS.insomniaTemplate.exec(text)) !== null) {
          const tag = match[1].trim();
          templateTags.add(tag.split(' ')[0]);

          if (tag.startsWith('response')) {
            hasResponseRef = true;
          }
        }
      }
    }

    if (templateTags.size > 0) {
      warnings.push({
        type: 'unsupported_feature',
        message: `Insomnia template tags detected: ${Array.from(templateTags).join(', ')}. These are not supported and will need manual replacement.`,
      });
    }

    if (hasResponseRef) {
      warnings.push({
        type: 'unsupported_feature',
        message: 'Insomnia response reference tags detected. These chain requests together and are not directly supported.',
      });
    }

    return warnings;
  }

  /**
   * Map Postman collection variables
   */
  mapCollectionVariables(
    variables: Array<{ key: string; value: string }>
  ): MappingResult {
    const warnings: MappingWarning[] = [];

    if (variables.length > 0) {
      warnings.push({
        type: 'conversion_note',
        message: `${variables.length} collection variable(s) found. These have been converted to environment variables. In Postman, collection variables have lower precedence than environment variables.`,
      });
    }

    const mappedVariables: VariableMapping[] = variables.map((v) => ({
      key: v.key,
      value: v.value,
      enabled: true,
      type: isSecretVariable(v.key) ? 'secret' : 'text',
    }));

    return {
      environments: [
        {
          name: 'Collection Variables',
          variables: mappedVariables,
        },
      ],
      warnings,
    };
  }

  /**
   * Map Postman global variables
   */
  mapGlobalVariables(
    variables: Array<{ key: string; value: string }>
  ): MappingResult {
    const mappedVariables: VariableMapping[] = variables.map((v) => ({
      key: v.key,
      value: v.value,
      enabled: true,
      type: isSecretVariable(v.key) ? 'secret' : 'text',
    }));

    return {
      environments: [
        {
          name: 'Global Variables',
          variables: mappedVariables,
        },
      ],
      warnings: [],
    };
  }

  /**
   * Normalize variable names to be valid identifiers
   */
  normalizeVariableNames(
    variables: Array<{ key: string; value: string }>
  ): { variables: VariableMapping[]; warnings: MappingWarning[] } {
    const warnings: MappingWarning[] = [];
    const normalizedVariables: VariableMapping[] = [];
    const seenNames = new Set<string>();

    for (const variable of variables) {
      const normalizedKey = normalizeVariableName(variable.key);

      // Check if name was changed
      if (normalizedKey !== variable.key) {
        warnings.push({
          type: 'variable_renamed',
          message: `Variable "${variable.key}" was renamed to "${normalizedKey}" to be a valid identifier`,
          originalName: variable.key,
          newName: normalizedKey,
        });
      }

      // Check for duplicates
      if (seenNames.has(normalizedKey)) {
        warnings.push({
          type: 'duplicate_variable',
          message: `Duplicate variable name "${normalizedKey}" after normalization. The later value will be used.`,
          variableName: normalizedKey,
        });
      }

      seenNames.add(normalizedKey);

      normalizedVariables.push({
        key: normalizedKey,
        value: variable.value,
        enabled: true,
        type: isSecretVariable(normalizedKey) ? 'secret' : 'text',
        originalKey: normalizedKey !== variable.key ? variable.key : undefined,
      });
    }

    return { variables: normalizedVariables, warnings };
  }
}

/**
 * Convenience function to map environment variables
 */
export function mapEnvironmentVariables(
  sourceEnvs: SourceEnvironment[]
): MappingResult {
  const mapper = new EnvVarMapper();
  return mapper.mapEnvironments(sourceEnvs);
}

export default EnvVarMapper;