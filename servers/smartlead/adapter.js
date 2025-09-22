// Smartlead MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * Smartlead MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'SMARTLEAD_API_KEY') {
  
  const toolsDefinitions = [
    
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

    // Analytics tools (22 tools)
    {
      name: 'smartlead-analytics-campaign-list',
      title: 'Analytics: Get Campaign List',
      description: 'Get a list of campaigns for analytics purposes. Supports filtering by client IDs for focused analysis.',
      inputSchema: {
        client_ids: z.array(z.number()).optional().describe('Filter campaigns by client IDs')
      }
    },
    {
      name: 'smartlead-analytics-client-list',
      title: 'Analytics: Get Client List',
      description: 'Get a list of all clients for analytics and reporting purposes.',
      inputSchema: {}
    },
    {
      name: 'smartlead-analytics-client-month-wise-count',
      title: 'Analytics: Monthly Client Count',
      description: 'Get month-wise client count statistics for growth analysis.',
      inputSchema: {
        start_date: z.string().optional().describe('Start date for analysis (YYYY-MM-DD)'),
        end_date: z.string().optional().describe('End date for analysis (YYYY-MM-DD)')
      }
    },
    {
      name: 'smartlead-analytics-overall-stats-v2',
      title: 'Analytics: Overall Stats V2',
      description: 'Get comprehensive overall analytics statistics including sent, opened, replied, bounced metrics with date range filtering.',
      inputSchema: {
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        timezone: z.string().optional().describe('Timezone (default: UTC)')
      }
    },
    {
      name: 'smartlead-analytics-day-wise-overall-stats',
      title: 'Analytics: Day-wise Overall Stats',
      description: 'Get day-by-day breakdown of overall analytics statistics for trend analysis.',
      inputSchema: {
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        timezone: z.string().optional().describe('Timezone (default: UTC)')
      }
    },
    {
      name: 'smartlead-analytics-day-wise-positive-reply-stats',
      title: 'Analytics: Day-wise Positive Reply Stats',
      description: 'Get day-by-day breakdown of positive reply statistics for detailed engagement analysis.',
      inputSchema: {
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        timezone: z.string().optional().describe('Timezone (default: UTC)')
      }
    },
    {
      name: 'smartlead-analytics-mailbox-name-wise-health-metrics',
      title: 'Analytics: Email Health Metrics',
      description: 'Get health metrics for individual email accounts including deliverability and performance data.',
      inputSchema: {
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        email_account_ids: z.array(z.number()).optional().describe('Filter by email account IDs')
      }
    },
    {
      name: 'smartlead-analytics-mailbox-domain-wise-health-metrics',
      title: 'Analytics: Domain Health Metrics',
      description: 'Get health metrics grouped by domain for domain reputation analysis.',
      inputSchema: {
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        domains: z.array(z.string()).optional().describe('Filter by domains')
      }
    },
    {
      name: 'smartlead-analytics-mailbox-provider-wise-overall-performance',
      title: 'Analytics: Email Provider Performance',
      description: 'Get performance metrics grouped by email provider (Gmail, Outlook, etc.) for provider-specific analysis.',
      inputSchema: {
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        providers: z.array(z.string()).optional().describe('Filter by email providers')
      }
    },
    {
      name: 'smartlead-analytics-campaign-overall-stats',
      title: 'Analytics: Campaign Overall Stats',
      description: 'Get overall performance statistics for campaigns with date range filtering and detailed metrics.',
      inputSchema: {
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        campaign_ids: z.array(z.number()).optional().describe('Filter by campaign IDs')
      }
    },
    {
      name: 'smartlead-analytics-client-overall-stats',
      title: 'Analytics: Client Overall Stats',
      description: 'Get overall performance statistics for clients with date range filtering.',
      inputSchema: {
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        client_ids: z.array(z.number()).optional().describe('Filter by client IDs')
      }
    },
    {
      name: 'smartlead-analytics-team-board-overall-stats',
      title: 'Analytics: Team Board Stats',
      description: 'Get team board performance statistics for team management and analysis.',
      inputSchema: {
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        team_id: z.string().optional().describe('Filter by team ID')
      }
    },
    {
      name: 'smartlead-analytics-lead-overall-stats',
      title: 'Analytics: Lead Overall Stats',
      description: 'Get overall lead performance statistics and metrics.',
      inputSchema: {
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        campaign_ids: z.array(z.number()).optional().describe('Filter by campaign IDs')
      }
    },
    {
      name: 'smartlead-analytics-lead-category-wise-response',
      title: 'Analytics: Lead Category Response',
      description: 'Get lead response statistics grouped by category for detailed analysis.',
      inputSchema: {
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        categories: z.array(z.string()).optional().describe('Filter by lead categories')
      }
    },
    {
      name: 'smartlead-analytics-campaign-leads-take-for-first-reply',
      title: 'Analytics: Leads Take for First Reply',
      description: 'Get statistics on how long leads take to provide their first reply.',
      inputSchema: {
        campaign_id: z.number().describe('Campaign ID'),
        start_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().optional().describe('End date (YYYY-MM-DD)')
      }
    },
    {
      name: 'smartlead-analytics-campaign-follow-up-reply-rate',
      title: 'Analytics: Follow-up Reply Rate',
      description: 'Get follow-up email reply rate statistics for campaign optimization.',
      inputSchema: {
        campaign_id: z.number().describe('Campaign ID'),
        start_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().optional().describe('End date (YYYY-MM-DD)')
      }
    },
    {
      name: 'smartlead-analytics-campaign-lead-to-reply-time',
      title: 'Analytics: Lead to Reply Time',
      description: 'Get median time statistics for leads to reply to campaigns.',
      inputSchema: {
        campaign_id: z.number().describe('Campaign ID'),
        start_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().optional().describe('End date (YYYY-MM-DD)')
      }
    },
    {
      name: 'smartlead-analytics-campaign-response-stats',
      title: 'Analytics: Campaign Response Stats',
      description: 'Get detailed campaign response statistics and performance metrics.',
      inputSchema: {
        campaign_id: z.number().describe('Campaign ID'),
        start_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().optional().describe('End date (YYYY-MM-DD)')
      }
    },
    {
      name: 'smartlead-analytics-campaign-status-stats',
      title: 'Analytics: Campaign Status Stats',
      description: 'Get campaign statistics grouped by status for status-based analysis.',
      inputSchema: {
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        statuses: z.array(z.string()).optional().describe('Filter by campaign statuses')
      }
    },
    {
      name: 'smartlead-analytics-mailbox-overall-stats',
      title: 'Analytics: Mailbox Overall Stats',
      description: 'Get overall mailbox performance statistics and health metrics.',
      inputSchema: {
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        email_account_ids: z.array(z.number()).optional().describe('Filter by email account IDs')
      }
    },

    // Enhanced campaign management tools (15 tools)
    {
      name: 'smartlead-delete-campaign',
      title: 'Delete Campaign',
      description: 'Permanently delete a campaign and all associated data. This action cannot be undone.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign to delete')
      }
    },
    {
      name: 'smartlead-export-campaign-data',
      title: 'Export Campaign Data',
      description: 'Export campaign data in various formats (CSV, Excel, JSON) for analysis or backup purposes.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        format: z.enum(['csv', 'excel', 'json']).optional().describe('Export format (default: json)'),
        data_type: z.enum(['leads', 'analytics', 'sequences', 'all']).optional().describe('Type of data to export')
      }
    },
    {
      name: 'smartlead-fetch-campaign-analytics-by-date-range',
      title: 'Fetch Campaign Analytics by Date Range',
      description: 'Retrieve detailed analytics for a campaign within a specific date range.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        timezone: z.string().optional().describe('Timezone (default: UTC)')
      }
    },
    {
      name: 'smartlead-get-campaign-sequence-analytics',
      title: 'Get Campaign Sequence Analytics',
      description: 'Retrieve analytics data for each step in a campaign sequence to optimize performance.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        start_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().optional().describe('End date (YYYY-MM-DD)')
      }
    },
    {
      name: 'smartlead-fetch-all-campaigns-using-lead-id',
      title: 'Fetch Campaigns by Lead ID',
      description: 'Retrieve all campaigns that contain a specific lead for cross-campaign analysis.',
      inputSchema: {
        lead_id: z.number().describe('ID of the lead')
      }
    },
    {
      name: 'smartlead-get-campaigns-with-analytics',
      title: 'Get Campaigns with Analytics',
      description: 'Retrieve campaigns list with embedded analytics data for performance overview.',
      inputSchema: {
        status: z.enum(['active', 'paused', 'completed', 'all']).optional().describe('Filter campaigns by status'),
        client_id: z.number().optional().describe('Filter by client ID'),
        limit: z.number().optional().describe('Maximum number of campaigns to return'),
        offset: z.number().optional().describe('Offset for pagination')
      }
    },
    {
      name: 'smartlead-update-campaign-status',
      title: 'Update Campaign Status',
      description: 'Update the status of a campaign (e.g., start, pause, stop, archive).',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        status: z.enum(['active', 'paused', 'completed', 'archived']).describe('New status for the campaign')
      }
    },

    // Client management tools (7 tools)
    {
      name: 'smartlead-add-client-to-system',
      title: 'Add Client To System',
      description: 'Add a new client to the SmartLead system (whitelabel or not).',
      inputSchema: {
        name: z.string().describe('Client name'),
        email: z.string().email().describe('Client email'),
        is_whitelabel: z.boolean().optional().describe('Whether this is a whitelabel client'),
        settings: z.object({}).optional().describe('Additional client settings')
      }
    },
    {
      name: 'smartlead-get-all-clients',
      title: 'Get All Clients',
      description: 'Fetch all clients from the SmartLead system.',
      inputSchema: {}
    },
    {
      name: 'smartlead-create-client-api-key',
      title: 'Create Client API Key',
      description: 'Create a new API key for the current client with optional permissions.',
      inputSchema: {
        name: z.string().describe('Name for the API key'),
        permissions: z.array(z.string()).optional().describe('Permissions for the API key')
      }
    },
    {
      name: 'smartlead-get-client-api-keys',
      title: 'Get Client API Keys',
      description: 'Retrieve all API keys for the current client.',
      inputSchema: {}
    },
    {
      name: 'smartlead-delete-client-api-key',
      title: 'Delete Client API Key',
      description: 'Delete a specific API key.',
      inputSchema: {
        api_key_id: z.number().describe('ID of the API key to delete')
      }
    },
    {
      name: 'smartlead-reset-client-api-key',
      title: 'Reset Client API Key',
      description: 'Reset/regenerate a specific API key.',
      inputSchema: {
        api_key_id: z.number().describe('ID of the API key to reset')
      }
    },
    {
      name: 'smartlead-get-team-details',
      title: 'Get Team Details',
      description: 'Get team details including members, campaigns, and performance metrics.',
      inputSchema: {
        team_id: z.string().optional().describe('Team ID (optional, uses default if not provided)')
      }
    },

    // Email account management tools (12 tools)
    {
      name: 'smartlead-list-email-accounts-per-campaign',
      title: 'List Email Accounts per Campaign',
      description: 'Retrieve all email accounts associated with a specific campaign.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign')
      }
    },
    {
      name: 'smartlead-get-all-email-accounts',
      title: 'Get All Email Accounts',
      description: 'Retrieve all email accounts associated with the current user.',
      inputSchema: {}
    },
    {
      name: 'smartlead-create-email-account',
      title: 'Create Email Account',
      description: 'Create a new email account with SMTP and IMAP configuration.',
      inputSchema: {
        email: z.string().email().describe('Email address'),
        password: z.string().describe('Email password'),
        smtp_host: z.string().describe('SMTP server host'),
        smtp_port: z.number().describe('SMTP server port'),
        imap_host: z.string().describe('IMAP server host'),
        imap_port: z.number().describe('IMAP server port'),
        name: z.string().optional().describe('Display name for the email account')
      }
    },
    {
      name: 'smartlead-update-email-account',
      title: 'Update Email Account',
      description: 'Update an existing email account configuration.',
      inputSchema: {
        email_account_id: z.number().describe('ID of the email account'),
        email: z.string().email().optional().describe('Email address'),
        password: z.string().optional().describe('Email password'),
        smtp_host: z.string().optional().describe('SMTP server host'),
        smtp_port: z.number().optional().describe('SMTP server port'),
        imap_host: z.string().optional().describe('IMAP server host'),
        imap_port: z.number().optional().describe('IMAP server port'),
        name: z.string().optional().describe('Display name for the email account')
      }
    },
    {
      name: 'smartlead-get-email-account-by-id',
      title: 'Get Email Account by ID',
      description: 'Retrieve detailed information about a specific email account.',
      inputSchema: {
        email_account_id: z.number().describe('ID of the email account')
      }
    },
    {
      name: 'smartlead-update-email-account-warmup',
      title: 'Update Email Account Warmup',
      description: 'Configure warmup settings for an email account to improve deliverability.',
      inputSchema: {
        email_account_id: z.number().describe('ID of the email account'),
        warmup_enabled: z.boolean().describe('Enable or disable warmup'),
        warmup_reputation: z.number().min(0).max(100).optional().describe('Warmup reputation score (0-100)'),
        daily_ramp_up: z.number().optional().describe('Daily ramp up count'),
        reply_rate_percentage: z.number().min(0).max(100).optional().describe('Reply rate percentage (0-100)')
      }
    },
    {
      name: 'smartlead-reconnect-failed-email-accounts',
      title: 'Reconnect Failed Email Accounts',
      description: 'Attempt to reconnect email accounts that have failed authentication.',
      inputSchema: {
        email_account_ids: z.array(z.number()).describe('Array of email account IDs to reconnect')
      }
    },
    {
      name: 'smartlead-update-email-account-tag',
      title: 'Update Email Account Tag',
      description: 'Update the tag/label for an email account for better organization.',
      inputSchema: {
        email_account_id: z.number().describe('ID of the email account'),
        tag: z.string().describe('New tag for the email account')
      }
    },
    {
      name: 'smartlead-remove-email-account-from-campaign',
      title: 'Remove Email Account from Campaign',
      description: 'Remove an email account from a specific campaign.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        email_account_id: z.number().describe('ID of the email account')
      }
    },

    // Enhanced lead management tools (17 tools)
    {
      name: 'smartlead-list-leads-by-campaign',
      title: 'List Leads by Campaign',
      description: 'Retrieve all leads associated with a specific campaign, with optional filtering and pagination.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        status: z.string().optional().describe('Filter by lead status'),
        category: z.string().optional().describe('Filter by lead category'),
        limit: z.number().optional().describe('Maximum number of leads to return'),
        offset: z.number().optional().describe('Offset for pagination')
      }
    },
    {
      name: 'smartlead-fetch-lead-categories',
      title: 'Fetch Lead Categories',
      description: 'Retrieve all available lead categories for classification and filtering purposes.',
      inputSchema: {}
    },
    {
      name: 'smartlead-fetch-lead-by-email',
      title: 'Fetch Lead by Email',
      description: 'Find and retrieve lead information using their email address.',
      inputSchema: {
        email: z.string().email().describe('Email address of the lead')
      }
    },
    {
      name: 'smartlead-add-leads-to-campaign',
      title: 'Add Leads to Campaign',
      description: 'Add one or more leads to a specific campaign with validation and duplicate checking.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        leads: z.array(z.object({
          email: z.string().email().describe('Email address of the lead'),
          first_name: z.string().optional().describe('First name of the lead'),
          last_name: z.string().optional().describe('Last name of the lead'),
          company_name: z.string().optional().describe('Company name of the lead'),
          phone_number: z.union([z.string(), z.number()]).optional().describe('Phone number of the lead'),
          website: z.string().optional().describe('Website of the lead'),
          location: z.string().optional().describe('Location of the lead'),
          custom_fields: z.object({}).optional().describe('Custom fields for the lead'),
          linkedin_profile: z.string().optional().describe('LinkedIn profile URL of the lead'),
          company_url: z.string().optional().describe('Company URL of the lead')
        })).describe('Array of leads to add')
      }
    },
    {
      name: 'smartlead-resume-lead-by-campaign',
      title: 'Resume Lead in Campaign',
      description: 'Resume email sending to a paused lead within a specific campaign.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        lead_id: z.number().describe('ID of the lead')
      }
    },
    {
      name: 'smartlead-pause-lead-by-campaign',
      title: 'Pause Lead in Campaign',
      description: 'Pause email sending to a lead within a specific campaign without removing them.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        lead_id: z.number().describe('ID of the lead')
      }
    },
    {
      name: 'smartlead-delete-lead-by-campaign',
      title: 'Delete Lead from Campaign',
      description: 'Remove a lead from a specific campaign permanently.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        lead_id: z.number().describe('ID of the lead')
      }
    },
    {
      name: 'smartlead-unsubscribe-lead-from-campaign',
      title: 'Unsubscribe Lead from Campaign',
      description: 'Unsubscribe a lead from a specific campaign, stopping all future emails.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        lead_id: z.number().describe('ID of the lead')
      }
    },
    {
      name: 'smartlead-unsubscribe-lead-from-all-campaigns',
      title: 'Unsubscribe Lead from All Campaigns',
      description: 'Unsubscribe a lead from all campaigns across the entire account.',
      inputSchema: {
        lead_id: z.number().describe('ID of the lead')
      }
    },
    {
      name: 'smartlead-add-lead-to-global-blocklist',
      title: 'Add Lead to Global Blocklist',
      description: 'Add a lead or domain to the global blocklist to prevent future contact.',
      inputSchema: {
        email: z.string().email().describe('Email address or domain to add to blocklist')
      }
    },
    {
      name: 'smartlead-fetch-all-leads-from-account',
      title: 'Fetch All Leads from Account',
      description: 'Retrieve all leads from the entire account with optional filtering and pagination.',
      inputSchema: {
        status: z.string().optional().describe('Filter by lead status'),
        category: z.string().optional().describe('Filter by lead category'),
        limit: z.number().optional().describe('Maximum number of leads to return'),
        offset: z.number().optional().describe('Offset for pagination')
      }
    },
    {
      name: 'smartlead-fetch-leads-from-global-blocklist',
      title: 'Fetch Leads from Global Blocklist',
      description: 'Retrieve all leads and domains currently on the global blocklist.',
      inputSchema: {
        limit: z.number().optional().describe('Maximum number of entries to return'),
        offset: z.number().optional().describe('Offset for pagination')
      }
    },
    {
      name: 'smartlead-update-lead-by-id',
      title: 'Update Lead by ID',
      description: 'Update lead information using the lead ID, including contact details and custom fields.',
      inputSchema: {
        lead_id: z.number().describe('ID of the lead'),
        email: z.string().email().optional().describe('Email address of the lead'),
        first_name: z.string().optional().describe('First name of the lead'),
        last_name: z.string().optional().describe('Last name of the lead'),
        company_name: z.string().optional().describe('Company name of the lead'),
        custom_fields: z.object({}).optional().describe('Custom fields for the lead')
      }
    },
    {
      name: 'smartlead-update-lead-category',
      title: 'Update Lead Category',
      description: 'Update the category classification of a lead within a specific campaign.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        lead_id: z.number().describe('ID of the lead'),
        category: z.string().describe('New category for the lead')
      }
    },
    {
      name: 'smartlead-fetch-lead-message-history',
      title: 'Fetch Lead Message History',
      description: 'Retrieve the complete message history for a lead within a specific campaign.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        lead_id: z.number().describe('ID of the lead')
      }
    },
    {
      name: 'smartlead-reply-to-lead-from-master-inbox',
      title: 'Reply to Lead from Master Inbox',
      description: 'Send a reply to a lead from the master inbox with tracking and personalization.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        lead_id: z.number().describe('ID of the lead'),
        subject: z.string().optional().describe('Subject line for the reply'),
        message: z.string().describe('Message content')
      }
    },
    {
      name: 'smartlead-forward-reply',
      title: 'Forward Reply',
      description: 'Forward a lead reply to another email address or team member.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        lead_id: z.number().describe('ID of the lead'),
        forward_to: z.string().email().describe('Email address to forward to'),
        message: z.string().optional().describe('Additional message to include')
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

    // Statistics tools (10 tools)
    {
      name: 'smartlead-get-campaign-statistics',
      title: 'Get Campaign Statistics',
      description: 'Retrieve comprehensive statistics for a specific campaign.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign')
      }
    },
    {
      name: 'smartlead-get-campaign-statistics-by-date-range',
      title: 'Get Campaign Statistics by Date Range',
      description: 'Retrieve campaign statistics for a specific date range.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        timezone: z.string().optional().describe('Timezone (default: Etc/GMT)')
      }
    },
    {
      name: 'smartlead-get-warmup-stats-by-email-account-id',
      title: 'Get Warmup Stats by Email Account ID',
      description: 'Retrieve warmup statistics for a specific email account.',
      inputSchema: {
        email_account_id: z.number().describe('ID of the email account')
      }
    },
    {
      name: 'smartlead-get-campaign-top-level-analytics',
      title: 'Get Campaign Top Level Analytics',
      description: 'Retrieve high-level analytics overview for a campaign.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign')
      }
    },
    {
      name: 'smartlead-get-campaign-top-level-analytics-by-date-range',
      title: 'Get Campaign Top Level Analytics by Date Range',
      description: 'Retrieve high-level analytics for a campaign within a specific date range.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        start_date: z.string().describe('Start date (YYYY-MM-DD)'),
        end_date: z.string().describe('End date (YYYY-MM-DD)'),
        timezone: z.string().optional().describe('Timezone (default: Etc/GMT)')
      }
    },
    {
      name: 'smartlead-get-campaign-lead-statistics',
      title: 'Get Campaign Lead Statistics',
      description: 'Retrieve detailed lead statistics for a campaign.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign')
      }
    },
    {
      name: 'smartlead-get-campaign-mailbox-statistics',
      title: 'Get Campaign Mailbox Statistics',
      description: 'Retrieve mailbox performance statistics for a campaign.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign')
      }
    },
    {
      name: 'smartlead-download-campaign-data',
      title: 'Download Campaign Data',
      description: 'Download campaign data in CSV or JSON format for analysis or backup.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        download_type: z.enum(['analytics', 'leads', 'sequences', 'full', 'summary']).describe('Type of data to download'),
        format: z.enum(['json', 'csv']).optional().describe('Format for download (default: json)'),
        user_id: z.string().optional().describe('User ID for tracking purposes')
      }
    },
    {
      name: 'smartlead-view-download-statistics',
      title: 'View Download Statistics',
      description: 'View download statistics with optional filtering by time period and grouping criteria.',
      inputSchema: {
        time_period: z.string().optional().describe('Time period filter (e.g., "last_7_days", "last_30_days", "last_quarter")'),
        group_by: z.string().optional().describe('Grouping criteria (e.g., "campaign", "user", "date", "type")')
      }
    },

    // Smart Delivery tools (30+ tools)
    {
      name: 'smartlead-get-region-wise-provider-ids',
      title: 'Get Region Wise Provider IDs',
      description: 'Retrieve provider IDs organized by geographic regions for smart delivery optimization.',
      inputSchema: {}
    },
    {
      name: 'smartlead-create-manual-placement-test',
      title: 'Create Manual Placement Test',
      description: 'Create a manual placement test to check email deliverability across different providers.',
      inputSchema: {
        test_name: z.string().describe('Name of the test'),
        email_content: z.string().describe('Email content to test'),
        subject: z.string().describe('Email subject line'),
        from_email: z.string().email().describe('Sender email address'),
        to_emails: z.array(z.string().email()).describe('Array of recipient email addresses')
      }
    },
    {
      name: 'smartlead-create-automated-placement-test',
      title: 'Create Automated Placement Test',
      description: 'Create an automated placement test that runs on a schedule for continuous monitoring.',
      inputSchema: {
        test_name: z.string().describe('Name of the test'),
        email_content: z.string().describe('Email content to test'),
        subject: z.string().describe('Email subject line'),
        from_email: z.string().email().describe('Sender email address'),
        schedule: z.object({
          frequency: z.string().describe('Frequency of the test (e.g., "daily", "weekly")'),
          time: z.string().describe('Time to run the test (e.g., "09:00")')
        }).describe('Schedule settings for the automated test')
      }
    },
    {
      name: 'smartlead-get-spam-test-details',
      title: 'Get Spam Test Details',
      description: 'Retrieve detailed results and analysis for a specific spam test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-delete-tests-in-bulk',
      title: 'Delete Tests in Bulk',
      description: 'Delete multiple smart delivery tests at once for cleanup purposes.',
      inputSchema: {
        test_ids: z.array(z.number()).describe('Array of test IDs to delete')
      }
    },
    {
      name: 'smartlead-stop-automated-test',
      title: 'Stop Automated Test',
      description: 'Stop a running automated placement test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test to stop')
      }
    },
    {
      name: 'smartlead-list-all-tests',
      title: 'List All Tests',
      description: 'Retrieve a list of all smart delivery tests with optional filtering.',
      inputSchema: {
        page: z.number().optional().describe('Page number for pagination'),
        limit: z.number().optional().describe('Number of results per page'),
        status: z.string().optional().describe('Filter by test status')
      }
    },
    {
      name: 'smartlead-get-provider-wise-report',
      title: 'Get Provider Wise Report',
      description: 'Retrieve a detailed report showing performance across different email providers.',
      inputSchema: {
        test_id: z.number().describe('ID of the test'),
        date_range: z.object({
          start_date: z.string().describe('Start date (YYYY-MM-DD)'),
          end_date: z.string().describe('End date (YYYY-MM-DD)')
        }).optional().describe('Optional date range filter')
      }
    },
    {
      name: 'smartlead-get-geo-wise-report',
      title: 'Get Geo Wise Report',
      description: 'Retrieve a detailed report showing performance across different geographic regions.',
      inputSchema: {
        test_id: z.number().describe('ID of the test'),
        date_range: z.object({
          start_date: z.string().describe('Start date (YYYY-MM-DD)'),
          end_date: z.string().describe('End date (YYYY-MM-DD)')
        }).optional().describe('Optional date range filter')
      }
    },
    {
      name: 'smartlead-get-sender-account-wise-report',
      title: 'Get Sender Account Wise Report',
      description: 'Retrieve a detailed report showing performance for different sender accounts.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-spam-filter-report',
      title: 'Get Spam Filter Report',
      description: 'Retrieve a detailed spam filter analysis report for a test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-dkim-details',
      title: 'Get DKIM Details',
      description: 'Retrieve DKIM authentication details for a specific test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-spf-details',
      title: 'Get SPF Details',
      description: 'Retrieve SPF record details for a specific test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-rdns-report',
      title: 'Get rDNS Report',
      description: 'Retrieve reverse DNS lookup report for a specific test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-sender-account-list',
      title: 'Get Sender Account List',
      description: 'Retrieve list of sender accounts used in a specific test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-blacklists',
      title: 'Get Blacklists',
      description: 'Retrieve blacklist status for a specific test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-domain-blacklist',
      title: 'Get Domain Blacklist',
      description: 'Retrieve domain blacklist status for a specific test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-spam-test-email-content',
      title: 'Get Spam Test Email Content',
      description: 'Retrieve the email content used in a specific spam test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-ip-blacklist-count',
      title: 'Get IP Blacklist Count',
      description: 'Retrieve IP blacklist count for a specific test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-email-reply-headers',
      title: 'Get Email Reply Headers',
      description: 'Retrieve email reply headers for a specific test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-schedule-history',
      title: 'Get Schedule History',
      description: 'Retrieve schedule history for automated tests.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-ip-details',
      title: 'Get IP Details',
      description: 'Retrieve IP address details for a specific test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-mailbox-summary',
      title: 'Get Mailbox Summary',
      description: 'Retrieve mailbox summary for a specific test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-mailbox-count',
      title: 'Get Mailbox Count',
      description: 'Retrieve mailbox count for a specific test.',
      inputSchema: {
        test_id: z.number().describe('ID of the test')
      }
    },
    {
      name: 'smartlead-get-all-folders',
      title: 'Get All Folders',
      description: 'Retrieve all smart delivery folders.',
      inputSchema: {}
    },
    {
      name: 'smartlead-create-folder',
      title: 'Create Folder',
      description: 'Create a new smart delivery folder.',
      inputSchema: {
        name: z.string().describe('Name of the folder'),
        description: z.string().optional().describe('Description of the folder')
      }
    },
    {
      name: 'smartlead-get-folder-by-id',
      title: 'Get Folder by ID',
      description: 'Retrieve a specific smart delivery folder by ID.',
      inputSchema: {
        folder_id: z.number().describe('ID of the folder')
      }
    },
    {
      name: 'smartlead-delete-folder',
      title: 'Delete Folder',
      description: 'Delete a smart delivery folder by ID.',
      inputSchema: {
        folder_id: z.number().describe('ID of the folder to delete')
      }
    },

    // Smart Senders tools (5 tools)
    {
      name: 'smartlead-search-domain',
      title: 'Search Domain',
      description: 'Search for domain availability and information for smart senders setup.',
      inputSchema: {
        domain: z.string().describe('Domain name to search')
      }
    },
    {
      name: 'smartlead-get-vendors',
      title: 'Get Vendors',
      description: 'Retrieve a list of available vendors for smart senders integration.',
      inputSchema: {}
    },
    {
      name: 'smartlead-auto-generate-mailboxes',
      title: 'Auto Generate Mailboxes',
      description: 'Automatically generate mailboxes for a domain with specified count and naming pattern.',
      inputSchema: {
        domain: z.string().describe('Domain name'),
        count: z.number().describe('Number of mailboxes to generate'),
        vendor_id: z.number().describe('ID of the vendor'),
        naming_pattern: z.string().optional().describe('Naming pattern for mailboxes')
      }
    },
    {
      name: 'smartlead-place-order-for-mailboxes',
      title: 'Place Order for Mailboxes',
      description: 'Place an order for specific mailboxes with a vendor.',
      inputSchema: {
        domain: z.string().describe('Domain name'),
        mailboxes: z.array(z.object({
          email: z.string().email().describe('Email address'),
          password: z.string().describe('Password for the mailbox')
        })).describe('Array of mailboxes to order'),
        vendor_id: z.number().describe('ID of the vendor')
      }
    },
    {
      name: 'smartlead-get-domain-list',
      title: 'Get Domain List',
      description: 'Retrieve a list of all domains configured for smart senders.',
      inputSchema: {}
    },

    // Webhooks tools (5 tools)
    {
      name: 'smartlead-get-webhooks-by-campaign-id',
      title: 'Get Webhooks by Campaign ID',
      description: 'Retrieve all webhooks configured for a specific campaign.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign')
      }
    },
    {
      name: 'smartlead-add-or-update-campaign-webhook',
      title: 'Add or Update Campaign Webhook',
      description: 'Add a new webhook or update an existing webhook for a campaign.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        webhook_url: z.string().url().describe('URL for the webhook'),
        events: z.array(z.string()).describe('Array of events to trigger the webhook'),
        is_active: z.boolean().optional().describe('Whether the webhook is active (default: true)')
      }
    },
    {
      name: 'smartlead-delete-campaign-webhook',
      title: 'Delete Campaign Webhook',
      description: 'Delete a specific webhook from a campaign.',
      inputSchema: {
        campaign_id: z.number().describe('ID of the campaign'),
        webhook_id: z.number().describe('ID of the webhook to delete')
      }
    },
    {
      name: 'smartlead-get-webhooks-publish-summary',
      title: 'Get Webhooks Publish Summary',
      description: 'Retrieve a summary of webhook events and their delivery status.',
      inputSchema: {
        start_date: z.string().optional().describe('Start date for summary (YYYY-MM-DD)'),
        end_date: z.string().optional().describe('End date for summary (YYYY-MM-DD)'),
        campaign_id: z.number().optional().describe('Filter by campaign ID')
      }
    },
    {
      name: 'smartlead-retrigger-failed-events',
      title: 'Retrigger Failed Events',
      description: 'Retry delivery of failed webhook events for better reliability.',
      inputSchema: {
        webhook_id: z.number().optional().describe('ID of specific webhook to retry'),
        campaign_id: z.number().optional().describe('Filter by campaign ID'),
        start_date: z.string().optional().describe('Start date for retry (YYYY-MM-DD)'),
        end_date: z.string().optional().describe('End date for retry (YYYY-MM-DD)')
      }
    }
  ];

  const toolHandlers = {
    

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


    // Analytics tools handlers
    'smartlead-analytics-campaign-list': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/campaigns', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Analytics Campaign List:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get analytics campaign list failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-client-list': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/clients', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Analytics Client List:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get analytics client list failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-overall-stats-v2': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/overall-stats-v2', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Overall Analytics Stats V2:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get overall analytics stats failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Enhanced campaign tools handlers
    'smartlead-delete-campaign': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.delete(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Deleted:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Delete campaign failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-export-campaign-data': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/export`, {
          params: { api_key: apiKey, format: args.format, data_type: args.data_type }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Data Exported:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Export campaign data failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Client management tools handlers
    'smartlead-add-client-to-system': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.post('https://server.smartlead.ai/api/v1/clients', args, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Client Added:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Add client failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-all-clients': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/clients', {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**All Clients:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get all clients failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Email account tools handlers
    'smartlead-get-all-email-accounts': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/email-accounts', {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**All Email Accounts:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get all email accounts failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-create-email-account': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.post('https://server.smartlead.ai/api/v1/email-accounts', args, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Email Account Created:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Create email account failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Enhanced lead management tools handlers
    'smartlead-list-leads-by-campaign': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { campaign_id, ...queryParams } = args;
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/leads`, {
          params: { api_key: apiKey, ...queryParams }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Leads:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`List leads by campaign failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-fetch-lead-by-email': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/leads/search', {
          params: { api_key: apiKey, email: args.email }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead Details:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Fetch lead by email failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Statistics tools handlers
    'smartlead-get-campaign-statistics': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/statistics`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Statistics:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaign statistics failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-warmup-stats-by-email-account-id': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/email-accounts/${args.email_account_id}/warmup-stats`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Warmup Statistics:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get warmup stats failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Smart Delivery tools handlers
    'smartlead-get-region-wise-provider-ids': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/smart-delivery/providers/regions', {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Region Wise Provider IDs:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get region wise provider IDs failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-create-manual-placement-test': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.post('https://server.smartlead.ai/api/v1/smart-delivery/placement-tests/manual', args, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Manual Placement Test Created:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Create manual placement test failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Smart Senders tools handlers
    'smartlead-search-domain': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/smart-senders/domains/search', {
          params: { api_key: apiKey, domain: args.domain }
        });
        return {
          content: [{
            type: "text",
            text: `**Domain Search Results:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Search domain failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-vendors': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/smart-senders/vendors', {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Available Vendors:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get vendors failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Webhooks tools handlers
    'smartlead-get-webhooks-by-campaign-id': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/webhooks`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Webhooks:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaign webhooks failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-add-or-update-campaign-webhook': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { campaign_id, ...webhookData } = args;
        const response = await axios.post(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/webhooks`, webhookData, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Webhook Added/Updated:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Add/update webhook failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Analytics tools handlers (remaining)
    'smartlead-analytics-client-month-wise-count': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/clients/month-wise-count', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Monthly Client Count:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get monthly client count failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-day-wise-overall-stats': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/day-wise-overall-stats', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Day-wise Overall Stats:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get day-wise overall stats failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-day-wise-positive-reply-stats': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/day-wise-positive-reply-stats', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Day-wise Positive Reply Stats:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get day-wise positive reply stats failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-mailbox-name-wise-health-metrics': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/mailbox-health/by-name', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Email Health Metrics:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get email health metrics failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-mailbox-domain-wise-health-metrics': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/mailbox-health/by-domain', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Domain Health Metrics:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get domain health metrics failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-mailbox-provider-wise-overall-performance': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/mailbox/provider-performance', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Provider Performance:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get provider performance failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-campaign-overall-stats': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/campaigns/overall-stats', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Overall Stats:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaign overall stats failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-client-overall-stats': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/clients/overall-stats', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Client Overall Stats:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get client overall stats failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-team-board-overall-stats': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/team-board/overall-stats', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Team Board Stats:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get team board stats failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-lead-overall-stats': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/leads/overall-stats', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead Overall Stats:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get lead overall stats failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-lead-category-wise-response': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/leads/category-wise-response', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead Category Response:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get lead category response failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-campaign-leads-take-for-first-reply': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/analytics/campaigns/${args.campaign_id}/leads-first-reply-time`, {
          params: { api_key: apiKey, start_date: args.start_date, end_date: args.end_date }
        });
        return {
          content: [{
            type: "text",
            text: `**Leads First Reply Time:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get leads first reply time failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-campaign-follow-up-reply-rate': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/analytics/campaigns/${args.campaign_id}/follow-up-reply-rate`, {
          params: { api_key: apiKey, start_date: args.start_date, end_date: args.end_date }
        });
        return {
          content: [{
            type: "text",
            text: `**Follow-up Reply Rate:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get follow-up reply rate failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-campaign-lead-to-reply-time': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/analytics/campaigns/${args.campaign_id}/lead-to-reply-time`, {
          params: { api_key: apiKey, start_date: args.start_date, end_date: args.end_date }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead to Reply Time:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get lead to reply time failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-campaign-response-stats': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/analytics/campaigns/${args.campaign_id}/response-stats`, {
          params: { api_key: apiKey, start_date: args.start_date, end_date: args.end_date }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Response Stats:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaign response stats failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-campaign-status-stats': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/campaigns/status-stats', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Status Stats:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaign status stats failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-analytics-mailbox-overall-stats': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/analytics/mailbox/overall-stats', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Mailbox Overall Stats:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get mailbox overall stats failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Enhanced campaign tools handlers (remaining)
    'smartlead-fetch-campaign-analytics-by-date-range': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/analytics`, {
          params: { api_key: apiKey, start_date: args.start_date, end_date: args.end_date, timezone: args.timezone }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Analytics by Date Range:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Fetch campaign analytics by date range failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-campaign-sequence-analytics': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/sequence-analytics`, {
          params: { api_key: apiKey, start_date: args.start_date, end_date: args.end_date }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Sequence Analytics:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaign sequence analytics failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-fetch-all-campaigns-using-lead-id': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/leads/${args.lead_id}/campaigns`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaigns by Lead ID:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Fetch campaigns by lead ID failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-campaigns-with-analytics': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/campaigns/with-analytics', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaigns with Analytics:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaigns with analytics failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-update-campaign-status': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/status`,
          { status: args.status }, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Status Updated:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Update campaign status failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Client management tools handlers (remaining)

    'smartlead-create-client-api-key': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.post('https://server.smartlead.ai/api/v1/clients/api-keys', args, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Client API Key Created:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Create client API key failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-client-api-keys': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/clients/api-keys', {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Client API Keys:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get client API keys failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-delete-client-api-key': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.delete(`https://server.smartlead.ai/api/v1/clients/api-keys/${args.api_key_id}`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Client API Key Deleted:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Delete client API key failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-reset-client-api-key': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.post(`https://server.smartlead.ai/api/v1/clients/api-keys/${args.api_key_id}/reset`, {}, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Client API Key Reset:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Reset client API key failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-team-details': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const teamId = args.team_id || '';
        const response = await axios.get(`https://server.smartlead.ai/api/v1/teams/${teamId}/details`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Team Details:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get team details failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Email account tools handlers (remaining)
    'smartlead-list-email-accounts-per-campaign': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/email-accounts`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Email Accounts:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`List email accounts per campaign failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-update-email-account': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { email_account_id, ...updateData } = args;
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/email-accounts/${email_account_id}`, updateData, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Email Account Updated:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Update email account failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-email-account-by-id': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/email-accounts/${args.email_account_id}`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Email Account Details:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get email account by ID failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-update-email-account-warmup': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { email_account_id, ...warmupData } = args;
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/email-accounts/${email_account_id}/warmup`, warmupData, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Email Account Warmup Updated:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Update email account warmup failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-reconnect-failed-email-accounts': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.post('https://server.smartlead.ai/api/v1/email-accounts/reconnect', args, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Email Accounts Reconnected:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Reconnect failed email accounts failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-update-email-account-tag': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { email_account_id, tag } = args;
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/email-accounts/${email_account_id}/tag`,
          { tag }, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Email Account Tag Updated:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Update email account tag failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-remove-email-account-from-campaign': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
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
        throw new Error(`Remove email account from campaign failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Enhanced lead management tools handlers (remaining)
    'smartlead-fetch-lead-categories': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/leads/categories', {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead Categories:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Fetch lead categories failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-add-leads-to-campaign': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { campaign_id, leads } = args;
        const response = await axios.post(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/leads/bulk`,
          { leads }, {
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

    'smartlead-resume-lead-by-campaign': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/leads/${args.lead_id}/resume`, {}, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead Resumed:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Resume lead failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-pause-lead-by-campaign': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/leads/${args.lead_id}/pause`, {}, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead Paused:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Pause lead failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-delete-lead-by-campaign': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.delete(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/leads/${args.lead_id}`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead Deleted from Campaign:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Delete lead from campaign failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-unsubscribe-lead-from-campaign': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/leads/${args.lead_id}/unsubscribe`, {}, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead Unsubscribed from Campaign:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Unsubscribe lead from campaign failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-unsubscribe-lead-from-all-campaigns': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/leads/${args.lead_id}/unsubscribe-all`, {}, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead Unsubscribed from All Campaigns:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Unsubscribe lead from all campaigns failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-add-lead-to-global-blocklist': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.post('https://server.smartlead.ai/api/v1/leads/global-blocklist',
          { email: args.email }, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead Added to Global Blocklist:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Add lead to global blocklist failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-fetch-all-leads-from-account': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/leads', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**All Leads from Account:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Fetch all leads from account failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-fetch-leads-from-global-blocklist': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/leads/global-blocklist', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Global Blocklist:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Fetch leads from global blocklist failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-update-lead-by-id': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { lead_id, ...updateData } = args;
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/leads/${lead_id}`, updateData, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead Updated:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Update lead by ID failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-update-lead-category': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.patch(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/leads/${args.lead_id}/category`,
          { category: args.category }, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead Category Updated:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Update lead category failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-fetch-lead-message-history': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/leads/${args.lead_id}/messages`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Lead Message History:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Fetch lead message history failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-reply-to-lead-from-master-inbox': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { campaign_id, lead_id, subject, message } = args;
        const response = await axios.post(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/leads/${lead_id}/reply`,
          { subject: subject || '', message }, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Reply Sent to Lead:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Reply to lead from master inbox failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-forward-reply': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { campaign_id, lead_id, ...forwardData } = args;
        const response = await axios.post(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/leads/${lead_id}/forward`, forwardData, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Reply Forwarded:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Forward reply failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Statistics tools handlers (remaining)
    'smartlead-get-campaign-statistics-by-date-range': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { campaign_id, ...dateParams } = args;
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/statistics/date-range`, {
          params: { api_key: apiKey, ...dateParams }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Statistics by Date Range:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaign statistics by date range failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-campaign-top-level-analytics': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/analytics/top-level`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Top Level Analytics:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaign top level analytics failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-campaign-top-level-analytics-by-date-range': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { campaign_id, ...dateParams } = args;
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/analytics/top-level/date-range`, {
          params: { api_key: apiKey, ...dateParams }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Top Level Analytics by Date Range:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaign top level analytics by date range failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-campaign-lead-statistics': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/statistics/leads`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Lead Statistics:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaign lead statistics failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-campaign-mailbox-statistics': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/statistics/mailbox`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Mailbox Statistics:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get campaign mailbox statistics failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-download-campaign-data': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { campaign_id, download_type, format, user_id } = args;
        const response = await axios.get(`https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/download`, {
          params: { api_key: apiKey, type: download_type, format: format || 'json', user_id }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Data Download:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Download campaign data failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-view-download-statistics': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/statistics/downloads', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Download Statistics:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`View download statistics failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Smart delivery tools handlers (remaining)
    'smartlead-create-automated-placement-test': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.post('https://server.smartlead.ai/api/v1/smart-delivery/placement-tests/automated', args, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Automated Placement Test Created:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Create automated placement test failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-spam-test-details': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/spam-tests/${args.test_id}`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Spam Test Details:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get spam test details failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-delete-tests-in-bulk': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.delete('https://server.smartlead.ai/api/v1/smart-delivery/tests/bulk', {
          params: { api_key: apiKey },
          data: args,
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Tests Deleted in Bulk:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Delete tests in bulk failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-stop-automated-test': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.post(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/stop`, {}, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Automated Test Stopped:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Stop automated test failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-list-all-tests': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/smart-delivery/tests', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**All Smart Delivery Tests:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`List all tests failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-provider-wise-report': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { test_id, date_range } = args;
        const params = { api_key: apiKey };
        if (date_range) {
          params.start_date = date_range.start_date;
          params.end_date = date_range.end_date;
        }
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${test_id}/reports/provider-wise`, {
          params
        });
        return {
          content: [{
            type: "text",
            text: `**Provider Wise Report:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get provider wise report failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-geo-wise-report': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const { test_id, date_range } = args;
        const params = { api_key: apiKey };
        if (date_range) {
          params.start_date = date_range.start_date;
          params.end_date = date_range.end_date;
        }
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${test_id}/reports/geo-wise`, {
          params
        });
        return {
          content: [{
            type: "text",
            text: `**Geo Wise Report:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get geo wise report failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-sender-account-wise-report': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/reports/sender-account-wise`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Sender Account Wise Report:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get sender account wise report failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-spam-filter-report': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/reports/spam-filter`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Spam Filter Report:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get spam filter report failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-dkim-details': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/dkim`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**DKIM Details:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get DKIM details failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-spf-details': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/spf`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**SPF Details:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get SPF details failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-rdns-report': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/rdns`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**rDNS Report:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get rDNS report failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-sender-account-list': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/sender-accounts`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Sender Account List:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get sender account list failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-blacklists': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/blacklists`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Blacklist Status:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get blacklists failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-domain-blacklist': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/domain-blacklist`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Domain Blacklist:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get domain blacklist failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-spam-test-email-content': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/email-content`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Spam Test Email Content:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get spam test email content failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-ip-blacklist-count': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/ip-blacklist-count`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**IP Blacklist Count:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get IP blacklist count failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-email-reply-headers': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/email-reply-headers`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Email Reply Headers:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get email reply headers failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-schedule-history': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/schedule-history`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Schedule History:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get schedule history failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-ip-details': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/ip-details`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**IP Details:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get IP details failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-mailbox-summary': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/mailbox-summary`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Mailbox Summary:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get mailbox summary failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-mailbox-count': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/tests/${args.test_id}/mailbox-count`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Mailbox Count:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get mailbox count failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-all-folders': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/smart-delivery/folders', {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**All Smart Delivery Folders:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get all folders failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-create-folder': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.post('https://server.smartlead.ai/api/v1/smart-delivery/folders', args, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Folder Created:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Create folder failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-folder-by-id': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get(`https://server.smartlead.ai/api/v1/smart-delivery/folders/${args.folder_id}`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Folder Details:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get folder by ID failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-delete-folder': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.delete(`https://server.smartlead.ai/api/v1/smart-delivery/folders/${args.folder_id}`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Folder Deleted:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Delete folder failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Smart senders tools handlers (remaining)
    'smartlead-auto-generate-mailboxes': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.post('https://server.smartlead.ai/api/v1/smart-senders/mailboxes/auto-generate', args, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Mailboxes Auto Generated:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Auto generate mailboxes failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-place-order-for-mailboxes': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.post('https://server.smartlead.ai/api/v1/smart-senders/mailboxes/order', args, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Mailboxes Order Placed:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Place order for mailboxes failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-domain-list': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/smart-senders/domains', {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Smart Senders Domain List:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get domain list failed: ${error.response?.data?.message || error.message}`);
      }
    },

    // Webhooks tools handlers (remaining)
    'smartlead-delete-campaign-webhook': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.delete(`https://server.smartlead.ai/api/v1/campaigns/${args.campaign_id}/webhooks/${args.webhook_id}`, {
          params: { api_key: apiKey }
        });
        return {
          content: [{
            type: "text",
            text: `**Campaign Webhook Deleted:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Delete campaign webhook failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-get-webhooks-publish-summary': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.get('https://server.smartlead.ai/api/v1/webhooks/publish-summary', {
          params: { api_key: apiKey, ...args }
        });
        return {
          content: [{
            type: "text",
            text: `**Webhooks Publish Summary:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Get webhooks publish summary failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'smartlead-retrigger-failed-events': async (args, apiKey, userId) => {
      if (!apiKey) throw new Error('Smartlead API key is required');
      try {
        const response = await axios.post('https://server.smartlead.ai/api/v1/webhooks/retrigger-failed-events', args, {
          params: { api_key: apiKey },
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          content: [{
            type: "text",
            text: `**Failed Events Retriggered:**\n\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Retrigger failed events failed: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}