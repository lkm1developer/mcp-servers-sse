// Utility MCP Server Tools
import { z } from 'zod';

export const toolsDefinitions = [
  {
    name: 'echo',
    title: 'Echo Tool',
    description: 'Echoes back the input message',
    inputSchema: {
      message: z.string().describe('The message to echo back')
    }
  },
  {
    name: 'timestamp',
    title: 'Timestamp Tool', 
    description: 'Returns current timestamp in various formats',
    inputSchema: {
      format: z.enum(['iso', 'unix', 'readable']).describe('The timestamp format to return')
    }
  }
];

export const toolHandlers = {
  'echo': async (args, apiKey, userId) => {
    return {
      content: [
        {
          type: "text",
          text: `Echo: ${args.message}`
        }
      ]
    };
  },

  'timestamp': async (args, apiKey, userId) => {
    const now = new Date();
    let timestamp;
    
    switch (args.format) {
      case 'unix':
        timestamp = Math.floor(now.getTime() / 1000);
        break;
      case 'readable':
        timestamp = now.toLocaleString();
        break;
      case 'iso':
      default:
        timestamp = now.toISOString();
        break;
    }
    
    return {
      content: [
        {
          type: "text",
          text: `Current timestamp (${args.format || 'iso'}): ${timestamp}`
        }
      ]
    };
  }
};