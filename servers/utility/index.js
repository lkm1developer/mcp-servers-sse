// Utility MCP Server Tools

export const toolsDefinitions = [
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
    }
  },
  {
    name: 'timestamp',
    title: 'Timestamp Tool',
    description: 'Returns current timestamp in various formats',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['iso', 'unix', 'readable'],
          description: 'The timestamp format to return',
          default: 'iso'
        }
      }
    }
  }
];

export const toolHandlers = {
  echo: async (args, apiKey, userId) => {
    return {
      content: [
        {
          type: 'text',
          text: `Echo: ${args.message} (API Key: ${apiKey?.substring(0, 10)}..., User: ${userId})`
        }
      ]
    };
  },
  
  timestamp: async (args, apiKey, userId) => {
    const now = new Date();
    let result;
    
    switch (args.format || 'iso') {
      case 'iso':
        result = now.toISOString();
        break;
      case 'unix':
        result = Math.floor(now.getTime() / 1000).toString();
        break;
      case 'readable':
        result = now.toLocaleString();
        break;
      default:
        result = now.toISOString();
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `Current timestamp (${args.format || 'iso'}): ${result}`
        }
      ]
    };
  }
};