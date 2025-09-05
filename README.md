# Multi-MCP Server with SSE Protocol

A scalable Express.js server that hosts multiple MCP (Model Context Protocol) servers with Server-Sent Events (SSE) support, route-based isolation, and JWT authentication.

## Features

- **Route-based MCP server hosting**: Each MCP server runs on its own route (`/mcp/:serverName`)
- **JWT authentication**: Encrypted JWT tokens in headers with server name and API key
- **Server isolation**: If one server crashes, others continue running
- **SSE support**: Full Server-Sent Events support for real-time communication
- **Server management**: REST API for registering, monitoring, and removing servers
- **Session management**: Automatic cleanup of inactive sessions
- **Health monitoring**: Health checks and server status monitoring

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

```bash
export JWT_SECRET="your-super-secret-jwt-key"
export PORT=8080
```

### 3. Start the Server

```bash
npm start
```

Or with auto-reload for development:

```bash
npm run dev
```

### 4. Register Example Servers

```bash
node example-server-config.js --register-examples
```

## API Endpoints

### Health Check
```
GET /health
```

### Server Management
```
GET /servers                    # List all servers
POST /servers/:serverName       # Register a new server
DELETE /servers/:serverName     # Remove a server
```

### MCP Protocol Endpoints
```
POST /:serverName/mcp      # MCP JSON-RPC requests
GET /:serverName/mcp       # SSE stream for server-to-client notifications
DELETE /:serverName/mcp    # Terminate session
```

### Required Headers
```
MCP-Protocol-Version: 2025-06-18    # Current MCP protocol version
Authorization: Bearer <jwt>          # Only for initialize requests
mcp-session-id: <session-id>        # For subsequent requests after initialize
```

## Authentication

All MCP endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt-token>
```

The JWT payload must include:
- `serverName`: Target MCP server name
- `apiKey`: API key for the server
- `userId`: User identifier (optional)

## Server Registration

### Programmatically

```javascript
import { serverManager } from './multi-mcp-server.js';

serverManager.registerServer('my-server', {
  name: 'My MCP Server',
  version: '1.0.0',
  description: 'My custom MCP server',
  tools: [
    {
      name: 'my-tool',
      title: 'My Tool',
      description: 'Does something useful',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string' }
        },
        required: ['input']
      },
      handler: async (args, apiKey, userId) => {
        return {
          content: [
            { type: 'text', text: `Result: ${args.input}` }
          ]
        };
      }
    }
  ]
});
```

### Via REST API

```bash
curl -X POST http://localhost:8080/servers/my-server \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My MCP Server",
    "version": "1.0.0",
    "tools": [...]
  }'
```

## JWT Token Generation

```javascript
import jwt from 'jsonwebtoken';

const token = jwt.sign({
  serverName: 'my-server',
  apiKey: 'my-api-key',
  userId: 'user123'
}, process.env.JWT_SECRET, { expiresIn: '1h' });
```

## Example Usage

### 1. Generate JWT Token
```javascript
import { generateJWTToken } from './example-server-config.js';

const token = generateJWTToken('calculator', 'my-api-key', 'user123');
console.log(`Bearer ${token}`);
```

### 2. Initialize MCP Session
```bash
curl -X POST http://localhost:8080/calculator/mcp \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'
```

### 3. Call a Tool
```bash
curl -X POST http://localhost:8080/calculator/mcp \
  -H "mcp-session-id: <session-id-from-initialize>" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "calculate",
      "arguments": {
        "operation": "add",
        "a": 5,
        "b": 3
      }
    }
  }'
```

### 4. Listen to SSE Stream
```bash
curl -N -H "mcp-session-id: <session-id>" \
     -H "MCP-Protocol-Version: 2025-06-18" \
     "http://localhost:8080/calculator/mcp"
```

## Server Isolation

Each MCP server runs in isolation:
- Separate transport management
- Independent session handling
- Crash isolation (one server crash won't affect others)
- Individual monitoring and health checks

## Monitoring

Check server status:
```bash
curl http://localhost:8080/health
curl http://localhost:8080/servers
```

## Architecture

```
┌─────────────────────────────────────────┐
│              Express Server              │
├─────────────────────────────────────────┤
│          JWT Auth Middleware            │
├─────────────────────────────────────────┤
│          Server Manager                  │
├─────────────────┬───────────────────────┤
│   MCP Server A  │    MCP Server B       │
│   /mcp/serverA  │    /mcp/serverB       │
│   ├─Transport 1 │    ├─Transport 1      │
│   ├─Transport 2 │    ├─Transport 2      │
│   └─Transport N │    └─Transport N      │
└─────────────────┴───────────────────────┘
```

## Error Handling

- JWT validation errors return 401
- Server not found returns 404
- Crashed servers return 503
- Internal errors return 500
- Automatic session cleanup every 5 minutes

## Environment Variables

- `JWT_SECRET`: Secret key for JWT token verification (required)
- `PORT`: Server port (default: 8080)

## License

MIT