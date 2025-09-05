// RocketReach MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * RocketReach MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'ROCKETREACH_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'rocketreach-person-lookup',
      title: 'RocketReach Person Lookup',
      description: 'Look up a person by name and company using RocketReach API',
      inputSchema: {
        name: z.string().describe('Full name of the person'),
        current_employer: z.string().optional().describe('Current company or employer'),
        linkedin_url: z.string().optional().describe('LinkedIn profile URL'),
        location: z.string().optional().describe('Location or city')
      }
    },
    {
      name: 'rocketreach-person-search',
      title: 'RocketReach Person Search',
      description: 'Search for people with advanced filters using RocketReach API',
      inputSchema: {
        query: z.string().optional().describe('Search query or keywords'),
        company: z.array(z.string()).optional().describe('Company names to filter by'),
        title: z.array(z.string()).optional().describe('Job titles to filter by'),
        location: z.array(z.string()).optional().describe('Locations to filter by'),
        school: z.array(z.string()).optional().describe('Schools to filter by'),
        start: z.number().optional().describe('Start index for pagination (default: 1)'),
        size: z.number().optional().describe('Number of results per page (max: 100)')
      }
    },
    {
      name: 'rocketreach-company-lookup',
      title: 'RocketReach Company Lookup',
      description: 'Look up company information using RocketReach API',
      inputSchema: {
        name: z.string().describe('Company name to lookup'),
        domain: z.string().optional().describe('Company domain')
      }
    },
    {
      name: 'rocketreach-company-search',
      title: 'RocketReach Company Search',
      description: 'Search for companies with filters using RocketReach API',
      inputSchema: {
        query: z.string().optional().describe('Search query or keywords'),
        location: z.array(z.string()).optional().describe('Locations to filter by'),
        industry: z.array(z.string()).optional().describe('Industries to filter by'),
        size: z.array(z.string()).optional().describe('Company size ranges'),
        start: z.number().optional().describe('Start index for pagination (default: 1)'),
        page_size: z.number().optional().describe('Number of results per page (max: 100)')
      }
    },
    {
      name: 'rocketreach-account-info',
      title: 'RocketReach Account Info',
      description: 'Get account information and usage statistics',
      inputSchema: {}
    },
    {
      name: 'rocketreach-bulk-lookup',
      title: 'RocketReach Bulk Person Lookup',
      description: 'Look up multiple people in bulk using RocketReach API',
      inputSchema: {
        people: z.array(z.object({
          name: z.string().describe('Full name of the person'),
          current_employer: z.string().optional().describe('Current company'),
          linkedin_url: z.string().optional().describe('LinkedIn URL')
        })).describe('Array of people to lookup')
      }
    }
  ];

  const toolHandlers = {
    'rocketreach-person-lookup': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('RocketReach API key is required');
      }

      try {
        const params = {
          api_key: apiKey,
          name: args.name
        };

        if (args.current_employer) params.current_employer = args.current_employer;
        if (args.linkedin_url) params.linkedin_url = args.linkedin_url;
        if (args.location) params.location = args.location;

        const response = await axios.get('https://api.rocketreach.co/v1/api/person/lookup', { params });
        const data = response.data;

        if (!data.profiles || data.profiles.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No person found matching: ${args.name} ${args.current_employer ? `at ${args.current_employer}` : ''}`
            }]
          };
        }

        const person = data.profiles[0];

        return {
          content: [
            {
              type: "text",
              text: `**RocketReach Person Lookup Results:**\\n\\n**Name:** ${person.name || 'N/A'}\\n**Current Title:** ${person.current_title || 'N/A'}\\n**Current Employer:** ${person.current_employer || 'N/A'}\\n**Location:** ${person.location || 'N/A'}\\n\\n**Contact Information:**\\n**Email:** ${person.emails?.map(e => e.email).join(', ') || 'N/A'}\\n**Phone:** ${person.phones?.map(p => p.number).join(', ') || 'N/A'}\\n**LinkedIn:** ${person.linkedin_url || 'N/A'}\\n**Twitter:** ${person.twitter_url || 'N/A'}\\n**Facebook:** ${person.facebook_url || 'N/A'}\\n\\n**Professional Background:**\\n**Experience:** ${person.work_experiences?.map(exp => `${exp.title} at ${exp.company_name} (${exp.start_date} - ${exp.end_date})`).join('\\n') || 'N/A'}\\n**Education:** ${person.educations?.map(edu => `${edu.degree} from ${edu.school} (${edu.start_date} - ${edu.end_date})`).join('\\n') || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`RocketReach person lookup failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'rocketreach-person-search': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('RocketReach API key is required');
      }

      try {
        const params = {
          api_key: apiKey,
          start: args.start || 1,
          size: args.size || 25
        };

        if (args.query) params.query = args.query;
        if (args.company) params['company[]'] = args.company;
        if (args.title) params['title[]'] = args.title;
        if (args.location) params['location[]'] = args.location;
        if (args.school) params['school[]'] = args.school;

        const response = await axios.get('https://api.rocketreach.co/v1/api/search', { params });
        const data = response.data;

        if (!data.profiles || data.profiles.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No people found matching the search criteria."
            }]
          };
        }

        const results = data.profiles.map((person, index) => {
          return `${index + 1}. **${person.name || 'Unknown'}**\\n   Title: ${person.current_title || 'N/A'}\\n   Company: ${person.current_employer || 'N/A'}\\n   Location: ${person.location || 'N/A'}\\n   Email: ${person.emails?.[0]?.email || 'N/A'}\\n   LinkedIn: ${person.linkedin_url || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**RocketReach Person Search Results:**\\n\\n${results.join('\\n')}\\n**Search Query:** ${args.query || 'Advanced filters'}\\n**Total Results:** ${data.pagination?.total || data.profiles.length}\\n**Current Page:** ${Math.ceil((args.start || 1) / (args.size || 25))}\\n**Results Per Page:** ${args.size || 25}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`RocketReach person search failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'rocketreach-company-lookup': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('RocketReach API key is required');
      }

      try {
        const params = {
          api_key: apiKey,
          name: args.name
        };

        if (args.domain) params.domain = args.domain;

        const response = await axios.get('https://api.rocketreach.co/v1/api/company/lookup', { params });
        const data = response.data;

        if (!data.companies || data.companies.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No company found matching: ${args.name}`
            }]
          };
        }

        const company = data.companies[0];

        return {
          content: [
            {
              type: "text",
              text: `**RocketReach Company Lookup Results:**\\n\\n**Name:** ${company.name || 'N/A'}\\n**Domain:** ${company.domain || 'N/A'}\\n**Industry:** ${company.industry || 'N/A'}\\n**Size:** ${company.size || 'N/A'}\\n**Founded:** ${company.founded_year || 'N/A'}\\n**Revenue:** ${company.revenue || 'N/A'}\\n\\n**Contact Information:**\\n**Location:** ${company.location || 'N/A'}\\n**Address:** ${company.address || 'N/A'}\\n**Phone:** ${company.phone || 'N/A'}\\n**Website:** ${company.website || 'N/A'}\\n\\n**Social Media:**\\n**LinkedIn:** ${company.linkedin_url || 'N/A'}\\n**Twitter:** ${company.twitter_url || 'N/A'}\\n**Facebook:** ${company.facebook_url || 'N/A'}\\n\\n**Description:** ${company.description || 'N/A'}\\n**Employee Count:** ${company.employee_count || 'N/A'}\\n**Technologies:** ${company.technologies?.join(', ') || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`RocketReach company lookup failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'rocketreach-company-search': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('RocketReach API key is required');
      }

      try {
        const params = {
          api_key: apiKey,
          start: args.start || 1,
          size: args.page_size || 25
        };

        if (args.query) params.query = args.query;
        if (args.location) params['location[]'] = args.location;
        if (args.industry) params['industry[]'] = args.industry;
        if (args.size) params['size[]'] = args.size;

        const response = await axios.get('https://api.rocketreach.co/v1/api/company/search', { params });
        const data = response.data;

        if (!data.companies || data.companies.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No companies found matching the search criteria."
            }]
          };
        }

        const results = data.companies.map((company, index) => {
          return `${index + 1}. **${company.name || 'Unknown Company'}**\\n   Domain: ${company.domain || 'N/A'}\\n   Industry: ${company.industry || 'N/A'}\\n   Size: ${company.size || 'N/A'}\\n   Location: ${company.location || 'N/A'}\\n   Revenue: ${company.revenue || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**RocketReach Company Search Results:**\\n\\n${results.join('\\n')}\\n**Search Query:** ${args.query || 'Advanced filters'}\\n**Total Results:** ${data.pagination?.total || data.companies.length}\\n**Current Page:** ${Math.ceil((args.start || 1) / (args.page_size || 25))}\\n**Results Per Page:** ${args.page_size || 25}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`RocketReach company search failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'rocketreach-account-info': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('RocketReach API key is required');
      }

      try {
        const params = {
          api_key: apiKey
        };

        const response = await axios.get('https://api.rocketreach.co/v1/api/account', { params });
        const data = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**RocketReach Account Information:**\\n\\n**Account Details:**\\n**Name:** ${data.name || 'N/A'}\\n**Email:** ${data.email || 'N/A'}\\n**Company:** ${data.company || 'N/A'}\\n**Plan:** ${data.plan || 'N/A'}\\n**Status:** ${data.status || 'N/A'}\\n\\n**Usage Statistics:**\\n**Lookups Used:** ${data.lookups_used || 'N/A'}\\n**Lookups Remaining:** ${data.lookups_remaining || 'N/A'}\\n**Searches Used:** ${data.searches_used || 'N/A'}\\n**Searches Remaining:** ${data.searches_remaining || 'N/A'}\\n**Emails Used:** ${data.emails_used || 'N/A'}\\n**Emails Remaining:** ${data.emails_remaining || 'N/A'}\\n\\n**Billing Information:**\\n**Billing Cycle:** ${data.billing_cycle || 'N/A'}\\n**Next Billing Date:** ${data.next_billing_date || 'N/A'}\\n**Credits Reset Date:** ${data.credits_reset_date || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`RocketReach account info failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'rocketreach-bulk-lookup': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('RocketReach API key is required');
      }

      try {
        const requestData = {
          api_key: apiKey,
          people: args.people
        };

        const response = await axios.post(
          'https://api.rocketreach.co/v1/api/person/bulk-lookup',
          requestData,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        const data = response.data;

        if (!data.profiles || data.profiles.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No people found in the bulk lookup request."
            }]
          };
        }

        const results = data.profiles.map((person, index) => {
          return `${index + 1}. **${person.name || 'Unknown'}**\\n   Title: ${person.current_title || 'N/A'}\\n   Company: ${person.current_employer || 'N/A'}\\n   Email: ${person.emails?.[0]?.email || 'N/A'}\\n   Phone: ${person.phones?.[0]?.number || 'N/A'}\\n   LinkedIn: ${person.linkedin_url || 'N/A'}\\n   Match Status: ${person.match_status || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**RocketReach Bulk Person Lookup Results:**\\n\\n${results.join('\\n')}\\n**Total Requested:** ${args.people.length}\\n**Total Found:** ${data.profiles.length}\\n**Success Rate:** ${Math.round((data.profiles.length / args.people.length) * 100)}%\\n\\n**Credits Used:** ${data.credits_used || 'N/A'}\\n**Credits Remaining:** ${data.credits_remaining || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`RocketReach bulk lookup failed: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}