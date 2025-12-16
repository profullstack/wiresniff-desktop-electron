/**
 * Insomnia Parser
 *
 * Parses Insomnia export files (v4 format) and converts them
 * to WireSniff's internal collection format.
 */

// ==================== Insomnia Types ====================

export interface InsomniaExport {
  _type: 'export';
  __export_format: number;
  __export_date: string;
  __export_source: string;
  resources: InsomniaResource[];
}

export interface InsomniaResource {
  _id: string;
  _type: string;
  parentId?: string;
  name?: string;
  created?: number;
  modified?: number;
}

export interface InsomniaWorkspace extends InsomniaResource {
  _type: 'workspace';
  name: string;
  description?: string;
  scope?: 'collection' | 'design';
}

export interface InsomniaRequestGroup extends InsomniaResource {
  _type: 'request_group';
  name: string;
  description?: string;
  environment?: Record<string, unknown>;
  environmentPropertyOrder?: Record<string, unknown>;
  metaSortKey?: number;
}

export interface InsomniaRequest extends InsomniaResource {
  _type: 'request';
  name: string;
  description?: string;
  url: string;
  method: string;
  headers: Array<{ name: string; value: string; disabled?: boolean }>;
  parameters: Array<{ name: string; value: string; disabled?: boolean }>;
  body: InsomniaBody;
  authentication: InsomniaAuth;
  settingStoreCookies?: boolean;
  settingSendCookies?: boolean;
  settingDisableRenderRequestBody?: boolean;
  settingEncodeUrl?: boolean;
  settingRebuildPath?: boolean;
  settingFollowRedirects?: string;
}

export interface InsomniaBody {
  mimeType?: string;
  text?: string;
  params?: Array<{
    name: string;
    value: string;
    disabled?: boolean;
    fileName?: string;
    type?: string;
  }>;
}

export interface InsomniaAuth {
  type?: string;
  // Basic auth
  username?: string;
  password?: string;
  // Bearer
  token?: string;
  prefix?: string;
  // API Key
  key?: string;
  value?: string;
  addTo?: 'header' | 'query';
  // OAuth2
  grantType?: string;
  accessTokenUrl?: string;
  authorizationUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  state?: string;
  code?: string;
  redirectUrl?: string;
  credentialsInBody?: boolean;
  audience?: string;
  resource?: string;
  tokenPrefix?: string;
  usePkce?: boolean;
}

export interface InsomniaEnvironment extends InsomniaResource {
  _type: 'environment';
  name: string;
  data: Record<string, unknown>;
  dataPropertyOrder?: Record<string, unknown>;
  color?: string;
  isPrivate?: boolean;
  metaSortKey?: number;
}

// ==================== WireSniff Types ====================

