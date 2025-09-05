// Adapter to convert Tavily MCP Server to our format
import axios from 'axios';
import { z } from 'zod';

/**
 * Extract tools from Tavily MCP server and create handlers for our multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'TAVILY_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'tavily-search',
      title: 'Tavily Search',
      description: 'A powerful web search tool that provides comprehensive, real-time results using Tavily\'s AI search engine',
      inputSchema: {
        query: z.string().describe('Search query')
      }
    }
  ];

  const toolHandlers = {
    'tavily-search': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Tavily API key is required');
      }

      try {
        const response = await axios.post('https://api.tavily.com/search', {
          api_key: apiKey,
          query: args.query,
          search_depth: 'basic',
          topic: 'general',
          max_results: 10,
          include_images: false,
          include_raw_content: false,
          include_domains: [],
          exclude_domains: []
        });

        return {
          content: [
            {
              type: "text",
              text: `Search Results for: "${args.query}"\n\n${response.data.results?.map((result, index) => 
                `${index + 1}. **${result.title}**\n   ${result.url}\n   ${result.content}\n`
              ).join('\n') || 'No results found'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Tavily search failed: ${error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}