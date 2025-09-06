/**
 * SSE Session Manager
 * Manages Server-Sent Events connections and sessions for MCP protocol
 */

import { SSEClient, SSEMessage, MCPSSEMessage, WorkflowContext } from '../types/sse';
import { logger } from './logger';
import { v4 as uuidv4 } from 'uuid';

export class SSESessionManager {
  private clients: Map<string, SSEClient> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private readonly CLEANUP_INTERVAL = 30000; // 30 seconds
  private readonly SESSION_TIMEOUT = 300000; // 5 minutes
  private readonly MAX_CLIENTS = 1000; // Maximum concurrent connections

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Register a new SSE client
   */
  registerClient(response: any): string {
    // Check client limit
    if (this.clients.size >= this.MAX_CLIENTS) {
      logger.error(`Maximum client limit reached: ${this.MAX_CLIENTS}`);
      throw new Error('Maximum concurrent connections exceeded');
    }
    
    const clientId = uuidv4();
    const client: SSEClient = {
      id: clientId,
      response,
      lastActivity: Date.now(),
      isActive: true,
    };

    this.clients.set(clientId, client);
    logger.info(`SSE client registered: ${clientId} (total: ${this.clients.size})`);

    // Set up SSE headers (with compression disabled for n8n compatibility)
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Content-Encoding': 'identity', // Explicitly disable compression
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'X-Content-Type-Options': 'nosniff',
    });

    // Don't send initial connection event - n8n expects endpoint event instead

    // Set up disconnect handler
    response.on('close', () => {
      this.removeClient(clientId);
    });

    return clientId;
  }

  /**
   * Remove a client
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isActive = false;
      this.clients.delete(clientId);
      logger.info(`SSE client removed: ${clientId}`);
    }
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(clientId: string, message: SSEMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || !client.isActive) {
      logger.warn(`Attempted to send to inactive client: ${clientId}`);
      return false;
    }

    try {
      const data = typeof message.data === 'string' 
        ? message.data 
        : JSON.stringify(message.data);

      let sseMessage = '';
      
      if (message.id) {
        sseMessage += `id: ${message.id}\n`;
      }
      
      if (message.event) {
        sseMessage += `event: ${message.event}\n`;
      }
      
      // Split data by newlines to ensure proper SSE format
      const lines = data.split('\n');
      for (const line of lines) {
        sseMessage += `data: ${line}\n`;
      }
      
      if (message.retry) {
        sseMessage += `retry: ${message.retry}\n`;
      }
      
      sseMessage += '\n';

      client.response.write(sseMessage);
      client.lastActivity = Date.now();
      
      logger.debug(`SSE message sent to client ${clientId}`, {
        event: message.event,
        dataLength: sseMessage.length,
        preview: sseMessage.substring(0, 100)
      });
      
      return true;
    } catch (error) {
      logger.error(`Failed to send SSE message to client ${clientId}:`, error);
      this.removeClient(clientId);
      return false;
    }
  }

  /**
   * Send MCP protocol message to client
   */
  sendMCPMessage(clientId: string, mcpMessage: MCPSSEMessage['data']): boolean {
    // For MCP protocol, send JSON-RPC messages without custom event names
    const message: SSEMessage = {
      data: mcpMessage,
    };

    if (mcpMessage.id) {
      message.id = String(mcpMessage.id);
    }

    return this.sendToClient(clientId, message);
  }

  /**
   * Broadcast a message to all active clients
   */
  broadcast(message: SSEMessage): void {
    const inactiveClients: string[] = [];

    for (const [clientId, client] of this.clients) {
      if (client.isActive) {
        const success = this.sendToClient(clientId, message);
        if (!success) {
          inactiveClients.push(clientId);
        }
      }
    }

    // Clean up inactive clients
    inactiveClients.forEach(clientId => this.removeClient(clientId));
  }

  /**
   * Send keepalive ping to a client
   */
  sendPing(clientId: string): boolean {
    return this.sendToClient(clientId, {
      event: 'ping',
      data: { timestamp: Date.now() },
    });
  }

  /**
   * Send keepalive pings to all clients
   */
  pingAllClients(): void {
    for (const [clientId, client] of this.clients) {
      if (client.isActive) {
        this.sendPing(clientId);
      }
    }
  }

  /**
   * Clean up inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = Date.now();
    const inactiveClients: string[] = [];

    for (const [clientId, client] of this.clients) {
      if (now - client.lastActivity > this.SESSION_TIMEOUT) {
        inactiveClients.push(clientId);
      }
    }

    if (inactiveClients.length > 0) {
      logger.info(`Cleaning up ${inactiveClients.length} inactive SSE sessions`);
      inactiveClients.forEach(clientId => this.removeClient(clientId));
    }
  }

  /**
   * Check if a client exists and is active
   */
  hasClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    return client ? client.isActive : false;
  }

  /**
   * Get active client count
   */
  getActiveClientCount(): number {
    return this.clients.size;
  }

  /**
   * Update workflow context for a client
   */
  updateWorkflowContext(clientId: string, context: WorkflowContext): boolean {
    const client = this.clients.get(clientId);
    if (!client || !client.isActive) {
      logger.warn(`Attempted to update context for inactive client: ${clientId}`);
      return false;
    }

    client.workflowContext = {
      ...client.workflowContext,
      ...context
    };
    
    logger.info(`Updated workflow context for client ${clientId}:`, client.workflowContext);
    return true;
  }

  /**
   * Get workflow context for a client
   */
  getWorkflowContext(clientId: string): WorkflowContext | undefined {
    const client = this.clients.get(clientId);
    return client?.workflowContext;
  }

  /**
   * Shutdown the session manager
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all client connections
    for (const [clientId, client] of this.clients) {
      try {
        client.response.end();
      } catch (error) {
        // Ignore errors during shutdown
      }
    }

    this.clients.clear();
    logger.info('SSE session manager shut down');
  }
}