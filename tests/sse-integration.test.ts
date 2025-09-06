/**
 * SSE Integration Tests for n8n MCP
 * Tests the enhanced SSE server functionality
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { EventSource } from 'eventsource';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const TEST_PORT = 3001;
const TEST_AUTH_TOKEN = 'test-token-' + uuidv4();
const TEST_URL = `http://localhost:${TEST_PORT}`;

// SSE server instance
let server: any;
let app: any;

describe('SSE Integration Tests', () => {
  beforeAll(async () => {
    // Set test environment
    process.env.AUTH_TOKEN = TEST_AUTH_TOKEN;
    process.env.PORT = String(TEST_PORT);
    process.env.MCP_MODE = 'sse';
    
    // Import and start SSE server
    const { startSSEServer } = await import('../src/sse-server');
    // Note: We'd need to modify startSSEServer to return the express app for testing
    // For now, we'll test against the running server
  });

  afterAll(async () => {
    // Clean up
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('Health Check', () => {
    test('should return server status', async () => {
      const response = await request(TEST_URL)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        mode: 'sse',
        activeSessions: expect.any(Number),
        memory: expect.any(Object),
        timestamp: expect.any(String)
      });
    });
  });

  describe('Authentication', () => {
    test('should authenticate with Bearer token', async () => {
      const response = await request(TEST_URL)
        .post('/mcp')
        .set('Authorization', `Bearer ${TEST_AUTH_TOKEN}`)
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1
        })
        .expect(200);

      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result');
    });

    test('should authenticate with custom header', async () => {
      const response = await request(TEST_URL)
        .post('/mcp')
        .set('x-auth-token', TEST_AUTH_TOKEN)
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1
        })
        .expect(200);

      expect(response.body).toHaveProperty('jsonrpc', '2.0');
    });

    test('should authenticate with API key header', async () => {
      const response = await request(TEST_URL)
        .post('/mcp')
        .set('x-api-key', TEST_AUTH_TOKEN)
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1
        })
        .expect(200);

      expect(response.body).toHaveProperty('jsonrpc', '2.0');
    });

    test('should reject invalid token', async () => {
      const response = await request(TEST_URL)
        .post('/mcp')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    test('should reject missing token', async () => {
      const response = await request(TEST_URL)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('Endpoint Patterns', () => {
    test('should support legacy /sse endpoint', async () => {
      const response = await new Promise((resolve, reject) => {
        const es = new EventSource(`${TEST_URL}/sse?token=${TEST_AUTH_TOKEN}`);
        
        es.onopen = () => {
          es.close();
          resolve({ connected: true });
        };
        
        es.onerror = (error) => {
          es.close();
          reject(error);
        };
      });

      expect(response).toEqual({ connected: true });
    });

    test('should support n8n pattern /mcp/:path/sse', async () => {
      const response = await new Promise((resolve, reject) => {
        const es = new EventSource(`${TEST_URL}/mcp/workflow-123/sse?token=${TEST_AUTH_TOKEN}`);
        
        es.onopen = () => {
          es.close();
          resolve({ connected: true });
        };
        
        es.onerror = (error) => {
          es.close();
          reject(error);
        };
      });

      expect(response).toEqual({ connected: true });
    });

    test('should support legacy /mcp/message endpoint', async () => {
      // First establish SSE connection to get client ID
      // This is simplified - in real test we'd extract the client ID from SSE messages
      const response = await request(TEST_URL)
        .post('/mcp/message')
        .set('Authorization', `Bearer ${TEST_AUTH_TOKEN}`)
        .set('X-Client-ID', 'test-client-id')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1
        });

      // The real response would come via SSE, here we just check acknowledgment
      expect(response.status).toBeLessThan(500);
    });

    test('should support n8n pattern /mcp/:path/message', async () => {
      const response = await request(TEST_URL)
        .post('/mcp/workflow-123/message')
        .set('Authorization', `Bearer ${TEST_AUTH_TOKEN}`)
        .set('X-Client-ID', 'test-client-id')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1
        });

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('MCP Protocol Methods', () => {
    test('should handle initialize method', async () => {
      const response = await request(TEST_URL)
        .post('/mcp')
        .set('Authorization', `Bearer ${TEST_AUTH_TOKEN}`)
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          serverInfo: {
            name: 'n8n-documentation-mcp'
          }
        }
      });
    });

    test('should handle tools/list method', async () => {
      const response = await request(TEST_URL)
        .post('/mcp')
        .set('Authorization', `Bearer ${TEST_AUTH_TOKEN}`)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 2
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: {
          tools: expect.any(Array)
        }
      });
    });

    test('should handle resources/list method', async () => {
      const response = await request(TEST_URL)
        .post('/mcp')
        .set('Authorization', `Bearer ${TEST_AUTH_TOKEN}`)
        .send({
          jsonrpc: '2.0',
          method: 'resources/list',
          id: 3
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 3,
        result: {
          resources: []
        }
      });
    });

    test('should handle prompts/list method', async () => {
      const response = await request(TEST_URL)
        .post('/mcp')
        .set('Authorization', `Bearer ${TEST_AUTH_TOKEN}`)
        .send({
          jsonrpc: '2.0',
          method: 'prompts/list',
          id: 4
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 4,
        result: {
          prompts: []
        }
      });
    });

    test('should return error for resources/read', async () => {
      const response = await request(TEST_URL)
        .post('/mcp')
        .set('Authorization', `Bearer ${TEST_AUTH_TOKEN}`)
        .send({
          jsonrpc: '2.0',
          method: 'resources/read',
          params: { uri: 'test://resource' },
          id: 5
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 5,
        error: {
          code: -32601,
          message: 'Resource reading not implemented'
        }
      });
    });

    test('should return error for prompts/get', async () => {
      const response = await request(TEST_URL)
        .post('/mcp')
        .set('Authorization', `Bearer ${TEST_AUTH_TOKEN}`)
        .send({
          jsonrpc: '2.0',
          method: 'prompts/get',
          params: { name: 'test-prompt' },
          id: 6
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 6,
        error: {
          code: -32601,
          message: 'Prompt retrieval not implemented'
        }
      });
    });

    test('should return error for unknown method', async () => {
      const response = await request(TEST_URL)
        .post('/mcp')
        .set('Authorization', `Bearer ${TEST_AUTH_TOKEN}`)
        .send({
          jsonrpc: '2.0',
          method: 'unknown/method',
          id: 7
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 7,
        error: {
          code: -32601,
          message: expect.stringContaining('Method not found')
        }
      });
    });
  });

  describe('Workflow Context', () => {
    test('should accept workflow context headers', async () => {
      const workflowId = 'workflow-' + uuidv4();
      const executionId = 'execution-' + uuidv4();
      const nodeId = 'node-' + uuidv4();
      
      // Test SSE connection with workflow context
      const url = `${TEST_URL}/sse?token=${TEST_AUTH_TOKEN}&workflowId=${workflowId}&executionId=${executionId}&nodeId=${nodeId}`;
      
      const response = await new Promise((resolve, reject) => {
        const es = new EventSource(url);
        
        es.onopen = () => {
          es.close();
          resolve({ connected: true });
        };
        
        es.onerror = (error) => {
          es.close();
          reject(error);
        };
      });

      expect(response).toEqual({ connected: true });
    });
  });

  describe('SSE Message Flow', () => {
    test('should receive connected event on SSE connection', async () => {
      const messages: any[] = [];
      
      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(`${TEST_URL}/sse?token=${TEST_AUTH_TOKEN}`);
        
        es.addEventListener('connected', (event: any) => {
          messages.push({
            type: event.type,
            data: JSON.parse(event.data)
          });
          es.close();
          resolve();
        });
        
        es.onerror = (error) => {
          es.close();
          reject(error);
        };
        
        // Timeout after 5 seconds
        setTimeout(() => {
          es.close();
          reject(new Error('Timeout waiting for connected event'));
        }, 5000);
      });

      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        type: 'connected',
        data: {
          clientId: expect.any(String),
          timestamp: expect.any(String)
        }
      });
    });

    test('should receive mcp-response for initialization', async () => {
      const messages: any[] = [];
      
      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(`${TEST_URL}/sse?token=${TEST_AUTH_TOKEN}`);
        
        es.addEventListener('mcp-response', (event: any) => {
          const data = JSON.parse(event.data);
          if (data.method === 'mcp/ready') {
            messages.push({
              type: event.type,
              data
            });
            es.close();
            resolve();
          }
        });
        
        es.onerror = (error) => {
          es.close();
          reject(error);
        };
        
        // Timeout after 5 seconds
        setTimeout(() => {
          es.close();
          reject(new Error('Timeout waiting for mcp/ready'));
        }, 5000);
      });

      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        type: 'mcp-response',
        data: {
          jsonrpc: '2.0',
          method: 'mcp/ready',
          params: {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: 'n8n-documentation-mcp'
            }
          }
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for unknown endpoints', async () => {
      const response = await request(TEST_URL)
        .get('/unknown-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not found',
        message: expect.stringContaining('Cannot GET /unknown-endpoint')
      });
    });

    test('should handle invalid JSON in request body', async () => {
      const response = await request(TEST_URL)
        .post('/mcp')
        .set('Authorization', `Bearer ${TEST_AUTH_TOKEN}`)
        .set('Content-Type', 'application/json')
        .send('invalid-json')
        .expect(400);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});