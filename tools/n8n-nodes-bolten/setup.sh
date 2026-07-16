#!/usr/bin/env bash
# n8n-nodes-bolten — setup script
# Usage: bash setup.sh
set -e

REPO_URL="https://github.com/renancpinheiro/n8n-nodes-bolten.git"
DIR="n8n-nodes-bolten"

echo "==> Cloning repo..."
git clone "$REPO_URL" "$DIR"
cd "$DIR"

mkdir -p credentials nodes/Bolten/descriptions

echo "==> Writing package.json..."
cat > package.json << 'EOF'
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
    "dev": "tsc --watch"
  },
  "files": ["dist"],
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": ["dist/credentials/BoltenApi.credentials.js"],
    "nodes": [
      "dist/nodes/Bolten/Bolten.node.js",
      "dist/nodes/Bolten/BoltenTrigger.node.js"
    ]
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
EOF

cat > tsconfig.json << 'EOF'
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
EOF

printf 'node_modules/\ndist/\n*.js.map\n' > .gitignore

cat > nodes/Bolten/bolten.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect width="60" height="60" rx="12" fill="#ff6828"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="22" fill="#fff">B</text></svg>
EOF

cat > credentials/BoltenApi.credentials.ts << 'EOF'
import { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';
export class BoltenApi implements ICredentialType {
  name = 'boltenApi';
  displayName = 'Bolten API';
  documentationUrl = 'https://app.bolten.io';
  properties: INodeProperties[] = [{
    displayName: 'API Key', name: 'apiKey', type: 'string',
    typeOptions: { password: true }, default: '', required: true,
  }];
  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
  };
  test: ICredentialTestRequest = {
    request: { baseURL: 'https://app.bolten.io', url: '/clients/api/v1/projects', method: 'GET' },
  };
}
EOF

cat > nodes/Bolten/descriptions/project.description.ts << 'EOF'
import { INodeProperties } from 'n8n-workflow';
export const projectOperations: INodeProperties[] = [{
  displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true,
  displayOptions: { show: { resource: ['project'] } },
  options: [
    { name: 'Get Many', value: 'getAll', description: 'List all projects', action: 'Get many projects' },
    { name: 'Get Components', value: 'getComponents', description: 'List components of a project', action: 'Get project components' },
  ],
  default: 'getAll',
}];
export const projectFields: INodeProperties[] = [{
  displayName: 'Project ID', name: 'projectId', type: 'string', required: true, default: '',
  displayOptions: { show: { resource: ['project'], operation: ['getComponents'] } },
  description: 'The UUID of the project',
}];
EOF

