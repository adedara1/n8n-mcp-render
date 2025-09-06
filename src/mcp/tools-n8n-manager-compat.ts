import { ToolDefinition } from '../types';

/**
 * n8n-Compatible Management Tools
 * 
 * This is a strict schema version of tools-n8n-manager.ts designed specifically for n8n compatibility.
 * Changes from original:
 * - All schemas have additionalProperties: false for strict validation
 * - All schemas have explicit required arrays (even if empty)
 * - All nested objects have required arrays
 * - Simplified descriptions without special characters
 * - Consistent schema structure for LangChain compatibility
 */
export const n8nManagementTools: ToolDefinition[] = [
  // Workflow Management Tools
  {
    name: 'n8n_create_workflow',
    description: 'Create a new workflow in n8n. Requires workflow name, nodes array, and connections object. The workflow will be created in inactive state and must be manually activated in the UI. Returns the created workflow with its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { 
          type: 'string', 
          description: 'Workflow name - required' 
        },
        nodes: { 
          type: 'array', 
          description: 'Array of workflow nodes. Each node must have: id, name, type, typeVersion, position, and parameters',
          items: {
            type: 'object',
            required: ['id', 'name', 'type', 'typeVersion', 'position', 'parameters'],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string' },
              typeVersion: { type: 'number' },
              position: { 
                type: 'array',
                items: { type: 'number' },
                minItems: 2,
                maxItems: 2
              },
              parameters: { type: 'object', additionalProperties: true },
              credentials: { type: 'object', additionalProperties: true },
              disabled: { type: 'boolean' },
              notes: { type: 'string' },
              continueOnFail: { type: 'boolean' },
              retryOnFail: { type: 'boolean' },
              maxTries: { type: 'number' },
              waitBetweenTries: { type: 'number' }
            },
            additionalProperties: false
          }
        },
        connections: { 
          type: 'object', 
          description: 'Workflow connections object. Keys are source node IDs, values define output connections',
          additionalProperties: true
        },
        settings: {
          type: 'object',
          description: 'Optional workflow settings for execution order, timezone, error handling',
          properties: {
            executionOrder: { type: 'string', enum: ['v0', 'v1'] },
            timezone: { type: 'string' },
            saveDataErrorExecution: { type: 'string', enum: ['all', 'none'] },
            saveDataSuccessExecution: { type: 'string', enum: ['all', 'none'] },
            saveManualExecutions: { type: 'boolean' },
            saveExecutionProgress: { type: 'boolean' },
            executionTimeout: { type: 'number' },
            errorWorkflow: { type: 'string' }
          },
          required: [],
          additionalProperties: false
        }
      },
      required: ['name', 'nodes', 'connections'],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_get_workflow',
    description: 'Get a workflow by ID. Returns the complete workflow including nodes, connections, and settings.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { 
          type: 'string', 
          description: 'Workflow ID' 
        }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_get_workflow_details',
    description: 'Get detailed workflow information including metadata, version, and execution statistics. More comprehensive than get_workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { 
          type: 'string', 
          description: 'Workflow ID' 
        }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_get_workflow_structure',
    description: 'Get a simplified view of workflow structure. Returns only node types and connections without full configurations. Useful for understanding workflow flow.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { 
          type: 'string', 
          description: 'Workflow ID' 
        }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_get_workflow_minimal',
    description: 'Get minimal workflow information. Returns only ID, name, active status, and node count. Fastest workflow info retrieval.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { 
          type: 'string', 
          description: 'Workflow ID' 
        }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_update_full_workflow',
    description: 'Update an existing workflow. Replaces the entire workflow definition. Use update_partial_workflow for incremental changes. The workflow must be deactivated before updating.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { 
          type: 'string', 
          description: 'Workflow ID to update' 
        },
        workflow: { 
          type: 'object', 
          description: 'Complete workflow definition including name, nodes, connections, and settings',
          additionalProperties: true
        }
      },
      required: ['id', 'workflow'],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_update_partial_workflow',
    description: 'Update a workflow using diff operations. More efficient than full updates. Supports operations: addNode, removeNode, updateNode, moveNode, enableNode, disableNode, addConnection, removeConnection, updateConnection, updateSettings, updateName, addTag, removeTag. Sends only changes, not the entire workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { 
          type: 'string', 
          description: 'Workflow ID to update' 
        },
        operations: {
          type: 'array',
          description: 'Array of diff operations to apply. Maximum 5 operations per request.',
          items: {
            type: 'object',
            properties: {
              operation: { 
                type: 'string',
                enum: ['addNode', 'removeNode', 'updateNode', 'moveNode', 'enableNode', 'disableNode', 
                       'addConnection', 'removeConnection', 'updateConnection', 'updateSettings', 
                       'updateName', 'addTag', 'removeTag'],
                description: 'The type of operation to perform'
              },
              nodeId: { type: 'string', description: 'Node ID or name for node operations' },
              data: { 
                type: 'object', 
                description: 'Operation-specific data',
                additionalProperties: true
              },
              sourceNodeId: { type: 'string', description: 'Source node for connection operations' },
              targetNodeId: { type: 'string', description: 'Target node for connection operations' },
              outputIndex: { type: 'number', description: 'Output index for connections' },
              inputIndex: { type: 'number', description: 'Input index for connections' }
            },
            required: ['operation'],
            additionalProperties: false
          },
          maxItems: 5
        },
        validateOnly: {
          type: 'boolean',
          description: 'If true, validates operations without applying them. Default false',
          default: false
        }
      },
      required: ['id', 'operations'],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_delete_workflow',
    description: 'Delete a workflow permanently. This action cannot be undone. The workflow must be deactivated before deletion.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { 
          type: 'string', 
          description: 'Workflow ID to delete' 
        }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_list_workflows',
    description: 'List workflows with optional filters. Returns basic workflow information. Supports pagination and filtering by active status.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { 
          type: 'number', 
          description: 'Number of workflows to return. 1-100, default 100',
          default: 100
        },
        active: { 
          type: 'boolean', 
          description: 'Filter by active status. Omit to get all workflows' 
        },
        search: { 
          type: 'string', 
          description: 'Search workflows by name' 
        }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_validate_workflow',
    description: 'Validate a workflow from n8n instance by ID. Fetches the workflow and runs comprehensive validation including node configurations, connections, and expressions. Returns detailed validation report with errors, warnings, and suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { 
          type: 'string', 
          description: 'Workflow ID to validate' 
        },
        options: {
          type: 'object',
          description: 'Validation options',
          properties: {
            validateNodes: { 
              type: 'boolean', 
              description: 'Validate node configurations. Default true',
              default: true
            },
            validateConnections: { 
              type: 'boolean', 
              description: 'Validate workflow connections. Default true',
              default: true
            },
            validateExpressions: { 
              type: 'boolean', 
              description: 'Validate n8n expressions. Default true',
              default: true
            },
            profile: { 
              type: 'string', 
              enum: ['minimal', 'runtime', 'ai-friendly', 'strict'],
              description: 'Validation profile to use. Default runtime',
              default: 'runtime'
            }
          },
          required: [],
          additionalProperties: false
        }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  
  // Workflow Execution Tools
  {
    name: 'n8n_trigger_webhook_workflow',
    description: 'Trigger a workflow via webhook URL. The workflow must have a webhook trigger node configured. Can send GET or POST requests with optional data payload.',
    inputSchema: {
      type: 'object',
      properties: {
        webhookUrl: { 
          type: 'string', 
          description: 'Full webhook URL from n8n workflow like https://n8n.example.com/webhook/abc-def-ghi' 
        },
        httpMethod: { 
          type: 'string', 
          enum: ['GET', 'POST', 'PUT', 'DELETE'],
          description: 'HTTP method to use. Default POST',
          default: 'POST'
        },
        data: { 
          type: 'object', 
          description: 'Data payload to send. For GET requests, converts to query parameters',
          additionalProperties: true
        },
        headers: { 
          type: 'object', 
          description: 'Optional HTTP headers to include',
          additionalProperties: true
        },
        waitForResponse: { 
          type: 'boolean', 
          description: 'Wait for workflow completion. Default true',
          default: true
        }
      },
      required: ['webhookUrl'],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_get_execution',
    description: 'Get details of a specific execution by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { 
          type: 'string', 
          description: 'Execution ID' 
        },
        includeData: { 
          type: 'boolean', 
          description: 'Include full execution data. Default false',
          default: false
        }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_list_executions',
    description: 'List workflow executions with optional filters. Supports pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { 
          type: 'number', 
          description: 'Number of executions to return. 1-100, default 100',
          default: 100
        },
        cursor: { 
          type: 'string', 
          description: 'Pagination cursor from previous response' 
        },
        workflowId: { 
          type: 'string', 
          description: 'Filter by workflow ID' 
        },
        projectId: { 
          type: 'string', 
          description: 'Filter by project ID - enterprise feature' 
        },
        status: { 
          type: 'string', 
          enum: ['success', 'error', 'waiting'],
          description: 'Filter by execution status' 
        },
        includeData: { 
          type: 'boolean', 
          description: 'Include execution data. Default false',
          default: false
        }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_delete_execution',
    description: 'Delete an execution record. This only removes the execution history, not any data processed.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { 
          type: 'string', 
          description: 'Execution ID to delete' 
        }
      },
      required: ['id'],
      additionalProperties: false
    }
  },

  // System Tools
  {
    name: 'n8n_health_check',
    description: 'Check n8n instance health and API connectivity. Returns status and available features.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_list_available_tools',
    description: 'List all available n8n management tools and their capabilities. Useful for understanding what operations are possible.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    }
  },
  {
    name: 'n8n_diagnostic',
    description: 'Diagnose n8n API configuration and management tools availability. Shows current configuration status, which tools are enabled or disabled, and helps troubleshoot why management tools might not be appearing. Returns detailed diagnostic information including environment variables, API connectivity, and tool registration status.',
    inputSchema: {
      type: 'object',
      properties: {
        verbose: {
          type: 'boolean',
          description: 'Include detailed debug information. Default false',
          default: false
        }
      },
      required: [],
      additionalProperties: false
    }
  }
];