// Apollo.io MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * Apollo.io MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'APOLLO_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'apollo-people-enrichment',
      title: 'Apollo People Enrichment',
      description: 'Enrich person data using Apollo.io API',
      inputSchema: {
        email: z.string().optional().describe('Email address to enrich'),
        first_name: z.string().optional().describe('First name of the person'),
        last_name: z.string().optional().describe('Last name of the person'),
        domain: z.string().optional().describe('Company domain'),
        linkedin_url: z.string().optional().describe('LinkedIn profile URL')
      }
    },
    {
      name: 'apollo-organization-enrichment',
      title: 'Apollo Organization Enrichment',
      description: 'Enrich organization data using Apollo.io API',
      inputSchema: {
        domain: z.string().describe('Organization domain to enrich'),
        name: z.string().optional().describe('Organization name')
      }
    },
    {
      name: 'apollo-people-search',
      title: 'Apollo People Search',
      description: 'Search for people using Apollo.io API',
      inputSchema: {
        q_keywords: z.string().optional().describe('Keywords to search for'),
        titles: z.array(z.string()).optional().describe('Job titles to search for'),
        seniorities: z.array(z.string()).optional().describe('Seniority levels'),
        departments: z.array(z.string()).optional().describe('Department names'),
        organization_domains: z.array(z.string()).optional().describe('Company domains'),
        organization_names: z.array(z.string()).optional().describe('Company names'),
        page: z.number().optional().describe('Page number for pagination'),
        per_page: z.number().optional().describe('Number of results per page (max 100)')
      }
    },
    {
      name: 'apollo-organization-search',
      title: 'Apollo Organization Search',
      description: 'Search for organizations using Apollo.io API',
      inputSchema: {
        q_keywords: z.string().optional().describe('Keywords to search for'),
        industries: z.array(z.string()).optional().describe('Industry names'),
        locations: z.array(z.string()).optional().describe('Location names'),
        employee_count_min: z.number().optional().describe('Minimum employee count'),
        employee_count_max: z.number().optional().describe('Maximum employee count'),
        revenue_min: z.number().optional().describe('Minimum revenue'),
        revenue_max: z.number().optional().describe('Maximum revenue'),
        page: z.number().optional().describe('Page number for pagination'),
        per_page: z.number().optional().describe('Number of results per page (max 100)')
      }
    },
    {
      name: 'apollo-organization-job-postings',
      title: 'Apollo Organization Job Postings',
      description: 'Get job postings for an organization using Apollo.io API',
      inputSchema: {
        organization_id: z.string().describe('Apollo organization ID'),
        page: z.number().optional().describe('Page number for pagination'),
        per_page: z.number().optional().describe('Number of results per page')
      }
    },
    {
      name: 'apollo-get-person-email',
      title: 'Apollo Get Person Email',
      description: 'Get email address for a person using Apollo.io API',
      inputSchema: {
        first_name: z.string().describe('First name of the person'),
        last_name: z.string().describe('Last name of the person'),
        domain: z.string().describe('Company domain'),
        email: z.string().optional().describe('Known email to verify')
      }
    },
    {
      name: 'apollo-employees-of-company',
      title: 'Apollo Employees of Company',
      description: 'Get employees of a specific company using Apollo.io API',
      inputSchema: {
        domain: z.string().describe('Company domain'),
        organization_name: z.string().optional().describe('Company name'),
        titles: z.array(z.string()).optional().describe('Job titles to filter by'),
        seniorities: z.array(z.string()).optional().describe('Seniority levels to filter by'),
        departments: z.array(z.string()).optional().describe('Departments to filter by'),
        page: z.number().optional().describe('Page number for pagination'),
        per_page: z.number().optional().describe('Number of results per page (max 100)')
      }
    }
  ];

  const toolHandlers = {
    'apollo-people-enrichment': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apollo.io API key is required');
      }

      try {
        const response = await axios.post(
          'https://api.apollo.io/v1/people/match',
          args,
          {
            headers: {
              'Cache-Control': 'no-cache',
              'Content-Type': 'application/json',
              'X-Api-Key': apiKey
            }
          }
        );

        const person = response.data.person;
        if (!person) {
          return {
            content: [{
              type: "text",
              text: "No person data found for the provided information."
            }]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `**Apollo People Enrichment Results:**\\n\\n**Name:** ${person.first_name || ''} ${person.last_name || ''}\\n**Email:** ${person.email || 'N/A'}\\n**Title:** ${person.title || 'N/A'}\\n**Company:** ${person.organization?.name || 'N/A'}\\n**LinkedIn:** ${person.linkedin_url || 'N/A'}\\n**Phone:** ${person.phone_numbers?.map(p => p.raw_number).join(', ') || 'N/A'}\\n**Location:** ${person.city || ''} ${person.state || ''} ${person.country || ''}\\n**Seniority:** ${person.seniority || 'N/A'}\\n**Department:** ${person.departments?.join(', ') || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Apollo people enrichment failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'apollo-organization-enrichment': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apollo.io API key is required');
      }

      try {
        const response = await axios.post(
          'https://api.apollo.io/v1/organizations/enrich',
          args,
          {
            headers: {
              'Cache-Control': 'no-cache',
              'Content-Type': 'application/json',
              'X-Api-Key': apiKey
            }
          }
        );

        const org = response.data.organization;
        if (!org) {
          return {
            content: [{
              type: "text",
              text: "No organization data found for the provided domain."
            }]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `**Apollo Organization Enrichment Results:**\\n\\n**Name:** ${org.name || 'N/A'}\\n**Domain:** ${org.website_url || 'N/A'}\\n**Industry:** ${org.industry || 'N/A'}\\n**Employees:** ${org.estimated_num_employees || 'N/A'}\\n**Revenue:** ${org.annual_revenue || 'N/A'}\\n**Founded:** ${org.founded_year || 'N/A'}\\n**Location:** ${org.city || ''} ${org.state || ''} ${org.country || ''}\\n**Description:** ${org.short_description || 'N/A'}\\n**LinkedIn:** ${org.linkedin_url || 'N/A'}\\n**Phone:** ${org.phone || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Apollo organization enrichment failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'apollo-people-search': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apollo.io API key is required');
      }

      try {
        const response = await axios.post(
          'https://api.apollo.io/v1/mixed_people/search',
          args,
          {
            headers: {
              'Cache-Control': 'no-cache',
              'Content-Type': 'application/json',
              'X-Api-Key': apiKey
            }
          }
        );

        const people = response.data.people || [];
        if (people.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No people found matching the search criteria."
            }]
          };
        }

        const results = people.map((person, index) => {
          return `${index + 1}. **${person.first_name || ''} ${person.last_name || 'Unknown'}**\\n   Title: ${person.title || 'N/A'}\\n   Company: ${person.organization?.name || 'N/A'}\\n   Email: ${person.email || 'N/A'}\\n   LinkedIn: ${person.linkedin_url || 'N/A'}\\n   Location: ${person.city || ''} ${person.state || ''} ${person.country || ''}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**Apollo People Search Results:**\\n\\n${results.join('\\n')}\\n**Total Results:** ${response.data.pagination?.total_entries || people.length}\\n**Current Page:** ${response.data.pagination?.page || 1}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Apollo people search failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'apollo-organization-search': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apollo.io API key is required');
      }

      try {
        const response = await axios.post(
          'https://api.apollo.io/v1/organizations/search',
          args,
          {
            headers: {
              'Cache-Control': 'no-cache',
              'Content-Type': 'application/json',
              'X-Api-Key': apiKey
            }
          }
        );

        const orgs = response.data.organizations || [];
        if (orgs.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No organizations found matching the search criteria."
            }]
          };
        }

        const results = orgs.map((org, index) => {
          return `${index + 1}. **${org.name || 'Unknown Company'}**\\n   Domain: ${org.website_url || 'N/A'}\\n   Industry: ${org.industry || 'N/A'}\\n   Employees: ${org.estimated_num_employees || 'N/A'}\\n   Revenue: ${org.annual_revenue || 'N/A'}\\n   Location: ${org.city || ''} ${org.state || ''} ${org.country || ''}\\n   Founded: ${org.founded_year || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**Apollo Organization Search Results:**\\n\\n${results.join('\\n')}\\n**Total Results:** ${response.data.pagination?.total_entries || orgs.length}\\n**Current Page:** ${response.data.pagination?.page || 1}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Apollo organization search failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'apollo-organization-job-postings': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apollo.io API key is required');
      }

      try {
        const response = await axios.get(
          `https://api.apollo.io/v1/organizations/${args.organization_id}/job_postings`,
          {
            params: {
              page: args.page || 1,
              per_page: args.per_page || 10
            },
            headers: {
              'Cache-Control': 'no-cache',
              'X-Api-Key': apiKey
            }
          }
        );

        const jobPostings = response.data.job_postings || [];
        if (jobPostings.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No job postings found for this organization."
            }]
          };
        }

        const results = jobPostings.map((job, index) => {
          return `${index + 1}. **${job.title || 'Unknown Position'}**\\n   Department: ${job.department || 'N/A'}\\n   Location: ${job.location || 'N/A'}\\n   Posted: ${job.posted_date || 'N/A'}\\n   URL: ${job.url || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**Apollo Job Postings Results:**\\n\\n${results.join('\\n')}\\n**Total Postings:** ${response.data.pagination?.total_entries || jobPostings.length}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Apollo job postings search failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'apollo-get-person-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apollo.io API key is required');
      }

      try {
        const response = await axios.post(
          'https://api.apollo.io/v1/email_accounts',
          args,
          {
            headers: {
              'Cache-Control': 'no-cache',
              'Content-Type': 'application/json',
              'X-Api-Key': apiKey
            }
          }
        );

        const account = response.data.email_account;
        if (!account) {
          return {
            content: [{
              type: "text",
              text: "No email found for the provided person information."
            }]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `**Apollo Email Discovery Results:**\\n\\n**Name:** ${args.first_name} ${args.last_name}\\n**Email:** ${account.email || 'N/A'}\\n**Status:** ${account.state || 'N/A'}\\n**Domain:** ${args.domain}\\n**Confidence:** ${account.email_confidence || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Apollo email discovery failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'apollo-employees-of-company': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apollo.io API key is required');
      }

      try {
        const searchParams = {
          organization_domains: [args.domain],
          ...args
        };
        delete searchParams.domain; // Remove domain from params since we use organization_domains

        const response = await axios.post(
          'https://api.apollo.io/v1/mixed_people/search',
          searchParams,
          {
            headers: {
              'Cache-Control': 'no-cache',
              'Content-Type': 'application/json',
              'X-Api-Key': apiKey
            }
          }
        );

        const employees = response.data.people || [];
        if (employees.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No employees found for domain: ${args.domain}`
            }]
          };
        }

        const results = employees.map((employee, index) => {
          return `${index + 1}. **${employee.first_name || ''} ${employee.last_name || 'Unknown'}**\\n   Title: ${employee.title || 'N/A'}\\n   Email: ${employee.email || 'N/A'}\\n   Department: ${employee.departments?.join(', ') || 'N/A'}\\n   Seniority: ${employee.seniority || 'N/A'}\\n   LinkedIn: ${employee.linkedin_url || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**Apollo Company Employees Results for ${args.domain}:**\\n\\n${results.join('\\n')}\\n**Total Employees Found:** ${response.data.pagination?.total_entries || employees.length}\\n**Current Page:** ${response.data.pagination?.page || 1}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Apollo employees search failed: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}