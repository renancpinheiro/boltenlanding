#!/usr/bin/env bash
# Recreates n8n-nodes-bolten from scratch and pushes to GitHub.
# Usage: bash setup.sh
set -e

REPO_URL="https://github.com/renancpinheiro/n8n-nodes-bolten.git"
DIR="n8n-nodes-bolten"

echo "==> Cloning repo..."
git clone "$REPO_URL" "$DIR"
cd "$DIR"

echo "==> Writing project files..."

mkdir -p credentials nodes/Bolten/descriptions

cat > package.json << 'PKGJSON'
{
  "name": "n8n-nodes-bolten",
  "version": "0.1.0",
  "description": "n8n community node for the Bolten platform (CRM, WhatsApp and AI)",
  "keywords": ["n8n-community-node-package"],
  "license": "MIT",
  "homepage": "https://github.com/renancpinheiro/n8n-nodes-bolten",
  "author": { "name": "Renan Pinheiro", "email": "renan.pinheiro@bolten.io" },
  "repository": { "type": "git", "url": "https://github.com/renancpinheiro/n8n-nodes-bolten.git" },
  "main": "index.js",
  "scripts": {
    "build": "tsc && npm run copy-icons",
    "copy-icons": "copyfiles -u 1 'nodes/**/*.svg' dist/",
    "dev": "tsc --watch",
    "lint": "eslint nodes credentials --ext .ts",
    "lintfix": "eslint nodes credentials --ext .ts --fix"
  },
  "files": ["dist"],
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": ["dist/credentials/BoltenApi.credentials.js"],
    "nodes": ["dist/nodes/Bolten/Bolten.node.js"]
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^6.20.0",
    "@typescript-eslint/parser": "^6.20.0",
    "copyfiles": "^2.4.1",
    "eslint": "^8.57.0",
    "eslint-plugin-n8n-nodes-base": "^1.16.2",
    "n8n-workflow": "^1.28.0",
    "prettier": "^3.3.3",
    "typescript": "^5.3.3"
  },
  "peerDependencies": { "n8n-workflow": "*" }
}
PKGJSON

cat > tsconfig.json << 'TSCONFIG'
{
  "compilerOptions": {
    "target": "ES2019",
    "module": "commonjs",
    "lib": ["ES2019"],
    "strict": false,
    "moduleResolution": "node",
    "outDir": "dist",
    "declaration": true,
    "sourceMap": false,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["credentials/**/*.ts", "nodes/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
TSCONFIG

cat > .gitignore << 'GITIGNORE'
node_modules/
dist/
*.js.map
GITIGNORE

cat > credentials/BoltenApi.credentials.ts << 'TS'
import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class BoltenApi implements ICredentialType {
  name = 'boltenApi';
  displayName = 'Bolten API';
  documentationUrl = 'https://app.bolten.io';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: { Authorization: '=Bearer {{$credentials.apiKey}}' },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: 'https://app.bolten.io',
      url: '/clients/api/v1/projects',
      method: 'GET',
    },
  };
}
TS

cat > nodes/Bolten/descriptions/project.description.ts << 'TS'
import { INodeProperties } from 'n8n-workflow';

export const projectOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['project'] } },
    options: [
      { name: 'Get Many', value: 'getAll', description: 'List all projects', action: 'Get many projects' },
      { name: 'Get Components', value: 'getComponents', description: 'List components of a project', action: 'Get project components' },
    ],
    default: 'getAll',
  },
];

export const projectFields: INodeProperties[] = [
  {
    displayName: 'Project ID',
    name: 'projectId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['project'], operation: ['getComponents'] } },
    description: 'The UUID of the project',
  },
];
TS

cat > nodes/Bolten/descriptions/contact.description.ts << 'TS'
import { INodeProperties } from 'n8n-workflow';