cat > nodes/Bolten/descriptions/contact.description.ts << 'TSEOF'
import { INodeProperties } from 'n8n-workflow';
export const contactOperations: INodeProperties[] = [{
  displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true,
  displayOptions: { show: { resource: ['contact'] } },
  options: [
    { name: 'Create', value: 'create', description: 'Create a contact', action: 'Create a contact' },
    { name: 'Delete', value: 'delete', description: 'Delete a contact', action: 'Delete a contact' },
    { name: 'Get', value: 'get', description: 'Get a contact', action: 'Get a contact' },
    { name: 'Get Many', value: 'getAll', description: 'List many contacts', action: 'Get many contacts' },
    { name: 'Get Schema', value: 'getSchema', description: 'Get the dynamic field schema', action: 'Get contact schema' },
    { name: 'Update', value: 'update', description: 'Update a contact', action: 'Update a contact' },
  ],
  default: 'getAll',
}];
export const contactFields: INodeProperties[] = [
  { displayName: 'Component ID', name: 'componentId', type: 'string', required: true, default: '',
    displayOptions: { show: { resource: ['contact'] } }, description: 'UUID of the CRM component' },
  { displayName: 'Contact ID', name: 'contactId', type: 'string', required: true, default: '',
    displayOptions: { show: { resource: ['contact'], operation: ['get','update','delete'] } }, description: 'UUID of the contact' },
  { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false,
    displayOptions: { show: { resource: ['contact'], operation: ['getAll'] } },
    description: 'Whether to return all results (auto-paginate) or only up to a given limit' },
  { displayName: 'Limit', name: 'limit', type: 'number', default: 50,
    typeOptions: { minValue: 1, maxValue: 100 },
    displayOptions: { show: { resource: ['contact'], operation: ['getAll'], returnAll: [false] } },
    description: 'Max number of results (API max: 100)' },
  { displayName: 'Page', name: 'page', type: 'number', default: 1,
    typeOptions: { minValue: 1 },
    displayOptions: { show: { resource: ['contact'], operation: ['getAll'], returnAll: [false] } },
    description: 'Page number to return' },
  { displayName: 'The Bolten API stores contact data inside a dynamic "attributes" object. Use the fields below. Use Get Schema to discover available field names.',
    name: 'attributesNotice', type: 'notice', default: '',
    displayOptions: { show: { resource: ['contact'], operation: ['create','update'] } } },
  { displayName: 'Use Raw JSON for Attributes', name: 'jsonMode', type: 'boolean', default: false,
    displayOptions: { show: { resource: ['contact'], operation: ['create','update'] } },
    description: 'Whether to provide attributes as raw JSON instead of key/value pairs' },
  { displayName: 'Attributes (Key/Value)', name: 'attributesUi', type: 'fixedCollection',
    placeholder: 'Add Attribute', default: {}, typeOptions: { multipleValues: true },
    displayOptions: { show: { resource: ['contact'], operation: ['create','update'], jsonMode: [false] } },
    options: [{ name: 'attributeValues', displayName: 'Attribute', values: [
      { displayName: 'Key', name: 'key', type: 'string', default: '' },
      { displayName: 'Value', name: 'value', type: 'string', default: '' },
    ]}] },
  { displayName: 'Attributes (JSON)', name: 'attributesJson', type: 'json', default: '{}',
    displayOptions: { show: { resource: ['contact'], operation: ['create','update'], jsonMode: [true] } },
    description: 'Attributes as raw JSON' },
];
TSEOF

