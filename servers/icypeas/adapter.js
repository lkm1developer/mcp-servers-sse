// IcyPeas MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * IcyPeas MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'ICYPEAS_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'icypeas-find-email',
      title: 'IcyPeas Find Email',
      description: 'Find email addresses for a person using IcyPeas API',
      inputSchema: {
        first_name: z.string().describe('First name of the person'),
        last_name: z.string().describe('Last name of the person'),
        domain: z.string().describe('Company domain'),
        company_name: z.string().optional().describe('Company name (optional)')
      }
    },
    {
      name: 'icypeas-verify-email',
      title: 'IcyPeas Verify Email',
      description: 'Verify the deliverability of an email address using IcyPeas API',
      inputSchema: {
        email: z.string().describe('Email address to verify')
      }
    },
    {
      name: 'icypeas-domain-search',
      title: 'IcyPeas Domain Search',
      description: 'Search for all email addresses in a domain using IcyPeas API',
      inputSchema: {
        domain: z.string().describe('Domain to search for emails'),
        limit: z.number().optional().describe('Maximum number of emails to return (default: 50)')
      }
    },
    {
      name: 'icypeas-account-info',
      title: 'IcyPeas Account Info',
      description: 'Get account information and remaining credits',
      inputSchema: {}
    }
  ];

  const toolHandlers = {
    'icypeas-find-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('IcyPeas API key is required');
      }

      try {
        const requestData = {
          first_name: args.first_name,
          last_name: args.last_name,
          domain: args.domain
        };

        if (args.company_name) requestData.company_name = args.company_name;

        const response = await axios.post(
          'https://api.icypeas.com/v1/email-finder',
          requestData,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const data = response.data;

        if (!data.email) {
          return {
            content: [{
              type: "text",
              text: `No email found for ${args.first_name} ${args.last_name} at ${args.domain}`
            }]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `**IcyPeas Email Discovery Results:**\\n\\n**Name:** ${args.first_name} ${args.last_name}\\n**Email:** ${data.email}\\n**Company:** ${args.company_name || args.domain}\\n**Domain:** ${args.domain}\\n**Confidence Score:** ${data.confidence || 'N/A'}\\n**Source:** ${data.source || 'N/A'}\\n**Verification Status:** ${data.verification_status || 'N/A'}\\n\\n**Credits Used:** ${data.credits_used || 'N/A'}\\n**Credits Remaining:** ${data.credits_remaining || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`IcyPeas email finder failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'icypeas-verify-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('IcyPeas API key is required');
      }

      try {
        const response = await axios.post(
          'https://api.icypeas.com/v1/email-verifier',
          { email: args.email },
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
              text: `**IcyPeas Email Verification Results:**\\n\\n**Email:** ${args.email}\\n**Status:** ${data.status}\\n**Deliverable:** ${data.deliverable ? 'Yes' : 'No'}\\n**Valid Format:** ${data.valid_format ? 'Yes' : 'No'}\\n**MX Record:** ${data.mx_record ? 'Found' : 'Not found'}\\n**SMTP Valid:** ${data.smtp_valid ? 'Yes' : 'No'}\\n**Disposable:** ${data.disposable ? 'Yes' : 'No'}\\n**Free Provider:** ${data.free_provider ? 'Yes' : 'No'}\\n**Role Account:** ${data.role_account ? 'Yes' : 'No'}\\n**Catch All:** ${data.catch_all ? 'Yes' : 'No'}\\n\\n**Risk Score:** ${data.risk_score || 'N/A'}\\n**Confidence:** ${data.confidence || 'N/A'}%\\n**Credits Used:** ${data.credits_used || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`IcyPeas email verification failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'icypeas-domain-search': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('IcyPeas API key is required');
      }

      try {
        const requestData = {
          domain: args.domain,
          limit: args.limit || 50
        };

        const response = await axios.post(
          'https://api.icypeas.com/v1/domain-search',
          requestData,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
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
          return `${index + 1}. **${email.email}**\\n   Name: ${email.first_name || ''} ${email.last_name || 'Unknown'}\\n   Position: ${email.position || 'N/A'}\\n   Department: ${email.department || 'N/A'}\\n   Confidence: ${email.confidence || 'N/A'}\\n   Verification: ${email.verification_status || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**IcyPeas Domain Search Results for ${args.domain}:**\\n\\n**Total Emails Found:** ${data.total_count || emails.length}\\n**Company:** ${data.company_name || 'N/A'}\\n\\n**Email Results:**\\n\\n${emailResults.join('\\n')}\\n\\n**Credits Used:** ${data.credits_used || 'N/A'}\\n**Credits Remaining:** ${data.credits_remaining || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`IcyPeas domain search failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'icypeas-account-info': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('IcyPeas API key is required');
      }

      try {
        const response = await axios.get(
          'https://api.icypeas.com/v1/account',
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            }
          }
        );

        const data = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**IcyPeas Account Information:**\\n\\n**Account Details:**\\n**Name:** ${data.name || 'N/A'}\\n**Email:** ${data.email || 'N/A'}\\n**Plan:** ${data.plan || 'N/A'}\\n**Status:** ${data.status || 'N/A'}\\n\\n**Credit Information:**\\n**Credits Remaining:** ${data.credits_remaining || 'N/A'}\\n**Credits Used:** ${data.credits_used || 'N/A'}\\n**Total Credits:** ${data.total_credits || 'N/A'}\\n**Monthly Limit:** ${data.monthly_limit || 'N/A'}\\n\\n**Usage Statistics:**\\n**Email Finder Used:** ${data.email_finder_used || 'N/A'}\\n**Email Verifier Used:** ${data.email_verifier_used || 'N/A'}\\n**Domain Search Used:** ${data.domain_search_used || 'N/A'}\\n\\n**Billing Information:**\\n**Next Billing Date:** ${data.next_billing_date || 'N/A'}\\n**Billing Cycle:** ${data.billing_cycle || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`IcyPeas account info failed: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}