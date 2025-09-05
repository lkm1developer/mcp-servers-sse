// Prospeo MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * Prospeo MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'PROSPEO_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'prospeo-find-work-email',
      title: 'Prospeo Find Work Email',
      description: 'Find work email addresses for a person using Prospeo API',
      inputSchema: {
        first_name: z.string().describe('First name of the person'),
        last_name: z.string().describe('Last name of the person'),
        company_domain: z.string().describe('Company domain or website'),
        company_name: z.string().optional().describe('Company name (optional)'),
        linkedin_url: z.string().optional().describe('LinkedIn profile URL (optional)')
      }
    },
    {
      name: 'prospeo-find-domain-emails',
      title: 'Prospeo Find Domain Emails',
      description: 'Find all email addresses associated with a domain using Prospeo API',
      inputSchema: {
        domain: z.string().describe('Domain to search for emails'),
        limit: z.number().optional().describe('Maximum number of emails to return (default: 50)'),
        offset: z.number().optional().describe('Pagination offset'),
        department: z.string().optional().describe('Filter by department'),
        seniority: z.string().optional().describe('Filter by seniority level')
      }
    },
    {
      name: 'prospeo-find-mobile-number',
      title: 'Prospeo Find Mobile Number',
      description: 'Find mobile phone number for a person using Prospeo API',
      inputSchema: {
        first_name: z.string().describe('First name of the person'),
        last_name: z.string().describe('Last name of the person'),
        company_domain: z.string().describe('Company domain or website'),
        location: z.string().optional().describe('Location/country of the person'),
        linkedin_url: z.string().optional().describe('LinkedIn profile URL (optional)')
      }
    },
    {
      name: 'prospeo-verify-email',
      title: 'Prospeo Verify Email',
      description: 'Verify the deliverability and validity of an email address using Prospeo API',
      inputSchema: {
        email: z.string().describe('Email address to verify')
      }
    },
    {
      name: 'prospeo-enrich-from-linkedin',
      title: 'Prospeo Enrich from LinkedIn',
      description: 'Enrich person information from LinkedIn profile using Prospeo API',
      inputSchema: {
        linkedin_url: z.string().describe('LinkedIn profile URL to enrich')
      }
    }
  ];

  const toolHandlers = {
    'prospeo-find-work-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Prospeo API key is required');
      }

      try {
        const requestData = {
          first_name: args.first_name,
          last_name: args.last_name,
          company_domain: args.company_domain
        };

        // Add optional parameters
        if (args.company_name) requestData.company_name = args.company_name;
        if (args.linkedin_url) requestData.linkedin_url = args.linkedin_url;

        const response = await axios.post(
          'https://api.prospeo.io/email-finder',
          requestData,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-KEY': apiKey
            }
          }
        );

        const data = response.data;

        if (!data.email) {
          return {
            content: [{
              type: "text",
              text: `No work email found for ${args.first_name} ${args.last_name} at ${args.company_domain}`
            }]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `**Prospeo Find Work Email Results:**\\n\\n**Name:** ${args.first_name} ${args.last_name}\\n**Email:** ${data.email}\\n**Company:** ${args.company_name || args.company_domain}\\n**Domain:** ${args.company_domain}\\n**Confidence Score:** ${data.score || 'N/A'}\\n**Source:** ${data.source || 'N/A'}\\n**LinkedIn:** ${args.linkedin_url || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Prospeo find work email failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'prospeo-find-domain-emails': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Prospeo API key is required');
      }

      try {
        const requestData = {
          domain: args.domain,
          limit: args.limit || 50
        };

        // Add optional parameters
        if (args.offset) requestData.offset = args.offset;
        if (args.department) requestData.department = args.department;
        if (args.seniority) requestData.seniority = args.seniority;

        const response = await axios.post(
          'https://api.prospeo.io/domain-search',
          requestData,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-KEY': apiKey
            }
          }
        );

        const data = response.data;
        const emails = data.emails || [];

        if (emails.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No emails found for domain: ${args.domain}`
            }]
          };
        }

        const emailResults = emails.map((email, index) => {
          return `${index + 1}. **${email.email}**\\n   Name: ${email.first_name || ''} ${email.last_name || 'Unknown'}\\n   Position: ${email.position || 'N/A'}\\n   Department: ${email.department || 'N/A'}\\n   Seniority: ${email.seniority || 'N/A'}\\n   LinkedIn: ${email.linkedin_url || 'N/A'}\\n   Phone: ${email.phone || 'N/A'}\\n   Confidence: ${email.score || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**Prospeo Domain Search Results for ${args.domain}:**\\n\\n**Total Emails Found:** ${data.total || emails.length}\\n**Company:** ${data.company_name || 'N/A'}\\n\\n**Email Addresses:**\\n\\n${emailResults.join('\\n')}\\n\\n**Pagination:** Page ${Math.floor((args.offset || 0) / (args.limit || 50)) + 1}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Prospeo domain search failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'prospeo-find-mobile-number': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Prospeo API key is required');
      }

      try {
        const requestData = {
          first_name: args.first_name,
          last_name: args.last_name,
          company_domain: args.company_domain
        };

        // Add optional parameters
        if (args.location) requestData.location = args.location;
        if (args.linkedin_url) requestData.linkedin_url = args.linkedin_url;

        const response = await axios.post(
          'https://api.prospeo.io/phone-finder',
          requestData,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-KEY': apiKey
            }
          }
        );

        const data = response.data;

        if (!data.phone) {
          return {
            content: [{
              type: "text",
              text: `No mobile number found for ${args.first_name} ${args.last_name} at ${args.company_domain}`
            }]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `**Prospeo Find Mobile Number Results:**\\n\\n**Name:** ${args.first_name} ${args.last_name}\\n**Mobile Number:** ${data.phone}\\n**Company Domain:** ${args.company_domain}\\n**Location:** ${args.location || 'N/A'}\\n**Confidence Score:** ${data.score || 'N/A'}\\n**Source:** ${data.source || 'N/A'}\\n**LinkedIn:** ${args.linkedin_url || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Prospeo find mobile number failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'prospeo-verify-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Prospeo API key is required');
      }

      try {
        const response = await axios.post(
          'https://api.prospeo.io/email-verifier',
          { email: args.email },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-KEY': apiKey
            }
          }
        );

        const data = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**Prospeo Email Verification Results:**\\n\\n**Email:** ${args.email}\\n**Status:** ${data.status || 'N/A'}\\n**Valid:** ${data.valid ? 'Yes' : 'No'}\\n**Deliverable:** ${data.deliverable ? 'Yes' : 'No'}\\n**Disposable:** ${data.disposable ? 'Yes' : 'No'}\\n**Catch All:** ${data.catch_all ? 'Yes' : 'No'}\\n**Gibberish:** ${data.gibberish ? 'Yes' : 'No'}\\n**Spam:** ${data.spam ? 'Yes' : 'No'}\\n**MX Record:** ${data.mx_record ? 'Found' : 'Not found'}\\n**SMTP Valid:** ${data.smtp_valid ? 'Yes' : 'No'}\\n**Role Account:** ${data.role_account ? 'Yes' : 'No'}\\n**Free Provider:** ${data.free_provider ? 'Yes' : 'No'}\\n\\n**Domain:** ${data.domain || 'N/A'}\\n**Username:** ${data.username || 'N/A'}\\n**Score:** ${data.score || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Prospeo email verification failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'prospeo-enrich-from-linkedin': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Prospeo API key is required');
      }

      try {
        const response = await axios.post(
          'https://api.prospeo.io/linkedin-email-finder',
          { linkedin_url: args.linkedin_url },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-KEY': apiKey
            }
          }
        );

        const data = response.data;

        if (!data.email && !data.first_name && !data.last_name) {
          return {
            content: [{
              type: "text",
              text: `Unable to enrich data from LinkedIn profile: ${args.linkedin_url}`
            }]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `**Prospeo LinkedIn Enrichment Results:**\\n\\n**LinkedIn URL:** ${args.linkedin_url}\\n\\n**Personal Information:**\\n**Name:** ${data.first_name || ''} ${data.last_name || ''}\\n**Email:** ${data.email || 'N/A'}\\n**Phone:** ${data.phone || 'N/A'}\\n\\n**Professional Information:**\\n**Current Position:** ${data.current_position || 'N/A'}\\n**Current Company:** ${data.current_company || 'N/A'}\\n**Company Domain:** ${data.company_domain || 'N/A'}\\n**Industry:** ${data.industry || 'N/A'}\\n**Location:** ${data.location || 'N/A'}\\n\\n**Profile Details:**\\n**Headline:** ${data.headline || 'N/A'}\\n**Summary:** ${data.summary ? data.summary.substring(0, 200) + '...' : 'N/A'}\\n**Connections:** ${data.connections || 'N/A'}\\n**Profile Picture:** ${data.profile_picture || 'N/A'}\\n\\n**Contact Score:** ${data.score || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Prospeo LinkedIn enrichment failed: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}