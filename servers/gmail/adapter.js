// Gmail MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import { google } from 'googleapis';
import { log } from '../../multi-mcp-server-simple.js';

/**
 * Gmail MCP Server adapter for multi-MCP system 
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'GMAIL_CREDENTIALS') {

  const toolsDefinitions = [
    {
      name: 'gmail-create-draft',
      title: 'Create Draft Email',
      description: 'Create a draft email that can be saved and edited later',
      inputSchema: {
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Email subject'),
        body: z.string().describe('Email body (plain text or HTML)'),
        cc: z.string().optional().describe('CC email addresses (comma separated)'),
        bcc: z.string().optional().describe('BCC email addresses (comma separated)'),
        isHtml: z.boolean().optional().default(false).describe('Whether the body is HTML (default: false)')
      }
    },
    {
      name: 'gmail-update-draft',
      title: 'Update Draft Email',
      description: 'Update an existing draft email',
      inputSchema: {
        draftId: z.string().describe('The ID of the draft to update'),
        to: z.string().optional().describe('Recipient email address'),
        subject: z.string().optional().describe('Email subject'),
        body: z.string().optional().describe('Email body (plain text or HTML)'),
        cc: z.string().optional().describe('CC email addresses (comma separated)'),
        bcc: z.string().optional().describe('BCC email addresses (comma separated)'),
        isHtml: z.boolean().optional().default(false).describe('Whether the body is HTML (default: false)')
      }
    },
    {
      name: 'gmail-list-drafts',
      title: 'List Draft Emails',
      description: 'List all draft emails',
      inputSchema: {
        maxResults: z.number().optional().default(10).describe('Maximum number of drafts to return (default: 10)')
      }
    },
    {
      name: 'gmail-get-draft',
      title: 'Get Draft Email',
      description: 'Get a specific draft email by ID',
      inputSchema: {
        draftId: z.string().describe('The ID of the draft to retrieve')
      }
    },
    {
      name: 'gmail-send-draft',
      title: 'Send Draft Email',
      description: 'Send a draft email',
      inputSchema: {
        draftId: z.string().describe('The ID of the draft to send')
      }
    },
    {
      name: 'gmail-delete-draft',
      title: 'Delete Draft Email',
      description: 'Delete a draft email',
      inputSchema: {
        draftId: z.string().describe('The ID of the draft to delete')
      }
    },
    {
      name: 'gmail-send-message',
      title: 'Send Message',
      description: 'Send an email message directly (without saving as draft)',
      inputSchema: {
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Email subject'),
        body: z.string().describe('Email body (plain text or HTML)'),
        cc: z.string().optional().describe('CC email addresses (comma separated)'),
        bcc: z.string().optional().describe('BCC email addresses (comma separated)'),
        isHtml: z.boolean().optional().default(false).describe('Whether the body is HTML (default: false)')
      }
    }
  ];

  // Initialize Gmail API client
  let gmail = null;

  const initializeGmail = async (accessToken) => {
    try {
      const auth = new google.auth.OAuth2();

      // Set OAuth2 access token
      auth.setCredentials({
        access_token: accessToken
      });

      gmail = google.gmail({ version: 'v1', auth });
      return true;
    } catch (error) {
      console.error('Failed to initialize Gmail API:', error);
      return false;
    }
  };

  const createEmailMessage = (to, subject, body, cc, bcc, isHtml) => {
    const messageParts = [
      `To: ${to}`,
      subject && `Subject: ${subject}`,
      cc && `Cc: ${cc}`,
      bcc && `Bcc: ${bcc}`,
      `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`,
      'MIME-Version: 1.0',
      '',
      body
    ].filter(Boolean).join('\n');

    return Buffer.from(messageParts)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const toolHandlers = {
    'gmail-create-draft': async (params, apiKey) => {
      try {
        const { to, subject, body, cc, bcc, isHtml = false } = params;
        await initializeGmail(apiKey);
        const encodedMessage = createEmailMessage(to, subject, body, cc, bcc, isHtml);

        const response = await gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: {
              raw: encodedMessage
            }
          }
        });
        log('GMAIL', JSON.stringify(response.data));
        
        return {
          content: [{
            type: "text",
            text: `Draft created successfully:\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        log('GMAIL', `Failed to create draft: ${error.message}`);
        throw new Error(`Failed to create draft: ${error.message}`);
      }
    },

    'gmail-update-draft': async (params, apiKey) => {
      try {
        const { draftId, to, subject, body, cc, bcc, isHtml = false } = params;
        await initializeGmail(apiKey);

        // Get current draft to merge with updates
        const currentDraft = await gmail.users.drafts.get({
          userId: 'me',
          id: draftId,
          format: 'metadata',
          metadataHeaders: ['To', 'Subject', 'Cc', 'Bcc']
        });

        const headers = currentDraft.data.message.payload.headers;
        const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

        // Use provided values or fall back to current values
        const finalTo = to || getHeader('To');
        const finalSubject = subject || getHeader('Subject');
        const finalCc = cc || getHeader('Cc');
        const finalBcc = bcc || getHeader('Bcc');

        // For body, if not provided, try to extract from current draft
        let finalBody = body;
        if (!finalBody) {
          const fullDraft = await gmail.users.drafts.get({
            userId: 'me',
            id: draftId,
            format: 'full'
          });

          // Extract body from current draft (simplified extraction)
          const payload = fullDraft.data.message.payload;
          if (payload.body && payload.body.data) {
            finalBody = Buffer.from(payload.body.data, 'base64').toString('utf-8');
          } else if (payload.parts) {
            for (const part of payload.parts) {
              if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
                if (part.body && part.body.data) {
                  finalBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
                  break;
                }
              }
            }
          }
        }

        const encodedMessage = createEmailMessage(finalTo, finalSubject, finalBody, finalCc, finalBcc, isHtml);

        const response = await gmail.users.drafts.update({
          userId: 'me',
          id: draftId,
          requestBody: {
            message: {
              raw: encodedMessage
            }
          }
        });

        return {
          content: [{
            type: "text",
            text: `Draft email updated successfully:\n\n- Draft ID: ${response.data.id}\n- Message ID: ${response.data.message.id}\n- To: ${finalTo}\n- Subject: ${finalSubject}\n\nFull Response:\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Failed to update draft: ${error.message}`);
      }
    },

    'gmail-list-drafts': async (params, apiKey) => {
      try {
        const { maxResults = 10 } = params;
        await initializeGmail(apiKey);

        const response = await gmail.users.drafts.list({
          userId: 'me',
          maxResults: maxResults
        });

        const drafts = response.data.drafts || [];

        // Get details for each draft
        const draftsWithDetails = await Promise.all(
          drafts.map(async (draft) => {
            try {
              const details = await gmail.users.drafts.get({
                userId: 'me',
                id: draft.id,
                format: 'metadata',
                metadataHeaders: ['To', 'Subject', 'Date']
              });

              const headers = details.data.message.payload.headers;
              const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

              return {
                id: draft.id,
                messageId: draft.message.id,
                to: getHeader('To'),
                subject: getHeader('Subject'),
                date: getHeader('Date'),
                snippet: details.data.message.snippet
              };
            } catch (error) {
              return {
                id: draft.id,
                messageId: draft.message.id,
                error: 'Failed to get draft details'
              };
            }
          })
        );

        return {
          content: [{
            type: "text",
            text: `Found ${draftsWithDetails.length} draft emails:\n\n${draftsWithDetails.map((draft, index) => `${index + 1}. Draft ID: ${draft.id}\n   To: ${draft.to}\n   Subject: ${draft.subject}\n   Date: ${draft.date}`).join('\n\n')}\n\nTotal Results: ${response.data.resultSizeEstimate || draftsWithDetails.length}`
          }]
        };
      } catch (error) {
        throw new Error(`Failed to list drafts: ${error.message}`);
      }
    },

    'gmail-get-draft': async (params, apiKey) => {
      try {
        const { draftId } = params;
        await initializeGmail(apiKey);

        const response = await gmail.users.drafts.get({
          userId: 'me',
          id: draftId,
          format: 'full'
        });

        const draft = response.data;
        const headers = draft.message.payload.headers;
        const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

        // Extract body content
        let body = '';
        const extractBody = (payload) => {
          if (payload.body && payload.body.data) {
            return Buffer.from(payload.body.data, 'base64').toString('utf-8');
          }
          if (payload.parts) {
            for (const part of payload.parts) {
              if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
                if (part.body && part.body.data) {
                  return Buffer.from(part.body.data, 'base64').toString('utf-8');
                }
              }
            }
          }
          return '';
        };

        body = extractBody(draft.message.payload);

        return {
          content: [{
            type: "text",
            text: `Draft Email Details:\n\n- Draft ID: ${draft.id}\n- Message ID: ${draft.message.id}\n- To: ${getHeader('To')}\n- CC: ${getHeader('Cc') || 'None'}\n- BCC: ${getHeader('Bcc') || 'None'}\n- Subject: ${getHeader('Subject')}\n- Date: ${getHeader('Date')}\n\nBody:\n${body}\n\nSnippet: ${draft.message.snippet}`
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get draft: ${error.message}`);
      }
    },

    'gmail-send-draft': async (params, apiKey) => {
      try {
        const { draftId } = params;
        await initializeGmail(apiKey);

        const response = await gmail.users.drafts.send({
          userId: 'me',
          requestBody: {
            id: draftId
          }
        });

        return {
          content: [{
            type: "text",
            text: `Draft email sent successfully:\n\n- Message ID: ${response.data.id}\n- Thread ID: ${response.data.threadId}\n- Status: Sent\n\nFull Response:\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Failed to send draft: ${error.message}`);
      }
    },

    'gmail-delete-draft': async (params, apiKey) => {
      try {
        const { draftId } = params;
        await initializeGmail(apiKey);

        await gmail.users.drafts.delete({
          userId: 'me',
          id: draftId
        });

        return {
          content: [{
            type: "text",
            text: `Draft email deleted successfully:\n\n- Draft ID: ${draftId}\n- Status: Deleted`
          }]
        };
      } catch (error) {
        throw new Error(`Failed to delete draft: ${error.message}`);
      }
    },

    'gmail-send-message': async (params, apiKey) => {
      try {
        const { to, subject, body, cc, bcc, isHtml = false } = params;
        await initializeGmail(apiKey);

        const encodedMessage = createEmailMessage(to, subject, body, cc, bcc, isHtml);

        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedMessage
          }
        });

        return {
          content: [{
            type: "text",
            text: `Email sent successfully:\n\n- Message ID: ${response.data.id}\n- Thread ID: ${response.data.threadId}\n- To: ${to}\n- Subject: ${subject}\n- Status: Sent\n\nFull Response:\n${JSON.stringify(response.data, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Failed to send message: ${error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers,
    initialize: initializeGmail
  };
}