export interface ParsedCollection {
  id: string;
  name: string;
  description?: string;
  folders: ParsedFolder[];
  requests: ParsedRequest[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ParsedFolder {
  id: string;
  name: string;
  description?: string;
  folders?: ParsedFolder[];
  requests: ParsedRequest[];
}

export interface ParsedRequest {
  id: string;
  name: string;
  description?: string;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  params: Array<{ key: string; value: string; enabled: boolean }>;
  body?: ParsedBody;
  auth?: ParsedAuth;
}

export interface ParsedBody {
  type: 'none' | 'json' | 'xml' | 'text' | 'form-urlencoded' | 'multipart' | 'graphql' | 'binary';
  content?: string;
  formData?: Array<{
    key: string;
    value: string;
    enabled: boolean;
    type?: 'text' | 'file';
    fileName?: string;
  }>;
}

export interface ParsedAuth {
  type: 'none' | 'basic' | 'bearer' | 'apikey' | 'oauth2' | 'digest' | 'ntlm' | 'aws';
  basic?: {
    username: string;
    password: string;
  };
  bearer?: {
    token: string;
    prefix?: string;
  };
  apikey?: {
    key: string;
    value: string;
    in: 'header' | 'query';
  };
  oauth2?: {
    grantType: string;
    accessTokenUrl?: string;
    authorizationUrl?: string;
    clientId?: string;
    clientSecret?: string;
    scope?: string;
    state?: string;
    redirectUrl?: string;
  };
}

export interface ParsedEnvironment {
  id: string;
  name: string;
  variables: Array<{ key: string; value: string; enabled: boolean }>;
}

export interface ImportWarning {
  type: 'unsupported_feature' | 'conversion_issue' | 'missing_data';
  message: string;
  resourceId?: string;
  resourceName?: string;
}

export interface ParseResult {
  collections: ParsedCollection[];
  environments: ParsedEnvironment[];
  warnings: ImportWarning[];
}

// ==================== Parser Implementation ====================

export class InsomniaParser {
  private warnings: ImportWarning[] = [];

  /**
   * Parse Insomnia export JSON string
   */
  parse(jsonString: string): ParseResult {
    this.warnings = [];

    // Parse JSON
    let data: InsomniaExport;
    try {
      data = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON: Unable to parse the file');
    }

    // Validate export format
    if (data._type !== 'export') {
      throw new Error('Not a valid Insomnia export file');
    }

    if (data.__export_format !== 4) {
      throw new Error(`Unsupported export format version: ${data.__export_format}. Only v4 is supported.`);
    }

    // Extract resources by type
    const workspaces = data.resources.filter(
      (r): r is InsomniaWorkspace => r._type === 'workspace'
    );
    const requestGroups = data.resources.filter(
      (r): r is InsomniaRequestGroup => r._type === 'request_group'
    );
    const requests = data.resources.filter(
      (r): r is InsomniaRequest => r._type === 'request'
    );
    const environments = data.resources.filter(
      (r): r is InsomniaEnvironment => r._type === 'environment'
    );

    // Check for unsupported resource types
    this.checkUnsupportedResources(data.resources);

    // Parse collections from workspaces
    const collections = workspaces.map((workspace) =>
      this.parseWorkspace(workspace, requestGroups, requests)
    );

    // Parse environments
    const parsedEnvironments = environments.map((env) => this.parseEnvironment(env));

    return {
      collections,
      environments: parsedEnvironments,
      warnings: this.warnings,
    };
  }

  /**
   * Check for unsupported resource types and add warnings
   */
  private checkUnsupportedResources(resources: InsomniaResource[]): void {
    const unsupportedTypes = [
      'cookie_jar',
      'client_certificate',
      'proto_file',
      'grpc_request',
      'websocket_request',
      'unit_test_suite',
      'unit_test',
      'api_spec',
    ];

    for (const resource of resources) {
      if (unsupportedTypes.includes(resource._type)) {
        const typeLabel = resource._type.replace(/_/g, ' ');
        this.warnings.push({
          type: 'unsupported_feature',
          message: `${typeLabel} resources are not supported and will be skipped`,
          resourceId: resource._id,
          resourceName: resource.name,
        });
      }
    }
  }

  /**
   * Parse workspace into collection
   */
  private parseWorkspace(
    workspace: InsomniaWorkspace,
    allGroups: InsomniaRequestGroup[],
    allRequests: InsomniaRequest[]
  ): ParsedCollection {
    // Get root-level folders (direct children of workspace)
    const rootGroups = allGroups.filter((g) => g.parentId === workspace._id);

    // Get root-level requests (direct children of workspace)
    const rootRequests = allRequests.filter((r) => r.parentId === workspace._id);

    // Parse folders recursively
    const folders = rootGroups.map((group) =>
      this.parseRequestGroup(group, allGroups, allRequests)
    );

    // Parse root requests
    const requests = rootRequests.map((req) => this.parseRequest(req));

    return {
      id: workspace._id,
      name: workspace.name,
      description: workspace.description,
      folders,
      requests,
      createdAt: new Date(workspace.created || Date.now()),
      updatedAt: new Date(workspace.modified || Date.now()),
    };
  }

  /**
   * Parse request group into folder (recursive)
   */
  private parseRequestGroup(
    group: InsomniaRequestGroup,
    allGroups: InsomniaRequestGroup[],
    allRequests: InsomniaRequest[]
  ): ParsedFolder {
    // Get child folders
    const childGroups = allGroups.filter((g) => g.parentId === group._id);

    // Get child requests
    const childRequests = allRequests.filter((r) => r.parentId === group._id);

    // Parse child folders recursively
    const folders = childGroups.map((childGroup) =>
      this.parseRequestGroup(childGroup, allGroups, allRequests)
    );

    // Parse requests
    const requests = childRequests.map((req) => this.parseRequest(req));

    return {
      id: group._id,
      name: group.name,
      description: group.description,
      folders: folders.length > 0 ? folders : undefined,
      requests,
    };
  }

  /**
   * Parse Insomnia request into WireSniff format
   */
  private parseRequest(request: InsomniaRequest): ParsedRequest {
    return {
      id: request._id,
      name: request.name,
      description: request.description,
      method: request.method,
      url: request.url,
      headers: this.parseHeaders(request.headers),
      params: this.parseParams(request.parameters),
      body: this.parseBody(request.body),
      auth: this.parseAuth(request.authentication),
    };
  }

  /**
   * Parse headers
   */
  private parseHeaders(
    headers: Array<{ name: string; value: string; disabled?: boolean }>
  ): Array<{ key: string; value: string; enabled: boolean }> {
    return headers.map((h) => ({
      key: h.name,
      value: h.value,
      enabled: !h.disabled,
    }));
  }

  /**
   * Parse query parameters
   */
  private parseParams(
    params: Array<{ name: string; value: string; disabled?: boolean }>
  ): Array<{ key: string; value: string; enabled: boolean }> {
    return params.map((p) => ({
      key: p.name,
      value: p.value,
      enabled: !p.disabled,
    }));
  }

  /**
   * Parse request body
   */
  private parseBody(body: InsomniaBody): ParsedBody | undefined {
    if (!body || (!body.mimeType && !body.text && !body.params)) {
      return undefined;
    }

    const mimeType = body.mimeType || '';

    // JSON body
    if (mimeType.includes('application/json')) {
      return {
        type: 'json',
        content: body.text || '',
      };
    }

    // XML body
    if (mimeType.includes('application/xml') || mimeType.includes('text/xml')) {
      return {
        type: 'xml',
        content: body.text || '',
      };
    }

    // GraphQL body
    if (mimeType.includes('application/graphql')) {
      return {
        type: 'graphql',
        content: body.text || '',
      };
    }

    // Form URL-encoded
    if (mimeType.includes('application/x-www-form-urlencoded')) {
      return {
        type: 'form-urlencoded',
        formData: body.params?.map((p) => ({
          key: p.name,
          value: p.value,
          enabled: !p.disabled,
          type: 'text' as const,
        })),
      };
    }

    // Multipart form
    if (mimeType.includes('multipart/form-data')) {
      return {
        type: 'multipart',
        formData: body.params?.map((p) => ({
          key: p.name,
          value: p.value,
          enabled: !p.disabled,
          type: p.type === 'file' ? ('file' as const) : ('text' as const),
          fileName: p.fileName,
        })),
      };
    }

    // Plain text or other
    if (body.text) {
      return {
        type: 'text',
        content: body.text,
      };
    }

    return undefined;
  }

  /**
   * Parse authentication
   */
  private parseAuth(auth: InsomniaAuth): ParsedAuth | undefined {
    if (!auth || !auth.type) {
      return undefined;
    }

    switch (auth.type) {
      case 'basic':
        return {
          type: 'basic',
          basic: {
            username: auth.username || '',
            password: auth.password || '',
          },
        };

      case 'bearer':
        return {
          type: 'bearer',
          bearer: {
            token: auth.token || '',
            prefix: auth.prefix,
          },
        };

      case 'apikey':
        return {
          type: 'apikey',
          apikey: {
            key: auth.key || '',
            value: auth.value || '',
            in: auth.addTo === 'query' ? 'query' : 'header',
          },
        };

      case 'oauth2':
        return {
          type: 'oauth2',
          oauth2: {
            grantType: auth.grantType || 'authorization_code',
            accessTokenUrl: auth.accessTokenUrl,
            authorizationUrl: auth.authorizationUrl,
            clientId: auth.clientId,
            clientSecret: auth.clientSecret,
            scope: auth.scope,
            state: auth.state,
            redirectUrl: auth.redirectUrl,
          },
        };

      default:
        this.warnings.push({
          type: 'unsupported_feature',
          message: `Authentication type "${auth.type}" is not fully supported`,
        });
        return undefined;
    }
  }

  /**
   * Parse environment
   */
  private parseEnvironment(env: InsomniaEnvironment): ParsedEnvironment {
    const variables: Array<{ key: string; value: string; enabled: boolean }> = [];

    for (const [key, value] of Object.entries(env.data)) {
      variables.push({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        enabled: true,
      });
    }

    return {
      id: env._id,
      name: env.name,
      variables,
    };
  }
}

/**
 * Convenience function to parse Insomnia export
 */
export function parseInsomniaExport(jsonString: string): ParseResult {
  const parser = new InsomniaParser();
  return parser.parse(jsonString);
}

export default InsomniaParser;