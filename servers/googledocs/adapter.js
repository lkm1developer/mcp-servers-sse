// Google Docs MCP Server Adapter for 2025 Protocol
import { z } from 'zod';

let google;
try {
  const googleModule = await import('googleapis');
  google = googleModule.google;
} catch (error) {
  console.warn('googleapis package not available. Google Docs functionality will be limited.');
}

/**
 * Google Docs MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'GOOGLE_DOCS_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'google-docs-create',
      title: 'Google Docs Create Document',
      description: 'Create a new Google Docs document',
      inputSchema: {
        title: z.string().describe('Title of the new document')
      }
    },
    {
      name: 'google-docs-get',
      title: 'Google Docs Get Document',
      description: 'Get content from a Google Docs document',
      inputSchema: {
        document_id: z.string().describe('ID of the document to retrieve'),
        suggestions_view_mode: z.enum(['DEFAULT_FOR_CURRENT_ACCESS', 'SUGGESTION_ACCEPTED', 'PREVIEW_SUGGESTION_ACCEPTED']).optional().describe('Suggestions view mode')
      }
    },
    {
      name: 'google-docs-batch-update',
      title: 'Google Docs Batch Update',
      description: 'Perform multiple updates to a document',
      inputSchema: {
        document_id: z.string().describe('ID of the document'),
        requests: z.array(z.object({
          insert_text: z.object({
            text: z.string().describe('Text to insert'),
            location: z.object({
              index: z.number().describe('Index where to insert text')
            })
          }).optional(),
          delete_content_range: z.object({
            range: z.object({
              start_index: z.number().describe('Start index'),
              end_index: z.number().describe('End index')
            })
          }).optional()
        })).describe('Array of update requests')
      }
    },
    {
      name: 'google-docs-share',
      title: 'Google Docs Share Document',
      description: 'Share a Google Docs document with users',
      inputSchema: {
        document_id: z.string().describe('ID of the document'),
        email: z.string().describe('Email address to share with'),
        role: z.enum(['reader', 'commenter', 'writer', 'owner']).describe('Permission level')
      }
    }
  ];

  const toolHandlers = {
    'google-docs-create': async (args, apiKey, userId) => {
      if (!google) {
        throw new Error('Google APIs not available. Please install googleapis package: npm install googleapis');
      }
      
      if (!apiKey) {
        throw new Error('Google Docs API key or service account credentials are required');
      }

      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: apiKey,
          scopes: ['https://www.googleapis.com/auth/documents']
        });

        const docs = google.docs({ version: 'v1', auth });

        const response = await docs.documents.create({
          resource: {
            title: args.title
          },
          auth
        });

        return {
          content: [
            {
              type: "text",
              text: `**Google Docs Document Created:**\\n\\n**Title:** ${response.data.title}\\n**Document ID:** ${response.data.documentId}\\n**URL:** https://docs.google.com/document/d/${response.data.documentId}/edit\\n**Created:** ${response.data.createTime || 'N/A'}\\n**Revision ID:** ${response.data.revisionId}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Google Docs create failed: ${error.message}`);
      }
    },

    'google-docs-get': async (args, apiKey, userId) => {
      if (!google) {
        throw new Error('Google APIs not available. Please install googleapis package: npm install googleapis');
      }
      
      if (!apiKey) {
        throw new Error('Google Docs API key or service account credentials are required');
      }

      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: apiKey,
          scopes: ['https://www.googleapis.com/auth/documents.readonly']
        });

        const docs = google.docs({ version: 'v1', auth });

        const response = await docs.documents.get({
          documentId: args.document_id,
          suggestionsViewMode: args.suggestions_view_mode || 'DEFAULT_FOR_CURRENT_ACCESS',
          auth
        });

        const doc = response.data;
        const content = doc.body?.content || [];
        
        // Extract text content
        let textContent = '';
        content.forEach(element => {
          if (element.paragraph) {
            element.paragraph.elements?.forEach(elem => {
              if (elem.textRun) {
                textContent += elem.textRun.content;
              }
            });
          }
        });

        return {
          content: [
            {
              type: "text",
              text: `**Google Docs Document Retrieved:**\\n\\n**Title:** ${doc.title}\\n**Document ID:** ${doc.documentId}\\n**URL:** https://docs.google.com/document/d/${doc.documentId}/edit\\n**Revision ID:** ${doc.revisionId}\\n\\n**Document Content:**\\n${textContent || 'No text content found'}\\n\\n**Statistics:**\\n**Content Elements:** ${content.length}\\n**Character Count:** ${textContent.length}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Google Docs get failed: ${error.message}`);
      }
    },

    'google-docs-batch-update': async (args, apiKey, userId) => {
      if (!google) {
        throw new Error('Google APIs not available. Please install googleapis package: npm install googleapis');
      }
      
      if (!apiKey) {
        throw new Error('Google Docs API key or service account credentials are required');
      }

      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: apiKey,
          scopes: ['https://www.googleapis.com/auth/documents']
        });

        const docs = google.docs({ version: 'v1', auth });

        // Convert requests to Google Docs API format
        const requests = args.requests.map(req => {
          if (req.insert_text) {
            return {
              insertText: {
                text: req.insert_text.text,
                location: {
                  index: req.insert_text.location.index
                }
              }
            };
          }
          if (req.delete_content_range) {
            return {
              deleteContentRange: {
                range: {
                  startIndex: req.delete_content_range.range.start_index,
                  endIndex: req.delete_content_range.range.end_index
                }
              }
            };
          }
          return req;
        });

        const response = await docs.documents.batchUpdate({
          documentId: args.document_id,
          resource: {
            requests: requests
          },
          auth
        });

        return {
          content: [
            {
              type: "text",
              text: `**Google Docs Batch Update Completed:**\\n\\n**Document ID:** ${args.document_id}\\n**URL:** https://docs.google.com/document/d/${args.document_id}/edit\\n**Requests Processed:** ${requests.length}\\n**Document Revision:** ${response.data.documentId}\\n\\n**Replies:** ${response.data.replies?.length || 0} operations completed`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Google Docs batch update failed: ${error.message}`);
      }
    },

    'google-docs-share': async (args, apiKey, userId) => {
      if (!google) {
        throw new Error('Google APIs not available. Please install googleapis package: npm install googleapis');
      }
      
      if (!apiKey) {
        throw new Error('Google Docs API key or service account credentials are required');
      }

      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: apiKey,
          scopes: ['https://www.googleapis.com/auth/drive']
        });

        const drive = google.drive({ version: 'v3', auth });

        const permission = {
          type: 'user',
          role: args.role,
          emailAddress: args.email
        };

        const response = await drive.permissions.create({
          fileId: args.document_id,
          resource: permission,
          sendNotificationEmail: true,
          auth
        });

        return {
          content: [
            {
              type: "text",
              text: `**Google Docs Sharing Updated:**\\n\\n**Document ID:** ${args.document_id}\\n**URL:** https://docs.google.com/document/d/${args.document_id}/edit\\n**Shared with:** ${args.email}\\n**Permission Level:** ${args.role}\\n**Permission ID:** ${response.data.id}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Google Docs sharing failed: ${error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}