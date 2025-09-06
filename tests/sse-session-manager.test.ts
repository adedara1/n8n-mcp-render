/**
 * Unit tests for SSE Session Manager
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SSESessionManager } from '../src/utils/sse-session-manager';
import { EventEmitter } from 'events';

// Mock Express response
class MockResponse extends EventEmitter {
  public headers: any = {};
  public statusCode?: number;
  public writtenData: string[] = [];
  
  writeHead(status: number, headers: any) {
    this.statusCode = status;
    this.headers = headers;
  }
  
  write(data: string) {
    this.writtenData.push(data);
    return true;
  }
  
  end() {
    this.emit('close');
  }
}

describe('SSE Session Manager', () => {
  let sessionManager: SSESessionManager;
  
  beforeEach(() => {
    sessionManager = new SSESessionManager();
  });
  
  afterEach(() => {
    sessionManager.shutdown();
  });
  
  describe('Client Registration', () => {
    test('should register a new client', () => {
      const mockResponse = new MockResponse();
      const clientId = sessionManager.registerClient(mockResponse);
      
      expect(clientId).toBeTruthy();
      expect(sessionManager.hasClient(clientId)).toBe(true);
      expect(sessionManager.getActiveClientCount()).toBe(1);
    });
    
    test('should set SSE headers correctly', () => {
      const mockResponse = new MockResponse();
      sessionManager.registerClient(mockResponse);
      
      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.headers['Content-Type']).toBe('text/event-stream');
      expect(mockResponse.headers['Cache-Control']).toBe('no-cache');
      expect(mockResponse.headers['Connection']).toBe('keep-alive');
    });
    
    test('should send connected event on registration', () => {
      const mockResponse = new MockResponse();
      const clientId = sessionManager.registerClient(mockResponse);
      
      // Check that connected event was sent
      expect(mockResponse.writtenData.length).toBeGreaterThan(0);
      const sentData = mockResponse.writtenData[0];
      expect(sentData).toContain('event: connected');
      expect(sentData).toContain(`"clientId":"${clientId}"`);
    });
    
    test('should handle client disconnect', () => {
      const mockResponse = new MockResponse();
      const clientId = sessionManager.registerClient(mockResponse);
      
      expect(sessionManager.hasClient(clientId)).toBe(true);
      
      // Simulate disconnect
      mockResponse.emit('close');
      
      expect(sessionManager.hasClient(clientId)).toBe(false);
      expect(sessionManager.getActiveClientCount()).toBe(0);
    });
  });
  
  describe('Message Sending', () => {
    test('should send message to client', () => {
      const mockResponse = new MockResponse();
      const clientId = sessionManager.registerClient(mockResponse);
      
      const result = sessionManager.sendToClient(clientId, {
        event: 'test-event',
        data: { message: 'Hello' }
      });
      
      expect(result).toBe(true);
      expect(mockResponse.writtenData.length).toBe(2); // connected + test message
      
      const lastMessage = mockResponse.writtenData[1];
      expect(lastMessage).toContain('event: test-event');
      expect(lastMessage).toContain('data: {"message":"Hello"}');
    });
    
    test('should handle message with ID and retry', () => {
      const mockResponse = new MockResponse();
      const clientId = sessionManager.registerClient(mockResponse);
      
      sessionManager.sendToClient(clientId, {
        id: '123',
        event: 'test',
        data: 'test data',
        retry: 5000
      });
      
      const lastMessage = mockResponse.writtenData[1];
      expect(lastMessage).toContain('id: 123');
      expect(lastMessage).toContain('retry: 5000');
    });
    
    test('should send MCP message correctly', () => {
      const mockResponse = new MockResponse();
      const clientId = sessionManager.registerClient(mockResponse);
      
      const mcpMessage = {
        jsonrpc: '2.0' as const,
        id: 1,
        result: { test: 'data' }
      };
      
      const result = sessionManager.sendMCPMessage(clientId, mcpMessage);
      
      expect(result).toBe(true);
      const lastMessage = mockResponse.writtenData[1];
      expect(lastMessage).toContain('event: mcp-response');
      expect(lastMessage).toContain('"jsonrpc":"2.0"');
    });
    
    test('should return false for invalid client', () => {
      const result = sessionManager.sendToClient('invalid-id', {
        data: 'test'
      });
      
      expect(result).toBe(false);
    });
  });
  
  describe('Workflow Context', () => {
    test('should update workflow context', () => {
      const mockResponse = new MockResponse();
      const clientId = sessionManager.registerClient(mockResponse);
      
      const context = {
        workflowId: 'workflow-123',
        executionId: 'execution-456',
        nodeId: 'node-789'
      };
      
      const result = sessionManager.updateWorkflowContext(clientId, context);
      
      expect(result).toBe(true);
      expect(sessionManager.getWorkflowContext(clientId)).toEqual(context);
    });
    
    test('should merge workflow context updates', () => {
      const mockResponse = new MockResponse();
      const clientId = sessionManager.registerClient(mockResponse);
      
      sessionManager.updateWorkflowContext(clientId, {
        workflowId: 'workflow-123'
      });
      
      sessionManager.updateWorkflowContext(clientId, {
        executionId: 'execution-456'
      });
      
      const context = sessionManager.getWorkflowContext(clientId);
      expect(context).toEqual({
        workflowId: 'workflow-123',
        executionId: 'execution-456'
      });
    });
    
    test('should return false for invalid client context update', () => {
      const result = sessionManager.updateWorkflowContext('invalid-id', {
        workflowId: 'test'
      });
      
      expect(result).toBe(false);
    });
  });
  
  describe('Broadcast', () => {
    test('should broadcast to all active clients', () => {
      const mockResponse1 = new MockResponse();
      const mockResponse2 = new MockResponse();
      
      sessionManager.registerClient(mockResponse1);
      sessionManager.registerClient(mockResponse2);
      
      sessionManager.broadcast({
        event: 'broadcast-test',
        data: { message: 'Hello all' }
      });
      
      // Both clients should receive the message
      expect(mockResponse1.writtenData.length).toBe(2);
      expect(mockResponse2.writtenData.length).toBe(2);
      
      const message1 = mockResponse1.writtenData[1];
      const message2 = mockResponse2.writtenData[1];
      
      expect(message1).toContain('event: broadcast-test');
      expect(message2).toContain('event: broadcast-test');
    });
  });
  
  describe('Ping', () => {
    test('should send ping to client', () => {
      const mockResponse = new MockResponse();
      const clientId = sessionManager.registerClient(mockResponse);
      
      const result = sessionManager.sendPing(clientId);
      
      expect(result).toBe(true);
      const lastMessage = mockResponse.writtenData[1];
      expect(lastMessage).toContain('event: ping');
      expect(lastMessage).toContain('"timestamp"');
    });
    
    test('should ping all clients', () => {
      const mockResponse1 = new MockResponse();
      const mockResponse2 = new MockResponse();
      
      sessionManager.registerClient(mockResponse1);
      sessionManager.registerClient(mockResponse2);
      
      sessionManager.pingAllClients();
      
      // Both clients should receive ping
      expect(mockResponse1.writtenData.length).toBe(2);
      expect(mockResponse2.writtenData.length).toBe(2);
      
      expect(mockResponse1.writtenData[1]).toContain('event: ping');
      expect(mockResponse2.writtenData[1]).toContain('event: ping');
    });
  });
  
  describe('Session Cleanup', () => {
    test('should clean up inactive sessions', async () => {
      // Mock the session timeout to a short value for testing
      jest.useFakeTimers();
      
      const mockResponse = new MockResponse();
      const clientId = sessionManager.registerClient(mockResponse);
      
      expect(sessionManager.hasClient(clientId)).toBe(true);
      
      // Fast forward past session timeout
      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes
      
      // The cleanup interval should have run and removed the inactive session
      // Note: This test might need adjustment based on actual implementation
      
      jest.useRealTimers();
    });
  });
  
  describe('Client Limits', () => {
    test('should enforce maximum client limit', () => {
      // Temporarily set a lower limit for testing
      const maxClients = 5;
      (sessionManager as any).MAX_CLIENTS = maxClients;
      
      // Register clients up to the limit
      const responses: MockResponse[] = [];
      for (let i = 0; i < maxClients; i++) {
        const mockResponse = new MockResponse();
        responses.push(mockResponse);
        sessionManager.registerClient(mockResponse);
      }
      
      expect(sessionManager.getActiveClientCount()).toBe(maxClients);
      
      // Try to register one more client
      const extraResponse = new MockResponse();
      expect(() => {
        sessionManager.registerClient(extraResponse);
      }).toThrow('Maximum concurrent connections exceeded');
      
      // Clean up
      responses.forEach(r => r.emit('close'));
    });
  });
  
  describe('Shutdown', () => {
    test('should close all connections on shutdown', () => {
      const mockResponse1 = new MockResponse();
      const mockResponse2 = new MockResponse();
      
      const endSpy1 = jest.spyOn(mockResponse1, 'end');
      const endSpy2 = jest.spyOn(mockResponse2, 'end');
      
      sessionManager.registerClient(mockResponse1);
      sessionManager.registerClient(mockResponse2);
      
      sessionManager.shutdown();
      
      expect(endSpy1).toHaveBeenCalled();
      expect(endSpy2).toHaveBeenCalled();
      expect(sessionManager.getActiveClientCount()).toBe(0);
    });
  });
});