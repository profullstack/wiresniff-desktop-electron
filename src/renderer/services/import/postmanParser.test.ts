/**
 * Postman Parser Service Tests
 *
 * Tests for the Postman Collection import parser.
 * Uses Vitest for testing.
 */

import { describe, it, expect } from 'vitest';
import { parsePostmanCollection, parsePostmanEnvironment } from './postmanParser';

describe('postmanParser Service', () => {
  describe('parsePostmanCollection', () => {
    describe('Schema Validation', () => {
      it('should throw error for missing schema', () => {
        const invalidCollection = JSON.stringify({
          info: {
            name: 'Test Collection',
          },
          item: [],
        });

        expect(() => parsePostmanCollection(invalidCollection)).toThrow(
          'Invalid Postman collection: missing schema'
        );
      });

      it('should throw error for unsupported schema version', () => {
        const invalidCollection = JSON.stringify({
          info: {
            name: 'Test Collection',
            schema: 'https://schema.getpostman.com/json/collection/v1.0.0/collection.json',
          },
          item: [],
        });

        expect(() => parsePostmanCollection(invalidCollection)).toThrow(
          'Unsupported Postman collection schema'
        );
      });

      it('should accept v2.0.0 schema', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test Collection',
            schema: 'https://schema.getpostman.com/json/collection/v2.0.0/collection.json',
          },
          item: [],
        });

        const result = parsePostmanCollection(collection);
        expect(result.name).toBe('Test Collection');
      });

      it('should accept v2.1.0 schema', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test Collection',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [],
        });

        const result = parsePostmanCollection(collection);
        expect(result.name).toBe('Test Collection');
      });
    });

    describe('Basic Collection Parsing', () => {
      it('should parse collection name and description', () => {
        const collection = JSON.stringify({
          info: {
            name: 'My API Collection',
            description: 'A collection of API endpoints',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [],
        });

        const result = parsePostmanCollection(collection);

        expect(result.name).toBe('My API Collection');
        expect(result.description).toBe('A collection of API endpoints');
        expect(result.id).toBeDefined();
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
      });

      it('should generate unique IDs for collections', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [],
        });

        const result1 = parsePostmanCollection(collection);
        const result2 = parsePostmanCollection(collection);

        expect(result1.id).not.toBe(result2.id);
      });
    });

    describe('Request Parsing', () => {
      it('should parse a basic GET request', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Get Users',
              request: {
                method: 'GET',
                url: 'https://api.example.com/users',
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests).toHaveLength(1);
        expect(result.requests[0].name).toBe('Get Users');
        expect(result.requests[0].method).toBe('GET');
        expect(result.requests[0].url).toBe('https://api.example.com/users');
      });

      it('should parse request with URL object', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Get User',
              request: {
                method: 'GET',
                url: {
                  raw: 'https://api.example.com/users/123',
                  protocol: 'https',
                  host: ['api', 'example', 'com'],
                  path: ['users', '123'],
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].url).toBe('https://api.example.com/users/123');
      });

      it('should build URL from parts when raw is missing', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Get User',
              request: {
                method: 'GET',
                url: {
                  protocol: 'https',
                  host: ['api', 'example', 'com'],
                  path: ['users', '123'],
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].url).toBe('https://api.example.com/users/123');
      });

      it('should parse query parameters', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Search Users',
              request: {
                method: 'GET',
                url: {
                  raw: 'https://api.example.com/users?page=1&limit=10',
                  query: [
                    { key: 'page', value: '1' },
                    { key: 'limit', value: '10', disabled: true },
                  ],
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].params).toHaveLength(2);
        expect(result.requests[0].params[0]).toMatchObject({
          key: 'page',
          value: '1',
          enabled: true,
        });
        expect(result.requests[0].params[1]).toMatchObject({
          key: 'limit',
          value: '10',
          enabled: false,
        });
      });

      it('should parse headers', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Get Users',
              request: {
                method: 'GET',
                url: 'https://api.example.com/users',
                header: [
                  { key: 'Content-Type', value: 'application/json' },
                  { key: 'X-Custom-Header', value: 'custom-value', disabled: true },
                ],
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].headers).toHaveLength(2);
        expect(result.requests[0].headers[0]).toMatchObject({
          key: 'Content-Type',
          value: 'application/json',
          enabled: true,
        });
        expect(result.requests[0].headers[1]).toMatchObject({
          key: 'X-Custom-Header',
          value: 'custom-value',
          enabled: false,
        });
      });

      it('should default method to GET when not specified', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Get Users',
              request: {
                url: 'https://api.example.com/users',
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].method).toBe('GET');
      });
    });

    describe('Body Parsing', () => {
      it('should parse raw JSON body', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Create User',
              request: {
                method: 'POST',
                url: 'https://api.example.com/users',
                body: {
                  mode: 'raw',
                  raw: '{"name": "John"}',
                  options: {
                    raw: { language: 'json' },
                  },
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].body).toMatchObject({
          type: 'json',
          content: '{"name": "John"}',
        });
      });

      it('should parse raw XML body', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Create User',
              request: {
                method: 'POST',
                url: 'https://api.example.com/users',
                body: {
                  mode: 'raw',
                  raw: '<user><name>John</name></user>',
                  options: {
                    raw: { language: 'xml' },
                  },
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].body).toMatchObject({
          type: 'xml',
          content: '<user><name>John</name></user>',
        });
      });

      it('should parse raw HTML body', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Create Page',
              request: {
                method: 'POST',
                url: 'https://api.example.com/pages',
                body: {
                  mode: 'raw',
                  raw: '<html><body>Hello</body></html>',
                  options: {
                    raw: { language: 'html' },
                  },
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].body).toMatchObject({
          type: 'html',
          content: '<html><body>Hello</body></html>',
        });
      });

      it('should parse urlencoded body', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Login',
              request: {
                method: 'POST',
                url: 'https://api.example.com/login',
                body: {
                  mode: 'urlencoded',
                  urlencoded: [
                    { key: 'username', value: 'john' },
                    { key: 'password', value: 'secret', disabled: true },
                  ],
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].body?.type).toBe('form-urlencoded');
        expect(result.requests[0].body?.formData).toHaveLength(2);
        expect(result.requests[0].body?.formData?.[0]).toMatchObject({
          key: 'username',
          value: 'john',
          enabled: true,
        });
      });

      it('should parse formdata body', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Upload',
              request: {
                method: 'POST',
                url: 'https://api.example.com/upload',
                body: {
                  mode: 'formdata',
                  formdata: [
                    { key: 'name', value: 'document.pdf', type: 'text' },
                    { key: 'file', type: 'file', src: '/path/to/file.pdf' },
                  ],
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].body?.type).toBe('form-data');
        expect(result.requests[0].body?.formData).toHaveLength(2);
      });

      it('should parse GraphQL body', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'GraphQL Query',
              request: {
                method: 'POST',
                url: 'https://api.example.com/graphql',
                body: {
                  mode: 'graphql',
                  graphql: {
                    query: 'query { users { id name } }',
                    variables: '{"limit": 10}',
                  },
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].body?.type).toBe('graphql');
        expect(result.requests[0].body?.graphql).toMatchObject({
          query: 'query { users { id name } }',
          variables: '{"limit": 10}',
        });
      });

      it('should parse binary/file body', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Upload Binary',
              request: {
                method: 'POST',
                url: 'https://api.example.com/upload',
                body: {
                  mode: 'file',
                  file: {
                    src: '/path/to/file.bin',
                  },
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].body?.type).toBe('binary');
        expect(result.requests[0].body?.content).toBe('/path/to/file.bin');
      });
    });

    describe('Authentication Parsing', () => {
      it('should parse bearer token auth', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Protected Endpoint',
              request: {
                method: 'GET',
                url: 'https://api.example.com/protected',
                auth: {
                  type: 'bearer',
                  bearer: [{ key: 'token', value: 'my-jwt-token' }],
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].auth).toMatchObject({
          type: 'bearer',
          bearer: { token: 'my-jwt-token' },
        });
      });

      it('should parse basic auth', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Protected Endpoint',
              request: {
                method: 'GET',
                url: 'https://api.example.com/protected',
                auth: {
                  type: 'basic',
                  basic: [
                    { key: 'username', value: 'user' },
                    { key: 'password', value: 'pass' },
                  ],
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].auth).toMatchObject({
          type: 'basic',
          basic: { username: 'user', password: 'pass' },
        });
      });

      it('should parse API key auth', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Protected Endpoint',
              request: {
                method: 'GET',
                url: 'https://api.example.com/protected',
                auth: {
                  type: 'apikey',
                  apikey: [
                    { key: 'key', value: 'X-API-Key' },
                    { key: 'value', value: 'secret-key' },
                    { key: 'in', value: 'header' },
                  ],
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].auth).toMatchObject({
          type: 'api-key',
          apiKey: {
            key: 'X-API-Key',
            value: 'secret-key',
            addTo: 'header',
          },
        });
      });

      it('should parse OAuth2 auth', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'OAuth Endpoint',
              request: {
                method: 'GET',
                url: 'https://api.example.com/oauth',
                auth: {
                  type: 'oauth2',
                  oauth2: [
                    { key: 'accessToken', value: 'token123' },
                    { key: 'tokenType', value: 'Bearer' },
                  ],
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].auth).toMatchObject({
          type: 'oauth2',
          oauth2: {
            accessToken: 'token123',
            tokenType: 'Bearer',
          },
        });
      });

      it('should handle noauth type', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Public Endpoint',
              request: {
                method: 'GET',
                url: 'https://api.example.com/public',
                auth: {
                  type: 'noauth',
                },
              },
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].auth).toMatchObject({
          type: 'none',
        });
      });

      it('should parse collection-level auth', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          auth: {
            type: 'bearer',
            bearer: [{ key: 'token', value: 'collection-token' }],
          },
          item: [],
        });

        const result = parsePostmanCollection(collection);

        expect(result.auth).toMatchObject({
          type: 'bearer',
          bearer: { token: 'collection-token' },
        });
      });
    });

    describe('Folder Parsing', () => {
      it('should parse folders', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Users',
              item: [
                {
                  name: 'Get Users',
                  request: {
                    method: 'GET',
                    url: 'https://api.example.com/users',
                  },
                },
              ],
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.folders).toHaveLength(1);
        expect(result.folders[0].name).toBe('Users');
        expect(result.folders[0].requests).toHaveLength(1);
        expect(result.folders[0].requests[0].name).toBe('Get Users');
      });

      it('should parse nested folders', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'API',
              item: [
                {
                  name: 'v1',
                  item: [
                    {
                      name: 'Get Users',
                      request: {
                        method: 'GET',
                        url: 'https://api.example.com/v1/users',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.folders).toHaveLength(1);
        expect(result.folders[0].name).toBe('API');
        expect(result.folders[0].folders).toHaveLength(1);
        expect(result.folders[0].folders[0].name).toBe('v1');
        expect(result.folders[0].folders[0].requests).toHaveLength(1);
      });
    });

    describe('Variables Parsing', () => {
      it('should parse collection variables', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          variable: [
            { key: 'baseUrl', value: 'https://api.example.com' },
            { key: 'apiKey', value: 'secret', disabled: true },
          ],
          item: [],
        });

        const result = parsePostmanCollection(collection);

        expect(result.variables).toHaveLength(2);
        expect(result.variables[0]).toMatchObject({
          key: 'baseUrl',
          value: 'https://api.example.com',
          enabled: true,
        });
        expect(result.variables[1]).toMatchObject({
          key: 'apiKey',
          value: 'secret',
          enabled: false,
        });
      });
    });

    describe('Scripts Parsing', () => {
      it('should parse pre-request scripts', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Get Users',
              request: {
                method: 'GET',
                url: 'https://api.example.com/users',
              },
              event: [
                {
                  listen: 'prerequest',
                  script: {
                    type: 'text/javascript',
                    exec: ['console.log("Pre-request");', 'pm.variables.set("timestamp", Date.now());'],
                  },
                },
              ],
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].preRequestScript).toBe(
          'console.log("Pre-request");\npm.variables.set("timestamp", Date.now());'
        );
      });

      it('should parse test scripts', () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Get Users',
              request: {
                method: 'GET',
                url: 'https://api.example.com/users',
              },
              event: [
                {
                  listen: 'test',
                  script: {
                    type: 'text/javascript',
                    exec: ['pm.test("Status is 200", function() {', '  pm.response.to.have.status(200);', '});'],
                  },
                },
              ],
            },
          ],
        });

        const result = parsePostmanCollection(collection);

        expect(result.requests[0].testScript).toContain('pm.test("Status is 200"');
      });
    });
  });

  describe('parsePostmanEnvironment', () => {
    it('should parse environment name and variables', () => {
      const environment = JSON.stringify({
        name: 'Development',
        values: [
          { key: 'baseUrl', value: 'https://dev.api.example.com', enabled: true },
          { key: 'apiKey', value: 'dev-key', enabled: false },
        ],
      });

      const result = parsePostmanEnvironment(environment);

      expect(result.name).toBe('Development');
      expect(result.variables).toHaveLength(2);
      expect(result.variables[0]).toMatchObject({
        key: 'baseUrl',
        value: 'https://dev.api.example.com',
        enabled: true,
      });
      expect(result.variables[1]).toMatchObject({
        key: 'apiKey',
        value: 'dev-key',
        enabled: false,
      });
    });

    it('should throw error for invalid environment format', () => {
      const invalidEnvironment = JSON.stringify({
        invalid: 'data',
      });

      expect(() => parsePostmanEnvironment(invalidEnvironment)).toThrow(
        'Invalid Postman environment format'
      );
    });

    it('should default enabled to true when not specified', () => {
      const environment = JSON.stringify({
        name: 'Test',
        values: [{ key: 'var1', value: 'value1' }],
      });

      const result = parsePostmanEnvironment(environment);

      expect(result.variables[0].enabled).toBe(true);
    });

    it('should generate unique IDs for variables', () => {
      const environment = JSON.stringify({
        name: 'Test',
        values: [
          { key: 'var1', value: 'value1' },
          { key: 'var2', value: 'value2' },
        ],
      });

      const result = parsePostmanEnvironment(environment);

      expect(result.variables[0].id).toBeDefined();
      expect(result.variables[1].id).toBeDefined();
      expect(result.variables[0].id).not.toBe(result.variables[1].id);
    });
  });
});