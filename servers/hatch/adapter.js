// Hatch MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * Hatch MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'HATCH_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'hatch-find-contact',
      title: 'Hatch Find Contact',
      description: 'Find contact information using Hatch API',
      inputSchema: {
        first_name: z.string().describe('First name of the person'),
        last_name: z.string().describe('Last name of the person'),
        company: z.string().optional().describe('Company name'),
        domain: z.string().optional().describe('Company domain'),
        linkedin_url: z.string().optional().describe('LinkedIn profile URL')
      }
    },
    {
      name: 'hatch-verify-contact',
      title: 'Hatch Verify Contact',
      description: 'Verify contact information using Hatch API',
      inputSchema: {
        email: z.string().optional().describe('Email address to verify'),
        phone: z.string().optional().describe('Phone number to verify')
      }
    },
    {
      name: 'hatch-enrich-company',
      title: 'Hatch Enrich Company',
      description: 'Enrich company information using Hatch API',
      inputSchema: {
        company_name: z.string().optional().describe('Company name'),
        domain: z.string().optional().describe('Company domain'),
        linkedin_url: z.string().optional().describe('Company LinkedIn URL')
      }
    },
    {
      name: 'hatch-search-contacts',
      title: 'Hatch Search Contacts',
      description: 'Search for contacts with filters using Hatch API',
      inputSchema: {
        company: z.string().optional().describe('Company to search within'),
        title: z.string().optional().describe('Job title filter'),
        location: z.string().optional().describe('Location filter'),
        industry: z.string().optional().describe('Industry filter'),
        limit: z.number().optional().describe('Maximum number of results (default: 50)')
      }
    },
    {
      name: 'hatch-account-info',
      title: 'Hatch Account Info',
      description: 'Get account information and usage statistics',
      inputSchema: {}
    }
  ];

  const toolHandlers = {
    'hatch-find-contact': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Hatch API key is required');
      }

      try {
        const requestData = {
          first_name: args.first_name,
          last_name: args.last_name
        };

        if (args.company) requestData.company = args.company;
        if (args.domain) requestData.domain = args.domain;
        if (args.linkedin_url) requestData.linkedin_url = args.linkedin_url;

        const response = await axios.post(
          'https://api.hatch.co/v1/contacts/find',
          requestData,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const data = response.data;

        if (!data.contact) {
          return {
            content: [{
              type: "text",
              text: `No contact found for ${args.first_name} ${args.last_name} ${args.company ? `at ${args.company}` : ''}`
            }]
          };
        }

        const contact = data.contact;

        return {
          content: [
            {
              type: "text",
              text: `**Hatch Contact Find Results:**\\n\\n**Personal Information:**\\n**Name:** ${contact.first_name || ''} ${contact.last_name || ''}\\n**Email:** ${contact.email || 'N/A'}\\n**Phone:** ${contact.phone || 'N/A'}\\n**LinkedIn:** ${contact.linkedin_url || 'N/A'}\\n\\n**Professional Information:**\\n**Title:** ${contact.title || 'N/A'}\\n**Company:** ${contact.company || 'N/A'}\\n**Domain:** ${contact.domain || 'N/A'}\\n**Department:** ${contact.department || 'N/A'}\\n**Seniority:** ${contact.seniority || 'N/A'}\\n**Location:** ${contact.location || 'N/A'}\\n\\n**Confidence Score:** ${contact.confidence_score || 'N/A'}%\\n**Last Updated:** ${contact.last_updated || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Hatch contact find failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'hatch-verify-contact': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Hatch API key is required');
      }

      try {
        const requestData = {};
        if (args.email) requestData.email = args.email;
        if (args.phone) requestData.phone = args.phone;

        if (Object.keys(requestData).length === 0) {
          throw new Error('Either email or phone number is required for verification');
        }

        const response = await axios.post(
          'https://api.hatch.co/v1/contacts/verify',
          requestData,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const data = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**Hatch Contact Verification Results:**\\n\\n${args.email ? `**Email Verification:**\\n**Email:** ${args.email}\\n**Valid:** ${data.email_valid ? 'Yes' : 'No'}\\n**Deliverable:** ${data.email_deliverable ? 'Yes' : 'No'}\\n**Risk Score:** ${data.email_risk_score || 'N/A'}\\n\\n` : ''}${args.phone ? `**Phone Verification:**\\n**Phone:** ${args.phone}\\n**Valid:** ${data.phone_valid ? 'Yes' : 'No'}\\n**Type:** ${data.phone_type || 'N/A'}\\n**Carrier:** ${data.phone_carrier || 'N/A'}\\n**Location:** ${data.phone_location || 'N/A'}\\n\\n` : ''}**Overall Confidence:** ${data.confidence_score || 'N/A'}%`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Hatch contact verification failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'hatch-enrich-company': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Hatch API key is required');
      }

      try {
        const requestData = {};
        if (args.company_name) requestData.company_name = args.company_name;
        if (args.domain) requestData.domain = args.domain;
        if (args.linkedin_url) requestData.linkedin_url = args.linkedin_url;

        if (Object.keys(requestData).length === 0) {
          throw new Error('At least one company identifier is required');
        }

        const response = await axios.post(
          'https://api.hatch.co/v1/companies/enrich',
          requestData,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const data = response.data;
        const company = data.company;

        if (!company) {
          return {
            content: [{
              type: "text",
              text: "No company information found for the provided data."
            }]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `**Hatch Company Enrichment Results:**\\n\\n**Basic Information:**\\n**Name:** ${company.name || 'N/A'}\\n**Domain:** ${company.domain || 'N/A'}\\n**Website:** ${company.website || 'N/A'}\\n**Industry:** ${company.industry || 'N/A'}\\n**Description:** ${company.description || 'N/A'}\\n\\n**Company Details:**\\n**Founded:** ${company.founded_year || 'N/A'}\\n**Employee Count:** ${company.employee_count || 'N/A'}\\n**Revenue:** ${company.revenue || 'N/A'}\\n**Funding:** ${company.funding_total || 'N/A'}\\n**Location:** ${company.location || 'N/A'}\\n**Headquarters:** ${company.headquarters || 'N/A'}\\n\\n**Contact Information:**\\n**Phone:** ${company.phone || 'N/A'}\\n**Email:** ${company.email || 'N/A'}\\n**LinkedIn:** ${company.linkedin_url || 'N/A'}\\n**Social Media:** ${company.social_profiles?.join(', ') || 'N/A'}\\n\\n**Technologies:** ${company.technologies?.join(', ') || 'N/A'}\\n**Keywords:** ${company.keywords?.join(', ') || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Hatch company enrichment failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'hatch-search-contacts': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Hatch API key is required');
      }

      try {
        const params = {
          limit: args.limit || 50
        };

        if (args.company) params.company = args.company;
        if (args.title) params.title = args.title;
        if (args.location) params.location = args.location;
        if (args.industry) params.industry = args.industry;

        const response = await axios.get('https://api.hatch.co/v1/contacts/search', {
          params,
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });

        const data = response.data;
        const contacts = data.contacts || [];

        if (contacts.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No contacts found matching the search criteria."
            }]
          };
        }

        const results = contacts.map((contact, index) => {
          return `${index + 1}. **${contact.first_name || ''} ${contact.last_name || 'Unknown'}**\\n   Title: ${contact.title || 'N/A'}\\n   Company: ${contact.company || 'N/A'}\\n   Email: ${contact.email || 'N/A'}\\n   Phone: ${contact.phone || 'N/A'}\\n   Location: ${contact.location || 'N/A'}\\n   LinkedIn: ${contact.linkedin_url || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**Hatch Contact Search Results:**\\n\\n${results.join('\\n')}\\n**Total Results:** ${data.total_count || contacts.length}\\n**Results Shown:** ${contacts.length}\\n\\n**Search Filters:**\\n**Company:** ${args.company || 'Any'}\\n**Title:** ${args.title || 'Any'}\\n**Location:** ${args.location || 'Any'}\\n**Industry:** ${args.industry || 'Any'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Hatch contact search failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'hatch-account-info': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Hatch API key is required');
      }

      try {
        const response = await axios.get('https://api.hatch.co/v1/account', {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });

        const data = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**Hatch Account Information:**\\n\\n**Account Details:**\\n**Name:** ${data.name || 'N/A'}\\n**Email:** ${data.email || 'N/A'}\\n**Company:** ${data.company || 'N/A'}\\n**Plan:** ${data.plan || 'N/A'}\\n**Status:** ${data.status || 'N/A'}\\n\\n**Usage Statistics:**\\n**Credits Used:** ${data.credits_used || 'N/A'}\\n**Credits Remaining:** ${data.credits_remaining || 'N/A'}\\n**Monthly Limit:** ${data.monthly_limit || 'N/A'}\\n**Daily Requests:** ${data.daily_requests || 'N/A'}\\n\\n**API Usage:**\\n**Contact Finds:** ${data.contact_finds_used || 'N/A'}\\n**Contact Verifications:** ${data.contact_verifications_used || 'N/A'}\\n**Company Enrichments:** ${data.company_enrichments_used || 'N/A'}\\n**Contact Searches:** ${data.contact_searches_used || 'N/A'}\\n\\n**Billing Information:**\\n**Next Billing Date:** ${data.next_billing_date || 'N/A'}\\n**Billing Cycle:** ${data.billing_cycle || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Hatch account info failed: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}