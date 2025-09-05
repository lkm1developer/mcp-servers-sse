// Calculator MCP Server Tools

export const toolsDefinitions = [
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
    }
  }
];

export const toolHandlers = {
  calculate: async (args, apiKey, userId) => {
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
};