export const contactOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['contact'] } },
    options: [
      { name: 'Create', value: 'create', description: 'Create a contact', action: 'Create a contact' },
      { name: 'Delete', value: 'delete', description: 'Delete a contact', action: 'Delete a contact' },
      { name: 'Get', value: 'get', description: 'Get a contact', action: 'Get a contact' },
      { name: 'Get Many', value: 'getAll', description: 'List many contacts', action: 'Get many contacts' },
      { name: 'Update', value: 'update', description: 'Update a contact', action: 'Update a contact' },
    ],
    default: 'getAll',
  },
];

export const contactFields: INodeProperties[] = [
  {
    displayName: 'Component ID',
    name: 'componentId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['contact'] } },
    description: 'UUID of the CRM component',
  },
  {
    displayName: 'Contact ID',
    name: 'contactId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['contact'], operation: ['get', 'update', 'delete'] } },
    description: 'UUID of the contact',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: { show: { resource: ['contact'], operation: ['getAll'] } },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 50,
    typeOptions: { minValue: 1, maxValue: 500 },
    displayOptions: { show: { resource: ['contact'], operation: ['getAll'], returnAll: [false] } },
    description: 'Max number of results to return',
  },
  {
    displayName: 'The Bolten API stores contact data inside a dynamic "attributes" object. Use the fields below to set those attributes.',
    name: 'attributesNotice',
    type: 'notice',
    default: '',
    displayOptions: { show: { resource: ['contact'], operation: ['create', 'update'] } },
  },
  {
    displayName: 'Use Raw JSON for Attributes',
    name: 'jsonMode',
    type: 'boolean',
    default: false,
    displayOptions: { show: { resource: ['contact'], operation: ['create', 'update'] } },
    description: 'Whether to provide attributes as raw JSON instead of key/value pairs',
  },
  {
    displayName: 'Attributes (Key/Value)',
    name: 'attributesUi',
    type: 'fixedCollection',
    placeholder: 'Add Attribute',
    default: {},
    typeOptions: { multipleValues: true },
    displayOptions: { show: { resource: ['contact'], operation: ['create', 'update'], jsonMode: [false] } },
    options: [{
      name: 'attributeValues',
      displayName: 'Attribute',
      values: [
        { displayName: 'Key', name: 'key', type: 'string', default: '', description: 'Attribute name' },
        { displayName: 'Value', name: 'value', type: 'string', default: '', description: 'Attribute value' },
      ],
    }],
  },
  {
    displayName: 'Attributes (JSON)',
    name: 'attributesJson',
    type: 'json',
    default: '{}',
    displayOptions: { show: { resource: ['contact'], operation: ['create', 'update'], jsonMode: [true] } },
    description: 'Attributes object as raw JSON',
  },
];
TS

cat > nodes/Bolten/descriptions/opportunity.description.ts << 'TS'
import { INodeProperties } from 'n8n-workflow';

export const opportunityOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['opportunity'] } },
    options: [
      { name: 'Create', value: 'create', description: 'Create an opportunity', action: 'Create an opportunity' },
      { name: 'Delete', value: 'delete', description: 'Delete an opportunity', action: 'Delete an opportunity' },
      { name: 'Get', value: 'get', description: 'Get an opportunity', action: 'Get an opportunity' },
      { name: 'Get Many', value: 'getAll', description: 'List many opportunities', action: 'Get many opportunities' },
      { name: 'Update', value: 'update', description: 'Update an opportunity', action: 'Update an opportunity' },
    ],
    default: 'getAll',
  },
];

