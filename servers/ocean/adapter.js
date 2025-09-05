// Ocean.io MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * Ocean.io MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'OCEAN_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'ocean-find-person',
      title: 'Ocean.io Find Person',
      description: 'Find a person by name and company using Ocean.io API',
      inputSchema: {
        first_name: z.string().describe('First name of the person'),
        last_name: z.string().describe('Last name of the person'),
        company_name: z.string().optional().describe('Company name where person works'),
        company_domain: z.string().optional().describe('Company domain'),
        linkedin_url: z.string().optional().describe('LinkedIn profile URL'),
        location: z.string().optional().describe('Person location or city')
      }
    },
    {
      name: 'ocean-search-people',
      title: 'Ocean.io Search People',
      description: 'Search for people with advanced filters using Ocean.io API',
      inputSchema: {
        company_name: z.string().optional().describe('Company name to search within'),
        company_domain: z.string().optional().describe('Company domain to search within'),
        job_title: z.string().optional().describe('Job title to filter by'),
        department: z.string().optional().describe('Department to filter by'),
        seniority: z.string().optional().describe('Seniority level to filter by'),
        location: z.string().optional().describe('Location to filter by'),
        skills: z.array(z.string()).optional().describe('Skills to filter by'),
        page: z.number().optional().describe('Page number for pagination'),
        per_page: z.number().optional().describe('Results per page (max 100)')
      }
    },
    {
      name: 'ocean-find-company',
      title: 'Ocean.io Find Company',
      description: 'Find company information using Ocean.io API',
      inputSchema: {
        company_name: z.string().optional().describe('Company name to search for'),
        domain: z.string().optional().describe('Company domain to search for'),
        linkedin_url: z.string().optional().describe('Company LinkedIn URL')
      }
    },
    {
      name: 'ocean-search-companies',
      title: 'Ocean.io Search Companies',
      description: 'Search for companies with filters using Ocean.io API',
      inputSchema: {
        industry: z.string().optional().describe('Industry to filter by'),
        location: z.string().optional().describe('Location to filter by'),
        employee_count_min: z.number().optional().describe('Minimum employee count'),
        employee_count_max: z.number().optional().describe('Maximum employee count'),
        revenue_min: z.number().optional().describe('Minimum revenue in USD'),
        revenue_max: z.number().optional().describe('Maximum revenue in USD'),
        technologies: z.array(z.string()).optional().describe('Technologies used by company'),
        page: z.number().optional().describe('Page number for pagination'),
        per_page: z.number().optional().describe('Results per page (max 100)')
      }
    },
    {
      name: 'ocean-enrich-person',
      title: 'Ocean.io Enrich Person',
      description: 'Enrich person data with additional information',
      inputSchema: {
        email: z.string().optional().describe('Email address to enrich'),
        linkedin_url: z.string().optional().describe('LinkedIn profile URL to enrich'),
        first_name: z.string().optional().describe('First name'),
        last_name: z.string().optional().describe('Last name'),
        company_domain: z.string().optional().describe('Company domain')
      }
    },
    {
      name: 'ocean-account-info',
      title: 'Ocean.io Account Info',
      description: 'Get account information and usage statistics',
      inputSchema: {}
    }
  ];

  const toolHandlers = {
    'ocean-find-person': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Ocean.io API key is required');
      }

      try {
        const requestData = {
          first_name: args.first_name,
          last_name: args.last_name
        };

        if (args.company_name) requestData.company_name = args.company_name;
        if (args.company_domain) requestData.company_domain = args.company_domain;
        if (args.linkedin_url) requestData.linkedin_url = args.linkedin_url;
        if (args.location) requestData.location = args.location;

        const response = await axios.post(
          'https://api.ocean.io/v1/person/find',
          requestData,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const data = response.data;

        if (!data.person) {
          return {
            content: [{
              type: "text",
              text: `No person found matching: ${args.first_name} ${args.last_name} ${args.company_name ? `at ${args.company_name}` : ''}`
            }]
          };
        }

        const person = data.person;

        return {
          content: [
            {
              type: "text",
              text: `**Ocean.io Person Find Results:**\\n\\n**Personal Information:**\\n**Name:** ${person.first_name || ''} ${person.last_name || ''}\\n**Email:** ${person.email || 'N/A'}\\n**Phone:** ${person.phone || 'N/A'}\\n**LinkedIn:** ${person.linkedin_url || 'N/A'}\\n**Location:** ${person.location || 'N/A'}\\n\\n**Professional Information:**\\n**Current Title:** ${person.job_title || 'N/A'}\\n**Current Company:** ${person.company_name || 'N/A'}\\n**Company Domain:** ${person.company_domain || 'N/A'}\\n**Department:** ${person.department || 'N/A'}\\n**Seniority:** ${person.seniority || 'N/A'}\\n**Industry:** ${person.industry || 'N/A'}\\n\\n**Additional Information:**\\n**Skills:** ${person.skills?.join(', ') || 'N/A'}\\n**Education:** ${person.education || 'N/A'}\\n**Experience:** ${person.experience || 'N/A'}\\n**Social Profiles:** ${person.social_profiles?.join(', ') || 'N/A'}\\n\\n**Confidence Score:** ${person.confidence_score || 'N/A'}%`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Ocean.io person find failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'ocean-search-people': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Ocean.io API key is required');
      }

      try {
        const params = {
          page: args.page || 1,
          per_page: args.per_page || 25
        };

        if (args.company_name) params.company_name = args.company_name;
        if (args.company_domain) params.company_domain = args.company_domain;
        if (args.job_title) params.job_title = args.job_title;
        if (args.department) params.department = args.department;
        if (args.seniority) params.seniority = args.seniority;
        if (args.location) params.location = args.location;
        if (args.skills) params.skills = args.skills.join(',');

        const response = await axios.get('https://api.ocean.io/v1/people/search', {
          params,
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });

        const data = response.data;
        const people = data.people || [];

        if (people.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No people found matching the search criteria."
            }]
          };
        }

        const results = people.map((person, index) => {
          return `${index + 1}. **${person.first_name || ''} ${person.last_name || 'Unknown'}**\\n   Title: ${person.job_title || 'N/A'}\\n   Company: ${person.company_name || 'N/A'}\\n   Email: ${person.email || 'N/A'}\\n   Location: ${person.location || 'N/A'}\\n   LinkedIn: ${person.linkedin_url || 'N/A'}\\n   Department: ${person.department || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**Ocean.io People Search Results:**\\n\\n${results.join('\\n')}\\n**Total Results:** ${data.total_count || people.length}\\n**Current Page:** ${args.page || 1}\\n**Results Per Page:** ${args.per_page || 25}\\n\\n**Search Filters:**\\n**Company:** ${args.company_name || args.company_domain || 'Any'}\\n**Job Title:** ${args.job_title || 'Any'}\\n**Location:** ${args.location || 'Any'}\\n**Department:** ${args.department || 'Any'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Ocean.io people search failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'ocean-find-company': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Ocean.io API key is required');
      }

      try {
        const requestData = {};

        if (args.company_name) requestData.company_name = args.company_name;
        if (args.domain) requestData.domain = args.domain;
        if (args.linkedin_url) requestData.linkedin_url = args.linkedin_url;

        if (Object.keys(requestData).length === 0) {
          throw new Error('At least one search parameter is required: company_name, domain, or linkedin_url');
        }

        const response = await axios.post(
          'https://api.ocean.io/v1/company/find',
          requestData,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const data = response.data;

        if (!data.company) {
          return {
            content: [{
              type: "text",
              text: `No company found matching the search criteria.`
            }]
          };
        }

        const company = data.company;

        return {
          content: [
            {
              type: "text",
              text: `**Ocean.io Company Find Results:**\\n\\n**Basic Information:**\\n**Name:** ${company.name || 'N/A'}\\n**Domain:** ${company.domain || 'N/A'}\\n**Website:** ${company.website || 'N/A'}\\n**Industry:** ${company.industry || 'N/A'}\\n**Description:** ${company.description || 'N/A'}\\n\\n**Company Details:**\\n**Founded:** ${company.founded_year || 'N/A'}\\n**Employee Count:** ${company.employee_count || 'N/A'}\\n**Revenue:** ${company.revenue || 'N/A'}\\n**Location:** ${company.location || 'N/A'}\\n**Headquarters:** ${company.headquarters || 'N/A'}\\n\\n**Contact Information:**\\n**Phone:** ${company.phone || 'N/A'}\\n**Email:** ${company.email || 'N/A'}\\n**LinkedIn:** ${company.linkedin_url || 'N/A'}\\n**Twitter:** ${company.twitter_url || 'N/A'}\\n**Facebook:** ${company.facebook_url || 'N/A'}\\n\\n**Technologies:** ${company.technologies?.join(', ') || 'N/A'}\\n**Keywords:** ${company.keywords?.join(', ') || 'N/A'}\\n**Competitors:** ${company.competitors?.join(', ') || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Ocean.io company find failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'ocean-search-companies': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Ocean.io API key is required');
      }

      try {
        const params = {
          page: args.page || 1,
          per_page: args.per_page || 25
        };

        if (args.industry) params.industry = args.industry;
        if (args.location) params.location = args.location;
        if (args.employee_count_min) params.employee_count_min = args.employee_count_min;
        if (args.employee_count_max) params.employee_count_max = args.employee_count_max;
        if (args.revenue_min) params.revenue_min = args.revenue_min;
        if (args.revenue_max) params.revenue_max = args.revenue_max;
        if (args.technologies) params.technologies = args.technologies.join(',');

        const response = await axios.get('https://api.ocean.io/v1/companies/search', {
          params,
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });

        const data = response.data;
        const companies = data.companies || [];

        if (companies.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No companies found matching the search criteria."
            }]
          };
        }

        const results = companies.map((company, index) => {
          return `${index + 1}. **${company.name || 'Unknown Company'}**\\n   Domain: ${company.domain || 'N/A'}\\n   Industry: ${company.industry || 'N/A'}\\n   Employees: ${company.employee_count || 'N/A'}\\n   Revenue: ${company.revenue || 'N/A'}\\n   Location: ${company.location || 'N/A'}\\n   Founded: ${company.founded_year || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**Ocean.io Company Search Results:**\\n\\n${results.join('\\n')}\\n**Total Results:** ${data.total_count || companies.length}\\n**Current Page:** ${args.page || 1}\\n**Results Per Page:** ${args.per_page || 25}\\n\\n**Search Filters:**\\n**Industry:** ${args.industry || 'Any'}\\n**Location:** ${args.location || 'Any'}\\n**Employee Count:** ${args.employee_count_min || '0'} - ${args.employee_count_max || '∞'}\\n**Revenue Range:** ${args.revenue_min || '0'} - ${args.revenue_max || '∞'}\\n**Technologies:** ${args.technologies?.join(', ') || 'Any'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Ocean.io company search failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'ocean-enrich-person': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Ocean.io API key is required');
      }

      try {
        const requestData = {};

        if (args.email) requestData.email = args.email;
        if (args.linkedin_url) requestData.linkedin_url = args.linkedin_url;
        if (args.first_name) requestData.first_name = args.first_name;
        if (args.last_name) requestData.last_name = args.last_name;
        if (args.company_domain) requestData.company_domain = args.company_domain;

        if (Object.keys(requestData).length === 0) {
          throw new Error('At least one identifier is required for enrichment');
        }

        const response = await axios.post(
          'https://api.ocean.io/v1/person/enrich',
          requestData,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const data = response.data;

        if (!data.person) {
          return {
            content: [{
              type: "text",
              text: "Unable to enrich the provided person information."
            }]
          };
        }

        const person = data.person;

        return {
          content: [
            {
              type: "text",
              text: `**Ocean.io Person Enrichment Results:**\\n\\n**Personal Information:**\\n**Name:** ${person.first_name || ''} ${person.last_name || ''}\\n**Email:** ${person.email || 'N/A'}\\n**Phone:** ${person.phone || 'N/A'}\\n**LinkedIn:** ${person.linkedin_url || 'N/A'}\\n**Location:** ${person.location || 'N/A'}\\n**Age:** ${person.age || 'N/A'}\\n\\n**Professional Information:**\\n**Current Title:** ${person.job_title || 'N/A'}\\n**Current Company:** ${person.company_name || 'N/A'}\\n**Company Domain:** ${person.company_domain || 'N/A'}\\n**Department:** ${person.department || 'N/A'}\\n**Seniority Level:** ${person.seniority_level || 'N/A'}\\n**Industry:** ${person.industry || 'N/A'}\\n**Work Experience:** ${person.work_experience || 'N/A'}\\n\\n**Skills & Education:**\\n**Skills:** ${person.skills?.join(', ') || 'N/A'}\\n**Education:** ${person.education || 'N/A'}\\n**Certifications:** ${person.certifications?.join(', ') || 'N/A'}\\n\\n**Social & Additional:**\\n**Social Profiles:** ${person.social_profiles?.join(', ') || 'N/A'}\\n**Interests:** ${person.interests?.join(', ') || 'N/A'}\\n**Languages:** ${person.languages?.join(', ') || 'N/A'}\\n\\n**Data Quality:**\\n**Confidence Score:** ${person.confidence_score || 'N/A'}%\\n**Last Updated:** ${person.last_updated || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Ocean.io person enrichment failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'ocean-account-info': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Ocean.io API key is required');
      }

      try {
        const response = await axios.get('https://api.ocean.io/v1/account', {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });

        const data = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**Ocean.io Account Information:**\\n\\n**Account Details:**\\n**Name:** ${data.name || 'N/A'}\\n**Email:** ${data.email || 'N/A'}\\n**Company:** ${data.company || 'N/A'}\\n**Plan:** ${data.plan || 'N/A'}\\n**Status:** ${data.status || 'N/A'}\\n\\n**Usage Statistics:**\\n**Credits Used:** ${data.credits_used || 'N/A'}\\n**Credits Remaining:** ${data.credits_remaining || 'N/A'}\\n**Total Credits:** ${data.total_credits || 'N/A'}\\n**Monthly Limit:** ${data.monthly_limit || 'N/A'}\\n\\n**API Usage:**\\n**Person Searches:** ${data.person_searches_used || 'N/A'}\\n**Company Searches:** ${data.company_searches_used || 'N/A'}\\n**Enrichments:** ${data.enrichments_used || 'N/A'}\\n**Bulk Operations:** ${data.bulk_operations_used || 'N/A'}\\n\\n**Billing Information:**\\n**Billing Cycle:** ${data.billing_cycle || 'N/A'}\\n**Next Billing Date:** ${data.next_billing_date || 'N/A'}\\n**Last Payment:** ${data.last_payment_date || 'N/A'}\\n**Payment Method:** ${data.payment_method || 'N/A'}\\n\\n**Rate Limits:**\\n**Requests Per Minute:** ${data.rate_limit_per_minute || 'N/A'}\\n**Requests Per Hour:** ${data.rate_limit_per_hour || 'N/A'}\\n**Daily Requests:** ${data.daily_request_limit || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Ocean.io account info failed: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}