// FindyMail MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * FindyMail MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'FINDYMAIL_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'findymail-find-email',
      title: 'FindyMail Find Email',
      description: 'Find email addresses for a person using FindyMail API',
      inputSchema: {
        first_name: z.string().describe('First name of the person'),
        last_name: z.string().describe('Last name of the person'),
        domain: z.string().describe('Company domain'),
        company_name: z.string().optional().describe('Company name (optional)'),
        linkedin_url: z.string().optional().describe('LinkedIn profile URL (optional)')
      }
    },
    {
      name: 'findymail-verify-email',
      title: 'FindyMail Verify Email',
      description: 'Verify the deliverability of an email address using FindyMail API',
      inputSchema: {
        email: z.string().describe('Email address to verify')
      }
    },
    {
      name: 'findymail-domain-search',
      title: 'FindyMail Domain Search',
      description: 'Search for all email addresses in a domain using FindyMail API',
      inputSchema: {
        domain: z.string().describe('Domain to search for emails'),
        limit: z.number().optional().describe('Maximum number of emails to return (default: 50)'),
        department: z.string().optional().describe('Filter by department'),
        seniority: z.string().optional().describe('Filter by seniority level')
      }
    },
    {
      name: 'findymail-bulk-verify',
      title: 'FindyMail Bulk Email Verification',
      description: 'Verify multiple email addresses in bulk using FindyMail API',
      inputSchema: {
        emails: z.array(z.string()).describe('Array of email addresses to verify')
      }
    },
    {
      name: 'findymail-account-credits',
      title: 'FindyMail Account Credits',
      description: 'Get account information and remaining credits',
      inputSchema: {}
    },
    {
      name: 'findymail-enrich-contact',
      title: 'FindyMail Enrich Contact',
      description: 'Enrich contact information with additional data points',
      inputSchema: {
        email: z.string().optional().describe('Email address to enrich'),
        linkedin_url: z.string().optional().describe('LinkedIn profile URL to enrich'),
        first_name: z.string().optional().describe('First name'),
        last_name: z.string().optional().describe('Last name'),
        company_domain: z.string().optional().describe('Company domain')
      }
    }
  ];

  const toolHandlers = {
    'findymail-find-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('FindyMail API key is required');
      }

      try {
        const requestData = {
          first_name: args.first_name,
          last_name: args.last_name,
          domain: args.domain
        };

        if (args.company_name) requestData.company_name = args.company_name;
        if (args.linkedin_url) requestData.linkedin_url = args.linkedin_url;

        const response = await axios.post(
          'https://app.findymail.com/api/v1/email/find',
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
              text: `**FindyMail Email Discovery Results:**\\n\\n**Name:** ${args.first_name} ${args.last_name}\\n**Email:** ${data.email}\\n**Company:** ${args.company_name || args.domain}\\n**Domain:** ${args.domain}\\n**Confidence Score:** ${data.confidence || 'N/A'}\\n**Source:** ${data.source || 'N/A'}\\n**Verification Status:** ${data.verification_status || 'N/A'}\\n**LinkedIn:** ${args.linkedin_url || 'N/A'}\\n\\n**Additional Information:**\\n**Position:** ${data.position || 'N/A'}\\n**Department:** ${data.department || 'N/A'}\\n**Phone:** ${data.phone || 'N/A'}\\n**Social Profiles:** ${data.social_profiles?.join(', ') || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`FindyMail email discovery failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'findymail-verify-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('FindyMail API key is required');
      }

      try {
        const response = await axios.post(
          'https://app.findymail.com/api/v1/email/verify',
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
              text: `**FindyMail Email Verification Results:**\\n\\n**Email:** ${args.email}\\n**Status:** ${data.status}\\n**Deliverable:** ${data.deliverable ? 'Yes' : 'No'}\\n**Valid Format:** ${data.valid_format ? 'Yes' : 'No'}\\n**MX Record Found:** ${data.mx_record ? 'Yes' : 'No'}\\n**SMTP Valid:** ${data.smtp_valid ? 'Yes' : 'No'}\\n**Disposable:** ${data.disposable ? 'Yes' : 'No'}\\n**Free Provider:** ${data.free_provider ? 'Yes' : 'No'}\\n**Role Account:** ${data.role_account ? 'Yes' : 'No'}\\n**Catch All:** ${data.catch_all ? 'Yes' : 'No'}\\n\\n**Technical Details:**\\n**Domain:** ${data.domain || 'N/A'}\\n**Username:** ${data.username || 'N/A'}\\n**Risk Score:** ${data.risk_score || 'N/A'}\\n**Confidence:** ${data.confidence || 'N/A'}%\\n**Response Time:** ${data.response_time || 'N/A'}ms`
            }
          ]
        };
      } catch (error) {
        throw new Error(`FindyMail email verification failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'findymail-domain-search': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('FindyMail API key is required');
      }

      try {
        const requestData = {
          domain: args.domain,
          limit: args.limit || 50
        };

        if (args.department) requestData.department = args.department;
        if (args.seniority) requestData.seniority = args.seniority;

        const response = await axios.post(
          'https://app.findymail.com/api/v1/domain/search',
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
          return `${index + 1}. **${email.email}**\\n   Name: ${email.first_name || ''} ${email.last_name || 'Unknown'}\\n   Position: ${email.position || 'N/A'}\\n   Department: ${email.department || 'N/A'}\\n   Seniority: ${email.seniority || 'N/A'}\\n   LinkedIn: ${email.linkedin_url || 'N/A'}\\n   Phone: ${email.phone || 'N/A'}\\n   Verification: ${email.verification_status || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**FindyMail Domain Search Results for ${args.domain}:**\\n\\n**Company Information:**\\n**Domain:** ${args.domain}\\n**Total Emails Found:** ${data.total_count || emails.length}\\n**Department Filter:** ${args.department || 'All'}\\n**Seniority Filter:** ${args.seniority || 'All'}\\n\\n**Email Results:**\\n\\n${emailResults.join('\\n')}\\n\\n**Showing:** ${emails.length} results (limit: ${args.limit || 50})`
            }
          ]
        };
      } catch (error) {
        throw new Error(`FindyMail domain search failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'findymail-bulk-verify': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('FindyMail API key is required');
      }

      try {
        const response = await axios.post(
          'https://app.findymail.com/api/v1/email/bulk-verify',
          { emails: args.emails },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const data = response.data;
        const results = data.results || [];

        if (results.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No verification results returned."
            }]
          };
        }

        const verificationResults = results.map((result, index) => {
          return `${index + 1}. **${result.email}**\\n   Status: ${result.status}\\n   Deliverable: ${result.deliverable ? 'Yes' : 'No'}\\n   Valid Format: ${result.valid_format ? 'Yes' : 'No'}\\n   Risk Score: ${result.risk_score || 'N/A'}\\n   Confidence: ${result.confidence || 'N/A'}%\\n`;
        });

        const summary = {
          total: results.length,
          deliverable: results.filter(r => r.deliverable).length,
          undeliverable: results.filter(r => !r.deliverable).length,
          risky: results.filter(r => r.risk_score && r.risk_score > 50).length
        };

        return {
          content: [
            {
              type: "text",
              text: `**FindyMail Bulk Email Verification Results:**\\n\\n**Summary:**\\n**Total Emails:** ${summary.total}\\n**Deliverable:** ${summary.deliverable}\\n**Undeliverable:** ${summary.undeliverable}\\n**Risky:** ${summary.risky}\\n**Success Rate:** ${Math.round((summary.deliverable / summary.total) * 100)}%\\n\\n**Individual Results:**\\n\\n${verificationResults.join('\\n')}\\n\\n**Credits Used:** ${data.credits_used || 'N/A'}\\n**Processing Time:** ${data.processing_time || 'N/A'}ms`
            }
          ]
        };
      } catch (error) {
        throw new Error(`FindyMail bulk verification failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'findymail-account-credits': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('FindyMail API key is required');
      }

      try {
        const response = await axios.get(
          'https://app.findymail.com/api/v1/account/credits',
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
              text: `**FindyMail Account Information:**\\n\\n**Credit Information:**\\n**Credits Remaining:** ${data.credits_remaining || 'N/A'}\\n**Credits Used:** ${data.credits_used || 'N/A'}\\n**Total Credits:** ${data.total_credits || 'N/A'}\\n**Credit Type:** ${data.credit_type || 'N/A'}\\n\\n**Account Details:**\\n**Plan:** ${data.plan || 'N/A'}\\n**Plan Status:** ${data.plan_status || 'N/A'}\\n**Billing Cycle:** ${data.billing_cycle || 'N/A'}\\n**Next Billing Date:** ${data.next_billing_date || 'N/A'}\\n\\n**Usage Statistics:**\\n**Email Finder Used:** ${data.email_finder_used || 'N/A'}\\n**Email Verifier Used:** ${data.email_verifier_used || 'N/A'}\\n**Domain Search Used:** ${data.domain_search_used || 'N/A'}\\n**Bulk Operations Used:** ${data.bulk_operations_used || 'N/A'}\\n\\n**Account Status:** ${data.status || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`FindyMail account credits failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'findymail-enrich-contact': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('FindyMail API key is required');
      }

      try {
        const requestData = {};
        
        if (args.email) requestData.email = args.email;
        if (args.linkedin_url) requestData.linkedin_url = args.linkedin_url;
        if (args.first_name) requestData.first_name = args.first_name;
        if (args.last_name) requestData.last_name = args.last_name;
        if (args.company_domain) requestData.company_domain = args.company_domain;

        const response = await axios.post(
          'https://app.findymail.com/api/v1/contact/enrich',
          requestData,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const data = response.data;

        if (!data || (!data.email && !data.first_name && !data.last_name)) {
          return {
            content: [{
              type: "text",
              text: "Unable to enrich the provided contact information."
            }]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `**FindyMail Contact Enrichment Results:**\\n\\n**Personal Information:**\\n**Name:** ${data.first_name || ''} ${data.last_name || ''}\\n**Email:** ${data.email || 'N/A'}\\n**Phone:** ${data.phone || 'N/A'}\\n**LinkedIn:** ${data.linkedin_url || 'N/A'}\\n\\n**Professional Information:**\\n**Current Position:** ${data.current_position || 'N/A'}\\n**Current Company:** ${data.current_company || 'N/A'}\\n**Company Domain:** ${data.company_domain || 'N/A'}\\n**Department:** ${data.department || 'N/A'}\\n**Seniority Level:** ${data.seniority_level || 'N/A'}\\n**Industry:** ${data.industry || 'N/A'}\\n\\n**Location Information:**\\n**Location:** ${data.location || 'N/A'}\\n**Country:** ${data.country || 'N/A'}\\n**City:** ${data.city || 'N/A'}\\n\\n**Additional Data:**\\n**Social Profiles:** ${data.social_profiles?.join(', ') || 'N/A'}\\n**Skills:** ${data.skills?.join(', ') || 'N/A'}\\n**Education:** ${data.education || 'N/A'}\\n**Experience Years:** ${data.experience_years || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`FindyMail contact enrichment failed: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}