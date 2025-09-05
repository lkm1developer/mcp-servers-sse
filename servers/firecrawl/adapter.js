// Adapter to convert Firecrawl MCP Server to our format
import FirecrawlApp from '@mendable/firecrawl-js';
import { z } from 'zod';

/**
 * Extract tools from Firecrawl MCP server and create handlers for our multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'FIRECRAWL_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'firecrawl-scrape',
      title: 'Firecrawl Scrape',
      description: 'Scrape a single URL and get clean, structured data',
      inputSchema: {
        url: z.string().describe('The URL to scrape'),
        formats: z.array(z.enum(['markdown', 'html', 'rawHtml', 'links', 'screenshot'])).describe('The formats to return')
      }
    },
    {
      name: 'firecrawl-crawl',
      title: 'Firecrawl Crawl',
      description: 'Crawl a website starting from a base URL',
      inputSchema: {
        url: z.string().describe('The base URL to start crawling from'),
        limit: z.number().describe('Maximum number of pages to crawl'),
        formats: z.array(z.enum(['markdown', 'html', 'rawHtml', 'links'])).describe('The formats to return')
      }
    },
    {
      name: 'firecrawl-map',
      title: 'Firecrawl Map',
      description: 'Map all URLs on a website to understand its structure',
      inputSchema: {
        url: z.string().describe('The website URL to map'),
        limit: z.number().describe('Maximum number of URLs to map')
      }
    },
    {
      name: 'firecrawl-search',
      title: 'Firecrawl Search',
      description: 'Search for specific content across crawled pages',
      inputSchema: {
        query: z.string().describe('Search query to look for in crawled content'),
        url: z.string().describe('The base URL to search within'),
        limit: z.number().describe('Maximum number of results to return')
      }
    }
  ];

  const toolHandlers = {
    'firecrawl-scrape': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Firecrawl API key is required');
      }

      try {
        const app = new FirecrawlApp({ apiKey });
        
        const scrapeOptions = {
          formats: args.formats || ['markdown'],
        };

        const result = await app.scrapeUrl(args.url, scrapeOptions);

        return {
          content: [
            {
              type: "text",
              text: `Scraped content from ${args.url}:\n\n${result.markdown || result.html || result.text || 'No content found'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Firecrawl scrape failed: ${error.message}`);
      }
    },

    'firecrawl-crawl': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Firecrawl API key is required');
      }

      try {
        const app = new FirecrawlApp({ apiKey });
        
        const crawlOptions = {
          limit: args.limit || 50,
          formats: args.formats || ['markdown']
        };

        const result = await app.crawlUrl(args.url, crawlOptions);

        return {
          content: [
            {
              type: "text",
              text: `Crawled ${result.data?.length || 0} pages from ${args.url}:\n\n${result.data?.map((page, index) => 
                `${index + 1}. **${page.metadata?.title || 'Untitled'}**\n   URL: ${page.metadata?.sourceURL || 'Unknown'}\n   Content: ${(page.markdown || page.html || page.text || '').substring(0, 200)}...\n`
              ).join('\n') || 'No pages found'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Firecrawl crawl failed: ${error.message}`);
      }
    },

    'firecrawl-map': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Firecrawl API key is required');
      }

      try {
        const app = new FirecrawlApp({ apiKey });
        
        const mapOptions = {
          limit: args.limit || 500
        };

        const result = await app.mapUrl(args.url, mapOptions);

        return {
          content: [
            {
              type: "text",
              text: `Website map for ${args.url}:\n\n${result.links?.map((link, index) => 
                `${index + 1}. ${link}`
              ).join('\n') || 'No URLs found'}\n\nTotal URLs mapped: ${result.links?.length || 0}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Firecrawl map failed: ${error.message}`);
      }
    },

    'firecrawl-search': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Firecrawl API key is required');
      }

      try {
        const app = new FirecrawlApp({ apiKey });
        
        const searchOptions = {
          limit: args.limit || 10
        };

        const result = await app.search(args.query, searchOptions);

        return {
          content: [
            {
              type: "text", 
              text: `Search results for "${args.query}":\n\n${result.data?.map((item, index) => 
                `${index + 1}. **${item.metadata?.title || 'Untitled'}**\n   URL: ${item.metadata?.sourceURL || 'Unknown'}\n   Content: ${(item.markdown || item.html || item.text || '').substring(0, 300)}...\n`
              ).join('\n') || 'No results found'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Firecrawl search failed: ${error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}