export const opportunityFields: INodeProperties[] = [
  {
    displayName: 'Component ID',
    name: 'componentId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['opportunity'] } },
    description: 'UUID of the Kanban component',
  },
  {
    displayName: 'Opportunity ID',
    name: 'opportunityId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['get', 'update', 'delete'] } },
    description: 'UUID of the opportunity',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: { show: { resource: ['opportunity'], operation: ['getAll'] } },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 50,
    typeOptions: { minValue: 1, maxValue: 500 },
    displayOptions: { show: { resource: ['opportunity'], operation: ['getAll'], returnAll: [false] } },
    description: 'Max number of results to return',
  },
  {
    displayName: 'The Bolten API stores opportunity data inside a dynamic "attributes" object. Use the fields below to set those attributes.',
    name: 'attributesNotice',
    type: 'notice',
    default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['create', 'update'] } },
  },
  {
    displayName: 'Use Raw JSON for Attributes',
    name: 'jsonMode',
    type: 'boolean',
    default: false,
    displayOptions: { show: { resource: ['opportunity'], operation: ['create', 'update'] } },
    description: 'Whether to provide attributes as raw JSON instead of key/value pairs',
  },
  {
    displayName: 'Attributes (Key/Value)',
    name: 'attributesUi',
    type: 'fixedCollection',
    placeholder: 'Add Attribute',
    default: {},
    typeOptions: { multipleValues: true },
    displayOptions: { show: { resource: ['opportunity'], operation: ['create', 'update'], jsonMode: [false] } },
    options: [{
      name: 'attributeValues',
      displayName: 'Attribute',
      values: [
        { displayName: 'Key', name: 'key', type: 'string', default: '', description: 'Attribute name' },
        { displayName: 'Value', name: 'value', type: 'string', default: '', description: 'Attribute value' },
      ],
    }],
  },
  {
    displayName: 'Attributes (JSON)',
    name: 'attributesJson',
    type: 'json',
    default: '{}',
    displayOptions: { show: { resource: ['opportunity'], operation: ['create', 'update'], jsonMode: [true] } },
    description: 'Attributes object as raw JSON',
  },
];
TS

cat > nodes/Bolten/Bolten.node.ts << 'TS'
import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
  JsonObject,
} from 'n8n-workflow';

import { contactFields, contactOperations } from './descriptions/contact.description';
import { opportunityFields, opportunityOperations } from './descriptions/opportunity.description';
import { projectFields, projectOperations } from './descriptions/project.description';

const BASE_URL = 'https://app.bolten.io';

