#!/usr/bin/env node

import { serverManager } from './multi-mcp-server.js';
import jwt from 'jsonwebtoken';

// Example tool handlers
const exampleTools = [
  {
    name: 'echo',
    title: 'Echo Tool',
    description: 'Echoes back the input message',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to echo back'
        }
      },
      required: ['message']
    },
    handler: async (args, apiKey, userId) => {
      return {
        content: [
          {
            type: 'text',
            text: `Echo: ${args.message} (API Key: ${apiKey?.substring(0, 10)}..., User: ${userId})`
          }
        ]
      };
    }
  },
  {
    name: 'calculate',
    title: 'Calculator',
    description: 'Performs basic arithmetic operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
          description: 'The arithmetic operation to perform'
        },
        a: {
          type: 'number',
          description: 'First number'
        },
        b: {
          type: 'number',
          description: 'Second number'
        }
      },
      required: ['operation', 'a', 'b']
    },
    handler: async (args, apiKey, userId) => {
      const { operation, a, b } = args;
      let result;
      
      switch (operation) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          if (b === 0) throw new Error('Division by zero is not allowed');
          result = a / b;
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `${a} ${operation} ${b} = ${result}`
          }
        ]
      };
    }
  }
];

// Example function to register servers programmatically
export function registerExampleServers() {
  try {
    // Register calculator server
    serverManager.registerServer('calculator', {
      name: 'Calculator MCP Server',
      version: '1.0.0',
      description: 'A server that provides calculator functionality',
      tools: [exampleTools[1]] // Just the calculator tool
    });

    // Register utility server
    serverManager.registerServer('utility', {
      name: 'Utility MCP Server',
      version: '1.0.0',
      description: 'A server that provides utility functions',
      tools: exampleTools // All tools
    });

    console.log('✅ Example servers registered successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Error registering example servers:', error.message);
    return false;
  }
}

// Example JWT token generation
export function generateJWTToken(serverName, apiKey, userId = 'user123', expiresIn = '1h') {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  
  const payload = {
    serverName,
    apiKey,
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (expiresIn === '1h' ? 3600 : 300)
  };
  
  return jwt.sign(payload, JWT_SECRET);
}

// Example usage
if (process.argv.includes('--register-examples')) {
  // Wait a moment for the main server to initialize
  setTimeout(() => {
    registerExampleServers();
    
    // Generate example tokens
    const calculatorToken = generateJWTToken('calculator', 'calc-api-key-123', 'user456');
    const utilityToken = generateJWTToken('utility', 'util-api-key-789', 'user789');
    
    console.log('\n📋 Example JWT Tokens:');
    console.log('\n🔢 Calculator Server Token:');
    console.log(`Bearer ${calculatorToken}`);
    
    console.log('\n🛠️ Utility Server Token:');
    console.log(`Bearer ${utilityToken}`);
    
    console.log('\n📖 Usage Examples:');
    console.log('POST http://localhost:8080/mcp/calculator');
    console.log('Headers: Authorization: Bearer <calculator-token>, mcp-session-id: <optional>');
    console.log('Body: {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {...}}');
    
    console.log('\nGET http://localhost:8080/mcp/calculator');
    console.log('Headers: Authorization: Bearer <calculator-token>, mcp-session-id: <session-id>');
    
  }, 1000);
}