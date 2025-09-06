import { ToolDefinition } from '../types';

/**
 * n8n-Compatible Documentation MCP Tools
 * 
 * This is a strict schema version of tools.ts designed specifically for n8n compatibility.
 * Changes from original:
 * - All schemas have additionalProperties: false for strict validation
 * - All schemas have explicit required arrays (even if empty)
 * - Simplified descriptions without special characters
 * - Consistent schema structure for LangChain compatibility
 */
export const n8nDocumentationToolsFinal: ToolDefinition[] = [
  {
    name: 'tools_documentation',
    description: 'Get documentation for n8n MCP tools. Call without parameters for quick start guide. Use topic parameter to get documentation for specific tools. Use depth parameter for detailed documentation.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Tool name like search_nodes or overview for general guide. Leave empty for quick reference.',
        },
        depth: {
          type: 'string',
          enum: ['essentials', 'full'],
          description: 'Level of detail. essentials is default for quick reference, full for comprehensive docs.',
          default: 'essentials',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'list_nodes',
    description: 'List n8n nodes with optional filters. Common usage: list_nodes with limit 200 for all nodes, or with category trigger for triggers. Use exact package names like n8n-nodes-base. Categories include trigger, transform, output, input. Returns node names and descriptions.',
    inputSchema: {
      type: 'object',
      properties: {
        package: {
          type: 'string',
          description: 'EXACT package name: n8n-nodes-base for 435 core integrations or @n8n/n8n-nodes-langchain for 90 AI nodes.',
        },
        category: {
          type: 'string',
          description: 'Single category: trigger, transform, output, input, or AI. Returns all nodes in that category.',
        },
        developmentStyle: {
          type: 'string',
          enum: ['declarative', 'programmatic'],
          description: 'Implementation type. Most nodes are programmatic. Rarely needed.',
        },
        isAITool: {
          type: 'boolean',
          description: 'true returns only nodes with usableAsTool for AI agents. 263 nodes available. Use list_ai_tools instead for better results.',
        },
        limit: {
          type: 'number',
          description: 'Results limit. Default 50 may miss nodes. Use 200 or more for complete results. Max 500.',
          default: 50,
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_node_info',
    description: 'Get COMPLETE technical schema for a node. WARNING: Returns massive JSON often over 100KB with all properties, operations, credentials. Contains duplicates and complex conditional logic. TIPS: Use get_node_essentials first for common use cases. Try get_node_documentation for human-readable info. Look for required true properties. Find properties without displayOptions for simpler versions. Node type MUST include prefix like nodes-base.httpRequest NOT just httpRequest. NOW INCLUDES aiToolCapabilities section showing how to use any node as an AI tool.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'FULL node type with prefix. Format: nodes-base.name or nodes-langchain.name. Common examples: nodes-base.httpRequest, nodes-base.webhook, nodes-base.code, nodes-base.slack, nodes-base.gmail, nodes-base.googleSheets, nodes-base.postgres, nodes-langchain.openAi, nodes-langchain.agent. CASE SENSITIVE.',
        },
      },
      required: ['nodeType'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_nodes',
    description: 'Search nodes by keywords. Returns nodes containing ANY of the search words using OR logic. Examples: slack finds Slack node, send message finds any node with send OR message. Best practice: Use single words for precise results, multiple words for broader search. Searches in node names and descriptions. If no results, try shorter words or use list_nodes by category.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term - MUST BE SINGLE WORD for best results. Good: slack, email, http, sheet, database, webhook. Bad: send slack message, read spreadsheet. Case-insensitive.',
        },
        limit: {
          type: 'number',
          description: 'Max results. Default 20 is usually enough. Increase if needed.',
          default: 20,
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_ai_tools',
    description: 'List all 263 nodes marked with usableAsTool true property. IMPORTANT: ANY node in n8n can be used as an AI tool - not just these. These nodes are optimized for AI usage but you can connect any node like Slack, Google Sheets, HTTP Request to an AI Agent tool port. Returns names and descriptions. For community nodes as tools, set N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE true. Use get_node_as_tool_info for guidance on using any node as a tool.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_node_documentation',
    description: 'Get human-readable documentation for a node. USE THIS BEFORE get_node_info. Returns markdown with explanations, examples, auth setup, common patterns. Much easier to understand than raw schema. 87 percent of nodes have docs. Returns No documentation available otherwise. Same nodeType format as get_node_info. Best for understanding what a node does and how to use it.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'Full node type WITH prefix same as get_node_info: nodes-base.slack, nodes-base.httpRequest, etc. CASE SENSITIVE.',
        },
      },
      required: ['nodeType'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_database_statistics',
    description: 'Quick summary of the n8n node ecosystem. Shows: total nodes 525, AI tools 263, triggers 104, versioned nodes, documentation coverage 87 percent, package breakdown. No parameters needed. Useful for verifying MCP is working and understanding available scope.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_node_essentials',
    description: 'Get only the 10-20 most important properties for a node with 95 percent size reduction. USE THIS INSTEAD OF get_node_info for basic configuration. Returns: required properties, common properties, working examples. Perfect for quick workflow building. Same nodeType format as get_node_info like nodes-base.httpRequest. Reduces 100KB responses to under 5KB focused data.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'Full node type WITH prefix: nodes-base.httpRequest, nodes-base.webhook, etc. Same format as get_node_info.',
        },
      },
      required: ['nodeType'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_node_properties',
    description: 'Search for specific properties within a node. Find authentication options, body parameters, headers, etc. without parsing the entire schema. Returns matching properties with their paths and descriptions. Use this when you need to find specific configuration options like auth, header, body, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'Full node type WITH prefix same as get_node_info.',
        },
        query: {
          type: 'string',
          description: 'Property name or keyword to search for. Examples: auth, header, body, json, timeout.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return. Default 20.',
          default: 20,
        },
      },
      required: ['nodeType', 'query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_node_for_task',
    description: 'Get pre-configured node settings for common tasks. USE THIS to quickly configure nodes for specific use cases like post_json_request, receive_webhook, query_database, etc. Returns ready-to-use configuration with clear indication of what user must provide. Much faster than figuring out configuration from scratch.',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The task to accomplish. Available tasks: get_api_data, post_json_request, call_api_with_auth, receive_webhook, webhook_with_response, query_postgres, insert_postgres_data, chat_with_ai, ai_agent_workflow, transform_data, filter_data, send_slack_message, send_email. Use list_tasks to see all available tasks.',
        },
      },
      required: ['task'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_tasks',
    description: 'List all available task templates. Use this to discover what pre-configured tasks are available before using get_node_for_task. Tasks are organized by category: HTTP/API, Webhooks, Database, AI/LangChain, Data Processing, Communication.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional category filter: HTTP/API, Webhooks, Database, AI/LangChain, Data Processing, Communication',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'validate_node_operation',
    description: 'Verify your node configuration is correct before using it. Checks: required fields are present, values are valid types and formats, operation-specific rules are met. Returns specific errors with fixes like Channel required to send Slack message - add channel with value general, warnings about common issues, working examples when errors found, and suggested next steps. Smart validation that only checks properties relevant to your selected operation or action. Essential for Slack, Google Sheets, MongoDB, OpenAI nodes. Supports validation profiles for different use cases.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'The node type to validate like nodes-base.slack',
        },
        config: {
          type: 'object',
          description: 'Your node configuration. Must include operation fields like resource, operation, action if the node has multiple operations.',
          additionalProperties: true,
        },
        profile: {
          type: 'string',
          enum: ['strict', 'runtime', 'ai-friendly', 'minimal'],
          description: 'Validation profile: minimal only required fields, runtime critical errors only, ai-friendly balanced default, strict all checks including best practices',
          default: 'ai-friendly',
        },
      },
      required: ['nodeType', 'config'],
      additionalProperties: false,
    },
  },
  {
    name: 'validate_node_minimal',
    description: 'Quick validation that ONLY checks for missing required fields. Returns just the list of required fields that are missing. Fastest validation option - use when you only need to know if required fields are present. No warnings, no suggestions, no examples - just missing required fields.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'The node type to validate like nodes-base.slack',
        },
        config: {
          type: 'object',
          description: 'The node configuration to check',
          additionalProperties: true,
        },
      },
      required: ['nodeType', 'config'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_property_dependencies',
    description: 'Shows which properties control the visibility of other properties. Helps understand why certain fields appear or disappear based on configuration. Example: In HTTP Request, sendBody true reveals body-related properties. Optionally provide a config to see what would be visible or hidden with those settings.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'The node type to analyze like nodes-base.httpRequest',
        },
        config: {
          type: 'object',
          description: 'Optional partial configuration to check visibility impact',
          additionalProperties: true,
        },
      },
      required: ['nodeType'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_node_as_tool_info',
    description: 'Get specific information about using a node as an AI tool. Returns whether the node can be used as a tool, common use cases, requirements, and examples. Essential for understanding how to connect regular nodes to AI Agents. Works for ANY node - not just those marked as AI tools.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'Full node type WITH prefix: nodes-base.slack, nodes-base.googleSheets, etc.',
        },
      },
      required: ['nodeType'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_node_templates',
    description: 'List workflow templates that use specific node types. Returns ready-to-use workflows from n8n.io community. Templates are from the last year with 399 total. Use FULL node types like n8n-nodes-base.httpRequest or @n8n/n8n-nodes-langchain.openAi. Great for finding proven workflow patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of node types to search for like n8n-nodes-base.httpRequest, n8n-nodes-base.openAi',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of templates to return. Default 10.',
          default: 10,
        },
      },
      required: ['nodeTypes'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_template',
    description: 'Get a specific workflow template with complete JSON. Returns the full workflow definition ready to import into n8n. Use template IDs from list_node_templates or search_templates results.',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: {
          type: 'number',
          description: 'The template ID to retrieve',
        },
      },
      required: ['templateId'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_templates',
    description: 'Search workflow templates by keywords in template NAMES and DESCRIPTIONS only. NOTE: This does NOT search by node types. To find templates using specific nodes, use list_node_templates with node types array instead. Examples: search_templates with chatbot finds templates with chatbot in the name or description. All templates are from the last year and include view counts to gauge popularity.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for template names and descriptions. NOT for node types. Examples: chatbot, automation, social media, webhook. For node-based search use list_node_templates instead.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results. Default 20.',
          default: 20,
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_templates_for_task',
    description: 'Get recommended templates for common automation tasks. Returns curated templates that solve specific use cases. Available tasks: ai_automation, data_sync, webhook_processing, email_automation, slack_integration, data_transformation, file_processing, scheduling, api_integration, database_operations.',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          enum: [
            'ai_automation',
            'data_sync', 
            'webhook_processing',
            'email_automation',
            'slack_integration',
            'data_transformation',
            'file_processing',
            'scheduling',
            'api_integration',
            'database_operations'
          ],
          description: 'The type of task to get templates for',
        },
      },
      required: ['task'],
      additionalProperties: false,
    },
  },
  {
    name: 'validate_workflow',
    description: 'Validate an entire n8n workflow before deployment. Checks: workflow structure, node connections including ai_tool connections, expressions, best practices, AI Agent configurations, and more. Returns comprehensive validation report with errors, warnings, and suggestions. Essential for AI agents building complete workflows. Validates AI tool connections and fromAI expressions. Prevents common workflow errors before they happen.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'object',
          description: 'The complete workflow JSON to validate. Must include nodes array and connections object.',
          additionalProperties: true,
        },
        options: {
          type: 'object',
          properties: {
            validateNodes: {
              type: 'boolean',
              description: 'Validate individual node configurations. Default true.',
              default: true,
            },
            validateConnections: {
              type: 'boolean',
              description: 'Validate node connections and flow. Default true.',
              default: true,
            },
            validateExpressions: {
              type: 'boolean',
              description: 'Validate n8n expressions syntax and references. Default true.',
              default: true,
            },
            profile: {
              type: 'string',
              enum: ['minimal', 'runtime', 'ai-friendly', 'strict'],
              description: 'Validation profile for node validation. Default runtime.',
              default: 'runtime',
            },
          },
          required: [],
          additionalProperties: false,
          description: 'Optional validation settings',
        },
      },
      required: ['workflow'],
      additionalProperties: false,
    },
  },
  {
    name: 'validate_workflow_connections',
    description: 'Validate only the connections in a workflow. Checks: all connections point to existing nodes, no cycles or infinite loops, no orphaned nodes, proper trigger node setup, AI tool connections are valid. Validates ai_tool connection types between AI Agents and tool nodes. Faster than full validation when you only need to check workflow structure.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'object',
          description: 'The workflow JSON with nodes array and connections object.',
          additionalProperties: true,
        },
      },
      required: ['workflow'],
      additionalProperties: false,
    },
  },
  {
    name: 'validate_workflow_expressions',
    description: 'Validate all n8n expressions in a workflow. Checks: expression syntax with double curly braces, variable references like json, node, input, node references exist, context availability. Returns specific errors with locations. Use this to catch expression errors before runtime.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'object',
          description: 'The workflow JSON to check for expression errors.',
          additionalProperties: true,
        },
      },
      required: ['workflow'],
      additionalProperties: false,
    },
  },
];

