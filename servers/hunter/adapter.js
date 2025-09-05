// Hunter.io MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * Hunter.io MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'HUNTER_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'hunter-find-email',
      title: 'Hunter Find Email',
      description: 'Find email addresses associated with a domain using Hunter.io',
      inputSchema: {
        domain: z.string().describe('Domain name to find emails for'),
        first_name: z.string().optional().describe('First name of the person'),
        last_name: z.string().optional().describe('Last name of the person'),
        full_name: z.string().optional().describe('Full name of the person'),
        max_duration: z.number().optional().describe('Maximum duration to search (in seconds)'),
        company: z.string().optional().describe('Company name')
      }
    },
    {
      name: 'hunter-verify-email',
      title: 'Hunter Verify Email',
      description: 'Verify the deliverability of an email address using Hunter.io',
      inputSchema: {
        email: z.string().describe('Email address to verify')
      }
    },
    {
      name: 'hunter-domain-search',
      title: 'Hunter Domain Search',
      description: 'Search for all email addresses associated with a domain using Hunter.io',
      inputSchema: {
        domain: z.string().describe('Domain name to search'),
        limit: z.number().optional().describe('Maximum number of email addresses to return (max 100)'),
        offset: z.number().optional().describe('Number of email addresses to skip'),
        type: z.enum(['personal', 'generic']).optional().describe('Type of email addresses to return'),
        seniority: z.enum(['junior', 'senior', 'executive']).optional().describe('Seniority level filter'),
        department: z.string().optional().describe('Department filter')
      }
    },
    {
      name: 'hunter-email-count',
      title: 'Hunter Email Count',
      description: 'Get the number of email addresses available for a domain using Hunter.io',
      inputSchema: {
        domain: z.string().describe('Domain name to count emails for')
      }
    },
    {
      name: 'hunter-account-info',
      title: 'Hunter Account Info',
      description: 'Get information about the Hunter.io account (API usage, plan details)',
      inputSchema: {}
    }
  ];

  const toolHandlers = {
    'hunter-find-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Hunter.io API key is required');
      }

      try {
        const params = {
          domain: args.domain,
          api_key: apiKey
        };

        // Add optional parameters
        if (args.first_name) params.first_name = args.first_name;
        if (args.last_name) params.last_name = args.last_name;
        if (args.full_name) params.full_name = args.full_name;
        if (args.max_duration) params.max_duration = args.max_duration;
        if (args.company) params.company = args.company;

        const response = await axios.get(
          'https://api.hunter.io/v2/email-finder',
          { params }
        );

        const data = response.data.data;
        if (!data) {
          return {
            content: [{
              type: "text",
              text: "No email found for the provided information."
            }]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `**Hunter Email Finder Results:**\\n\\n**Email:** ${data.email || 'Not found'}\\n**Confidence Score:** ${data.score || 'N/A'}%\\n**First Name:** ${data.first_name || 'N/A'}\\n**Last Name:** ${data.last_name || 'N/A'}\\n**Domain:** ${args.domain}\\n**Company:** ${data.company || args.company || 'N/A'}\\n**Position:** ${data.position || 'N/A'}\\n**LinkedIn:** ${data.linkedin || 'N/A'}\\n**Twitter:** ${data.twitter || 'N/A'}\\n**Phone:** ${data.phone_number || 'N/A'}\\n\\n**Sources:** ${data.sources?.map(s => s.uri).join(', ') || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Hunter email finder failed: ${error.response?.data?.errors?.[0]?.details || error.message}`);
      }
    },

    'hunter-verify-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Hunter.io API key is required');
      }

      try {
        const params = {
          email: args.email,
          api_key: apiKey
        };

        const response = await axios.get(
          'https://api.hunter.io/v2/email-verifier',
          { params }
        );

        const data = response.data.data;

        return {
          content: [
            {
              type: "text",
              text: `**Hunter Email Verification Results:**\\n\\n**Email:** ${data.email}\\n**Result:** ${data.result}\\n**Score:** ${data.score || 'N/A'}%\\n**Deliverable:** ${data.result === 'deliverable' ? 'Yes' : 'No'}\\n**Disposable:** ${data.disposable ? 'Yes' : 'No'}\\n**Webmail:** ${data.webmail ? 'Yes' : 'No'}\\n**MX Records:** ${data.mx_records ? 'Found' : 'Not found'}\\n**SMTP Server:** ${data.smtp_server ? 'Reachable' : 'Not reachable'}\\n**SMTP Check:** ${data.smtp_check ? 'Valid' : 'Invalid'}\\n**Accept All:** ${data.accept_all ? 'Yes' : 'No'}\\n**Block:** ${data.block ? 'Yes' : 'No'}\\n\\n**Regexp:** ${data.regexp ? 'Valid format' : 'Invalid format'}\\n**Gibberish:** ${data.gibberish ? 'Yes' : 'No'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Hunter email verification failed: ${error.response?.data?.errors?.[0]?.details || error.message}`);
      }
    },

    'hunter-domain-search': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Hunter.io API key is required');
      }

      try {
        const params = {
          domain: args.domain,
          api_key: apiKey
        };

        // Add optional parameters
        if (args.limit) params.limit = args.limit;
        if (args.offset) params.offset = args.offset;
        if (args.type) params.type = args.type;
        if (args.seniority) params.seniority = args.seniority;
        if (args.department) params.department = args.department;

        const response = await axios.get(
          'https://api.hunter.io/v2/domain-search',
          { params }
        );

        const data = response.data.data;
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
          return `${index + 1}. **${email.value}**\\n   Name: ${email.first_name || ''} ${email.last_name || 'Unknown'}\\n   Position: ${email.position || 'N/A'}\\n   Department: ${email.department || 'N/A'}\\n   Seniority: ${email.seniority || 'N/A'}\\n   Type: ${email.type || 'N/A'}\\n   Confidence: ${email.confidence || 'N/A'}%\\n   LinkedIn: ${email.linkedin || 'N/A'}\\n   Twitter: ${email.twitter || 'N/A'}\\n   Phone: ${email.phone_number || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**Hunter Domain Search Results for ${args.domain}:**\\n\\n**Company:** ${data.organization || 'N/A'}\\n**Total Emails:** ${data.total}\\n**Disposable Emails:** ${data.disposable_emails}\\n**Webmail Emails:** ${data.webmail_emails}\\n**Accept All Emails:** ${data.accept_all_emails}\\n**Pattern:** ${data.pattern || 'N/A'}\\n\\n**Email Addresses:**\\n\\n${emailResults.join('\\n')}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Hunter domain search failed: ${error.response?.data?.errors?.[0]?.details || error.message}`);
      }
    },

    'hunter-email-count': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Hunter.io API key is required');
      }

      try {
        const params = {
          domain: args.domain,
          api_key: apiKey
        };

        const response = await axios.get(
          'https://api.hunter.io/v2/email-count',
          { params }
        );

        const data = response.data.data;

        return {
          content: [
            {
              type: "text",
              text: `**Hunter Email Count Results:**\\n\\n**Domain:** ${args.domain}\\n**Total Emails:** ${data.total}\\n**Personal Emails:** ${data.personal_emails}\\n**Generic Emails:** ${data.generic_emails}\\n**Department Breakdown:**\\n${Object.entries(data.department || {}).map(([dept, count]) => `- ${dept}: ${count}`).join('\\n') || 'N/A'}\\n\\n**Seniority Breakdown:**\\n${Object.entries(data.seniority || {}).map(([level, count]) => `- ${level}: ${count}`).join('\\n') || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Hunter email count failed: ${error.response?.data?.errors?.[0]?.details || error.message}`);
      }
    },

    'hunter-account-info': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Hunter.io API key is required');
      }

      try {
        const params = {
          api_key: apiKey
        };

        const response = await axios.get(
          'https://api.hunter.io/v2/account',
          { params }
        );

        const data = response.data.data;

        return {
          content: [
            {
              type: "text",
              text: `**Hunter Account Information:**\\n\\n**First Name:** ${data.first_name || 'N/A'}\\n**Last Name:** ${data.last_name || 'N/A'}\\n**Email:** ${data.email || 'N/A'}\\n**Plan Name:** ${data.plan_name || 'N/A'}\\n**Plan Level:** ${data.plan_level || 'N/A'}\\n**Reset Date:** ${data.reset_date || 'N/A'}\\n\\n**API Usage:**\\n**Requests Used:** ${data.calls?.used || 0} / ${data.calls?.available || 0}\\n**Email Finder Calls:** ${data.calls?.email_finder || 0}\\n**Domain Search Calls:** ${data.calls?.domain_search || 0}\\n**Email Verifier Calls:** ${data.calls?.email_verifier || 0}\\n**Email Count Calls:** ${data.calls?.email_count || 0}\\n**Author Finder Calls:** ${data.calls?.author_finder || 0}\\n\\n**Team:** ${data.team ? 'Yes' : 'No'}\\n**Team ID:** ${data.team_id || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Hunter account info failed: ${error.response?.data?.errors?.[0]?.details || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}