cat > nodes/Bolten/descriptions/opportunity.description.ts << 'TSEOF'
import { INodeProperties } from 'n8n-workflow';
export const opportunityOperations: INodeProperties[] = [{
  displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true,
  displayOptions: { show: { resource: ['opportunity'] } },
  options: [
    { name: 'Add Product', value: 'addProduct', description: 'Add a product to an opportunity', action: 'Add product to opportunity' },
    { name: 'Associate Contact', value: 'associateContact', description: 'Link a contact to an opportunity', action: 'Associate contact to opportunity' },
    { name: 'Create', value: 'create', description: 'Create an opportunity', action: 'Create an opportunity' },
    { name: 'Create Task', value: 'createTask', description: 'Create a task on an opportunity', action: 'Create task on opportunity' },
    { name: 'Delete', value: 'delete', description: 'Delete an opportunity', action: 'Delete an opportunity' },
    { name: 'Dissociate Contact', value: 'dissociateContact', description: 'Remove the linked contact', action: 'Dissociate contact from opportunity' },
    { name: 'Get', value: 'get', description: 'Get an opportunity', action: 'Get an opportunity' },
    { name: 'Get Many', value: 'getAll', description: 'List many opportunities', action: 'Get many opportunities' },
    { name: 'Get Schema', value: 'getSchema', description: 'Get the dynamic field schema', action: 'Get opportunity schema' },
    { name: 'Remove Product', value: 'removeProduct', description: 'Remove a product from an opportunity', action: 'Remove product from opportunity' },
    { name: 'Remove Task', value: 'removeTask', description: 'Remove a task from an opportunity', action: 'Remove task from opportunity' },
    { name: 'Update', value: 'update', description: 'Update an opportunity', action: 'Update an opportunity' },
    { name: 'Update Product', value: 'updateProduct', description: 'Update a product on an opportunity', action: 'Update product on opportunity' },
    { name: 'Update Task', value: 'updateTask', description: 'Update a task on an opportunity', action: 'Update task on opportunity' },
  ],
  default: 'getAll',
}];
export const opportunityFields: INodeProperties[] = [
  { displayName: 'Component ID', name: 'componentId', type: 'string', required: true, default: '',
    displayOptions: { show: { resource: ['opportunity'] } }, description: 'UUID of the Kanban component' },
  { displayName: 'Opportunity ID', name: 'opportunityId', type: 'string', required: true, default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['get','update','delete','associateContact','dissociateContact','addProduct','updateProduct','removeProduct','createTask','updateTask','removeTask'] } },
    description: 'UUID of the opportunity' },
  { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false,
    displayOptions: { show: { resource: ['opportunity'], operation: ['getAll'] } },
    description: 'Whether to return all results (auto-paginate)' },
  { displayName: 'Limit', name: 'limit', type: 'number', default: 50, typeOptions: { minValue: 1, maxValue: 100 },
    displayOptions: { show: { resource: ['opportunity'], operation: ['getAll'], returnAll: [false] } }, description: 'Max items (API max: 100)' },
  { displayName: 'Page', name: 'page', type: 'number', default: 1, typeOptions: { minValue: 1 },
    displayOptions: { show: { resource: ['opportunity'], operation: ['getAll'], returnAll: [false] } }, description: 'Page number' },
  { displayName: 'The Bolten API stores opportunity data inside a dynamic "attributes" object. Use Get Schema to discover available field names.',
    name: 'attributesNotice', type: 'notice', default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['create','update'] } } },
  { displayName: 'Use Raw JSON for Attributes', name: 'jsonMode', type: 'boolean', default: false,
    displayOptions: { show: { resource: ['opportunity'], operation: ['create','update'] } },
    description: 'Whether to provide attributes as raw JSON' },
  { displayName: 'Attributes (Key/Value)', name: 'attributesUi', type: 'fixedCollection',
    placeholder: 'Add Attribute', default: {}, typeOptions: { multipleValues: true },
    displayOptions: { show: { resource: ['opportunity'], operation: ['create','update'], jsonMode: [false] } },
    options: [{ name: 'attributeValues', displayName: 'Attribute', values: [
      { displayName: 'Key', name: 'key', type: 'string', default: '' },
      { displayName: 'Value', name: 'value', type: 'string', default: '' },
    ]}] },
  { displayName: 'Attributes (JSON)', name: 'attributesJson', type: 'json', default: '{}',
    displayOptions: { show: { resource: ['opportunity'], operation: ['create','update'], jsonMode: [true] } },
    description: 'Attributes as raw JSON' },
  { displayName: 'Contact ID', name: 'associateContactId', type: 'string', required: true, default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['associateContact'] } }, description: 'UUID of the contact to link' },
  { displayName: 'Product ID', name: 'productId', type: 'string', required: true, default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['addProduct'] } }, description: 'UUID of the product' },
  { displayName: 'Quantity', name: 'productQuantity', type: 'number', default: 1,
    displayOptions: { show: { resource: ['opportunity'], operation: ['addProduct'] } }, description: 'Number of units' },
  { displayName: 'Final Price', name: 'productFinalPrice', type: 'number', default: 0,
    displayOptions: { show: { resource: ['opportunity'], operation: ['addProduct'] } }, description: 'Override price (0 = use product default)' },
  { displayName: 'Product Item ID', name: 'productItemId', type: 'string', required: true, default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['updateProduct','removeProduct'] } }, description: 'UUID of the product line-item' },
  { displayName: 'Updated Product ID', name: 'updatedProductId', type: 'string', default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['updateProduct'] } }, description: 'New product UUID (leave empty to keep current)' },
  { displayName: 'Updated Quantity', name: 'updatedProductQuantity', type: 'number', default: 1,
    displayOptions: { show: { resource: ['opportunity'], operation: ['updateProduct'] } } },
  { displayName: 'Updated Final Price', name: 'updatedProductFinalPrice', type: 'number', default: 0,
    displayOptions: { show: { resource: ['opportunity'], operation: ['updateProduct'] } } },
  { displayName: 'Task Title', name: 'taskTitle', type: 'string', required: true, default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['createTask'] } } },
  { displayName: 'Task Description', name: 'taskDescription', type: 'string', typeOptions: { rows: 3 }, default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['createTask'] } } },
  { displayName: 'Task State', name: 'taskState', type: 'options',
    options: [{ name: 'To Do', value: 'to_do' },{ name: 'Doing', value: 'doing' },{ name: 'Done', value: 'done' }],
    default: 'to_do', displayOptions: { show: { resource: ['opportunity'], operation: ['createTask'] } } },
  { displayName: 'Scheduled To', name: 'taskScheduledTo', type: 'dateTime', default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['createTask'] } } },
  { displayName: 'Task ID', name: 'taskId', type: 'string', required: true, default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['updateTask','removeTask'] } }, description: 'UUID of the task' },
  { displayName: 'Updated Task Title', name: 'updatedTaskTitle', type: 'string', default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['updateTask'] } } },
  { displayName: 'Updated Task Description', name: 'updatedTaskDescription', type: 'string', typeOptions: { rows: 3 }, default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['updateTask'] } } },
  { displayName: 'Updated Task State', name: 'updatedTaskState', type: 'options',
    options: [{ name: 'To Do', value: 'to_do' },{ name: 'Doing', value: 'doing' },{ name: 'Done', value: 'done' }],
    default: 'to_do', displayOptions: { show: { resource: ['opportunity'], operation: ['updateTask'] } } },
  { displayName: 'Updated Scheduled To', name: 'updatedTaskScheduledTo', type: 'dateTime', default: '',
    displayOptions: { show: { resource: ['opportunity'], operation: ['updateTask'] } } },
];
TSEOF

