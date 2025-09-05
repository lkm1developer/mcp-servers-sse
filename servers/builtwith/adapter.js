// BuiltWith MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * BuiltWith MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'BUILTWITH_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'builtwith-technology-lookup',
      title: 'BuiltWith Technology Lookup',
      description: 'Get detailed technology information for a website using BuiltWith API',
      inputSchema: {
        domain: z.string().describe('Website domain to analyze (e.g., example.com)')
      }
    },
    {
      name: 'builtwith-technology-list',
      title: 'BuiltWith Technology List',
      description: 'Get list of websites using specific technologies',
      inputSchema: {
        technology: z.string().describe('Technology name to search for (e.g., WordPress, React)'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 50)'),
        country: z.string().optional().describe('Filter by country code (e.g., US, GB)')
      }
    },
    {
      name: 'builtwith-domain-details',
      title: 'BuiltWith Domain Details',
      description: 'Get comprehensive domain analysis including technologies, traffic, and more',
      inputSchema: {
        domain: z.string().describe('Website domain to analyze'),
        hidetext: z.boolean().optional().describe('Hide text descriptions (default: false)'),
        nometa: z.boolean().optional().describe('Hide meta information (default: false)')
      }
    },
    {
      name: 'builtwith-trends',
      title: 'BuiltWith Technology Trends',
      description: 'Get technology usage trends and statistics',
      inputSchema: {
        technology: z.string().describe('Technology name to get trends for'),
        period: z.enum(['month', 'quarter', 'year']).optional().describe('Time period for trends')
      }
    },
    {
      name: 'builtwith-relationships',
      title: 'BuiltWith Domain Relationships',
      description: 'Find related domains and relationships for a given domain',
      inputSchema: {
        domain: z.string().describe('Domain to find relationships for'),
        type: z.enum(['redirect', 'subdomain', 'similar']).optional().describe('Type of relationship to find')
      }
    }
  ];

  const toolHandlers = {
    'builtwith-technology-lookup': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('BuiltWith API key is required');
      }

      try {
        const response = await axios.get(
          `https://api.builtwith.com/v21/api.json?KEY=${apiKey}&LOOKUP=${encodeURIComponent(args.domain)}`
        );

        const data = response.data;
        
        if (!data.Results || data.Results.length === 0) {
          return {
            content: [{
              type: "text", 
              text: `No technology information found for domain: ${args.domain}`
            }]
          };
        }

        const result = data.Results[0];
        const technologies = {};

        // Group technologies by category
        if (result.Result && result.Result.Paths) {
          result.Result.Paths.forEach(path => {
            path.Technologies.forEach(tech => {
              if (!technologies[tech.Tag]) {
                technologies[tech.Tag] = [];
              }
              technologies[tech.Tag].push({
                name: tech.Name,
                description: tech.Description || 'N/A',
                categories: tech.Categories?.map(cat => cat.Name).join(', ') || 'N/A'
              });
            });
          });
        }

        let techSummary = '';
        for (const [category, techs] of Object.entries(technologies)) {
          techSummary += `\\n**${category}:**\\n`;
          techs.forEach(tech => {
            techSummary += `- ${tech.name}: ${tech.description}\\n`;
          });
        }

        return {
          content: [
            {
              type: "text",
              text: `**BuiltWith Technology Analysis for ${args.domain}:**\\n\\n**Domain:** ${result.Domain}\\n**Last Updated:** ${result.LastUpdated || 'N/A'}\\n\\n**Technologies Detected:**${techSummary || '\\nNo technologies detected'}\\n\\n**Meta Information:**\\n- First Indexed: ${result.FirstIndexed || 'N/A'}\\n- Spend: ${result.Spend || 'N/A'}\\n- Company: ${result.Company || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`BuiltWith technology lookup failed: ${error.response?.data?.Error || error.message}`);
      }
    },

    'builtwith-technology-list': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('BuiltWith API key is required');
      }

      try {
        const params = {
          KEY: apiKey,
          TECH: args.technology,
          LIMIT: args.limit || 50
        };
        
        if (args.country) params.COUNTRY = args.country;

        const response = await axios.get('https://api.builtwith.com/lists15/api.json', { params });
        const data = response.data;

        if (!data.Results || data.Results.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No websites found using technology: ${args.technology}`
            }]
          };
        }

        const websites = data.Results.map((site, index) => {
          return `${index + 1}. **${site.Domain}**\\n   Company: ${site.Company || 'N/A'}\\n   Country: ${site.Country || 'N/A'}\\n   First Detected: ${site.FirstDetected || 'N/A'}\\n   Last Detected: ${site.LastDetected || 'N/A'}\\n   Spend: ${site.Spend || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**Websites Using ${args.technology}:**\\n\\n${websites.join('\\n')}\\n**Total Results:** ${data.Results.length}\\n**Technology:** ${args.technology}\\n**Country Filter:** ${args.country || 'All countries'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`BuiltWith technology list failed: ${error.response?.data?.Error || error.message}`);
      }
    },

    'builtwith-domain-details': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('BuiltWith API key is required');  
      }

      try {
        const params = {
          KEY: apiKey,
          LOOKUP: args.domain
        };
        
        if (args.hidetext) params.HIDETEXT = 'yes';
        if (args.nometa) params.NOMETA = 'yes';

        const response = await axios.get('https://api.builtwith.com/v21/api.json', { params });
        const data = response.data;

        if (!data.Results || data.Results.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No detailed information found for domain: ${args.domain}`
            }]
          };
        }

        const result = data.Results[0];
        const meta = result.Meta || {};

        return {
          content: [
            {
              type: "text",
              text: `**BuiltWith Domain Details for ${args.domain}:**\\n\\n**Basic Information:**\\n- Domain: ${result.Domain}\\n- Company: ${meta.CompanyName || 'N/A'}\\n- Country: ${meta.Country || 'N/A'}\\n- Vertical: ${meta.Vertical || 'N/A'}\\n- Social: ${meta.Social || 'N/A'}\\n\\n**Traffic & Analytics:**\\n- Quantcast Rank: ${meta.QuantcastRank || 'N/A'}\\n- Estimated Spend: ${meta.Spend || 'N/A'}\\n\\n**Technical Details:**\\n- First Indexed: ${result.FirstIndexed || 'N/A'}\\n- Last Updated: ${result.LastUpdated || 'N/A'}\\n- IP Address: ${meta.IP || 'N/A'}\\n- Server: ${meta.Server || 'N/A'}\\n\\n**Contact Information:**\\n- Email: ${meta.Email || 'N/A'}\\n- Phone: ${meta.Phone || 'N/A'}\\n- Address: ${meta.Address || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`BuiltWith domain details failed: ${error.response?.data?.Error || error.message}`);
      }
    },

    'builtwith-trends': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('BuiltWith API key is required');
      }

      try {
        const params = {
          KEY: apiKey,
          TECH: args.technology
        };

        if (args.period) params.PERIOD = args.period;

        const response = await axios.get('https://api.builtwith.com/trends/v4/api.json', { params });
        const data = response.data;

        if (!data.Trends || data.Trends.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No trend data found for technology: ${args.technology}`
            }]
          };
        }

        const trends = data.Trends.map((trend, index) => {
          return `${index + 1}. **Period:** ${trend.Date}\\n   Websites: ${trend.Websites || 'N/A'}\\n   Change: ${trend.Change || 'N/A'}\\n   Percentage: ${trend.Percentage || 'N/A'}%\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**Technology Trends for ${args.technology}:**\\n\\n${trends.join('\\n')}\\n**Technology:** ${args.technology}\\n**Period:** ${args.period || 'Default'}\\n**Total Data Points:** ${data.Trends.length}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`BuiltWith trends failed: ${error.response?.data?.Error || error.message}`);
      }
    },

    'builtwith-relationships': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('BuiltWith API key is required');
      }

      try {
        const params = {
          KEY: apiKey,
          LOOKUP: args.domain
        };

        if (args.type) params.TYPE = args.type;

        const response = await axios.get('https://api.builtwith.com/relationships/v2/api.json', { params });
        const data = response.data;

        if (!data.Relationships || data.Relationships.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No relationships found for domain: ${args.domain}`
            }]
          };
        }

        const relationships = data.Relationships.map((rel, index) => {
          return `${index + 1}. **${rel.Domain}**\\n   Type: ${rel.Type || 'N/A'}\\n   First Detected: ${rel.FirstDetected || 'N/A'}\\n   Last Detected: ${rel.LastDetected || 'N/A'}\\n   Status: ${rel.Status || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**Domain Relationships for ${args.domain}:**\\n\\n${relationships.join('\\n')}\\n**Source Domain:** ${args.domain}\\n**Relationship Type:** ${args.type || 'All types'}\\n**Total Relationships:** ${data.Relationships.length}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`BuiltWith relationships failed: ${error.response?.data?.Error || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}