import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import freeeApiSchema from './data/freee-api-schema.json';

type OpenAPIRequestBodyContentSchema = {
  required?: string[];
  type: 'object';
  properties: {
    [key: string]: {
      type?: string;
      format?: string;
      description?: string;
      example?: string | number | boolean | (string | number | boolean)[];
      enum?: string[] | number[];
      minimum?: number | string;
      maximum?: number | string;
    };
  };
};

type OpenAPIRequestBody = {
  content: {
    'application/json'?: {
      schema: { $ref: string } | OpenAPIRequestBodyContentSchema;
    };
    'multipart/form-data'?: {
      schema: { $ref: string } | OpenAPIRequestBodyContentSchema;
    };
  };
};

type OpenAPIParameter = {
  name: string;
  in: string;
  schema?: {
    type: string;
    format?: string;
  };
  type?: string;
  format?: string;
  required?: boolean;
  description?: string;
};

type OpenAPIOperation = {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, unknown>;
};

type OpenAPIPathItem = {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  patch?: OpenAPIOperation;
};

// APIリクエストを実行する関数
async function makeApiRequest(
  method: string,
  path: string,
  params?: Record<string, unknown>,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const baseUrl = process.env.FREEE_API_URL || 'https://api.freee.co.jp';
  const accessToken = process.env.FREEE_ACCESS_TOKEN;
  const companyId = process.env.FREEE_COMPANY_ID || 0;

  if (!accessToken) {
    throw new Error('FREEE_ACCESS_TOKEN is not set');
  }

  const url = new URL(path, baseUrl);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  url.searchParams.append('company_id', String(companyId));

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body.body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API request failed: ${response.status} ${JSON.stringify(errorData)}`);
  }

  return response.json();
}

// OpenAPIのパラメータをZodスキーマに変換する関数
function convertParameterToZodSchema(parameter: OpenAPIParameter): z.ZodType {
  const { type } = parameter.schema || parameter;
  const { description, required } = parameter;

  let schema;

  switch (type) {
    case 'string':
      schema = z.string();
      break;
    case 'integer':
      schema = z.number().int();
      break;
    case 'number':
      schema = z.number();
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    default:
      schema = z.any();
  }

  if (description) {
    schema = schema.describe(description);
  }

  if (!required) {
    schema = schema.optional();
  }

  return schema;
}

// OpenAPIのパスをMCPツール名に変換する関数
function convertPathToToolName(path: string): string {
  // 基本的な変換
  const baseName = path
    .replace(/^\/api\/\d+\//, '')
    .replace(/\/{[^}]+}/g, '_by_id')
    .replace(/\//g, '_');

  // 文字列をハッシュ化して10文字に収める
  let hash = 0;
  for (let i = 0; i < baseName.length; i++) {
    const char = baseName.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // ハッシュを16進数に変換し、最初の10文字を取得
  return Math.abs(hash).toString(16).substring(0, 10);
}

function sanitizeParameterName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_.-]/g, '_') // 許可されていない文字を_に置換
    .substring(0, 64); // 64文字に制限
}

// OpenAPIの定義からMCPツールを生成する関数
function generateToolsFromOpenApi(server: McpServer): void {
  const paths = freeeApiSchema.paths;
  const components = freeeApiSchema.components;
  const componentsSchemas = components.schemas as Record<string, OpenAPIRequestBodyContentSchema>;

  // パスの key のアルファベット順でソート
  const orderedPathKeys = Object.keys(paths).sort() as (keyof typeof paths)[];

  orderedPathKeys.forEach((pathKey) => {
    const pathItem: OpenAPIPathItem = paths[pathKey];
    Object.entries(pathItem).forEach(([method, operation]: [string, OpenAPIOperation]) => {
      const toolName = `${method}_${convertPathToToolName(pathKey)}`;
      const description = operation.summary || operation.description || '';

      // パラメータスキーマの構築
      const parameterSchema: Record<string, z.ZodType> = {};

      // パスパラメータの処理
      const pathParams = operation.parameters?.filter((p) => p.in === 'path') || [];
      pathParams.forEach((param) => {
        const safeName = sanitizeParameterName(param.name);
        parameterSchema[safeName] = convertParameterToZodSchema(param);
      });

      // クエリパラメータの処理
      const queryParams = operation.parameters?.filter((p) => p.in === 'query') || [];
      queryParams.forEach((param) => {
        let schema = convertParameterToZodSchema(param);
        if (param.name === 'company_id') {
          schema = schema.optional(); // company_id は任意にしてリクエスト時に補完
        }
        const safeName = sanitizeParameterName(param.name);
        parameterSchema[safeName] = schema;
      });

      // Bodyパラメータの処理
      // let bodySchema = z.object({});
      let bodySchema = z.any();
      if (method === 'post' || method === 'put') {
        const requestBody = operation.requestBody?.content?.['application/json']?.schema;
        if (requestBody) {
          // TODO: The framework does not support nested objects as parameters, so this is temporarily commented out

          // let requestBodyContentSchema;
          // if ('$ref' in requestBody) {
          //   const ref = requestBody['$ref'];
          //   const componentName = ref.replace('#/components/schemas/', '');
          //   const component = componentsSchemas[componentName];
          //   requestBodyContentSchema = component;
          // } else {
          //   requestBodyContentSchema = requestBody;
          // }

          // const required = requestBodyContentSchema.required || [];
          // const properties = requestBodyContentSchema.properties || {};
          // Object.entries(properties).forEach(([name, property]) => {
          //   const schema = convertParameterToZodSchema(property as OpenAPIParameter);
          //   if (!required.includes(name)) {
          //     schema.optional();
          //   }
          //   bodySchema = bodySchema.extend({ [name]: schema });
          // });

          // bodySchema を parameterSchema に追加
          parameterSchema['body'] = bodySchema.describe('Request body');
        }
      }

      server.tool(toolName, description, parameterSchema, async (params) => {
        try {
          // パスパラメータの置換
          let actualPath = pathKey as string;
          pathParams.forEach((param: OpenAPIParameter) => {
            actualPath = actualPath.replace(`{${param.name}}`, String(params[param.name]));
          });

          // クエリパラメータの抽出
          const queryParameters: Record<string, unknown> = {};
          queryParams.forEach((param: OpenAPIParameter) => {
            if (params[param.name] !== undefined) {
              queryParameters[param.name] = params[param.name];
            }
          });

          const bodyParameters =
            method === 'post' || method === 'put' ? bodySchema.parse(params) : undefined;
          const result = await makeApiRequest(
            method.toUpperCase(),
            actualPath,
            queryParameters,
            bodyParameters,
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      });
    });
  });
}

// Create an MCP server
const server = new McpServer({
  name: 'freee',
  version: '1.0.0',
});

// OpenAPI定義からツールを生成
generateToolsFromOpenApi(server);

const main = async (): Promise<void> => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Freee MCP Server running on stdio');
};

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
