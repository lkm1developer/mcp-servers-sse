// File Operations MCP Server Tools

export const toolsDefinitions = [
  {
    name: 'read_file',
    title: 'Read File',
    description: 'Reads content from a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'list_files',
    title: 'List Files',
    description: 'Lists files in a directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the directory to list',
          default: '.'
        }
      }
    }
  }
];

export const toolHandlers = {
  read_file: async (args, apiKey, userId) => {
    const fs = await import('fs/promises');
    
    try {
      const content = await fs.readFile(args.path, 'utf8');
      return {
        content: [
          {
            type: 'text',
            text: `File content (${args.path}):\n${content}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  },
  
  list_files: async (args, apiKey, userId) => {
    const fs = await import('fs/promises');
    
    try {
      const files = await fs.readdir(args.path || '.');
      return {
        content: [
          {
            type: 'text',
            text: `Files in ${args.path || '.'}:\n${files.join('\n')}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }
};