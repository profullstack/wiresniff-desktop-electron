/**
 * Insomnia Parser Tests
 *
 * Tests for parsing Insomnia export files (v4 format).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InsomniaParser,
  parseInsomniaExport,
  InsomniaExport,
  InsomniaResource,
  InsomniaRequest,
  InsomniaRequestGroup,
  InsomniaEnvironment,
  InsomniaWorkspace,
  ParsedCollection,
  ParsedRequest,
  ParsedFolder,
  ParsedEnvironment,
  ImportWarning,
} from './insomniaParser';

// Sample Insomnia export data
const sampleInsomniaExport: InsomniaExport = {
  _type: 'export',
  __export_format: 4,
  __export_date: '2024-01-15T10:30:00.000Z',
  __export_source: 'insomnia.desktop.app:v2023.5.8',
  resources: [
    {
      _id: 'wrk_1',
      _type: 'workspace',
      name: 'My API Workspace',
      description: 'Test workspace',
      scope: 'collection',
      created: 1705312200000,
      modified: 1705312200000,
    } as InsomniaWorkspace,
    {
      _id: 'fld_1',
      _type: 'request_group',
      parentId: 'wrk_1',
      name: 'Users',
      description: 'User endpoints',
      created: 1705312200000,
      modified: 1705312200000,
    } as InsomniaRequestGroup,
    {
      _id: 'req_1',
      _type: 'request',
      parentId: 'fld_1',
      name: 'Get Users',
      description: 'Fetch all users',
      url: 'https://api.example.com/users',
      method: 'GET',
      headers: [
        { name: 'Authorization', value: 'Bearer {{token}}' },
        { name: 'Content-Type', value: 'application/json' },
      ],
      parameters: [
        { name: 'page', value: '1' },
        { name: 'limit', value: '10' },
      ],
      body: {},
      authentication: {},
      created: 1705312200000,
      modified: 1705312200000,
    } as InsomniaRequest,
    {
      _id: 'req_2',
      _type: 'request',
      parentId: 'fld_1',
      name: 'Create User',
      description: 'Create a new user',
      url: 'https://api.example.com/users',
      method: 'POST',
      headers: [
        { name: 'Content-Type', value: 'application/json' },
      ],
      parameters: [],
      body: {
        mimeType: 'application/json',
        text: '{"name": "{{userName}}", "email": "{{userEmail}}"}',
      },
      authentication: {
        type: 'bearer',
        token: '{{token}}',
      },
      created: 1705312200000,
      modified: 1705312200000,
    } as InsomniaRequest,
    {
      _id: 'req_3',
      _type: 'request',
      parentId: 'wrk_1',
      name: 'Health Check',
      url: 'https://api.example.com/health',
      method: 'GET',
      headers: [],
      parameters: [],
      body: {},
      authentication: {},
      created: 1705312200000,
      modified: 1705312200000,
    } as InsomniaRequest,
    {
      _id: 'env_1',
      _type: 'environment',
      parentId: 'wrk_1',
      name: 'Development',
      data: {
        baseUrl: 'https://dev.api.example.com',
        token: 'dev-token-123',
        userName: 'Test User',
        userEmail: 'test@example.com',
      },
      created: 1705312200000,
      modified: 1705312200000,
    } as InsomniaEnvironment,
    {
      _id: 'env_2',
      _type: 'environment',
      parentId: 'wrk_1',
      name: 'Production',
      data: {
        baseUrl: 'https://api.example.com',
        token: 'prod-token-456',
        userName: 'Prod User',
        userEmail: 'prod@example.com',
      },
      created: 1705312200000,
      modified: 1705312200000,
    } as InsomniaEnvironment,
  ],
};

describe('InsomniaParser', () => {
  let parser: InsomniaParser;

  beforeEach(() => {
    parser = new InsomniaParser();
  });

  describe('parse', () => {
    it('should parse valid Insomnia export JSON', () => {
      const result = parser.parse(JSON.stringify(sampleInsomniaExport));
      
      expect(result).toBeDefined();
      expect(result.collections).toHaveLength(1);
      expect(result.environments).toHaveLength(2);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => parser.parse('invalid json')).toThrow('Invalid JSON');
    });

    it('should throw error for non-Insomnia export', () => {
      expect(() => parser.parse('{"foo": "bar"}')).toThrow('Not a valid Insomnia export');
    });

    it('should throw error for unsupported export format', () => {
      const oldFormat = { ...sampleInsomniaExport, __export_format: 3 };
      expect(() => parser.parse(JSON.stringify(oldFormat))).toThrow('Unsupported export format');
    });
  });

  describe('parseCollection', () => {
    it('should extract workspace as collection', () => {
      const result = parser.parse(JSON.stringify(sampleInsomniaExport));
      const collection = result.collections[0];

      expect(collection.name).toBe('My API Workspace');
      expect(collection.description).toBe('Test workspace');
    });

    it('should parse folders from request groups', () => {
      const result = parser.parse(JSON.stringify(sampleInsomniaExport));
      const collection = result.collections[0];

      expect(collection.folders).toHaveLength(1);
      expect(collection.folders[0].name).toBe('Users');
      expect(collection.folders[0].description).toBe('User endpoints');
    });

    it('should parse requests within folders', () => {
      const result = parser.parse(JSON.stringify(sampleInsomniaExport));
      const folder = result.collections[0].folders[0];

      expect(folder.requests).toHaveLength(2);
      expect(folder.requests[0].name).toBe('Get Users');
      expect(folder.requests[1].name).toBe('Create User');
    });

    it('should parse root-level requests', () => {
      const result = parser.parse(JSON.stringify(sampleInsomniaExport));
      const collection = result.collections[0];

      expect(collection.requests).toHaveLength(1);
      expect(collection.requests[0].name).toBe('Health Check');
    });
  });

  describe('parseRequest', () => {
    it('should parse request method and URL', () => {
      const result = parser.parse(JSON.stringify(sampleInsomniaExport));
      const request = result.collections[0].folders[0].requests[0];

      expect(request.method).toBe('GET');
      expect(request.url).toBe('https://api.example.com/users');
    });

    it('should parse request headers', () => {
      const result = parser.parse(JSON.stringify(sampleInsomniaExport));
      const request = result.collections[0].folders[0].requests[0];

      expect(request.headers).toHaveLength(2);
      expect(request.headers[0]).toEqual({
        key: 'Authorization',
        value: 'Bearer {{token}}',
        enabled: true,
      });
    });

    it('should parse query parameters', () => {
      const result = parser.parse(JSON.stringify(sampleInsomniaExport));
      const request = result.collections[0].folders[0].requests[0];

      expect(request.params).toHaveLength(2);
      expect(request.params[0]).toEqual({
        key: 'page',
        value: '1',
        enabled: true,
      });
    });

    it('should parse JSON body', () => {
      const result = parser.parse(JSON.stringify(sampleInsomniaExport));
      const request = result.collections[0].folders[0].requests[1];

      expect(request.body).toBeDefined();
      expect(request.body?.type).toBe('json');
      expect(request.body?.content).toBe('{"name": "{{userName}}", "email": "{{userEmail}}"}');
    });

    it('should parse bearer authentication', () => {
      const result = parser.parse(JSON.stringify(sampleInsomniaExport));
      const request = result.collections[0].folders[0].requests[1];

      expect(request.auth).toBeDefined();
      expect(request.auth?.type).toBe('bearer');
      expect(request.auth?.bearer?.token).toBe('{{token}}');
    });
  });

  describe('parseEnvironments', () => {
    it('should parse all environments', () => {
      const result = parser.parse(JSON.stringify(sampleInsomniaExport));

      expect(result.environments).toHaveLength(2);
      expect(result.environments[0].name).toBe('Development');
      expect(result.environments[1].name).toBe('Production');
    });

    it('should parse environment variables', () => {
      const result = parser.parse(JSON.stringify(sampleInsomniaExport));
      const devEnv = result.environments[0];

      expect(devEnv.variables).toHaveLength(4);
      expect(devEnv.variables).toContainEqual({
        key: 'baseUrl',
        value: 'https://dev.api.example.com',
        enabled: true,
      });
      expect(devEnv.variables).toContainEqual({
        key: 'token',
        value: 'dev-token-123',
        enabled: true,
      });
    });
  });

  describe('variable conversion', () => {
    it('should convert Insomnia variables to WireSniff format', () => {
      const result = parser.parse(JSON.stringify(sampleInsomniaExport));
      const request = result.collections[0].folders[0].requests[0];

      // Insomnia uses {{var}}, WireSniff uses {{var}} - same format
      expect(request.headers[0].value).toBe('Bearer {{token}}');
    });

    it('should handle nested variable references', () => {
      const exportWithNestedVars: InsomniaExport = {
        ...sampleInsomniaExport,
        resources: [
          ...sampleInsomniaExport.resources.slice(0, 2),
          {
            _id: 'req_nested',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Nested Vars',
            url: '{{baseUrl}}/api/{{version}}/users',
            method: 'GET',
            headers: [],
            parameters: [],
            body: {},
            authentication: {},
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaRequest,
        ],
      };

      const result = parser.parse(JSON.stringify(exportWithNestedVars));
      const request = result.collections[0].requests.find(r => r.name === 'Nested Vars');

      expect(request?.url).toBe('{{baseUrl}}/api/{{version}}/users');
    });
  });

  describe('authentication types', () => {
    it('should parse basic authentication', () => {
      const exportWithBasicAuth: InsomniaExport = {
        ...sampleInsomniaExport,
        resources: [
          sampleInsomniaExport.resources[0],
          {
            _id: 'req_basic',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Basic Auth Request',
            url: 'https://api.example.com/secure',
            method: 'GET',
            headers: [],
            parameters: [],
            body: {},
            authentication: {
              type: 'basic',
              username: 'admin',
              password: 'secret123',
            },
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaRequest,
        ],
      };

      const result = parser.parse(JSON.stringify(exportWithBasicAuth));
      const request = result.collections[0].requests.find(r => r.name === 'Basic Auth Request');

      expect(request?.auth?.type).toBe('basic');
      expect(request?.auth?.basic?.username).toBe('admin');
      expect(request?.auth?.basic?.password).toBe('secret123');
    });

    it('should parse API key authentication', () => {
      const exportWithApiKey: InsomniaExport = {
        ...sampleInsomniaExport,
        resources: [
          sampleInsomniaExport.resources[0],
          {
            _id: 'req_apikey',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'API Key Request',
            url: 'https://api.example.com/data',
            method: 'GET',
            headers: [],
            parameters: [],
            body: {},
            authentication: {
              type: 'apikey',
              key: 'X-API-Key',
              value: 'my-api-key-123',
              addTo: 'header',
            },
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaRequest,
        ],
      };

      const result = parser.parse(JSON.stringify(exportWithApiKey));
      const request = result.collections[0].requests.find(r => r.name === 'API Key Request');

      expect(request?.auth?.type).toBe('apikey');
      expect(request?.auth?.apikey?.key).toBe('X-API-Key');
      expect(request?.auth?.apikey?.value).toBe('my-api-key-123');
      expect(request?.auth?.apikey?.in).toBe('header');
    });

    it('should parse OAuth2 authentication', () => {
      const exportWithOAuth: InsomniaExport = {
        ...sampleInsomniaExport,
        resources: [
          sampleInsomniaExport.resources[0],
          {
            _id: 'req_oauth',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'OAuth Request',
            url: 'https://api.example.com/protected',
            method: 'GET',
            headers: [],
            parameters: [],
            body: {},
            authentication: {
              type: 'oauth2',
              grantType: 'authorization_code',
              accessTokenUrl: 'https://auth.example.com/token',
              authorizationUrl: 'https://auth.example.com/authorize',
              clientId: 'client-123',
              clientSecret: 'secret-456',
              scope: 'read write',
            },
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaRequest,
        ],
      };

      const result = parser.parse(JSON.stringify(exportWithOAuth));
      const request = result.collections[0].requests.find(r => r.name === 'OAuth Request');

      expect(request?.auth?.type).toBe('oauth2');
      expect(request?.auth?.oauth2?.grantType).toBe('authorization_code');
      expect(request?.auth?.oauth2?.accessTokenUrl).toBe('https://auth.example.com/token');
    });
  });

  describe('body types', () => {
    it('should parse form-urlencoded body', () => {
      const exportWithForm: InsomniaExport = {
        ...sampleInsomniaExport,
        resources: [
          sampleInsomniaExport.resources[0],
          {
            _id: 'req_form',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Form Request',
            url: 'https://api.example.com/login',
            method: 'POST',
            headers: [],
            parameters: [],
            body: {
              mimeType: 'application/x-www-form-urlencoded',
              params: [
                { name: 'username', value: 'admin' },
                { name: 'password', value: 'secret' },
              ],
            },
            authentication: {},
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaRequest,
        ],
      };

      const result = parser.parse(JSON.stringify(exportWithForm));
      const request = result.collections[0].requests.find(r => r.name === 'Form Request');

      expect(request?.body?.type).toBe('form-urlencoded');
      expect(request?.body?.formData).toHaveLength(2);
      expect(request?.body?.formData?.[0]).toEqual({
        key: 'username',
        value: 'admin',
        enabled: true,
        type: 'text',
      });
    });

    it('should parse multipart form body', () => {
      const exportWithMultipart: InsomniaExport = {
        ...sampleInsomniaExport,
        resources: [
          sampleInsomniaExport.resources[0],
          {
            _id: 'req_multipart',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Multipart Request',
            url: 'https://api.example.com/upload',
            method: 'POST',
            headers: [],
            parameters: [],
            body: {
              mimeType: 'multipart/form-data',
              params: [
                { name: 'file', value: '', fileName: 'test.txt', type: 'file' },
                { name: 'description', value: 'Test file' },
              ],
            },
            authentication: {},
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaRequest,
        ],
      };

      const result = parser.parse(JSON.stringify(exportWithMultipart));
      const request = result.collections[0].requests.find(r => r.name === 'Multipart Request');

      expect(request?.body?.type).toBe('multipart');
      expect(request?.body?.formData).toHaveLength(2);
    });

    it('should parse raw XML body', () => {
      const exportWithXml: InsomniaExport = {
        ...sampleInsomniaExport,
        resources: [
          sampleInsomniaExport.resources[0],
          {
            _id: 'req_xml',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'XML Request',
            url: 'https://api.example.com/soap',
            method: 'POST',
            headers: [],
            parameters: [],
            body: {
              mimeType: 'application/xml',
              text: '<request><data>test</data></request>',
            },
            authentication: {},
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaRequest,
        ],
      };

      const result = parser.parse(JSON.stringify(exportWithXml));
      const request = result.collections[0].requests.find(r => r.name === 'XML Request');

      expect(request?.body?.type).toBe('xml');
      expect(request?.body?.content).toBe('<request><data>test</data></request>');
    });

    it('should parse GraphQL body', () => {
      const exportWithGraphQL: InsomniaExport = {
        ...sampleInsomniaExport,
        resources: [
          sampleInsomniaExport.resources[0],
          {
            _id: 'req_graphql',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'GraphQL Request',
            url: 'https://api.example.com/graphql',
            method: 'POST',
            headers: [],
            parameters: [],
            body: {
              mimeType: 'application/graphql',
              text: 'query { users { id name } }',
            },
            authentication: {},
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaRequest,
        ],
      };

      const result = parser.parse(JSON.stringify(exportWithGraphQL));
      const request = result.collections[0].requests.find(r => r.name === 'GraphQL Request');

      expect(request?.body?.type).toBe('graphql');
      expect(request?.body?.content).toBe('query { users { id name } }');
    });
  });

  describe('warnings', () => {
    it('should warn about unsupported features', () => {
      const exportWithUnsupported: InsomniaExport = {
        ...sampleInsomniaExport,
        resources: [
          ...sampleInsomniaExport.resources,
          {
            _id: 'cert_1',
            _type: 'client_certificate',
            parentId: 'wrk_1',
            host: 'api.example.com',
            cert: 'cert-data',
            key: 'key-data',
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaResource,
        ],
      };

      const result = parser.parse(JSON.stringify(exportWithUnsupported));

      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.type === 'unsupported_feature')).toBe(true);
    });

    it('should warn about cookie jars', () => {
      const exportWithCookies: InsomniaExport = {
        ...sampleInsomniaExport,
        resources: [
          ...sampleInsomniaExport.resources,
          {
            _id: 'jar_1',
            _type: 'cookie_jar',
            parentId: 'wrk_1',
            name: 'Default Jar',
            cookies: [
              { key: 'session', value: 'abc123', domain: 'example.com' },
            ],
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaResource,
        ],
      };

      const result = parser.parse(JSON.stringify(exportWithCookies));

      expect(result.warnings.some(w => 
        w.type === 'unsupported_feature' && w.message.includes('cookie')
      )).toBe(true);
    });

    it('should warn about proto files', () => {
      const exportWithProto: InsomniaExport = {
        ...sampleInsomniaExport,
        resources: [
          ...sampleInsomniaExport.resources,
          {
            _id: 'proto_1',
            _type: 'proto_file',
            parentId: 'wrk_1',
            name: 'service.proto',
            protoText: 'syntax = "proto3";',
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaResource,
        ],
      };

      const result = parser.parse(JSON.stringify(exportWithProto));

      expect(result.warnings.some(w => 
        w.type === 'unsupported_feature' && w.message.includes('proto')
      )).toBe(true);
    });
  });

  describe('nested folders', () => {
    it('should handle nested request groups', () => {
      const exportWithNestedFolders: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        __export_date: '2024-01-15T10:30:00.000Z',
        __export_source: 'insomnia.desktop.app:v2023.5.8',
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Nested Workspace',
            scope: 'collection',
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaWorkspace,
          {
            _id: 'fld_1',
            _type: 'request_group',
            parentId: 'wrk_1',
            name: 'Parent Folder',
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaRequestGroup,
          {
            _id: 'fld_2',
            _type: 'request_group',
            parentId: 'fld_1',
            name: 'Child Folder',
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaRequestGroup,
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'fld_2',
            name: 'Nested Request',
            url: 'https://api.example.com/nested',
            method: 'GET',
            headers: [],
            parameters: [],
            body: {},
            authentication: {},
            created: 1705312200000,
            modified: 1705312200000,
          } as InsomniaRequest,
        ],
      };

      const result = parser.parse(JSON.stringify(exportWithNestedFolders));
      const parentFolder = result.collections[0].folders[0];

      expect(parentFolder.name).toBe('Parent Folder');
      expect(parentFolder.folders).toHaveLength(1);
      expect(parentFolder.folders![0].name).toBe('Child Folder');
      expect(parentFolder.folders![0].requests).toHaveLength(1);
      expect(parentFolder.folders![0].requests[0].name).toBe('Nested Request');
    });
  });

  describe('parseInsomniaExport convenience function', () => {
    it('should parse export using convenience function', () => {
      const result = parseInsomniaExport(JSON.stringify(sampleInsomniaExport));

      expect(result.collections).toHaveLength(1);
      expect(result.environments).toHaveLength(2);
    });
  });
});