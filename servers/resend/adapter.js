// Adapter to convert Resend MCP Server to our format
import { Resend } from 'resend';
import { z } from 'zod';

/**
 * Extract tools from Resend MCP server and create handlers for our multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'RESEND_API_KEY') {

  const toolsDefinitions = [
    {
      name: 'send-email',
      title: 'Send Email',
      description: 'Send an email using Resend',
      inputSchema: {
        to: z.string().email().describe('Recipient email address'),
        subject: z.string().describe('Email subject line'),
        text: z.string().describe('Plain text email content'),
        html: z.string().optional().describe('HTML email content. When provided, the plain text argument MUST be provided as well.'),
        cc: z.string().email().array().optional().describe('Optional array of CC email addresses'),
        bcc: z.string().email().array().optional().describe('Optional array of BCC email addresses'),
        scheduledAt: z.string().optional().describe("Optional parameter to schedule the email. This uses natural language. Examples would be 'tomorrow at 10am' or 'in 2 hours'"),
        from: z.string().email().describe('Sender email address'),
        replyTo: z.string().email().array().optional().describe('Optional email addresses for the email readers to reply to')
      }
    },
    {
      name: 'list-audiences',
      title: 'List Audiences',
      description: 'List all audiences from Resend. This tool is useful for getting the audience ID to help find the audience to use for other tools.',
      inputSchema: {}
    }
  ];

  const toolHandlers = {
    'send-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Resend API key is required');
      }

      try {
        const resend = new Resend(apiKey);

        // Build email request
        const emailRequest = {
          to: args.to,
          subject: args.subject,
          text: args.text,
          from: args.from,
          replyTo: args.replyTo || []
        };

        // Add optional parameters
        if (args.html) {
          emailRequest.html = args.html;
        }

        if (args.scheduledAt) {
          emailRequest.scheduledAt = args.scheduledAt;
        }

        if (args.cc) {
          emailRequest.cc = args.cc;
        }

        if (args.bcc) {
          emailRequest.bcc = args.bcc;
        }

        const response = await resend.emails.send(emailRequest);

        if (response.error) {
          throw new Error(`Email failed to send: ${JSON.stringify(response.error)}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Email sent successfully! ${JSON.stringify(response.data)}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Resend send-email failed: ${error.message}`);
      }
    },

    'list-audiences': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Resend API key is required');
      }

      try {
        const resend = new Resend(apiKey);
        const response = await resend.audiences.list();

        if (response.error) {
          throw new Error(`Failed to list audiences: ${JSON.stringify(response.error)}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Audiences found: ${JSON.stringify(response.data)}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Resend list-audiences failed: ${error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}
