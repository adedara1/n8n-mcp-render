#!/usr/bin/env node
/**
 * SSE (Server-Sent Events) server for n8n MCP integration
 * Implements the SSE protocol expected by n8n's MCP Server Trigger
 */

import express from 'express';
import { N8NDocumentationMCPServer } from './mcp/server';
import { SSESessionManager } from './utils/sse-session-manager';
import { logger } from './utils/logger';
import { PROJECT_VERSION } from './utils/version';
import { n8nDocumentationToolsFinal } from './mcp/tools';
import { n8nManagementTools } from './mcp/tools-n8n-manager';
import { n8nDocumentationToolsFinal as n8nCompatTools } from './mcp/tools-n8n-compat';
import { n8nManagementTools as n8nCompatManagementTools } from './mcp/tools-n8n-manager-compat';
import { isN8nApiConfigured } from './config/n8n-api';
import { loadAuthToken } from './http-server';
import { DEFAULT_NEGOTIATED_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

dotenv.config();

let expressServer: any;
let authToken: string | null = null;
let sessionManager: SSESessionManager;
let mcpServer: N8NDocumentationMCPServer;

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  authToken = loadAuthToken();
  
  if (!authToken || authToken.trim() === '') {
    logger.error('No authentication token found or token is empty');
    console.error('ERROR: AUTH_TOKEN is required for SSE mode and cannot be empty');
    console.error('Set AUTH_TOKEN environment variable or AUTH_TOKEN_FILE pointing to a file containing the token');
    console.error('Generate AUTH_TOKEN with: openssl rand -base64 32');
    process.exit(1);
  }
  
  authToken = authToken.trim();
  
  if (authToken.length < 32) {
    logger.warn('AUTH_TOKEN should be at least 32 characters for security');
    console.warn('WARNING: AUTH_TOKEN should be at least 32 characters for security');
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown() {
  logger.info('Shutting down SSE server...');
  console.log('Shutting down SSE server...');
  
  if (sessionManager) {
    sessionManager.shutdown();
  }
  
  if (expressServer) {
    expressServer.close(() => {
      logger.info('SSE server closed');
      console.log('SSE server closed');
      process.exit(0);
    });
    
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

export async function startSSEServer() {
  validateEnvironment();
  
  const app = express();
  sessionManager = new SSESessionManager();
  mcpServer = new N8NDocumentationMCPServer();
  
  // Configure trust proxy
  const trustProxy = process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 0;
  if (trustProxy > 0) {
    app.set('trust proxy', trustProxy);
    logger.info(`Trust proxy enabled with ${trustProxy} hop(s)`);
  }
  
  // Parse JSON for message endpoint
  app.use(express.json());
  
  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  
  // CORS configuration
  app.use((req, res, next) => {
    const allowedOrigin = process.env.CORS_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Client-ID, X-Auth-Token, X-API-Key');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      logger.info('OPTIONS preflight request', {
        path: req.path,
        origin: req.headers.origin,
        headers: req.headers
      });
      res.sendStatus(204);
      return;
    }
    next();
  });
  
  // Request logging with enhanced debug info
  app.use((req, res, next) => {
    const logData = {
      method: req.method,
      path: req.path,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      contentLength: req.get('content-length'),
      headers: process.env.LOG_LEVEL === 'debug' ? req.headers : undefined,
      query: req.query,
      isSSERequest: req.headers.accept?.includes('text/event-stream') || false
    };
    
    logger.info(`${req.method} ${req.path}`, logData);
    
    // Special logging for SSE attempts
    if (req.path.includes('/sse') || req.path === '/mcp' || req.headers.accept?.includes('text/event-stream')) {
      logger.info('SSE connection attempt detected', {
        path: req.path,
        acceptHeader: req.headers.accept,
        authHeader: req.headers.authorization ? 'present' : 'missing'
      });
    }
    
    next();
  });
  
  // Authentication middleware - supports multiple methods
  const authenticateRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let token: string | null = null;
    let authMethod: string | null = null;
    
    // Log authentication attempt
    logger.debug('Authentication attempt', {
      path: req.path,
      headers: Object.keys(req.headers),
      hasAuthHeader: !!req.headers.authorization,
      hasQuery: !!req.query.token
    });
    
    // Method 1: Bearer token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
      authMethod = 'Bearer';
      logger.debug('Using Bearer authentication');
    }
    
    // Method 2: Custom header authentication
    if (!token) {
      const customHeaderName = process.env.AUTH_HEADER_NAME || 'x-auth-token';
      const customHeaderValue = req.headers[customHeaderName.toLowerCase()];
      if (customHeaderValue && typeof customHeaderValue === 'string') {
        token = customHeaderValue.trim();
        authMethod = `Custom header (${customHeaderName})`;
        logger.debug(`Using custom header authentication: ${customHeaderName}`);
      }
    }
    
    // Method 3: Query parameter authentication (for SSE connections)
    if (!token && req.query.token) {
      token = req.query.token as string;
      authMethod = 'Query parameter';
      logger.debug('Using query parameter authentication');
    }
    
    // Method 4: API key in header
    if (!token && req.headers['x-api-key']) {
      token = req.headers['x-api-key'] as string;
      authMethod = 'API key header';
      logger.debug('Using API key header authentication');
    }
    
    // Validate token
    if (!token) {
      logger.warn('Authentication failed: No token provided', { 
        ip: req.ip,
        path: req.path,
        headers: Object.keys(req.headers),
        availableAuthMethods: ['Bearer', 'x-auth-token', 'query.token', 'x-api-key']
      });
      res.status(401).json({ 
        error: 'Unauthorized',
        message: 'No authentication token provided',
        hint: 'Use Bearer token, x-auth-token header, query parameter ?token=, or x-api-key header'
      });
      return;
    }
    
    if (token !== authToken) {
      logger.warn('Authentication failed: Invalid token', { 
        ip: req.ip,
        path: req.path,
        authMethod: authMethod,
        tokenReceived: true
      });
      res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid authentication token'
      });
      return;
    }
    
    logger.debug('Authentication successful', {
      path: req.path,
      authMethod: authMethod
    });
    
    next();
  };
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      mode: 'sse',
      version: PROJECT_VERSION,
      uptime: Math.floor(process.uptime()),
      activeSessions: sessionManager.getActiveClientCount(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      },
      timestamp: new Date().toISOString()
    });
  });
  
  // SSE endpoint handler - shared logic for all SSE endpoints
  const handleSSE = (req: express.Request, res: express.Response) => {
    const path = req.params.path || 'default';
    
    logger.info('SSE endpoint handler invoked', {
      endpoint: req.path,
      method: req.method,
      acceptHeader: req.headers.accept,
      userAgent: req.headers['user-agent'],
      path: path
    });
    
    let clientId: string;
    try {
      clientId = sessionManager.registerClient(res);
    } catch (error) {
      logger.error('Failed to register SSE client:', error);
      res.status(503).json({
        error: 'Service Unavailable',
        message: error instanceof Error ? error.message : 'Failed to establish SSE connection'
      });
      return;
    }
    
    logger.info(`New SSE connection established: ${clientId} (path: ${path})`, {
      totalClients: sessionManager.getActiveClientCount(),
      headers: {
        accept: req.headers.accept,
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      }
    });
    
    // Helper to safely extract string parameters
    const getStringParam = (value: any): string | undefined => {
      if (typeof value === 'string') return value;
      if (Array.isArray(value) && value.length > 0) return String(value[0]);
      return undefined;
    };
    
    // Extract workflow context from headers or query params
    const workflowContext = {
      workflowId: req.headers['x-workflow-id'] as string || getStringParam(req.query.workflowId),
      executionId: req.headers['x-execution-id'] as string || getStringParam(req.query.executionId),
      nodeId: req.headers['x-node-id'] as string || getStringParam(req.query.nodeId),
      nodeName: req.headers['x-node-name'] as string || getStringParam(req.query.nodeName),
      runId: req.headers['x-run-id'] as string || getStringParam(req.query.runId),
    };
    
    // Filter out undefined values (optimized)
    const cleanContext: Record<string, string> = {};
    for (const [key, value] of Object.entries(workflowContext)) {
      if (value !== undefined) {
        cleanContext[key] = value;
      }
    }
    
    if (Object.keys(cleanContext).length > 0) {
      sessionManager.updateWorkflowContext(clientId, cleanContext);
      logger.info(`Workflow context for client ${clientId}:`, cleanContext);
    }
    
    // Send endpoint event with session-specific message URL
    logger.debug('Sending endpoint event', { clientId });
    sessionManager.sendToClient(clientId, {
      event: 'endpoint',
      data: `/messages?session_id=${clientId}`
    });
    
    // Keep connection alive with periodic pings
    const pingInterval = setInterval(() => {
      if (!sessionManager.hasClient(clientId)) {
        clearInterval(pingInterval);
        return;
      }
      sessionManager.sendPing(clientId);
    }, 30000); // Ping every 30 seconds
    
    // Handle client disconnect
    req.on('close', () => {
      clearInterval(pingInterval);
      logger.info(`SSE connection closed: ${clientId}`, {
        path: path,
        remainingClients: sessionManager.getActiveClientCount() - 1
      });
    });
  };
  
  // SSE endpoints - Support both legacy and n8n-expected patterns
  app.get('/sse', authenticateRequest, handleSSE);
  app.get('/mcp', authenticateRequest, handleSSE);  // Direct /mcp endpoint for SSE
  app.get('/mcp/:path/sse', authenticateRequest, handleSSE);
  
  // Message endpoint handler - shared logic for all message endpoints
  const handleMessage = async (req: express.Request, res: express.Response) => {
    const sessionId = req.query.session_id as string;
    
    logger.info('Message endpoint called', {
      path: req.path,
      sessionId,
      headers: Object.keys(req.headers),
      body: req.body
    });
    
    const clientId = sessionId;
    
    if (!clientId || !sessionManager.hasClient(clientId)) {
      res.status(400).json({
        error: 'Invalid session',
        message: 'Client ID not found or session expired'
      });
      return;
    }
    
    try {
      const jsonRpcRequest = req.body;
      const workflowContext = sessionManager.getWorkflowContext(clientId);
      logger.debug('Received MCP message:', { 
        clientId,
        method: jsonRpcRequest.method,
        id: jsonRpcRequest.id,
        workflowContext
      });
      
      // Handle the request
      let response;
      
      switch (jsonRpcRequest.method) {
        case 'initialize':
          response = {
            jsonrpc: '2.0' as const,
            result: {
              protocolVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
              capabilities: {
                tools: {},
                resources: {},
                prompts: {}
              },
              serverInfo: {
                name: 'n8n-documentation-mcp',
                version: PROJECT_VERSION
              }
            },
            id: jsonRpcRequest.id
          };
          break;
          
        case 'tools/list':
          const isN8nCompatMode = process.env.N8N_COMPATIBILITY_MODE === 'true';
          const docTools = isN8nCompatMode ? n8nCompatTools : n8nDocumentationToolsFinal;
          const mgmtTools = isN8nCompatMode ? n8nCompatManagementTools : n8nManagementTools;
          
          const tools = [...docTools];
          if (isN8nApiConfigured()) {
            tools.push(...mgmtTools);
          }
          
          response = {
            jsonrpc: '2.0' as const,
            result: {
              tools
            },
            id: jsonRpcRequest.id
          };
          break;
          
        case 'tools/call':
          const toolName = jsonRpcRequest.params?.name;
          const toolArgs = jsonRpcRequest.params?.arguments || {};
          
          logger.debug('Tool call details:', {
            toolName,
            toolArgs,
            toolArgsType: typeof toolArgs,
            toolArgsKeys: Object.keys(toolArgs),
            rawParams: jsonRpcRequest.params
          });
          
          try {
            const result = await mcpServer.executeTool(toolName, toolArgs);
            response = {
              jsonrpc: '2.0' as const,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                  }
                ]
              },
              id: jsonRpcRequest.id
            };
          } catch (error) {
            logger.error(`Error executing tool ${toolName}:`, error);
            response = {
              jsonrpc: '2.0' as const,
              error: {
                code: -32603,
                message: `Error executing tool ${toolName}: ${
                  error instanceof Error ? error.message : String(error)
                }`
              },
              id: jsonRpcRequest.id
            };
          }
          break;
          
        case 'resources/list':
          // MCP resources are not currently implemented
          response = {
            jsonrpc: '2.0' as const,
            result: {
              resources: []
            },
            id: jsonRpcRequest.id
          };
          break;
          
        case 'resources/read':
          response = {
            jsonrpc: '2.0' as const,
            error: {
              code: -32601,
              message: 'Resource reading not implemented'
            },
            id: jsonRpcRequest.id
          };
          break;
          
        case 'prompts/list':
          // MCP prompts are not currently implemented
          response = {
            jsonrpc: '2.0' as const,
            result: {
              prompts: []
            },
            id: jsonRpcRequest.id
          };
          break;
          
        case 'prompts/get':
          response = {
            jsonrpc: '2.0' as const,
            error: {
              code: -32601,
              message: 'Prompt retrieval not implemented'
            },
            id: jsonRpcRequest.id
          };
          break;
          
        default:
          response = {
            jsonrpc: '2.0' as const,
            error: {
              code: -32601,
              message: `Method not found: ${jsonRpcRequest.method}`
            },
            id: jsonRpcRequest.id
          };
      }
      
      // Send response via SSE
      sessionManager.sendMCPMessage(clientId, response);
      
      // Acknowledge receipt
      res.json({ 
        status: 'ok',
        messageId: jsonRpcRequest.id 
      });
      
    } catch (error) {
      logger.error('Error processing MCP message:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
  
  // Legacy MCP handler - for direct POST without SSE
  const handleLegacyMCP = async (req: express.Request, res: express.Response) => {
    try {
      const jsonRpcRequest = req.body;
      logger.debug('Received legacy MCP request:', { method: jsonRpcRequest.method });
      
      // Process request synchronously for backward compatibility
      let response;
      
      switch (jsonRpcRequest.method) {
        case 'initialize':
          response = {
            jsonrpc: '2.0' as const,
            result: {
              protocolVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
              capabilities: {
                tools: {},
                resources: {},
                prompts: {}
              },
              serverInfo: {
                name: 'n8n-documentation-mcp',
                version: PROJECT_VERSION
              }
            },
            id: jsonRpcRequest.id
          };
          break;
          
        case 'tools/list':
          const isN8nCompatMode = process.env.N8N_COMPATIBILITY_MODE === 'true';
          const docTools = isN8nCompatMode ? n8nCompatTools : n8nDocumentationToolsFinal;
          const mgmtTools = isN8nCompatMode ? n8nCompatManagementTools : n8nManagementTools;
          
          const tools = [...docTools];
          if (isN8nApiConfigured()) {
            tools.push(...mgmtTools);
          }
          
          response = {
            jsonrpc: '2.0' as const,
            result: {
              tools
            },
            id: jsonRpcRequest.id
          };
          break;
          
        case 'tools/call':
          const toolName = jsonRpcRequest.params?.name;
          const toolArgs = jsonRpcRequest.params?.arguments || {};
          
          logger.debug('Tool call details:', {
            toolName,
            toolArgs,
            toolArgsType: typeof toolArgs,
            toolArgsKeys: Object.keys(toolArgs),
            rawParams: jsonRpcRequest.params
          });
          
          try {
            const result = await mcpServer.executeTool(toolName, toolArgs);
            response = {
              jsonrpc: '2.0' as const,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                  }
                ]
              },
              id: jsonRpcRequest.id
            };
          } catch (error) {
            logger.error(`Error executing tool ${toolName}:`, error);
            response = {
              jsonrpc: '2.0' as const,
              error: {
                code: -32603,
                message: `Error executing tool ${toolName}: ${
                  error instanceof Error ? error.message : String(error)
                }`
              },
              id: jsonRpcRequest.id
            };
          }
          break;
          
        case 'resources/list':
          // MCP resources are not currently implemented
          response = {
            jsonrpc: '2.0' as const,
            result: {
              resources: []
            },
            id: jsonRpcRequest.id
          };
          break;
          
        case 'resources/read':
          response = {
            jsonrpc: '2.0' as const,
            error: {
              code: -32601,
              message: 'Resource reading not implemented'
            },
            id: jsonRpcRequest.id
          };
          break;
          
        case 'prompts/list':
          // MCP prompts are not currently implemented
          response = {
            jsonrpc: '2.0' as const,
            result: {
              prompts: []
            },
            id: jsonRpcRequest.id
          };
          break;
          
        case 'prompts/get':
          response = {
            jsonrpc: '2.0' as const,
            error: {
              code: -32601,
              message: 'Prompt retrieval not implemented'
            },
            id: jsonRpcRequest.id
          };
          break;
          
        default:
          response = {
            jsonrpc: '2.0' as const,
            error: {
              code: -32601,
              message: `Method not found: ${jsonRpcRequest.method}`
            },
            id: jsonRpcRequest.id
          };
      }
      
      res.json(response);
      
    } catch (error) {
      logger.error('Legacy MCP request error:', error);
      res.status(500).json({
        jsonrpc: '2.0' as const,
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : undefined
        },
        id: null
      });
    }
  };
  
  // Message endpoints - Support both legacy and n8n-expected patterns
  app.post('/messages', authenticateRequest, handleMessage);  // MCP standard endpoint
  app.post('/mcp/message', authenticateRequest, handleMessage);
  app.post('/mcp/:path/message', authenticateRequest, handleMessage);
  
  // Legacy MCP endpoints for backward compatibility
  app.post('/mcp', authenticateRequest, handleLegacyMCP);
  app.post('/mcp/:path', authenticateRequest, handleLegacyMCP);
  
  // Also handle POST to SSE endpoints for n8n compatibility
  app.post('/sse', authenticateRequest, handleLegacyMCP);
  
  // Catch-all route to log any unmatched requests
  app.use((req, res, next) => {
    // Only log if this is truly unmatched (will reach 404)
    const isKnownRoute = ['/health', '/sse', '/mcp', '/mcp/message'].some(route => 
      req.path === route || req.path.startsWith(route + '/')
    );
    
    if (!isKnownRoute) {
      logger.warn('Unmatched request', {
        method: req.method,
        path: req.path,
        url: req.url,
        headers: Object.keys(req.headers),
        hasAuth: !!req.headers.authorization,
        ip: req.ip
      });
    }
    next();
  });
  
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ 
      error: 'Not found',
      message: `Cannot ${req.method} ${req.path}`
    });
  });
  
  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Express error handler:', err);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
      });
    }
  });
  
  const port = parseInt(process.env.PORT || '3000');
  const host = process.env.HOST || '0.0.0.0';
  
  expressServer = app.listen(port, host, () => {
    logger.info(`n8n MCP SSE Server started`, { port, host });
    console.log(`n8n MCP SSE Server running on ${host}:${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`SSE endpoints:`);
    console.log(`  - http://localhost:${port}/sse`);
    console.log(`  - http://localhost:${port}/mcp`);
    console.log(`  - http://localhost:${port}/mcp/{path}/sse`);
    console.log(`Message endpoints:`);
    console.log(`  - http://localhost:${port}/messages?session_id={session_id}`);
    console.log(`  - http://localhost:${port}/mcp/message (legacy)`);
    console.log('\nPress Ctrl+C to stop the server');
  });
  
  expressServer.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${port} is already in use`);
      console.error(`ERROR: Port ${port} is already in use`);
      process.exit(1);
    } else {
      logger.error('Server error:', error);
      console.error('Server error:', error);
      process.exit(1);
    }
  });
  
  // Graceful shutdown handlers
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    console.error('Uncaught exception:', error);
    shutdown();
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection:', reason);
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown();
  });
}

// Make executeTool public on the server
declare module './mcp/server' {
  interface N8NDocumentationMCPServer {
    executeTool(name: string, args: any): Promise<any>;
  }
}

// Start if called directly
if (require.main === module) {
  startSSEServer().catch(error => {
    logger.error('Failed to start SSE server:', error);
    console.error('Failed to start SSE server:', error);
    process.exit(1);
  });
}