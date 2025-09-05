// Adapter to convert Tavily MCP Server to our format
import axios from 'axios';

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
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          search_depth: {
            type: 'string',
            enum: ['basic', 'advanced'],
            description: 'The depth of the search. It can be \'basic\' or \'advanced\'',
            default: 'basic'
          },
          topic: {
            type: 'string',
            enum: ['general', 'news'],
            description: 'The category of the search. This will determine which of our agents will be used for the search',
            default: 'general'
          },
          max_results: {
            type: 'number',
            description: 'The maximum number of search results to return',
            default: 10,
            minimum: 5,
            maximum: 20
          },
          include_images: {
            type: 'boolean',
            description: 'Include a list of query-related images in the response',
            default: false
          },
          include_raw_content: {
            type: 'boolean',
            description: 'Include the cleaned and parsed HTML content of each search result',
            default: false
          },
          include_domains: {
            type: 'array',
            items: { type: 'string' },
            description: 'A list of domains to specifically include in the search results',
            default: []
          },
          exclude_domains: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of domains to specifically exclude',
            default: []
          },
          country: {
            type: 'string',
            description: 'Boost search results from a specific country',
            default: ''
          },
          time_range: {
            type: 'string',
            description: 'The time range back from the current date to include in the search results',
            enum: ['day', 'week', 'month', 'year', 'd', 'w', 'm', 'y']
          }
        },
        required: ['query']
      }
    },
    {
      name: 'tavily-extract',
      title: 'Tavily Extract',
      description: 'A powerful web content extraction tool that retrieves and processes raw content from specified URLs',
      inputSchema: {
        type: 'object',
        properties: {
          urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of URLs to extract content from'
          },
          extract_depth: {
            type: 'string',
            enum: ['basic', 'advanced'],
            description: 'Depth of extraction - \'basic\' or \'advanced\'',
            default: 'basic'
          },
          include_images: {
            type: 'boolean',
            description: 'Include a list of images extracted from the urls in the response',
            default: false
          },
          format: {
            type: 'string',
            enum: ['markdown', 'text'],
            description: 'The format of the extracted web page content',
            default: 'markdown'
          }
        },
        required: ['urls']
      }
    },
    {
      name: 'tavily-crawl',
      title: 'Tavily Crawl',
      description: 'A powerful web crawler that initiates a structured web crawl starting from a specified base URL',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The root URL to begin the crawl'
          },
          max_depth: {
            type: 'integer',
            description: 'Max depth of the crawl. Defines how far from the base URL the crawler can explore.',
            default: 1,
            minimum: 1
          },
          max_breadth: {
            type: 'integer',
            description: 'Max number of links to follow per level of the tree',
            default: 20,
            minimum: 1
          },
          limit: {
            type: 'integer',
            description: 'Total number of links the crawler will process before stopping',
            default: 50,
            minimum: 1
          },
          instructions: {
            type: 'string',
            description: 'Natural language instructions for the crawler'
          },
          allow_external: {
            type: 'boolean',
            description: 'Whether to allow following links that go to external domains',
            default: false
          },
          extract_depth: {
            type: 'string',
            enum: ['basic', 'advanced'],
            description: 'Advanced extraction retrieves more data',
            default: 'basic'
          },
          format: {
            type: 'string',
            enum: ['markdown', 'text'],
            description: 'The format of the extracted web page content',
            default: 'markdown'
          }
        },
        required: ['url']
      }
    },
    {
      name: 'tavily-map',
      title: 'Tavily Map',
      description: 'A powerful web mapping tool that creates a structured map of website URLs',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The root URL to begin the mapping'
          },
          max_depth: {
            type: 'integer',
            description: 'Max depth of the mapping',
            default: 1,
            minimum: 1
          },
          max_breadth: {
            type: 'integer',
            description: 'Max number of links to follow per level',
            default: 20,
            minimum: 1
          },
          limit: {
            type: 'integer',
            description: 'Total number of links the crawler will process',
            default: 50,
            minimum: 1
          },
          instructions: {
            type: 'string',
            description: 'Natural language instructions for the crawler'
          },
          allow_external: {
            type: 'boolean',
            description: 'Whether to allow following links to external domains',
            default: false
          }
        },
        required: ['url']
      }
    }
  ];

  // Base URLs for Tavily API
  const baseURLs = {
    search: 'https://api.tavily.com/search',
    extract: 'https://api.tavily.com/extract',
    crawl: 'https://api.tavily.com/crawl',
    map: 'https://api.tavily.com/map'
  };

  // Helper function to format search results
  function formatResults(response) {
    const output = [];
    
    if (response.answer) {
      output.push(`Answer: ${response.answer}`);
    }
    
    output.push('Detailed Results:');
    response.results.forEach(result => {
      output.push(`\nTitle: ${result.title}`);
      output.push(`URL: ${result.url}`);
      output.push(`Content: ${result.content}`);
      if (result.raw_content) {
        output.push(`Raw Content: ${result.raw_content}`);
      }
      if (result.favicon) {
        output.push(`Favicon: ${result.favicon}`);
      }
    });
    
    if (response.images && response.images.length > 0) {
      output.push('\nImages:');
      response.images.forEach((image, index) => {
        if (typeof image === 'string') {
          output.push(`\n[${index + 1}] URL: ${image}`);
        } else {
          output.push(`\n[${index + 1}] URL: ${image.url}`);
          if (image.description) {
            output.push(`   Description: ${image.description}`);
          }
        }
      });
    }
    
    return output.join('\n');
  }

  // Helper function to format crawl results
  function formatCrawlResults(response) {
    const output = [];
    output.push(`Crawl Results:`);
    output.push(`Base URL: ${response.base_url}`);
    output.push('\nCrawled Pages:');
    response.results.forEach((page, index) => {
      output.push(`\n[${index + 1}] URL: ${page.url}`);
      if (page.raw_content) {
        const contentPreview = page.raw_content.length > 200
          ? page.raw_content.substring(0, 200) + "..."
          : page.raw_content;
        output.push(`Content: ${contentPreview}`);
      }
      if (page.favicon) {
        output.push(`Favicon: ${page.favicon}`);
      }
    });
    return output.join('\n');
  }

  // Helper function to format map results
  function formatMapResults(response) {
    const output = [];
    output.push(`Site Map Results:`);
    output.push(`Base URL: ${response.base_url}`);
    output.push('\nMapped Pages:');
    response.results.forEach((page, index) => {
      output.push(`\n[${index + 1}] URL: ${page}`);
    });
    return output.join('\n');
  }

  const toolHandlers = {
    'tavily-search': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Tavily API key is required');
      }

      try {
        const axiosInstance = axios.create({
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'X-Client-Source': 'MCP'
          }
        });

        // If country is set, ensure topic is general
        if (args.country) {
          args.topic = 'general';
        }

        const searchParams = {
          query: args.query,
          search_depth: args.search_depth || 'basic',
          topic: args.topic || 'general',
          max_results: args.max_results || 10,
          include_images: args.include_images || false,
          include_raw_content: args.include_raw_content || false,
          include_domains: Array.isArray(args.include_domains) ? args.include_domains : [],
          exclude_domains: Array.isArray(args.exclude_domains) ? args.exclude_domains : [],
          country: args.country || '',
          time_range: args.time_range,
          api_key: apiKey
        };

        const response = await axiosInstance.post(baseURLs.search, searchParams);

        return {
          content: [
            { type: 'text', text: formatResults(response.data) }
          ]
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 401) {
            throw new Error('Invalid Tavily API key');
          } else if (error.response?.status === 429) {
            throw new Error('Tavily usage limit exceeded');
          }
          throw new Error(`Tavily API error: ${error.response?.data?.message ?? error.message}`);
        }
        throw new Error(`Tavily search failed: ${error.message}`);
      }
    },

    'tavily-extract': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Tavily API key is required');
      }

      try {
        const axiosInstance = axios.create({
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'X-Client-Source': 'MCP'
          }
        });

        const extractParams = {
          urls: args.urls,
          extract_depth: args.extract_depth || 'basic',
          include_images: args.include_images || false,
          format: args.format || 'markdown',
          api_key: apiKey
        };

        const response = await axiosInstance.post(baseURLs.extract, extractParams);

        return {
          content: [
            { type: 'text', text: formatResults(response.data) }
          ]
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 401) {
            throw new Error('Invalid Tavily API key');
          } else if (error.response?.status === 429) {
            throw new Error('Tavily usage limit exceeded');
          }
          throw new Error(`Tavily API error: ${error.response?.data?.message ?? error.message}`);
        }
        throw new Error(`Tavily extract failed: ${error.message}`);
      }
    },

    'tavily-crawl': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Tavily API key is required');
      }

      try {
        const axiosInstance = axios.create({
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'X-Client-Source': 'MCP'
          }
        });

        const crawlParams = {
          url: args.url,
          max_depth: args.max_depth || 1,
          max_breadth: args.max_breadth || 20,
          limit: args.limit || 50,
          instructions: args.instructions,
          allow_external: args.allow_external || false,
          extract_depth: args.extract_depth || 'basic',
          format: args.format || 'markdown',
          api_key: apiKey
        };

        const response = await axiosInstance.post(baseURLs.crawl, crawlParams);

        return {
          content: [
            { type: 'text', text: formatCrawlResults(response.data) }
          ]
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 401) {
            throw new Error('Invalid Tavily API key');
          } else if (error.response?.status === 429) {
            throw new Error('Tavily usage limit exceeded');
          }
          throw new Error(`Tavily API error: ${error.response?.data?.message ?? error.message}`);
        }
        throw new Error(`Tavily crawl failed: ${error.message}`);
      }
    },

    'tavily-map': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Tavily API key is required');
      }

      try {
        const axiosInstance = axios.create({
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'X-Client-Source': 'MCP'
          }
        });

        const mapParams = {
          url: args.url,
          max_depth: args.max_depth || 1,
          max_breadth: args.max_breadth || 20,
          limit: args.limit || 50,
          instructions: args.instructions,
          allow_external: args.allow_external || false,
          api_key: apiKey
        };

        const response = await axiosInstance.post(baseURLs.map, mapParams);

        return {
          content: [
            { type: 'text', text: formatMapResults(response.data) }
          ]
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 401) {
            throw new Error('Invalid Tavily API key');
          } else if (error.response?.status === 429) {
            throw new Error('Tavily usage limit exceeded');
          }
          throw new Error(`Tavily API error: ${error.response?.data?.message ?? error.message}`);
        }
        throw new Error(`Tavily map failed: ${error.message}`);
      }
    }
  };

  return { toolsDefinitions, toolHandlers };
}