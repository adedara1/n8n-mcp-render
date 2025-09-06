#!/bin/bash

# Test script for SSE server
# Usage: ./scripts/test-sse.sh

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
AUTH_TOKEN="${AUTH_TOKEN:-test-secure-token-123456789}"

echo "🧪 Testing SSE Server Implementation"
echo "Server URL: $SERVER_URL"
echo "Auth Token: ${AUTH_TOKEN:0:8}..."
echo ""

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local headers=$4
    
    echo -n "Testing $method $endpoint... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$SERVER_URL$endpoint" $headers)
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL$endpoint" \
            -H "Content-Type: application/json" \
            $headers \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        echo "✅ OK ($http_code)"
        if [ -n "$body" ]; then
            echo "  Response: $(echo "$body" | jq -c . 2>/dev/null || echo "$body")"
        fi
    else
        echo "❌ FAILED ($http_code)"
        if [ -n "$body" ]; then
            echo "  Error: $body"
        fi
    fi
    echo ""
}

# Test health check
test_endpoint "GET" "/health" "" ""

# Test SSE connection (limited test with curl)
echo -n "Testing SSE connection... "
timeout 2 curl -s -N -H "Authorization: Bearer $AUTH_TOKEN" "$SERVER_URL/sse" > /tmp/sse-test.log 2>&1 &
SSE_PID=$!
sleep 1

if kill -0 $SSE_PID 2>/dev/null; then
    echo "✅ Connection established"
    kill $SSE_PID 2>/dev/null
    if [ -s /tmp/sse-test.log ]; then
        echo "  Initial events:"
        cat /tmp/sse-test.log | head -5
    fi
else
    echo "❌ Connection failed"
fi
echo ""

# Test legacy MCP endpoint
test_endpoint "POST" "/mcp" '{"jsonrpc":"2.0","method":"tools/list","id":1}' "-H 'Authorization: Bearer $AUTH_TOKEN'"

# Test invalid auth
echo -n "Testing authentication rejection... "
response=$(curl -s -w "\n%{http_code}" -X GET "$SERVER_URL/sse" -H "Authorization: Bearer invalid-token")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "401" ]; then
    echo "✅ Correctly rejected ($http_code)"
else
    echo "❌ Expected 401, got $http_code"
fi

# Summary
echo ""
echo "📊 Test Summary:"
echo "SSE server endpoint: $SERVER_URL/sse"
echo "Message endpoint: $SERVER_URL/mcp/message"
echo "Legacy endpoint: $SERVER_URL/mcp"

# Instructions for manual testing
echo ""
echo "📝 Manual Testing Instructions:"
echo ""
echo "1. Connect to SSE stream:"
echo "   curl -N -H \"Authorization: Bearer $AUTH_TOKEN\" $SERVER_URL/sse"
echo ""
echo "2. In another terminal, get the client ID from the connected event and send a message:"
echo "   curl -X POST $SERVER_URL/mcp/message \\"
echo "     -H \"Authorization: Bearer $AUTH_TOKEN\" \\"
echo "     -H \"X-Client-ID: <client-id-from-sse>\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/list\",\"id\":1}'"
echo ""
echo "3. You should see the response in the SSE stream"