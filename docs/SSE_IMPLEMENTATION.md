# SSE (Server-Sent Events) Implementation for n8n MCP

## Overview

This document describes the SSE implementation that enables n8n's MCP Server Trigger to connect to n8n-mcp server using Server-Sent Events protocol.

## Architecture

### Components

1. **SSE Server** (`src/sse-server.ts`)
   - Main Express server with SSE endpoints
   - Handles authentication and CORS
   - Manages both SSE connections and message processing

2. **SSE Session Manager** (`src/utils/sse-session-manager.ts`)
   - Manages active SSE client connections
   - Handles session lifecycle and cleanup
   - Sends events to connected clients

3. **Type Definitions** (`src/types/sse.ts`)
   - TypeScript interfaces for SSE messages
   - MCP protocol message types

## Endpoints

### GET /sse, GET /mcp, and GET /mcp/:path/sse
- **Purpose**: SSE connection endpoint for n8n MCP Server Trigger
- **Authentication**: Multiple methods supported (see Authentication section)
- **Query Parameters** (optional):
  - `workflowId`: n8n workflow ID
  - `executionId`: n8n execution ID
  - `nodeId`: n8n node ID
  - `nodeName`: n8n node name
  - `runId`: n8n run ID
  - `token`: Authentication token (for SSE connections)
- **Headers** (optional):
  - `X-Workflow-ID`: n8n workflow ID
  - `X-Execution-ID`: n8n execution ID
  - `X-Node-ID`: n8n node ID
  - `X-Node-Name`: n8n node name
  - `X-Run-ID`: n8n run ID
- **Response**: Event stream with MCP protocol messages
- **Events**:
  - `connected`: Initial connection confirmation with client ID
  - `mcp-response`: MCP protocol responses
  - `mcp-error`: Error messages
  - `ping`: Keep-alive messages (every 30 seconds)

### POST /mcp/message and POST /mcp/:path/message
- **Purpose**: Receive MCP requests from n8n
- **Authentication**: Multiple methods supported (see Authentication section)
- **Headers**: 
  - `X-Client-ID`: SSE session client ID (required)
- **Request Body**: JSON-RPC 2.0 format
- **Response**: Acknowledgment with message ID

### POST /mcp and POST /mcp/:path (Legacy)
- **Purpose**: Backward compatibility with HTTP POST mode
- **Authentication**: Multiple methods supported (see Authentication section)
- **Request/Response**: Standard JSON-RPC 2.0

### GET /health
- **Purpose**: Health check endpoint
- **Response**: Server status including active SSE sessions

## Protocol Flow

1. **Connection**:
   ```
   n8n → GET /mcp/workflow-123/sse?workflowId=123&nodeId=456 (with auth)
   ← SSE connection established
   ← Event: connected {clientId: "uuid"}
   ← Event: mcp-response {method: "mcp/ready"}
   ```

2. **Tool Discovery**:
   ```
   n8n → POST /mcp/workflow-123/message {method: "tools/list"}
   ← Response: {status: "ok"}
   ← Event: mcp-response {result: {tools: [...]}}
   ```

3. **Tool Execution**:
   ```
   n8n → POST /mcp/workflow-123/message {method: "tools/call", params: {name, arguments}}
   ← Response: {status: "ok"}
   ← Event: mcp-response {result: {content: [...]}}
   ```

4. **Resources and Prompts** (empty implementations):
   ```
   n8n → POST /mcp/message {method: "resources/list"}
   ← Event: mcp-response {result: {resources: []}}
   
   n8n → POST /mcp/message {method: "prompts/list"}
   ← Event: mcp-response {result: {prompts: []}}
   ```

## Configuration

### Environment Variables
- `AUTH_TOKEN` or `AUTH_TOKEN_FILE`: Authentication token (required)
- `AUTH_HEADER_NAME`: Custom authentication header name (default: x-auth-token)
- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: 0.0.0.0)
- `CORS_ORIGIN`: Allowed CORS origin (default: *)
- `TRUST_PROXY`: Number of proxy hops for correct IP logging

## Usage

### Starting the SSE Server

```bash
# Build and start
npm run sse

# Development mode with auto-reload
npm run dev:sse

# With environment variables
AUTH_TOKEN=your-secure-token npm run sse
```

### Testing the Implementation

```bash
# Run SSE tests
npm run test:sse

# Manual test with curl
# 1. Connect to SSE endpoint
curl -N -H "Authorization: Bearer your-token" http://localhost:3000/sse

# 2. Send a message (in another terminal)
curl -X POST http://localhost:3000/mcp/message \
  -H "Authorization: Bearer your-token" \
  -H "X-Client-ID: <client-id-from-sse>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## n8n Configuration

### MCP Client Tool Node

1. **SSE Endpoint**: `http://your-server:3000/mcp/your-path/sse`
2. **Authentication**: Choose from supported methods
3. **Token**: Your AUTH_TOKEN value
4. **Optional Headers**: Add workflow context headers for better tracking

## Security Considerations

### Authentication Methods
The SSE server supports multiple authentication methods:

1. **Bearer Token** (recommended):
   - Header: `Authorization: Bearer <token>`
   
2. **Custom Header**:
   - Header: `X-Auth-Token: <token>` (or custom via AUTH_HEADER_NAME env var)
   
3. **Query Parameter** (for SSE connections):
   - URL: `/sse?token=<token>`
   
4. **API Key Header**:
   - Header: `X-API-Key: <token>`

### Additional Security Features
- **CORS**: Configure CORS_ORIGIN for production deployments
- **HTTPS**: Use reverse proxy with SSL in production
- **Session Timeout**: Sessions expire after 5 minutes of inactivity
- **Workflow Context**: Track requests by workflow/node for auditing

## Performance

- Keep-alive pings every 30 seconds prevent connection timeouts
- Session cleanup runs every 30 seconds
- Supports up to 1000 concurrent SSE connections (configurable)
- Minimal memory footprint per connection
- Enhanced debug logging available with LOG_LEVEL=debug

## Troubleshooting

### Connection Issues
- Check AUTH_TOKEN is set correctly
- Verify firewall allows SSE connections
- Check proxy configuration if behind reverse proxy
- **n8n Connection Failed**: If you see "Could not connect to your MCP server" in n8n logs, this is likely due to gzip compression breaking SSE. The server now explicitly disables compression with `Content-Encoding: identity` header

### Message Delivery
- Ensure X-Client-ID header matches active session
- Check server logs for session expiration
- Verify JSON-RPC format is correct

### Nginx Configuration
If behind Nginx, add these directives:
```nginx
proxy_set_header Connection '';
proxy_http_version 1.1;
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 86400s;
gzip off;  # Important: Disable gzip for SSE endpoints
```

**Note**: n8n has known issues with gzip compression on SSE connections. Always disable compression for SSE endpoints.

## Integration with n8n

The SSE implementation enables n8n workflows to:
1. Receive real-time MCP events
2. Execute long-running tool operations
3. Handle asynchronous responses
4. Support multiple concurrent workflows

This provides a more robust integration compared to simple HTTP polling, especially for:
- Long-running operations
- Real-time notifications
- Event-driven workflows
- Scalable deployments