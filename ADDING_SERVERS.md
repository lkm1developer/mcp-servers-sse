# Adding MCP Servers to Multi-MCP System

This guide explains how to add existing MCP servers to our multi-MCP server system.

## 🎯 **Two Ways to Add Servers**

### **Method 1: Simple Format (Recommended for New Servers)**

Create a server with direct exports:

```javascript
// servers/myserver/index.js
export const toolsDefinitions = [
  {
    name: 'my_tool',
    title: 'My Tool',
    description: 'Does something useful',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input parameter' }
      },
      required: ['input']
    }
  }
];

export const toolHandlers = {
  my_tool: async (args, apiKey, userId) => {
    // Use the user's API key to call third-party service
    const result = await myThirdPartyAPI.call(args.input, apiKey);
    
    return {
      content: [
        { type: 'text', text: `Result: ${result}` }
      ]
    };
  }
};
```

### **Method 2: Adapter Pattern (For Existing MCP Servers)**

For existing servers that use the old `Server` class pattern:

1. **Keep the original server file** (don't modify it)
2. **Create an adapter.js**:

```javascript
// servers/myserver/adapter.js
export async function createServerAdapter(serverPath, apiKeyParam) {
  // Extract tool definitions from the original server
  const toolsDefinitions = [
    {
      name: 'existing_tool',
      title: 'Existing Tool',
      description: 'Converted from original server',
      inputSchema: { /* original schema */ }
    }
  ];

  const toolHandlers = {
    existing_tool: async (args, apiKey, userId) => {
      // Use the original server's logic but with our API key pattern
      const OriginalClient = (await import('original-client')).default;
      const client = new OriginalClient({ apiKey });
      
      const result = await client.doSomething(args);
      return {
        content: [{ type: 'text', text: result }]
      };
    }
  };

  return { toolsDefinitions, toolHandlers };
}
```

3. **Create index.js that uses the adapter**:

```javascript
// servers/myserver/index.js
import { createServerAdapter } from './adapter.js';

const { toolsDefinitions, toolHandlers } = await createServerAdapter(__dirname, 'MY_API_KEY');

export { toolsDefinitions, toolHandlers };
```

## 📝 **Configuration Steps**

### 1. Add Server Directory
```bash
mkdir servers/myserver
# Add your server files
```

### 2. Update server.json
```json
{
  "servers": {
    "myserver": {
      "name": "My MCP Server",
      "version": "1.0.0",
      "description": "Description of what this server does",
      "directory": "./servers/myserver",
      "enabled": true,
      "entryFile": "index.js",
      "apiKeyParam": "MY_API_KEY"
    }
  }
}
```

### 3. Install Dependencies
```bash
npm install any-required-packages
```

### 4. Test Server
```bash
npm start
```

Check logs for successful initialization:
```
[MANAGER] Server myserver loaded in standard format
[MANAGER] Server myserver initialized successfully with 3 tools
```

## 🔑 **API Key Handling**

### **JWT Token Structure**
```javascript
{
  "serverName": "myserver",    // Must match server name in config
  "apiKey": "user-api-key",    // User's API key for the third-party service
  "userId": "user123"          // Optional user identifier
}
```

### **Tool Handler Signature**
```javascript
async (args, apiKey, userId) => {
  // args: Tool arguments from client
  // apiKey: User's decrypted API key from JWT
  // userId: Optional user ID for logging/tracking
  
  return {
    content: [
      { type: 'text', text: 'Response text' }
    ]
  };
}
```

## 🌐 **Usage Examples**

### **Client Usage**
```bash
# 1. Generate JWT token
const token = jwt.sign({
  serverName: 'myserver',
  apiKey: 'sk-user-api-key-here',
  userId: 'user123'
}, JWT_SECRET);

# 2. Initialize session
curl -X POST http://localhost:8080/myserver/mcp \
  -H "Authorization: Bearer $token" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}'

# 3. Call tools
curl -X POST http://localhost:8080/myserver/mcp \
  -H "mcp-session-id: session-id-from-step-2" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"my_tool","arguments":{"input":"test"}}}'
```

## 🔧 **Server Types Supported**

### **✅ Supported Patterns**

1. **Direct Export** (New format):
   ```javascript
   export const toolsDefinitions = [...];
   export const toolHandlers = {...};
   ```

2. **Adapter Function** (Legacy conversion):
   ```javascript
   export async function createServerAdapter(serverPath, apiKeyParam) {
     return { toolsDefinitions, toolHandlers };
   }
   ```

### **❌ Not Directly Supported**

1. **Old SDK Server Class** - Needs adapter
2. **StdioServerTransport** - Needs conversion
3. **Different authentication patterns** - Needs wrapper

## 🐛 **Troubleshooting**

### **Server Won't Load**
```bash
# Check logs for specific error
tail -f multi-mcp-debug.log

# Common issues:
# - Missing exports: Must export toolsDefinitions and toolHandlers
# - Wrong file path: Check directory and entryFile in server.json
# - Import errors: Check dependencies in package.json
```

### **Tools Not Working**
```bash
# Check tool handler signature
async (args, apiKey, userId) => { ... }

# Check return format
return {
  content: [{ type: 'text', text: 'result' }]
};

# Check API key usage
if (!apiKey) {
  throw new Error('API key required');
}
```

### **Session Issues**
```bash
# Check JWT token contains serverName matching route
GET /myserver/mcp  # serverName must be 'myserver'

# Check MCP protocol headers
MCP-Protocol-Version: 2025-06-18
mcp-session-id: <session-from-initialize>
```

## 📊 **Server Monitoring**

Check server status:
```bash
# Health check
curl http://localhost:8080/health

# Server details
curl http://localhost:8080/servers
```

Response includes:
- Server status (ready/crashed)
- Active session count
- Last activity timestamp
- Error details (if crashed)

## 🎉 **Examples in Repository**

1. **utility** - Echo and timestamp tools (direct export)  
2. **tavily** - AI-powered search/extract/crawl/map (adapter pattern)
3. **firecrawl** - Web scraping service (adapter pattern)

Study these examples for implementation patterns!