cat > nodes/Bolten/BoltenTrigger.node.ts << 'TSEOF'
import { IHookFunctions, IWebhookFunctions, INodeType, INodeTypeDescription, IWebhookResponseData, JsonObject } from 'n8n-workflow';
export class BoltenTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Bolten Trigger', name: 'boltenTrigger', icon: 'file:bolten.svg',
    group: ['trigger'], version: 1,
    description: 'Starts the workflow when a Bolten webhook event fires',
    defaults: { name: 'Bolten Trigger' },
    inputs: [], outputs: ['main'], credentials: [],
    webhooks: [{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' }],
    properties: [
      { displayName: 'Copy the <strong>Webhook URL</strong> below and register it in your Bolten project under <strong>Configurações › Integrações › Webhooks</strong>.',
        name: 'notice', type: 'notice', default: '' },
      { displayName: 'Events', name: 'events', type: 'multiOptions',
        options: [
          { name: 'Opportunity Created', value: 'opportunity.created', description: 'Fired when a new opportunity is created' },
          { name: 'Opportunity Lost', value: 'opportunity.lost', description: 'Fired when an opportunity is marked as lost' },
          { name: 'Opportunity Transitioned', value: 'opportunity.transitioned', description: 'Fired when an opportunity moves between stages' },
          { name: 'Opportunity Won', value: 'opportunity.won', description: 'Fired when an opportunity is marked as won' },
        ],
        default: [], description: 'Event types to listen to. Leave empty to receive all events.' },
    ],
  };
  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> { return true; },
      async create(this: IHookFunctions): Promise<boolean> { return true; },
      async delete(this: IHookFunctions): Promise<boolean> { return true; },
    },
  };
  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData() as JsonObject;
    const events = this.getNodeParameter('events', []) as string[];
    const type = (body.type as string) ?? '';
    if (events.length > 0 && !events.includes(type)) return { workflowData: [[]] };
    return { workflowData: [this.helpers.returnJsonArray([body])] };
  }
}
TSEOF