/**
 * QUICK REFERENCE for AI Agents:
 * 
 * 1. RECOMMENDED WORKFLOW:
 *    - Start: search_nodes → get_node_essentials → get_node_for_task → validate_node_operation
 *    - Discovery: list_nodes with category trigger for browsing categories
 *    - Quick Config: get_node_essentials for nodes-base.httpRequest - only essential properties
 *    - Full Details: get_node_info only when essentials aren't enough
 *    - Validation: Use validate_node_operation for complex nodes like Slack, Google Sheets, etc.
 * 
 * 2. COMMON NODE TYPES:
 *    Triggers: webhook, schedule, emailReadImap, slackTrigger
 *    Core: httpRequest, code, set, if, merge, splitInBatches
 *    Integrations: slack, gmail, googleSheets, postgres, mongodb
 *    AI: agent, openAi, chainLlm, documentLoader
 * 
 * 3. SEARCH TIPS:
 *    - search_nodes returns ANY word match using OR logic
 *    - Single words more precise, multiple words broader
 *    - If no results: use list_nodes with category filter
 * 
 * 4. TEMPLATE SEARCHING:
 *    - search_templates with slack searches template names and descriptions, NOT node types
 *    - To find templates using Slack node: list_node_templates with n8n-nodes-base.slack
 *    - For task-based templates: get_templates_for_task with slack_integration
 *    - 399 templates available from the last year
 * 
 * 5. KNOWN ISSUES:
 *    - Some nodes have duplicate properties with different conditions
 *    - Package names: use n8n-nodes-base not @n8n/n8n-nodes-base
 *    - Check showWhen and hideWhen to identify the right property variant
 * 
 * 6. PERFORMANCE:
 *    - get_node_essentials: Fast under 5KB
 *    - get_node_info: Slow over 100KB - use sparingly
 *    - search_nodes and list_nodes: Fast, cached
 */