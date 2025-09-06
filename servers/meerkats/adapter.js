// Meerkats MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';
import * as dns from 'dns';
import { promisify } from 'util';

/**
 * Meerkats MCP Server adapter for multi-MCP system
 * Provides web scraping, email verification, Google services, and domain utilities
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'MEERKATS_API_KEY') {
  
  // External service configuration
  const EMAIL_SERVICE_URL = 'http://34.46.80.154/api/email';
  const EMAIL_API_KEY = 'jhfgkjghtucvfg';
  
  // Promisify DNS functions
  const resolveMx = promisify(dns.resolveMx);
  
  const toolsDefinitions = [
    {
      name: "meerkats-scrape-url",
      title: "Meerkats Scrape URL",
      description: "Scrape a URL and return the content as markdown or HTML",
      inputSchema: {
        url: z.string().describe("URL to scrape"),
        formats: z.array(z.enum(["markdown", "html"])).optional().describe("Content formats to extract (default: ['markdown'])"),
        onlyMainContent: z.boolean().optional().describe("Extract only the main content, filtering out navigation, footers, etc."),
        includeTags: z.array(z.string()).optional().describe("HTML tags to specifically include in extraction"),
        excludeTags: z.array(z.string()).optional().describe("HTML tags to exclude from extraction"),
        waitFor: z.number().optional().describe("Time in milliseconds to wait for dynamic content to load"),
        timeout: z.number().optional().describe("Maximum time in milliseconds to wait for the page to load")
      }
    },
    {
      name: "meerkats-web-search",
      title: "Meerkats Web Search",
      description: "Search the web and return results",
      inputSchema: {
        query: z.string().describe("Query to search for on the web")
      }
    },
    {
      name: "meerkats-verify-email",
      title: "Meerkats Verify Email",
      description: "Verify if an email address is valid and active using SMTP verification",
      inputSchema: {
        email: z.string().describe("Email address to verify"),
        fromEmail: z.string().optional().describe("Email address to use as the sender in SMTP verification")
      }
    },
    {
      name: "meerkats-guess-email",
      title: "Meerkats Guess Email",
      description: "Guess email addresses based on name and domain using common email patterns",
      inputSchema: {
        firstName: z.string().describe("First name of the person"),
        lastName: z.string().describe("Last name of the person"),
        domain: z.string().describe("Company domain name"),
        fromEmail: z.string().optional().describe("Email address to use as the sender in SMTP verification"),
        company: z.string().optional().describe("Company name (optional)")
      }
    },
    {
      name: "meerkats-generate-support-emails",
      title: "Meerkats Generate Support Emails",
      description: "Generate and verify group support email addresses for a domain",
      inputSchema: {
        domain: z.string().describe("Domain to generate support emails for"),
        emails: z.string().optional().describe("List of email prefixes to check, separated by commas"),
        fromEmail: z.string().optional().describe("Email address to use as the sender in SMTP verification")
      }
    },
    {
      name: "meerkats-check-domain-catch-all",
      title: "Meerkats Check Domain Catch-All",
      description: "Check if a domain has a catch-all email address",
      inputSchema: {
        domain: z.string().describe("Domain to check for catch-all")
      }
    },
    {
      name: "meerkats-get-mx-for-domain",
      title: "Meerkats Get MX Records",
      description: "Get MX records for a domain",
      inputSchema: {
        domain: z.string().describe("Domain to get MX records for")
      }
    },
    {
      name: "meerkats-google-serp",
      title: "Meerkats Google Search Results",
      description: "Get Google search results for a query with page limit",
      inputSchema: {
        query: z.string().describe("Search query"),
        limit: z.number().optional().describe("Maximum number of results to return (default: 10)")
      }
    },
    {
      name: "meerkats-google-map",
      title: "Meerkats Google Maps Search",
      description: "Get Google Maps data for a location query, optionally at specific coordinates",
      inputSchema: {
        query: z.string().describe("Location search query"),
        location: z.string().optional().describe("Optional location parameter. If in 'latitude,longitude' format, will search at those coordinates"),
        limit: z.number().optional().describe("Maximum number of results to return (default: 10)")
      }
    },
    {
      name: "meerkats-google-places",
      title: "Meerkats Google Places",
      description: "Get Google Maps Places API data for a search query",
      inputSchema: {
        query: z.string().describe("Search query for places")
      }
    }
  ];

  const toolHandlers = {
    'meerkats-scrape-url': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        // Use a simple scraping approach with axios
        const response = await axios.get(args.url, {
          timeout: args.timeout || 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        let content = response.data;
        
        // Basic HTML to markdown conversion (simplified)
        if (args.formats && args.formats.includes('markdown')) {
          content = content
            .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '# $1\\n\\n')
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\\n\\n')
            .replace(/<br[^>]*>/gi, '\\n')
            .replace(/<[^>]+>/g, '') // Remove all HTML tags
            .replace(/\\n\\s*\\n/g, '\\n\\n'); // Clean up multiple newlines
        }

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats URL Scraping Results:**\\n\\n**URL:** ${args.url}\\n**Status:** Success\\n**Content Length:** ${content.length} characters\\n\\n**Content:**\\n${content.substring(0, 2000)}${content.length > 2000 ? '...\\n\\n(Content truncated)' : ''}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats URL scraping failed: ${error.message}`);
      }
    },

    'meerkats-web-search': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        // Use a basic web search with Google (you can integrate with other APIs as needed)
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(args.query)}`;
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 15000
        });

        // Basic extraction of search results from HTML
        let content = response.data;
        const results = [];
        
        // Simple regex to extract basic search result information
        const titleRegex = /<h3[^>]*>(.*?)<\/h3>/gi;
        let match;
        let count = 0;
        
        while ((match = titleRegex.exec(content)) && count < 10) {
          const title = match[1].replace(/<[^>]+>/g, '').trim();
          if (title && title.length > 10) {
            results.push(`${count + 1}. ${title}`);
            count++;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Web Search Results:**\\n\\n**Query:** ${args.query}\\n**Results Found:** ${results.length}\\n\\n**Search Results:**\\n${results.join('\\n') || 'No results found'}\\n\\n**Note:** This is a basic web search implementation. For better results, consider integrating with Google Custom Search API or similar services.`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats web search failed: ${error.message}`);
      }
    },

    'meerkats-verify-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        const response = await axios.post(`${EMAIL_SERVICE_URL}/verify`, {
          email: args.email,
          fromEmail: args.fromEmail || "test@example.com"
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': EMAIL_API_KEY
          },
          timeout: 15000
        });

        const result = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Email Verification Results:**\\n\\n**Email:** ${args.email}\\n**Valid:** ${result.exists ? 'Yes' : 'No'}\\n**Verification Method:** SMTP\\n**From Email:** ${args.fromEmail || 'test@example.com'}\\n\\n**Details:**\\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats email verification failed: ${error.message}`);
      }
    },

    'meerkats-guess-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        const response = await axios.post(`${EMAIL_SERVICE_URL}/guess`, {
          firstName: args.firstName,
          lastName: args.lastName,
          domain: args.domain,
          company: args.company
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': EMAIL_API_KEY
          },
          timeout: 15000
        });

        const result = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Email Guessing Results:**\\n\\n**Name:** ${args.firstName} ${args.lastName}\\n**Domain:** ${args.domain}\\n**Company:** ${args.company || 'N/A'}\\n\\n**Generated Email Patterns:**\\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats email guessing failed: ${error.message}`);
      }
    },

    'meerkats-generate-support-emails': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        // Generate support email list
        let emails = args.emails ? args.emails.split(',').map(e => e.trim()) : [];
        const defaultEmails = ['info', 'admin', 'sales', 'support', 'hello', 'contact', 'help', 'service', 'billing', 'marketing'];
        emails = [...new Set([...emails, ...defaultEmails])];
        emails = emails.map(email => `${email}@${args.domain}`);

        // Verify each email
        const verificationPromises = emails.map(async (email) => {
          try {
            const response = await axios.post(`${EMAIL_SERVICE_URL}/verify`, {
              email: email,
              fromEmail: args.fromEmail || `noreply@${args.domain}`
            }, {
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': EMAIL_API_KEY
              },
              timeout: 10000
            });
            return response.data.exists ? email : null;
          } catch (error) {
            return null;
          }
        });

        const results = await Promise.all(verificationPromises);
        const validEmails = results.filter(email => email !== null);

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Support Email Generation Results:**\\n\\n**Domain:** ${args.domain}\\n**Emails Tested:** ${emails.length}\\n**Valid Emails Found:** ${validEmails.length}\\n\\n**Valid Support Emails:**\\n${validEmails.map((email, i) => `${i + 1}. ${email}`).join('\\n') || 'None found'}\\n\\n**All Tested Emails:**\\n${emails.join(', ')}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats support email generation failed: ${error.message}`);
      }
    },

    'meerkats-check-domain-catch-all': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        const response = await axios.post(`${EMAIL_SERVICE_URL}/catchall`, {
          domain: args.domain
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': EMAIL_API_KEY
          },
          timeout: 15000
        });

        const result = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Domain Catch-All Check:**\\n\\n**Domain:** ${args.domain}\\n**Has Catch-All:** ${result.isCatchAll ? 'Yes' : 'No'}\\n**Confidence:** ${result.confidence || 'N/A'}\\n\\n**Details:**\\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats domain catch-all check failed: ${error.message}`);
      }
    },

    'meerkats-get-mx-for-domain': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        // First try to get MX records using the email service API
        try {
          const response = await axios.post(`${EMAIL_SERVICE_URL}/mx`, {
            domain: args.domain
          }, {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': EMAIL_API_KEY
            },
            timeout: 15000
          });

          const result = response.data;
          return {
            content: [
              {
                type: "text",
                text: `**Meerkats MX Records for ${args.domain}:**\\n\\n**Total MX Records:** ${result.mxRecords?.length || 0}\\n\\n**Details:**\\n${JSON.stringify(result, null, 2)}`
              }
            ]
          };
        } catch (apiError) {
          // Fallback to DNS lookup if API fails
          const mxRecords = await resolveMx(args.domain);
          
          const sortedMxRecords = mxRecords
            .sort((a, b) => a.priority - b.priority)
            .map((record, index) => `${index + 1}. ${record.exchange} (Priority: ${record.priority})`);

          return {
            content: [
              {
                type: "text",
                text: `**Meerkats MX Records for ${args.domain}:**\\n\\n**Total MX Records:** ${mxRecords.length}\\n\\n**MX Records (sorted by priority):**\\n${sortedMxRecords.join('\\n') || 'No MX records found'}\\n\\n**Raw Data:**\\n${JSON.stringify(mxRecords, null, 2)}`
              }
            ]
          };
        }
      } catch (error) {
        throw new Error(`Meerkats MX record lookup failed: ${error.message}`);
      }
    },

    'meerkats-google-serp': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        const limit = args.limit || 10;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(args.query)}&num=${limit}`;
        
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 15000
        });

        // Extract search results from Google SERP
        let content = response.data;
        const results = [];
        
        // Regex to extract search result blocks
        const resultRegex = /<div class="g"[^>]*>.*?<h3[^>]*><a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a><\/h3>.*?<span[^>]*>(.*?)<\/span>/gis;
        let match;
        let count = 0;
        
        while ((match = resultRegex.exec(content)) && count < limit) {
          const url = match[1];
          const title = match[2].replace(/<[^>]+>/g, '').trim();
          const snippet = match[3].replace(/<[^>]+>/g, '').trim();
          
          if (title && url && title.length > 5) {
            results.push({
              title,
              url,
              snippet: snippet.substring(0, 200) + (snippet.length > 200 ? '...' : ''),
              rank: count + 1
            });
            count++;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Google Search Results:**\\n\\n**Query:** ${args.query}\\n**Results Found:** ${results.length}\\n**Limit:** ${limit}\\n\\n**Search Results:**\\n${results.map(r => `${r.rank}. **${r.title}**\\n   URL: ${r.url}\\n   ${r.snippet}\\n`).join('\\n') || 'No results found'}\\n\\n**Note:** This is a basic SERP scraper. For production use, consider using Google Custom Search API.`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats Google search failed: ${error.message}`);
      }
    },

    'meerkats-google-map': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        const limit = args.limit || 10;
        let searchQuery = args.query;
        
        // If location is provided in latitude,longitude format, use it for location-based search
        if (args.location && /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(args.location)) {
          const [lat, lng] = args.location.split(',');
          searchQuery = `${args.query} near ${lat},${lng}`;
        } else if (args.location) {
          searchQuery = `${args.query} in ${args.location}`;
        }

        // Use Google Maps search URL
        const mapsSearchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
        
        const response = await axios.get(mapsSearchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 15000
        });

        // Basic extraction of place information from Google Maps
        let content = response.data;
        const places = [];
        
        // Simple regex to extract place names and addresses (this is very basic)
        const placeRegex = /<div[^>]*aria-label="([^"]*)"[^>]*>.*?<span[^>]*>(.*?)<\/span>/gis;
        let match;
        let count = 0;
        
        while ((match = placeRegex.exec(content)) && count < limit) {
          const name = match[1];
          const address = match[2];
          
          if (name && name.length > 3 && !name.includes('Search') && !name.includes('Map')) {
            places.push({
              name: name.substring(0, 100),
              address: address ? address.substring(0, 150) : 'Address not available',
              rank: count + 1
            });
            count++;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Google Maps Search:**\\n\\n**Query:** ${args.query}\\n**Location:** ${args.location || 'N/A'}\\n**Places Found:** ${places.length}\\n**Limit:** ${limit}\\n\\n**Places:**\\n${places.map(p => `${p.rank}. **${p.name}**\\n   Address: ${p.address}\\n`).join('\\n') || 'No places found'}\\n\\n**Note:** This is a basic Maps scraper. For production use, consider using Google Maps Places API.`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats Google Maps search failed: ${error.message}`);
      }
    },

    'meerkats-google-places': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        // Use Google search with "places" context
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(args.query + ' places near me')}`;
        
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 15000
        });

        // Basic extraction of place information
        let content = response.data;
        const places = [];
        
        // Try to extract business listings and places
        const businessRegex = /<div[^>]*class="[^"]*business[^"]*"[^>]*>.*?<span[^>]*>(.*?)<\/span>.*?<span[^>]*>(.*?)<\/span>/gis;
        const placeRegex = /<h3[^>]*><a[^>]*>(.*?)<\/a><\/h3>.*?<span[^>]*>(.*?)<\/span>/gis;
        
        let match;
        let count = 0;
        
        // Try business regex first
        while ((match = businessRegex.exec(content)) && count < 10) {
          const name = match[1].replace(/<[^>]+>/g, '').trim();
          const info = match[2].replace(/<[^>]+>/g, '').trim();
          
          if (name && name.length > 3 && !name.includes('Search') && !name.includes('Map')) {
            places.push({
              name: name.substring(0, 100),
              info: info.substring(0, 150),
              rank: count + 1,
              type: 'Business'
            });
            count++;
          }
        }
        
        // If no businesses found, try general places
        if (places.length === 0) {
          while ((match = placeRegex.exec(content)) && count < 10) {
            const name = match[1].replace(/<[^>]+>/g, '').trim();
            const info = match[2].replace(/<[^>]+>/g, '').trim();
            
            if (name && name.length > 3 && !name.includes('Search') && !name.includes('Google')) {
              places.push({
                name: name.substring(0, 100),
                info: info.substring(0, 150),
                rank: count + 1,
                type: 'Place'
              });
              count++;
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Google Places Search:**\\n\\n**Query:** ${args.query}\\n**Places Found:** ${places.length}\\n\\n**Places:**\\n${places.map(p => `${p.rank}. **${p.name}** (${p.type})\\n   Info: ${p.info}\\n`).join('\\n') || 'No places found'}\\n\\n**Note:** This is a basic places scraper. For production use, consider using Google Places API with proper API key.`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats Google Places search failed: ${error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}