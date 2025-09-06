/**
 * TypeScript types for SSE (Server-Sent Events) implementation
 */

export interface SSEClient {
  id: string;
  response: any; // Express Response object
  lastActivity: number;
  isActive: boolean;
  workflowContext?: WorkflowContext;
}

export interface WorkflowContext {
  workflowId?: string;
  executionId?: string;
  nodeId?: string;
  nodeName?: string;
  runId?: string;
}

export interface SSEMessage {
  id?: string;
  event?: string;
  data: any;
  retry?: number;
}

export interface MCPSSEMessage extends SSEMessage {
  event: 'mcp-response' | 'mcp-notification' | 'mcp-error' | 'ping';
  data: {
    jsonrpc: '2.0';
    id?: string | number | null;
    method?: string;
    params?: any;
    result?: any;
    error?: {
      code: number;
      message: string;
      data?: any;
    };
  };
}

export interface SSESessionData {
  clientId: string;
  connectedAt: number;
  lastRequestId?: string | number;
  authToken?: string;
}