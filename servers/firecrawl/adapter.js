// Adapter to convert legacy MCP Server to our format
import { readFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import path from 'path';

/**
 * Extract tools from a legacy MCP server that uses Server class
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'FIRECRAWL_API_KEY') {
  // Since the original server uses process.env and Server class,
  // we need to extract just the tool definitions and create handlers
  
  const toolsDefinitions = [
    {
      name: 'firecrawl_scrape',
      title: 'Scrape Webpage',
      description: 'Scrape a single webpage with advanced options for content extraction',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to scrape' },
          formats: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['markdown', 'html', 'rawHtml', 'screenshot', 'links', 'screenshot@fullPage', 'extract']
            },
            description: "Content formats to extract (default: ['markdown'])"
          },
          onlyMainContent: { type: 'boolean', description: 'Extract only the main content' },
          includeTags: { type: 'array', items: { type: 'string' }, description: 'HTML tags to include' },
          excludeTags: { type: 'array', items: { type: 'string' }, description: 'HTML tags to exclude' },
          waitFor: { type: 'number', description: 'Time in milliseconds to wait for dynamic content' },
          timeout: { type: 'number', description: 'Maximum time to wait for page load' },
          mobile: { type: 'boolean', description: 'Use mobile viewport' },
          skipTlsVerification: { type: 'boolean', description: 'Skip TLS certificate verification' },
          removeBase64Images: { type: 'boolean', description: 'Remove base64 encoded images' }
        },
        required: ['url']
      }
    },
    {
      name: 'firecrawl_search',
      title: 'Search Web',
      description: 'Search and retrieve content from web pages',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query string' },
          limit: { type: 'number', description: 'Maximum number of results (default: 5)' },
          lang: { type: 'string', description: 'Language code (default: en)' },
          country: { type: 'string', description: 'Country code (default: us)' },
          scrapeOptions: {
            type: 'object',
            properties: {
              formats: {
                type: 'array',
                items: { type: 'string', enum: ['markdown', 'html', 'rawHtml'] }
              },
              onlyMainContent: { type: 'boolean' },
              waitFor: { type: 'number' }
            }
          }
        },
        required: ['query']
      }
    },
    {
      name: 'firecrawl_map',
      title: 'Map Website URLs',
      description: 'Discover URLs from a starting point using sitemap and HTML links',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Starting URL for discovery' },
          search: { type: 'string', description: 'Optional search term to filter URLs' },
          ignoreSitemap: { type: 'boolean', description: 'Skip sitemap.xml discovery' },
          sitemapOnly: { type: 'boolean', description: 'Only use sitemap.xml' },
          includeSubdomains: { type: 'boolean', description: 'Include subdomains' },
          limit: { type: 'number', description: 'Maximum number of URLs to return' }
        },
        required: ['url']
      }
    },
    {
      name: 'firecrawl_crawl',
      title: 'Crawl Website',
      description: 'Start an asynchronous crawl of multiple pages',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Starting URL for the crawl' },
          excludePaths: { type: 'array', items: { type: 'string' }, description: 'URL paths to exclude' },
          includePaths: { type: 'array', items: { type: 'string' }, description: 'Only crawl these paths' },
          maxDepth: { type: 'number', description: 'Maximum link depth' },
          limit: { type: 'number', description: 'Maximum number of pages' },
          ignoreSitemap: { type: 'boolean', description: 'Skip sitemap.xml' },
          allowBackwardLinks: { type: 'boolean', description: 'Allow parent directory links' },
          allowExternalLinks: { type: 'boolean', description: 'Allow external domain links' }
        },
        required: ['url']
      }
    }
  ];

  const toolHandlers = {
    firecrawl_scrape: async (args, apiKey, userId) => {
      const FirecrawlApp = (await import('@mendable/firecrawl-js')).default;
      
      if (!apiKey) {
        throw new Error('Firecrawl API key is required');
      }

      const client = new FirecrawlApp({ apiKey });
      const { url, ...options } = args;

      try {
        const response = await client.scrapeUrl(url, options);
        
        if ('success' in response && !response.success) {
          throw new Error(response.error || 'Scraping failed');
        }

        const content = 'markdown' in response 
          ? response.markdown || response.html || response.rawHtml
          : null;

        return {
          content: [
            { type: 'text', text: content || 'No content available' }
          ]
        };
      } catch (error) {
        throw new Error(`Firecrawl scrape failed: ${error.message}`);
      }
    },

    firecrawl_search: async (args, apiKey, userId) => {
      const FirecrawlApp = (await import('@mendable/firecrawl-js')).default;
      
      if (!apiKey) {
        throw new Error('Firecrawl API key is required');
      }

      const client = new FirecrawlApp({ apiKey });

      try {
        const response = await client.search(args.query, args);
        
        if (!response.success) {
          throw new Error(`Search failed: ${response.error || 'Unknown error'}`);
        }

        const results = response.data
          .map((result) => `URL: ${result.url}
Title: ${result.title || 'No title'}
Description: ${result.description || 'No description'}
${result.markdown ? `\nContent:\n${result.markdown}` : ''}`)
          .join('\n\n');

        return {
          content: [{ type: 'text', text: results }]
        };
      } catch (error) {
        throw new Error(`Firecrawl search failed: ${error.message}`);
      }
    },

    firecrawl_map: async (args, apiKey, userId) => {
      const FirecrawlApp = (await import('@mendable/firecrawl-js')).default;
      
      if (!apiKey) {
        throw new Error('Firecrawl API key is required');
      }

      const client = new FirecrawlApp({ apiKey });
      const { url, ...options } = args;

      try {
        const response = await client.mapUrl(url, options);
        
        if ('error' in response) {
          throw new Error(response.error);
        }

        if (!response.links) {
          throw new Error('No links received from FireCrawl API');
        }

        return {
          content: [{ type: 'text', text: response.links.join('\n') }]
        };
      } catch (error) {
        throw new Error(`Firecrawl map failed: ${error.message}`);
      }
    },

    firecrawl_crawl: async (args, apiKey, userId) => {
      const FirecrawlApp = (await import('@mendable/firecrawl-js')).default;
      
      if (!apiKey) {
        throw new Error('Firecrawl API key is required');
      }

      const client = new FirecrawlApp({ apiKey });
      const { url, ...options } = args;

      try {
        const response = await client.asyncCrawlUrl(url, options);
        
        if (!response.success) {
          throw new Error(response.error);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Started crawl for ${url} with job ID: ${response.id}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Firecrawl crawl failed: ${error.message}`);
      }
    }
  };

  return { toolsDefinitions, toolHandlers };
}