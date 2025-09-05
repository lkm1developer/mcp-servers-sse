// NeverBounce MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * NeverBounce MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'NEVERBOUNCE_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'neverbounce-verify-single',
      title: 'NeverBounce Verify Single Email',
      description: 'Verify a single email address using NeverBounce API',
      inputSchema: {
        email: z.string().describe('Email address to verify'),
        address_info: z.boolean().optional().describe('Include additional address information (default: false)'),
        credits_info: z.boolean().optional().describe('Include credits information (default: false)')
      }
    },
    {
      name: 'neverbounce-verify-bulk',
      title: 'NeverBounce Verify Bulk Emails',
      description: 'Verify multiple email addresses in bulk using NeverBounce API',
      inputSchema: {
        emails: z.array(z.string()).describe('Array of email addresses to verify'),
        auto_start: z.boolean().optional().describe('Auto-start the verification job (default: true)'),
        filename: z.string().optional().describe('Custom filename for the job')
      }
    },
    {
      name: 'neverbounce-job-status',
      title: 'NeverBounce Job Status',
      description: 'Get the status of a bulk verification job',
      inputSchema: {
        job_id: z.string().describe('Job ID to check status for')
      }
    },
    {
      name: 'neverbounce-job-results',
      title: 'NeverBounce Job Results',
      description: 'Get results from a completed bulk verification job',
      inputSchema: {
        job_id: z.string().describe('Job ID to get results for'),
        valids: z.boolean().optional().describe('Include valid emails (default: true)'),
        invalids: z.boolean().optional().describe('Include invalid emails (default: true)'),
        catchalls: z.boolean().optional().describe('Include catchall emails (default: true)'),
        unknowns: z.boolean().optional().describe('Include unknown emails (default: true)')
      }
    },
    {
      name: 'neverbounce-account-info',
      title: 'NeverBounce Account Info',
      description: 'Get account information including credit balance and usage stats',
      inputSchema: {}
    },
    {
      name: 'neverbounce-job-delete',
      title: 'NeverBounce Delete Job',
      description: 'Delete a bulk verification job and its results',
      inputSchema: {
        job_id: z.string().describe('Job ID to delete')
      }
    }
  ];

  const toolHandlers = {
    'neverbounce-verify-single': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('NeverBounce API key is required');
      }

      try {
        const params = {
          key: apiKey,
          email: args.email
        };

        if (args.address_info) params.address_info = 1;
        if (args.credits_info) params.credits_info = 1;

        const response = await axios.get('https://api.neverbounce.com/v4/single/check', { params });
        const data = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**NeverBounce Single Email Verification:**\\n\\n**Email:** ${args.email}\\n**Result:** ${data.result}\\n**Flags:** ${data.flags?.join(', ') || 'None'}\\n**Suggested Correction:** ${data.suggested_correction || 'None'}\\n**Execution Time:** ${data.execution_time || 'N/A'}ms\\n\\n**Address Information:**\\n${data.address_info ? `- Normalized: ${data.address_info.normalized}\\n- Original: ${data.address_info.original}\\n- Addr: ${data.address_info.addr}\\n- Alias: ${data.address_info.alias}\\n- Host: ${data.address_info.host}\\n- Subdomain: ${data.address_info.subdomain}\\n- Domain: ${data.address_info.domain}\\n- TLD: ${data.address_info.tld}` : 'Not requested'}\\n\\n**Credits Used:** ${data.credits_info?.used || 'N/A'}\\n**Credits Remaining:** ${data.credits_info?.remaining || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`NeverBounce single verification failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'neverbounce-verify-bulk': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('NeverBounce API key is required');
      }

      try {
        const requestData = {
          key: apiKey,
          input: args.emails,
          auto_start: args.auto_start !== false ? 1 : 0
        };

        if (args.filename) requestData.filename = args.filename;

        const response = await axios.post(
          'https://api.neverbounce.com/v4/jobs/create',
          requestData,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        const data = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**NeverBounce Bulk Verification Job Created:**\\n\\n**Job ID:** ${data.job_id}\\n**Status:** ${data.status}\\n**Total Records:** ${data.total_records}\\n**Credits Used:** ${data.credits_used || 'N/A'}\\n**Estimated Time:** ${data.estimated_completion_time || 'N/A'}\\n**Filename:** ${args.filename || 'Auto-generated'}\\n\\n**Email Count:** ${args.emails.length}\\n**Auto Start:** ${args.auto_start !== false ? 'Yes' : 'No'}\\n\\n**Note:** Use the job ID to check status and retrieve results when complete.`
            }
          ]
        };
      } catch (error) {
        throw new Error(`NeverBounce bulk verification failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'neverbounce-job-status': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('NeverBounce API key is required');
      }

      try {
        const params = {
          key: apiKey,
          job_id: args.job_id
        };

        const response = await axios.get('https://api.neverbounce.com/v4/jobs/status', { params });
        const data = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**NeverBounce Job Status:**\\n\\n**Job ID:** ${args.job_id}\\n**Status:** ${data.status}\\n**Job Type:** ${data.job_type || 'N/A'}\\n**Filename:** ${data.filename || 'N/A'}\\n**Created:** ${data.created_at || 'N/A'}\\n**Started:** ${data.started_at || 'N/A'}\\n**Finished:** ${data.finished_at || 'N/A'}\\n\\n**Progress:**\\n**Total Records:** ${data.total_records || 'N/A'}\\n**Processed Records:** ${data.processed_records || 'N/A'}\\n**Bounce Estimate:** ${data.bounce_estimate || 'N/A'}\\n**Percent Complete:** ${data.percent_complete || 'N/A'}%\\n\\n**Results:**\\n**Valid:** ${data.total?.valid || 'N/A'}\\n**Invalid:** ${data.total?.invalid || 'N/A'}\\n**Catchall:** ${data.total?.catchall || 'N/A'}\\n**Unknown:** ${data.total?.unknown || 'N/A'}\\n**Disposable:** ${data.total?.disposable || 'N/A'}\\n**Duplicate:** ${data.total?.duplicate || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`NeverBounce job status failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'neverbounce-job-results': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('NeverBounce API key is required');
      }

      try {
        const params = {
          key: apiKey,
          job_id: args.job_id
        };

        // Add result type filters
        if (args.valids === false) params.valids = 0;
        if (args.invalids === false) params.invalids = 0;
        if (args.catchalls === false) params.catchalls = 0;
        if (args.unknowns === false) params.unknowns = 0;

        const response = await axios.get('https://api.neverbounce.com/v4/jobs/results', { params });
        const data = response.data;

        const results = data.results || [];
        const formattedResults = results.slice(0, 50).map((result, index) => {
          return `${index + 1}. **${result.data.email}**\\n   Result: ${result.verification.result}\\n   Flags: ${result.verification.flags?.join(', ') || 'None'}\\n   Suggested: ${result.verification.suggested_correction || 'None'}\\n`;
        });

        const summary = data.summary || {};

        return {
          content: [
            {
              type: "text",
              text: `**NeverBounce Job Results:**\\n\\n**Job ID:** ${args.job_id}\\n\\n**Summary:**\\n**Total Records:** ${summary.total_records || 'N/A'}\\n**Valid:** ${summary.valid || 'N/A'}\\n**Invalid:** ${summary.invalid || 'N/A'}\\n**Catchall:** ${summary.catchall || 'N/A'}\\n**Unknown:** ${summary.unknown || 'N/A'}\\n**Disposable:** ${summary.disposable || 'N/A'}\\n**Duplicate:** ${summary.duplicate || 'N/A'}\\n\\n**Sample Results (First 50):**\\n\\n${formattedResults.join('\\n') || 'No results available'}\\n\\n**Note:** ${results.length > 50 ? `Showing first 50 of ${results.length} results.` : `Total ${results.length} results shown.`}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`NeverBounce job results failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'neverbounce-account-info': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('NeverBounce API key is required');
      }

      try {
        const params = {
          key: apiKey
        };

        const response = await axios.get('https://api.neverbounce.com/v4/account/info', { params });
        const data = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**NeverBounce Account Information:**\\n\\n**Credits Information:**\\n**Free Credits Used:** ${data.credits_info?.free_credits_used || 'N/A'}\\n**Free Credits Remaining:** ${data.credits_info?.free_credits_remaining || 'N/A'}\\n**Paid Credits Used:** ${data.credits_info?.paid_credits_used || 'N/A'}\\n**Paid Credits Remaining:** ${data.credits_info?.paid_credits_remaining || 'N/A'}\\n\\n**Job Counts:**\\n**Jobs Completed:** ${data.job_counts?.completed || 'N/A'}\\n**Jobs Processing:** ${data.job_counts?.processing || 'N/A'}\\n**Jobs Queued:** ${data.job_counts?.queued || 'N/A'}\\n**Jobs Under Review:** ${data.job_counts?.under_review || 'N/A'}\\n\\n**Account Details:**\\n**API Version:** ${data.api_version || 'N/A'}\\n**Subscription Type:** ${data.subscription_type || 'N/A'}\\n**Email Usage:** ${data.email_usage || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`NeverBounce account info failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'neverbounce-job-delete': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('NeverBounce API key is required');
      }

      try {
        const requestData = {
          key: apiKey,
          job_id: args.job_id
        };

        const response = await axios.post(
          'https://api.neverbounce.com/v4/jobs/delete',
          requestData,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        const data = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**NeverBounce Job Deletion:**\\n\\n**Job ID:** ${args.job_id}\\n**Status:** ${data.success ? 'Successfully deleted' : 'Deletion failed'}\\n**Message:** ${data.message || 'Job and all associated results have been permanently deleted.'}\\n\\n**Warning:** This action cannot be undone. All verification results for this job have been permanently removed.`
            }
          ]
        };
      } catch (error) {
        throw new Error(`NeverBounce job deletion failed: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}