cat > nodes/Bolten/Bolten.node.ts << 'TSEOF'
import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription, NodeOperationError, JsonObject } from 'n8n-workflow';
import { contactFields, contactOperations } from './descriptions/contact.description';
import { opportunityFields, opportunityOperations } from './descriptions/opportunity.description';
import { projectFields, projectOperations } from './descriptions/project.description';
const BASE = 'https://app.bolten.io';
export class Bolten implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Bolten', name: 'bolten', icon: 'file:bolten.svg',
    group: ['transform'], version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with the Bolten CRM, WhatsApp and AI platform',
    defaults: { name: 'Bolten' }, inputs: ['main'], outputs: ['main'],
    credentials: [{ name: 'boltenApi', required: true }],
    properties: [
      { displayName: 'Resource', name: 'resource', type: 'options', noDataExpression: true,
        options: [{ name: 'Contact', value: 'contact' },{ name: 'Opportunity', value: 'opportunity' },{ name: 'Project', value: 'project' }],
        default: 'contact' },
      ...projectOperations, ...projectFields,
      ...contactOperations, ...contactFields,
      ...opportunityOperations, ...opportunityFields,
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
        if (resource === 'project') responseData = await handleProject.call(this, operation, i);
        else if (resource === 'contact') responseData = await handleContact.call(this, operation, i);
        else if (resource === 'opportunity') responseData = await handleOpportunity.call(this, operation, i);
        else throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`);
        const normalized = Array.isArray(responseData) ? responseData : [responseData];
        returnData.push(...this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(normalized), { itemData: { item: i } }));
      } catch (error) {
        if (this.continueOnFail()) { returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } }); continue; }
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
  const ui = ctx.getNodeParameter('attributesUi', i, {}) as { attributeValues?: Array<{ key: string; value: string }> };
  const result: Record<string, unknown> = {};
  for (const row of ui.attributeValues ?? []) result[row.key] = row.value;
  return result;
}
async function req(ctx: IExecuteFunctions, method: string, url: string, body?: Record<string, unknown>, qs?: Record<string, unknown>): Promise<JsonObject | JsonObject[]> {
  return ctx.helpers.requestWithAuthentication.call(ctx, 'boltenApi', { method, url, body, qs, json: true }) as Promise<JsonObject | JsonObject[]>;
}
async function getAllItems(ctx: IExecuteFunctions, url: string): Promise<JsonObject[]> {
  const all: JsonObject[] = []; let page = 1;
  while (true) {
    const response = await req(ctx, 'GET', url, undefined, { page, limit: 100 }) as { items: JsonObject[]; pagination: { total: number; limit: number } };
    const items: JsonObject[] = response?.items ?? [];
    all.push(...items);
    const { total, limit } = response?.pagination ?? { total: 0, limit: 100 };
    if (all.length >= total || items.length < limit) break;
    page++;
  }
  return all;
}
async function handleProject(this: IExecuteFunctions, operation: string, i: number): Promise<JsonObject | JsonObject[]> {
  if (operation === 'getAll') return req(this, 'GET', `${BASE}/clients/api/v1/projects`);
  if (operation === 'getComponents') { const pid = this.getNodeParameter('projectId', i) as string; return req(this, 'GET', `${BASE}/clients/api/v1/projects/${pid}/components`); }
  throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
}
async function handleContact(this: IExecuteFunctions, operation: string, i: number): Promise<JsonObject | JsonObject[]> {
  const cid = this.getNodeParameter('componentId', i) as string;
  const base = `${BASE}/contact/api/v1/${cid}`;
  if (operation === 'getAll') {
    const returnAll = this.getNodeParameter('returnAll', i) as boolean;
    if (returnAll) return getAllItems(this, `${base}/contacts`);
    return req(this, 'GET', `${base}/contacts`, undefined, { page: this.getNodeParameter('page', i, 1), limit: this.getNodeParameter('limit', i) });
  }
  if (operation === 'get') { const id = this.getNodeParameter('contactId', i) as string; return req(this, 'GET', `${base}/contacts/${id}`); }
  if (operation === 'create') return req(this, 'POST', `${base}/contacts`, { attributes: buildAttributes(this, i) });
  if (operation === 'update') { const id = this.getNodeParameter('contactId', i) as string; return req(this, 'PATCH', `${base}/contacts/${id}`, { attributes: buildAttributes(this, i) }); }
  if (operation === 'delete') { const id = this.getNodeParameter('contactId', i) as string; return req(this, 'DELETE', `${base}/contacts/${id}`); }
  if (operation === 'getSchema') return req(this, 'GET', `${base}/schema`);
  throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
}
async function handleOpportunity(this: IExecuteFunctions, operation: string, i: number): Promise<JsonObject | JsonObject[]> {
  const cid = this.getNodeParameter('componentId', i) as string;
  const apiBase = `${BASE}/kanban/api/v1/${cid}`;
  const v1Base = `${BASE}/kanban/v1/${cid}`;
  if (operation === 'getAll') {
    const returnAll = this.getNodeParameter('returnAll', i) as boolean;
    if (returnAll) return getAllItems(this, `${apiBase}/opportunities`);
    return req(this, 'GET', `${apiBase}/opportunities`, undefined, { page: this.getNodeParameter('page', i, 1), limit: this.getNodeParameter('limit', i) });
  }
  if (operation === 'getSchema') return req(this, 'GET', `${apiBase}/schema`);
  const oid = this.getNodeParameter('opportunityId', i) as string;
  if (operation === 'get') return req(this, 'GET', `${apiBase}/opportunities/${oid}`);
  if (operation === 'create') return req(this, 'POST', `${apiBase}/opportunities`, { attributes: buildAttributes(this, i) });
  if (operation === 'update') return req(this, 'PATCH', `${apiBase}/opportunities/${oid}`, { attributes: buildAttributes(this, i) });
  if (operation === 'delete') return req(this, 'DELETE', `${apiBase}/opportunities/${oid}`);
  if (operation === 'associateContact') { const contactId = this.getNodeParameter('associateContactId', i) as string; return req(this, 'POST', `${apiBase}/opportunities/${oid}/contact`, { id: contactId }); }
  if (operation === 'dissociateContact') return req(this, 'DELETE', `${apiBase}/opportunities/${oid}/contact`);
  if (operation === 'addProduct') {
    const body: Record<string, unknown> = { product_id: this.getNodeParameter('productId', i), quantity: this.getNodeParameter('productQuantity', i) };
    const fp = this.getNodeParameter('productFinalPrice', i, 0) as number; if (fp > 0) body.final_price = fp;
    return req(this, 'POST', `${v1Base}/opportunities/${oid}/products`, body);
  }
  if (operation === 'updateProduct') {
    const itemId = this.getNodeParameter('productItemId', i) as string;
    const body: Record<string, unknown> = { quantity: this.getNodeParameter('updatedProductQuantity', i) };
    const upid = this.getNodeParameter('updatedProductId', i, '') as string; if (upid) body.product_id = upid;
    const ufp = this.getNodeParameter('updatedProductFinalPrice', i, 0) as number; if (ufp > 0) body.final_price = ufp;
    return req(this, 'PUT', `${v1Base}/opportunities/${oid}/products/${itemId}`, body);
  }
  if (operation === 'removeProduct') { const itemId = this.getNodeParameter('productItemId', i) as string; return req(this, 'DELETE', `${v1Base}/opportunities/${oid}/products/${itemId}`); }
  if (operation === 'createTask') {
    const body: Record<string, unknown> = { title: this.getNodeParameter('taskTitle', i), state: this.getNodeParameter('taskState', i) };
    const desc = this.getNodeParameter('taskDescription', i, '') as string; if (desc) body.description = desc;
    const st = this.getNodeParameter('taskScheduledTo', i, '') as string; if (st) body.scheduled_to = st;
    return req(this, 'POST', `${v1Base}/opportunities/${oid}/tasks`, body);
  }
  if (operation === 'updateTask') {
    const taskId = this.getNodeParameter('taskId', i) as string;
    const body: Record<string, unknown> = { state: this.getNodeParameter('updatedTaskState', i) };
    const title = this.getNodeParameter('updatedTaskTitle', i, '') as string; if (title) body.title = title;
    const desc = this.getNodeParameter('updatedTaskDescription', i, '') as string; if (desc) body.description = desc;
    const st = this.getNodeParameter('updatedTaskScheduledTo', i, '') as string; if (st) body.scheduled_to = st;
    return req(this, 'PUT', `${v1Base}/opportunities/${oid}/tasks/${taskId}`, body);
  }
  if (operation === 'removeTask') { const taskId = this.getNodeParameter('taskId', i) as string; return req(this, 'DELETE', `${v1Base}/opportunities/${oid}/tasks/${taskId}`); }
  throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
}
TSEOF

echo "==> Installing dependencies..."
npm install

echo "==> Building..."
npm run build

echo "==> Pushing to GitHub..."
git add -A
git commit -m "feat: Bolten n8n node — action node + trigger node"
git push -u origin main

echo ""
echo "Done! https://github.com/renancpinheiro/n8n-nodes-bolten"
echo ""
echo "Local n8n link:"
echo "  npm link"
echo "  cd ~/.n8n && mkdir -p nodes && cd nodes && npm link n8n-nodes-bolten"
echo "  Restart n8n"
