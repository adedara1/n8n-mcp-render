#!/usr/bin/env ts-node
/**
 * Test script for SSE server implementation
 * Tests the SSE connection and MCP protocol communication
 */

import axios from 'axios';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'test-token';

interface TestResult {
  test: string;
  status: 'passed' | 'failed';
  message?: string;
  duration?: number;
}

const results: TestResult[] = [];

function logTest(test: string, status: 'passed' | 'failed', message?: string, duration?: number) {
  results.push({ test, status, message, duration });
  console.log(`${status === 'passed' ? '✅' : '❌'} ${test}${message ? `: ${message}` : ''}${duration ? ` (${duration}ms)` : ''}`);
}

async function testHealthCheck() {
  const start = Date.now();
  try {
    const response = await axios.get(`${SERVER_URL}/health`);
    const duration = Date.now() - start;
    
    if (response.data.status === 'ok' && response.data.mode === 'sse') {
      logTest('Health check', 'passed', `Server is running in SSE mode`, duration);
    } else {
      logTest('Health check', 'failed', `Unexpected response: ${JSON.stringify(response.data)}`, duration);
    }
  } catch (error) {
    logTest('Health check', 'failed', error instanceof Error ? error.message : 'Unknown error');
  }
}

async function testSSEConnection(): Promise<string | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    let clientId: string | null = null;
    let eventSource: EventSource | null = null;
    
    try {
      // Note: eventsource package doesn't support headers in constructor
      // We'll need to use a different approach or library for authenticated SSE
      const EventSourcePolyfill = require('eventsource');
      eventSource = new EventSourcePolyfill(`${SERVER_URL}/sse`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }) as EventSource;
      
      eventSource.addEventListener('connected', (event: any) => {
        const duration = Date.now() - start;
        const data = JSON.parse(event.data);
        clientId = data.clientId;
        logTest('SSE connection', 'passed', `Connected with client ID: ${clientId}`, duration);
      });
      
      eventSource.addEventListener('mcp-response', (event: any) => {
        const data = JSON.parse(event.data);
        console.log('  Received MCP response:', data);
      });
      
      eventSource.addEventListener('ping', (event: any) => {
        console.log('  Received ping:', event.data);
      });
      
      eventSource.onerror = (error) => {
        logTest('SSE connection', 'failed', `Connection error: ${error}`);
        eventSource?.close();
        resolve(null);
      };
      
      // Wait for connection and initial message
      setTimeout(() => {
        if (eventSource) {
          eventSource.close();
        }
        resolve(clientId);
      }, 2000);
      
    } catch (error) {
      logTest('SSE connection', 'failed', error instanceof Error ? error.message : 'Unknown error');
      resolve(null);
    }
  });
}

async function testMCPMessage(clientId: string) {
  const start = Date.now();
  try {
    // Test initialize
    const initResponse = await axios.post(
      `${SERVER_URL}/mcp/message`,
      {
        jsonrpc: '2.0',
        method: 'initialize',
        id: 'test-init-1',
        params: {}
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'X-Client-ID': clientId,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = Date.now() - start;
    
    if (initResponse.data.status === 'ok') {
      logTest('MCP initialize message', 'passed', `Message acknowledged`, duration);
    } else {
      logTest('MCP initialize message', 'failed', `Unexpected response: ${JSON.stringify(initResponse.data)}`, duration);
    }
  } catch (error) {
    logTest('MCP initialize message', 'failed', error instanceof Error ? error.message : 'Unknown error');
  }
}

async function testToolsList(clientId: string) {
  const start = Date.now();
  try {
    const response = await axios.post(
      `${SERVER_URL}/mcp/message`,
      {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 'test-tools-1',
        params: {}
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'X-Client-ID': clientId,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = Date.now() - start;
    
    if (response.data.status === 'ok') {
      logTest('MCP tools/list message', 'passed', `Message acknowledged`, duration);
    } else {
      logTest('MCP tools/list message', 'failed', `Unexpected response: ${JSON.stringify(response.data)}`, duration);
    }
  } catch (error) {
    logTest('MCP tools/list message', 'failed', error instanceof Error ? error.message : 'Unknown error');
  }
}

async function testLegacyEndpoint() {
  const start = Date.now();
  try {
    const response = await axios.post(
      `${SERVER_URL}/mcp`,
      {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 'test-legacy-1',
        params: {}
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = Date.now() - start;
    
    if (response.data.result && response.data.result.tools) {
      logTest('Legacy /mcp endpoint', 'passed', `Found ${response.data.result.tools.length} tools`, duration);
    } else {
      logTest('Legacy /mcp endpoint', 'failed', `Unexpected response: ${JSON.stringify(response.data)}`, duration);
    }
  } catch (error) {
    logTest('Legacy /mcp endpoint', 'failed', error instanceof Error ? error.message : 'Unknown error');
  }
}

async function runTests() {
  console.log('🧪 Testing SSE Server Implementation');
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`Auth Token: ${AUTH_TOKEN.substring(0, 8)}...`);
  console.log('');
  
  // Health check
  await testHealthCheck();
  
  // SSE connection
  const clientId = await testSSEConnection();
  
  if (clientId) {
    // Test MCP messages
    await testMCPMessage(clientId);
    await testToolsList(clientId);
  }
  
  // Test legacy endpoint
  await testLegacyEndpoint();
  
  // Summary
  console.log('\n📊 Test Summary:');
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter(r => r.status === 'failed').forEach(r => {
      console.log(`  - ${r.test}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Install eventsource if not available
try {
  require('eventsource');
} catch {
  console.log('Installing eventsource package...');
  require('child_process').execSync('npm install --no-save eventsource', { stdio: 'inherit' });
}

// Run tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});