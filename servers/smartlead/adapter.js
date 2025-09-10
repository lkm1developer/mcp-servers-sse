// Smartlead MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * Smartlead MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'SMARTLEAD_API_KEY') {
  
  const toolsDefinitions = [
    // API Key management tools
    {
      name: 'smartlead-validate-api-key',
      title: 'Validate API Key',
      description: 'Validate the Smartlead API key by making a test request',
      inputSchema: {}
    },
    {
      name: 'smartlead-update-api-key',
      title: 'Update API Key',
      description: 'Update the Smartlead API key for the current session',
      inputSchema: {
        new_api_key: z.string().describe('New Smartlead API key to use')
      }
    },
    
    // Campaign management tools
    {
      name: 'smartlead-create-campaign',
      title: 'Create Campaign',
      description: 'Create a new campaign in Smartlead',
      inputSchema: {
        name: z.string().describe('Name of the campaign'),
        client_id: z.number().optional().describe('Client ID for the campaign')
      }
    },
    {
      name: 'smartlead-update-campaign-schedule',
      title: 'Update Campaign Schedule',
      description: 'Update a campaign\'s schedule settings',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign to update'),
        timezone: z.string().optional().describe('Timezone for the campaign (e.g., "America/Los_Angeles")'),
        days_of_the_week: z.array(z.number()).optional().describe('Days of the week to send emails (1-7, where 1 is Monday)'),
        start_hour: z.string().optional().describe('Start hour in 24-hour format (e.g., "09:00")'),
        end_hour: z.string().optional().describe('End hour in 24-hour format (e.g., "17:00")'),
        min_time_btw_emails: z.number().optional().describe('Minimum time between emails in minutes'),
        max_new_leads_per_day: z.number().optional().describe('Maximum number of new leads per day'),
        schedule_start_time: z.string().optional().describe('Schedule start time in ISO format')
      }
    },
    {
      name: 'smartlead-update-campaign-settings',
      title: 'Update Campaign Settings',
      description: 'Update a campaign\'s general settings',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign to update'),
        name: z.string().optional().describe('New name for the campaign'),
        status: z.enum(['active', 'paused', 'completed']).optional().describe('Status of the campaign'),
        settings: z.object({}).optional().describe('Additional campaign settings')
      }
    },
    {
      name: 'smartlead-get-campaign',
      title: 'Get Campaign',
      description: 'Get details of a specific campaign by ID',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign to retrieve')
      }
    },
    {
      name: 'smartlead-list-campaigns',
      title: 'List Campaigns',
      description: 'List all campaigns with optional filtering',
      inputSchema: {
        status: z.enum(['active', 'paused', 'completed', 'all']).optional().describe('Filter campaigns by status'),
        limit: z.number().optional().describe('Maximum number of campaigns to return'),
        offset: z.number().optional().describe('Offset for pagination')
      }
    },
    
    // Campaign sequence tools
    {
      name: 'smartlead-save-campaign-sequence',
      title: 'Save Campaign Sequence',
      description: 'Save a sequence of emails for a campaign with A/B testing variants',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        sequences: z.array(z.object({
          id: z.number().optional().describe('ID of the sequence (only for updates, omit when creating)'),
          seq_number: z.number().describe('Sequence number (order in the sequence)'),
          seq_delay_details: z.object({
            delay_in_days: z.number().describe('Days to wait before sending this email')
          }).describe('Delay settings for the sequence'),
          variant_distribution_type: z.enum(['MANUAL_EQUAL', 'MANUAL_PERCENTAGE', 'AI_EQUAL']).optional().describe('Type of variant distribution'),
          lead_distribution_percentage: z.number().optional().describe('Sample percentage size of the lead pool to use to find the winner'),
          winning_metric_property: z.enum(['OPEN_RATE', 'CLICK_RATE', 'REPLY_RATE', 'POSITIVE_REPLY_RATE']).optional().describe('Metric to use for determining the winning variant'),
          seq_variants: z.array(z.object({
            subject: z.string().describe('Email subject line'),
            email_body: z.string().describe('Email body content (HTML)'),
            variant_label: z.string().describe('Label for the variant (e.g., "A", "B", "C")'),
            id: z.number().optional().describe('ID of the variant (only for updates, omit when creating)'),
            variant_distribution_percentage: z.number().describe('Percentage of leads to receive this variant')
          })).optional().describe('Variants for A/B testing'),
          subject: z.string().optional().describe('Email subject line (for simple follow-ups, blank makes it in the same thread)'),
          email_body: z.string().optional().describe('Email body content (HTML) for simple follow-ups')
        })).describe('Array of email sequences to send')
      }
    },
    {
      name: 'smartlead-get-campaign-sequence',
      title: 'Get Campaign Sequence',
      description: 'Get the sequence of emails for a campaign',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign')
      }
    },
    {
      name: 'smartlead-update-campaign-sequence',
      title: 'Update Campaign Sequence',
      description: 'Update a specific email in a campaign sequence',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        sequence_id: z.number().describe('ID of the sequence email to update'),
        subject: z.string().optional().describe('Updated email subject line'),
        body: z.string().optional().describe('Updated email body content'),
        wait_days: z.number().optional().describe('Updated days to wait before sending this email')
      }
    },
    {
      name: 'smartlead-delete-campaign-sequence',
      title: 'Delete Campaign Sequence',
      description: 'Delete a specific email from a campaign sequence',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        sequence_id: z.number().describe('ID of the sequence email to delete')
      }
    },
    
    // Email account management tools
    {
      name: 'smartlead-add-email-account-to-campaign',
      title: 'Add Email Account to Campaign',
      description: 'Add an email account to a campaign',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        email_account_id: z.number().describe('ID of the email account to add')
      }
    },
    {
      name: 'smartlead-update-email-account-in-campaign',
      title: 'Update Email Account in Campaign',
      description: 'Update an email account in a campaign',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        email_account_id: z.number().describe('ID of the email account to update'),
        settings: z.object({}).optional().describe('Settings for the email account in this campaign')
      }
    },
    {
      name: 'smartlead-delete-email-account-from-campaign',
      title: 'Delete Email Account from Campaign',
      description: 'Remove an email account from a campaign',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        email_account_id: z.number().describe('ID of the email account to remove')
      }
    },
    
    // Lead management tools
    {
      name: 'smartlead-add-lead-to-campaign',
      title: 'Add Lead to Campaign',
      description: 'Add leads to a campaign (up to 100 leads at once)',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        lead_list: z.array(z.object({
          email: z.string().describe('Email address of the lead'),
          first_name: z.string().optional().describe('First name of the lead'),
          last_name: z.string().optional().describe('Last name of the lead'),
          company_name: z.string().optional().describe('Company name of the lead'),
          phone_number: z.union([z.string(), z.number()]).optional().describe('Phone number of the lead'),
          website: z.string().optional().describe('Website of the lead'),
          location: z.string().optional().describe('Location of the lead'),
          custom_fields: z.object({
            email1: z.string().optional().describe('Value of the custom field'),
            email2: z.string().optional().describe('Value of the custom field'),
            email3: z.string().optional().describe('Value of the custom field')
          }).optional().describe('Custom fields for the lead'),
          linkedin_profile: z.string().optional().describe('LinkedIn profile URL of the lead'),
          company_url: z.string().optional().describe('Company URL of the lead')
        })).describe('List of leads to add (max 100)'),
        settings: z.object({
          ignore_global_block_list: z.boolean().optional().describe('If true, uploaded leads will bypass the global block list'),
          ignore_unsubscribe_list: z.boolean().optional().describe('If true, leads will bypass the comparison with unsubscribed leads'),
          ignore_community_bounce_list: z.boolean().optional().describe('If true, uploaded leads will bypass any leads that bounced across the entire userbase'),
          ignore_duplicate_leads_in_other_campaign: z.boolean().optional().describe('If true, leads will NOT bypass the comparison with other campaigns')
        }).optional().describe('Settings for lead addition')
      }
    },
    {
      name: 'smartlead-update-lead-in-campaign',
      title: 'Update Lead in Campaign',
      description: 'Update a lead in a campaign',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        lead_id: z.number().describe('ID of the lead to update'),
        lead: z.object({
          email: z.string().optional().describe('Email address of the lead'),
          first_name: z.string().optional().describe('First name of the lead'),
          last_name: z.string().optional().describe('Last name of the lead'),
          company: z.string().optional().describe('Company of the lead'),
          custom_variables: z.object({}).optional().describe('Custom fields for the lead (max 20 fields)')
        }).describe('Updated lead information')
      }
    },
    {
      name: 'smartlead-delete-lead-from-campaign',
      title: 'Delete Lead from Campaign',
      description: 'Remove a lead from a campaign',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        lead_id: z.number().describe('ID of the lead to remove')
      }
    }
  ];

  const toolHandlers = {
    'smartlead-validate-api-key': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        // Make a simple API call to validate the key - get campaigns list
        const response = await axios.get('https://server.smartlead.ai/api/v1/campaigns', {
          params: { api_key: apiKey, limit: 1 },
          timeout: 10000 // 10 second timeout
        });

        return {
          content: [{
            type: "text",
            text: `**✅ API Key Valid:**\n\nSuccessfully connected to Smartlead API.\nResponse: ${response.status} ${response.statusText}`
          }]
        };
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new Error(`❌ API Key Invalid: ${error.response?.data?.message || 'Unauthorized access to Smartlead API'}`);
        }
        throw new Error(`❌ API Key Validation Failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-update-api-key': async (args, apiKey, userId) => {
      const { new_api_key } = args;
      
      if (!new_api_key) {
        throw new Error('New API key is required');
      }

      try {
        // Validate the new API key
        const response = await axios.get('https://server.smartlead.ai/api/v1/campaigns', {
          params: { api_key: new_api_key, limit: 1 },
          timeout: 10000
        });

        return {
          content: [{
            type: "text",
            text: `**✅ API Key Validated Successfully:**\n\nThe new Smartlead API key is valid and can be used.\nResponse: ${response.status} ${response.statusText}\n\n⚠️ **Note:** Please update your environment configuration or restart your session with the new API key to use it for subsequent requests.`
          }]
        };
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new Error(`❌ New API Key Invalid: ${error.response?.data?.message || 'Unauthorized access to Smartlead API'}`);
        }
        throw new Error(`❌ API Key Validation Failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-create-campaign': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const response = await axios.post('https://server.smartlead.ai/api/v1/campaigns/create', args, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });

        return {
          content: [{
            type: "text",
            text: `**Campaign Created:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Create campaign failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-update-campaign-schedule': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const { campaign_id, ...scheduleParams } = args;
        const response = await axios.post(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}`, scheduleParams, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });

        return {
          content: [{
            type: "text",
            text: `**Campaign Schedule Updated:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Update campaign schedule failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-update-campaign-settings': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const { campaign_id, ...settingsParams } = args;
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}`, settingsParams, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });

        return {
          content: [{
            type: "text",
            text: `**Campaign Settings Updated:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Update campaign settings failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-campaign': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}`, {
          params: { api_key: apiKey }
        });

        return {
          content: [{
            type: "text",
            text: `**Campaign Details:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaign failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-list-campaigns': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/campaigns', {
          params: { api_key: apiKey, ...args }
        });

        return {
          content: [{
            type: "text",
            text: `**Campaigns List:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`List campaigns failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-save-campaign-sequence': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const { campaign_id, sequences } = args;
        const response = await axios.post(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/sequences`, 
          { sequences }, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });

        return {
          content: [{
            type: "text",
            text: `**Campaign Sequence Saved:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Save campaign sequence failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-campaign-sequence': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/sequence`, {
          params: { api_key: apiKey }
        });

        return {
          content: [{
            type: "text",
            text: `**Campaign Sequence:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaign sequence failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-update-campaign-sequence': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const { campaign_id, sequence_id, ...updateParams } = args;
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/sequence/${sequence_id}`, 
          updateParams, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });

        return {
          content: [{
            type: "text",
            text: `**Campaign Sequence Updated:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Update campaign sequence failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-delete-campaign-sequence': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const response = await axios.delete(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/sequence/${args.sequence_id}`, {
          params: { api_key: apiKey }
        });

        return {
          content: [{
            type: "text",
            text: `**Campaign Sequence Deleted:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Delete campaign sequence failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-add-email-account-to-campaign': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const response = await axios.post(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/email-accounts`, 
          { email_account_id: args.email_account_id }, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });

        return {
          content: [{
            type: "text",
            text: `**Email Account Added to Campaign:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Add email account to campaign failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-update-email-account-in-campaign': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const { campaign_id, email_account_id, settings } = args;
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/email-accounts/${email_account_id}`, 
          settings || {}, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });

        return {
          content: [{
            type: "text",
            text: `**Email Account Updated in Campaign:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Update email account in campaign failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-delete-email-account-from-campaign': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const response = await axios.delete(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/email-accounts/${args.email_account_id}`, {
          params: { api_key: apiKey }
        });

        return {
          content: [{
            type: "text",
            text: `**Email Account Removed from Campaign:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Delete email account from campaign failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-add-lead-to-campaign': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const { campaign_id, lead_list, settings } = args;
        const payload = { lead_list };
        if (settings) payload.settings = settings;

        const response = await axios.post(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/leads`, 
          payload, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });

        return {
          content: [{
            type: "text",
            text: `**Leads Added to Campaign:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Add leads to campaign failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-update-lead-in-campaign': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const { campaign_id, lead_id, lead } = args;
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/leads/${lead_id}`, 
          lead, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });

        return {
          content: [{
            type: "text",
            text: `**Lead Updated in Campaign:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Update lead in campaign failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-delete-lead-from-campaign': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Smartlead API key is required');
      }

      try {
        const response = await axios.delete(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/leads/${args.lead_id}`, {
          params: { api_key: apiKey }
        });

        return {
          content: [{
            type: "text",
            text: `**Lead Removed from Campaign:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Delete lead from campaign failed: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}