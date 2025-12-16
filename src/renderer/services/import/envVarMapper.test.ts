/**
 * Environment Variable Auto-Mapper Tests
 *
 * Tests for automatically mapping environment variables from
 * imported collections (Postman, Insomnia) to WireSniff format.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EnvVarMapper,
  mapEnvironmentVariables,
  detectVariableSyntax,
  convertVariableSyntax,
  VariableSyntax,
  MappingResult,
  MappingWarning,
  VariableMapping,
} from './envVarMapper';

describe('EnvVarMapper', () => {
  let mapper: EnvVarMapper;

  beforeEach(() => {
    mapper = new EnvVarMapper();
  });

  describe('detectVariableSyntax', () => {
    it('should detect Postman double-brace syntax', () => {
      expect(detectVariableSyntax('{{baseUrl}}')).toBe('postman');
      expect(detectVariableSyntax('Bearer {{token}}')).toBe('postman');
      expect(detectVariableSyntax('https://{{host}}/api')).toBe('postman');
    });

    it('should detect Insomnia double-brace syntax (same as Postman)', () => {
      expect(detectVariableSyntax('{{baseUrl}}')).toBe('postman');
    });

    it('should detect environment variable syntax ($VAR)', () => {
      expect(detectVariableSyntax('$BASE_URL')).toBe('env');
      expect(detectVariableSyntax('Bearer $TOKEN')).toBe('env');
    });

    it('should detect environment variable syntax (${VAR})', () => {
      expect(detectVariableSyntax('${BASE_URL}')).toBe('env-braces');
      expect(detectVariableSyntax('https://${HOST}/api')).toBe('env-braces');
    });

    it('should detect cURL-style syntax', () => {
      expect(detectVariableSyntax(':baseUrl')).toBe('curl');
      expect(detectVariableSyntax('https://:host/api/:version')).toBe('curl');
    });

    it('should return null for no variables', () => {
      expect(detectVariableSyntax('https://api.example.com')).toBeNull();
      expect(detectVariableSyntax('plain text')).toBeNull();
    });

    it('should handle mixed syntax (returns first detected)', () => {
      // Postman syntax takes precedence
      expect(detectVariableSyntax('{{var}} and $VAR')).toBe('postman');
    });
  });

  describe('convertVariableSyntax', () => {
    it('should convert Postman syntax to WireSniff format', () => {
      expect(convertVariableSyntax('{{baseUrl}}', 'postman', 'wiresniff')).toBe('{{baseUrl}}');
      expect(convertVariableSyntax('Bearer {{token}}', 'postman', 'wiresniff')).toBe('Bearer {{token}}');
    });

    it('should convert env syntax to WireSniff format', () => {
      expect(convertVariableSyntax('$BASE_URL', 'env', 'wiresniff')).toBe('{{BASE_URL}}');
      expect(convertVariableSyntax('Bearer $TOKEN', 'env', 'wiresniff')).toBe('Bearer {{TOKEN}}');
    });

    it('should convert env-braces syntax to WireSniff format', () => {
      expect(convertVariableSyntax('${BASE_URL}', 'env-braces', 'wiresniff')).toBe('{{BASE_URL}}');
      expect(convertVariableSyntax('https://${HOST}/api', 'env-braces', 'wiresniff')).toBe('https://{{HOST}}/api');
    });

    it('should convert cURL syntax to WireSniff format', () => {
      expect(convertVariableSyntax(':baseUrl', 'curl', 'wiresniff')).toBe('{{baseUrl}}');
      expect(convertVariableSyntax('https://:host/api/:version', 'curl', 'wiresniff')).toBe('https://{{host}}/api/{{version}}');
    });

    it('should handle multiple variables in one string', () => {
      expect(convertVariableSyntax('{{protocol}}://{{host}}:{{port}}', 'postman', 'wiresniff'))
        .toBe('{{protocol}}://{{host}}:{{port}}');
      expect(convertVariableSyntax('$PROTOCOL://$HOST:$PORT', 'env', 'wiresniff'))
        .toBe('{{PROTOCOL}}://{{HOST}}:{{PORT}}');
    });

    it('should preserve non-variable text', () => {
      expect(convertVariableSyntax('https://api.example.com/v1', 'postman', 'wiresniff'))
        .toBe('https://api.example.com/v1');
    });
  });

  describe('mapEnvironmentVariables', () => {
    it('should map simple environment variables', () => {
      const sourceEnvs = [
        {
          name: 'Development',
          variables: [
            { key: 'baseUrl', value: 'https://dev.api.example.com' },
            { key: 'token', value: 'dev-token-123' },
          ],
        },
      ];

      const result = mapper.mapEnvironments(sourceEnvs);

      expect(result.environments).toHaveLength(1);
      expect(result.environments[0].name).toBe('Development');
      expect(result.environments[0].variables).toHaveLength(2);
      expect(result.environments[0].variables[0]).toEqual({
        key: 'baseUrl',
        value: 'https://dev.api.example.com',
        enabled: true,
        type: 'text',
      });
    });

    it('should detect and mark secret variables', () => {
      const sourceEnvs = [
        {
          name: 'Production',
          variables: [
            { key: 'apiKey', value: 'sk-1234567890' },
            { key: 'password', value: 'secret123' },
            { key: 'token', value: 'bearer-token' },
            { key: 'secret', value: 'my-secret' },
            { key: 'baseUrl', value: 'https://api.example.com' },
          ],
        },
      ];

      const result = mapper.mapEnvironments(sourceEnvs);

      const apiKeyVar = result.environments[0].variables.find((v: VariableMapping) => v.key === 'apiKey');
      const passwordVar = result.environments[0].variables.find((v: VariableMapping) => v.key === 'password');
      const tokenVar = result.environments[0].variables.find((v: VariableMapping) => v.key === 'token');
      const secretVar = result.environments[0].variables.find((v: VariableMapping) => v.key === 'secret');
      const baseUrlVar = result.environments[0].variables.find((v: VariableMapping) => v.key === 'baseUrl');

      expect(apiKeyVar?.type).toBe('secret');
      expect(passwordVar?.type).toBe('secret');
      expect(tokenVar?.type).toBe('secret');
      expect(secretVar?.type).toBe('secret');
      expect(baseUrlVar?.type).toBe('text');
    });

    it('should handle multiple environments', () => {
      const sourceEnvs = [
        { name: 'Development', variables: [{ key: 'url', value: 'https://dev.example.com' }] },
        { name: 'Staging', variables: [{ key: 'url', value: 'https://staging.example.com' }] },
        { name: 'Production', variables: [{ key: 'url', value: 'https://example.com' }] },
      ];

      const result = mapper.mapEnvironments(sourceEnvs);

      expect(result.environments).toHaveLength(3);
      expect(result.environments.map((e: { name: string }) => e.name)).toEqual(['Development', 'Staging', 'Production']);
    });

    it('should handle empty environments', () => {
      const result = mapper.mapEnvironments([]);
      expect(result.environments).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle environment with no variables', () => {
      const sourceEnvs = [{ name: 'Empty', variables: [] }];
      const result = mapper.mapEnvironments(sourceEnvs);

      expect(result.environments).toHaveLength(1);
      expect(result.environments[0].variables).toHaveLength(0);
    });
  });

  describe('variable extraction from requests', () => {
    it('should extract variables used in URLs', () => {
      const requests = [
        { url: '{{baseUrl}}/users', method: 'GET', headers: [], params: [] },
        { url: '{{baseUrl}}/posts/{{postId}}', method: 'GET', headers: [], params: [] },
      ];

      const result = mapper.extractUsedVariables(requests);

      expect(result).toContain('baseUrl');
      expect(result).toContain('postId');
    });

    it('should extract variables used in headers', () => {
      const requests = [
        {
          url: 'https://api.example.com',
          method: 'GET',
          headers: [
            { key: 'Authorization', value: 'Bearer {{token}}' },
            { key: 'X-API-Key', value: '{{apiKey}}' },
          ],
          params: [],
        },
      ];

      const result = mapper.extractUsedVariables(requests);

      expect(result).toContain('token');
      expect(result).toContain('apiKey');
    });

    it('should extract variables used in body', () => {
      const requests = [
        {
          url: 'https://api.example.com',
          method: 'POST',
          headers: [],
          params: [],
          body: {
            type: 'json' as const,
            content: '{"userId": "{{userId}}", "name": "{{userName}}"}',
          },
        },
      ];

      const result = mapper.extractUsedVariables(requests);

      expect(result).toContain('userId');
      expect(result).toContain('userName');
    });

    it('should return unique variables only', () => {
      const requests = [
        { url: '{{baseUrl}}/users', method: 'GET', headers: [], params: [] },
        { url: '{{baseUrl}}/posts', method: 'GET', headers: [], params: [] },
        {
          url: '{{baseUrl}}/comments',
          method: 'GET',
          headers: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
          params: [],
        },
      ];

      const result = mapper.extractUsedVariables(requests);

      expect(result.filter((v: string) => v === 'baseUrl')).toHaveLength(1);
    });
  });

  describe('variable validation', () => {
    it('should warn about undefined variables', () => {
      const usedVariables = ['baseUrl', 'token', 'undefinedVar'];
      const definedVariables = ['baseUrl', 'token'];

      const result = mapper.validateVariables(usedVariables, definedVariables);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('undefined_variable');
      expect(result.warnings[0].variableName).toBe('undefinedVar');
    });

    it('should warn about unused variables', () => {
      const usedVariables = ['baseUrl'];
      const definedVariables = ['baseUrl', 'token', 'apiKey'];

      const result = mapper.validateVariables(usedVariables, definedVariables);

      expect(result.warnings.filter((w: MappingWarning) => w.type === 'unused_variable')).toHaveLength(2);
    });

    it('should not warn when all variables are used and defined', () => {
      const usedVariables = ['baseUrl', 'token'];
      const definedVariables = ['baseUrl', 'token'];

      const result = mapper.validateVariables(usedVariables, definedVariables);

      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Postman-specific features', () => {
    it('should handle Postman dynamic variables', () => {
      const requests = [
        {
          url: 'https://api.example.com/users',
          method: 'POST',
          headers: [],
          params: [],
          body: {
            type: 'json' as const,
            content: '{"id": "{{$guid}}", "timestamp": "{{$timestamp}}", "random": "{{$randomInt}}"}',
          },
        },
      ];

      const result = mapper.extractUsedVariables(requests);
      const warnings = mapper.checkDynamicVariables(requests);

      // Dynamic variables should be detected
      expect(warnings.some((w: MappingWarning) => w.type === 'dynamic_variable')).toBe(true);
    });

    it('should warn about Postman collection variables', () => {
      const collectionVariables = [
        { key: 'collectionVar', value: 'value1' },
      ];

      const result = mapper.mapCollectionVariables(collectionVariables);

      expect(result.warnings.some((w: MappingWarning) => 
        w.type === 'conversion_note' && w.message.includes('collection variable')
      )).toBe(true);
    });

    it('should handle Postman global variables', () => {
      const globalVariables = [
        { key: 'globalToken', value: 'global-token-123' },
      ];

      const result = mapper.mapGlobalVariables(globalVariables);

      expect(result.environments).toHaveLength(1);
      expect(result.environments[0].name).toBe('Global Variables');
      expect(result.environments[0].variables[0].key).toBe('globalToken');
    });
  });

  describe('Insomnia-specific features', () => {
    it('should handle Insomnia template tags', () => {
      const requests = [
        {
          url: 'https://api.example.com/users',
          method: 'GET',
          headers: [
            { key: 'X-Request-Id', value: '{% uuid %}' },
            { key: 'X-Timestamp', value: '{% now %}' },
          ],
          params: [],
        },
      ];

      const warnings = mapper.checkInsomniaTemplateTags(requests);

      expect(warnings.some((w: MappingWarning) => w.type === 'unsupported_feature')).toBe(true);
      expect(warnings.some((w: MappingWarning) => w.message.includes('template tag'))).toBe(true);
    });

    it('should handle Insomnia response references', () => {
      const requests = [
        {
          url: 'https://api.example.com/users',
          method: 'GET',
          headers: [
            { key: 'Authorization', value: '{% response "body", "req_123", "$.token" %}' },
          ],
          params: [],
        },
      ];

      const warnings = mapper.checkInsomniaTemplateTags(requests);

      expect(warnings.some((w: MappingWarning) => 
        w.type === 'unsupported_feature' && w.message.includes('response reference')
      )).toBe(true);
    });
  });

  describe('variable name normalization', () => {
    it('should normalize variable names with special characters', () => {
      const variables = [
        { key: 'base-url', value: 'https://api.example.com' },
        { key: 'api.key', value: 'key123' },
        { key: 'my variable', value: 'value' },
      ];

      const result = mapper.normalizeVariableNames(variables);

      expect(result.variables[0].key).toBe('base_url');
      expect(result.variables[1].key).toBe('api_key');
      expect(result.variables[2].key).toBe('my_variable');
    });

    it('should warn about renamed variables', () => {
      const variables = [
        { key: 'base-url', value: 'https://api.example.com' },
      ];

      const result = mapper.normalizeVariableNames(variables);

      expect(result.warnings.some((w: MappingWarning) => 
        w.type === 'variable_renamed' && w.originalName === 'base-url' && w.newName === 'base_url'
      )).toBe(true);
    });

    it('should handle duplicate names after normalization', () => {
      const variables = [
        { key: 'base-url', value: 'value1' },
        { key: 'base_url', value: 'value2' },
      ];

      const result = mapper.normalizeVariableNames(variables);

      expect(result.warnings.some((w: MappingWarning) => w.type === 'duplicate_variable')).toBe(true);
    });
  });

  describe('convenience function', () => {
    it('should work with mapEnvironmentVariables function', () => {
      const sourceEnvs = [
        {
          name: 'Test',
          variables: [{ key: 'url', value: 'https://test.example.com' }],
        },
      ];

      const result = mapEnvironmentVariables(sourceEnvs);

      expect(result.environments).toHaveLength(1);
      expect(result.environments[0].name).toBe('Test');
    });
  });
});