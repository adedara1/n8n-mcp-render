#!/usr/bin/env ts-node

/**
 * Manual test script for SSE endpoints
 * Usage: npm run build && npx ts-node tests/test-sse-endpoints.ts
 */

import { EventSource } from 'eventsource';
import fetch from 'node-fetch';

const BASE_URL = process.env.SSE_TEST_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'test-token';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message?: string;
  error?: any;
}

const results: TestResult[] = [];

function logResult(test: string, status: 'PASS' | 'FAIL', message?: string, error?: any) {
  results.push({ test, status, message, error });
  console.log(`[${status}] ${test}${message ? ': ' + message : ''}`);
  if (error) {
    console.error('  Error:', error);
  }
}

async function testHealthEndpoint() {
  console.log('\n=== Testing Health Endpoint ===');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    
    if (response.ok && data.status === 'ok' && data.mode === 'sse') {
      logResult('Health Check', 'PASS', `Server is healthy (mode: ${data.mode})`);
    } else {
      logResult('Health Check', 'FAIL', 'Unexpected response', data);
    }
  } catch (error) {
    logResult('Health Check', 'FAIL', 'Failed to connect', error);
  }
}

async function testAuthentication() {
  console.log('\n=== Testing Authentication Methods ===');
  
  // Test Bearer token
  try {
    const response = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1
      })
    });
    
    if (response.ok) {
      logResult('Bearer Token Auth', 'PASS');
    } else {
      logResult('Bearer Token Auth', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logResult('Bearer Token Auth', 'FAIL', 'Request failed', error);
  }
  
  // Test custom header
  try {
    const response = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'x-auth-token': AUTH_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 2
      })
    });
    
    if (response.ok) {
      logResult('Custom Header Auth', 'PASS');
    } else {
      logResult('Custom Header Auth', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logResult('Custom Header Auth', 'FAIL', 'Request failed', error);
  }
  
  // Test API key header
  try {
    const response = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'x-api-key': AUTH_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 3
      })
    });
    
    if (response.ok) {
      logResult('API Key Auth', 'PASS');
    } else {
      logResult('API Key Auth', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logResult('API Key Auth', 'FAIL', 'Request failed', error);
  }
}

async function testSSEEndpoints() {
  console.log('\n=== Testing SSE Endpoints ===');
  
  // Test legacy /sse endpoint
  await testSSEConnection('/sse', 'Legacy SSE endpoint');
  
  // Test n8n pattern endpoint
  await testSSEConnection('/mcp/test-workflow/sse', 'n8n pattern SSE endpoint');
}

async function testSSEConnection(endpoint: string, testName: string): Promise<void> {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${endpoint}?token=${AUTH_TOKEN}`;
    console.log(`Testing ${testName}: ${url}`);
    
    const es = new EventSource(url);
    let receivedConnected = false;
    let receivedReady = false;
    
    const timeout = setTimeout(() => {
      es.close();
      if (!receivedConnected) {
        logResult(testName, 'FAIL', 'Timeout - no connected event');
      } else if (!receivedReady) {
        logResult(testName, 'FAIL', 'Timeout - no mcp/ready event');
      }
      resolve();
    }, 5000);
    
    es.addEventListener('connected', (event: any) => {
      receivedConnected = true;
      const data = JSON.parse(event.data);
      console.log(`  Received connected event: clientId=${data.clientId}`);
    });
    
    es.addEventListener('mcp-response', (event: any) => {
      const data = JSON.parse(event.data);
      if (data.method === 'mcp/ready') {
        receivedReady = true;
        console.log(`  Received mcp/ready event`);
        clearTimeout(timeout);
        es.close();
        logResult(testName, 'PASS', 'Connected and ready');
        resolve();
      }
    });
    
    es.onerror = (error: any) => {
      clearTimeout(timeout);
      es.close();
      logResult(testName, 'FAIL', 'Connection error', error);
      resolve();
    };
  });
}

async function testMCPMethods() {
  console.log('\n=== Testing MCP Protocol Methods ===');
  
  const methods = [
    { method: 'initialize', expectedResult: true },
    { method: 'tools/list', expectedResult: true },
    { method: 'resources/list', expectedResult: true },
    { method: 'prompts/list', expectedResult: true },
    { method: 'resources/read', expectedResult: false },
    { method: 'prompts/get', expectedResult: false },
  ];
  
  for (const { method, expectedResult } of methods) {
    try {
      const response = await fetch(`${BASE_URL}/mcp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params: method.includes('read') ? { uri: 'test://resource' } : 
                  method.includes('get') ? { name: 'test-prompt' } : undefined,
          id: Math.random()
        })
      });
      
      const data = await response.json();
      
      if (expectedResult && data.result !== undefined) {
        logResult(`MCP ${method}`, 'PASS', 'Returned result');
      } else if (!expectedResult && data.error !== undefined) {
        logResult(`MCP ${method}`, 'PASS', 'Returned expected error');
      } else {
        logResult(`MCP ${method}`, 'FAIL', 'Unexpected response', data);
      }
    } catch (error) {
      logResult(`MCP ${method}`, 'FAIL', 'Request failed', error);
    }
  }
}

async function testWorkflowContext() {
  console.log('\n=== Testing Workflow Context ===');
  
  const workflowId = 'test-workflow-123';
  const executionId = 'test-execution-456';
  const nodeId = 'test-node-789';
  
  const url = `${BASE_URL}/mcp/${workflowId}/sse?token=${AUTH_TOKEN}&workflowId=${workflowId}&executionId=${executionId}&nodeId=${nodeId}`;
  
  return new Promise<void>((resolve) => {
    const es = new EventSource(url);
    
    const timeout = setTimeout(() => {
      es.close();
      logResult('Workflow Context', 'FAIL', 'Timeout');
      resolve();
    }, 5000);
    
    es.addEventListener('connected', (event: any) => {
      clearTimeout(timeout);
      es.close();
      logResult('Workflow Context', 'PASS', 'Connected with context parameters');
      resolve();
    });
    
    es.onerror = (error: any) => {
      clearTimeout(timeout);
      es.close();
      logResult('Workflow Context', 'FAIL', 'Connection error', error);
      resolve();
    };
  });
}

async function runAllTests() {
  console.log(`Testing SSE Server at ${BASE_URL}`);
  console.log(`Using auth token: ${AUTH_TOKEN.substring(0, 8)}...`);
  
  await testHealthEndpoint();
  await testAuthentication();
  await testSSEEndpoints();
  await testMCPMethods();
  await testWorkflowContext();
  
  // Summary
  console.log('\n=== Test Summary ===');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`- ${r.test}: ${r.message || 'No message'}`);
    });
    process.exit(1);
  } else {
    console.log('\nAll tests passed!');
    process.exit(0);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});