export class Bolten implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Bolten',
    name: 'bolten',
    icon: 'file:bolten.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with the Bolten CRM, WhatsApp and AI platform',
    defaults: { name: 'Bolten' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'boltenApi', required: true }],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Contact', value: 'contact' },
          { name: 'Opportunity', value: 'opportunity' },
          { name: 'Project', value: 'project' },
        ],
        default: 'contact',
      },
      ...projectOperations,
      ...projectFields,
      ...contactOperations,
      ...contactFields,
      ...opportunityOperations,
      ...opportunityFields,
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;
      let responseData: JsonObject | JsonObject[];

      try {
        if (resource === 'project') {
          responseData = await handleProject.call(this, operation, i);
        } else if (resource === 'contact') {
          responseData = await handleContact.call(this, operation, i);
        } else if (resource === 'opportunity') {
          responseData = await handleOpportunity.call(this, operation, i);
        } else {
          throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`);
        }

        const normalized = Array.isArray(responseData) ? responseData : [responseData];
        const executionData = this.helpers.constructExecutionMetaData(
          this.helpers.returnJsonArray(normalized),
          { itemData: { item: i } },
        );
        returnData.push(...executionData);
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

function buildAttributes(ctx: IExecuteFunctions, i: number): Record<string, unknown> {
  const jsonMode = ctx.getNodeParameter('jsonMode', i, false) as boolean;
  if (jsonMode) {
    const raw = ctx.getNodeParameter('attributesJson', i, '{}') as string | Record<string, unknown>;
    return typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : raw;
  }
  const ui = ctx.getNodeParameter('attributesUi', i, {}) as {
    attributeValues?: Array<{ key: string; value: string }>;
  };
  const result: Record<string, unknown> = {};
  for (const row of ui.attributeValues ?? []) result[row.key] = row.value;
  return result;
}

async function apiRequest(
  ctx: IExecuteFunctions,
  method: string,
  url: string,
  body?: Record<string, unknown>,
  qs?: Record<string, unknown>,
): Promise<JsonObject | JsonObject[]> {
  return ctx.helpers.requestWithAuthentication.call(ctx, 'boltenApi', {
    method, url, body, qs, json: true,
  }) as Promise<JsonObject | JsonObject[]>;
}

async function handleProject(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<JsonObject | JsonObject[]> {
  if (operation === 'getAll') return apiRequest(this, 'GET', `${BASE_URL}/clients/api/v1/projects`);
  if (operation === 'getComponents') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    return apiRequest(this, 'GET', `${BASE_URL}/clients/api/v1/projects/${projectId}/components`);
  }
  throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
}

async function handleContact(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<JsonObject | JsonObject[]> {
  const componentId = this.getNodeParameter('componentId', i) as string;
  const base = `${BASE_URL}/contact/api/v1/${componentId}/contacts`;

  if (operation === 'getAll') {
    const returnAll = this.getNodeParameter('returnAll', i) as boolean;
    const qs: Record<string, unknown> = {};
    if (!returnAll) qs.limit = this.getNodeParameter('limit', i) as number;
    return apiRequest(this, 'GET', base, undefined, qs);
  }
  if (operation === 'get') {
    const contactId = this.getNodeParameter('contactId', i) as string;
    return apiRequest(this, 'GET', `${base}/${contactId}`);
  }
  if (operation === 'create') return apiRequest(this, 'POST', base, { attributes: buildAttributes(this, i) });
  if (operation === 'update') {
    const contactId = this.getNodeParameter('contactId', i) as string;
    return apiRequest(this, 'PATCH', `${base}/${contactId}`, { attributes: buildAttributes(this, i) });
  }
  if (operation === 'delete') {
    const contactId = this.getNodeParameter('contactId', i) as string;
    return apiRequest(this, 'DELETE', `${base}/${contactId}`);
  }
  throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
}

async function handleOpportunity(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<JsonObject | JsonObject[]> {
  const componentId = this.getNodeParameter('componentId', i) as string;
  const base = `${BASE_URL}/kanban/api/v1/${componentId}/opportunities`;

  if (operation === 'getAll') {
    const returnAll = this.getNodeParameter('returnAll', i) as boolean;
    const qs: Record<string, unknown> = {};
    if (!returnAll) qs.limit = this.getNodeParameter('limit', i) as number;
    return apiRequest(this, 'GET', base, undefined, qs);
  }
  if (operation === 'get') {
    const opportunityId = this.getNodeParameter('opportunityId', i) as string;
    return apiRequest(this, 'GET', `${base}/${opportunityId}`);
  }
  if (operation === 'create') return apiRequest(this, 'POST', base, { attributes: buildAttributes(this, i) });
  if (operation === 'update') {
    const opportunityId = this.getNodeParameter('opportunityId', i) as string;
    return apiRequest(this, 'PATCH', `${base}/${opportunityId}`, { attributes: buildAttributes(this, i) });
  }
  if (operation === 'delete') {
    const opportunityId = this.getNodeParameter('opportunityId', i) as string;
    return apiRequest(this, 'DELETE', `${base}/${opportunityId}`);
  }
  throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
}
TS

cat > nodes/Bolten/bolten.svg << 'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect width="60" height="60" rx="12" fill="#6366f1"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="22" fill="#fff">B</text></svg>
SVG

echo "==> Installing dependencies..."
npm install

echo "==> Building..."
npm run build

echo "==> Pushing to GitHub..."
git add -A
git commit -m "feat: initial scaffold — credentials, node, descriptions, build config"
git push -u origin main

echo ""
echo "Done! https://github.com/renancpinheiro/n8n-nodes-bolten"
echo ""
echo "Local n8n link:"
echo "  npm link"
echo "  cd ~/.n8n && mkdir -p nodes && cd nodes && npm link n8n-nodes-bolten"
echo "  Restart n8n"
