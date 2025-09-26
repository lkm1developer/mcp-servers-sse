// Google Sheets MCP Server Adapter for 2025 Protocol
import { z } from 'zod';

let google;
try {
  const googleModule = await import('googleapis');
  google = googleModule.google;
} catch (error) {
  console.warn('googleapis package not available. Google Sheets functionality will be limited.');
}

/**
 * Google Sheets MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'GOOGLE_SHEETS_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'google-sheets-create',
      title: 'Google Sheets Create Spreadsheet',
      description: 'Create a new Google Sheets spreadsheet',
      inputSchema: {
        title: z.string().describe('Title of the new spreadsheet'),
        locale: z.string().optional().describe('Locale for the spreadsheet (default: en_US)')
      }
    },
    {
      name: 'google-sheets-get',
      title: 'Google Sheets Get Spreadsheet',
      description: 'Get information about a Google Sheets spreadsheet',
      inputSchema: {
        spreadsheet_id: z.string().describe('ID of the spreadsheet to retrieve'),
        include_grid_data: z.boolean().optional().describe('Include cell data (default: false)')
      }
    },
    {
      name: 'google-sheets-update-values',
      title: 'Google Sheets Update Values',
      description: 'Update values in a Google Sheets spreadsheet',
      inputSchema: {
        spreadsheet_id: z.string().describe('ID of the spreadsheet'),
        range: z.string().describe('A1 notation range (e.g., Sheet1!A1:D5)'),
        values: z.array(z.array(z.string())).describe('2D array of values to insert'),
        value_input_option: z.enum(['RAW', 'USER_ENTERED']).optional().describe('How values should be interpreted')
      }
    },
    {
      name: 'google-sheets-get-values',
      title: 'Google Sheets Get Values',
      description: 'Get values from a Google Sheets spreadsheet range',
      inputSchema: {
        spreadsheet_id: z.string().describe('ID of the spreadsheet'),
        range: z.string().describe('A1 notation range (e.g., Sheet1!A1:D5)'),
        value_render_option: z.enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA']).optional().describe('How values should be rendered')
      }
    },
    {
      name: 'google-sheets-batch-update',
      title: 'Google Sheets Batch Update',
      description: 'Perform multiple updates to a spreadsheet in a single request',
      inputSchema: {
        spreadsheet_id: z.string().describe('ID of the spreadsheet'),
        requests: z.array(z.object({
          add_sheet: z.object({
            properties: z.object({
              title: z.string().describe('Sheet title')
            })
          }).optional(),
          delete_sheet: z.object({
            sheet_id: z.number().describe('Sheet ID to delete')
          }).optional(),
          update_cells: z.object({
            range: z.string().describe('A1 notation range'),
            values: z.array(z.array(z.string())).describe('Values to update')
          }).optional()
        })).describe('Array of update requests')
      }
    },
    {
      name: 'google-sheets-share',
      title: 'Google Sheets Share Spreadsheet',
      description: 'Share a Google Sheets spreadsheet with users',
      inputSchema: {
        spreadsheet_id: z.string().describe('ID of the spreadsheet'),
        email: z.string().describe('Email address to share with'),
        role: z.enum(['reader', 'writer', 'owner']).describe('Permission level'),
        send_notification: z.boolean().optional().describe('Send notification email (default: true)')
      }
    }
  ];

  const toolHandlers = {
    'google-sheets-create': async (args, apiKey, userId) => {
      if (!google) {
        throw new Error('Google APIs not available. Please install googleapis package: npm install googleapis');
      }
      
      if (!apiKey) {
        throw new Error('Google Sheets API key or service account credentials are required');
      }

      try {
        // Initialize Google Sheets API
        const auth = new google.auth.GoogleAuth({
          keyFile: apiKey, // Assuming apiKey is path to service account JSON
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        const resource = {
          properties: {
            title: args.title,
            locale: args.locale || 'en_US'
          }
        };

        const response = await sheets.spreadsheets.create({
          resource,
          auth
        });

        return {
          content: [
            {
              type: "text",
              text: `**Google Sheets Spreadsheet Created:**\\n\\n**Title:** ${response.data.properties.title}\\n**Spreadsheet ID:** ${response.data.spreadsheetId}\\n**URL:** https://docs.google.com/spreadsheets/d/${response.data.spreadsheetId}/edit\\n**Locale:** ${response.data.properties.locale}\\n**Created:** ${response.data.properties.createdTime || 'N/A'}\\n\\n**Sheets:**\\n${response.data.sheets?.map(sheet => `- ${sheet.properties.title} (ID: ${sheet.properties.sheetId})`).join('\\n') || 'No sheets'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Google Sheets create failed: ${error.message}`);
      }
    },

    'google-sheets-get': async (args, apiKey, userId) => {
      if (!google) {
        throw new Error('Google APIs not available. Please install googleapis package: npm install googleapis');
      }
      
      if (!apiKey) {
        throw new Error('Google Sheets API key or service account credentials are required');
      }

      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: apiKey,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.get({
          spreadsheetId: args.spreadsheet_id,
          includeGridData: args.include_grid_data || false,
          auth
        });

        const data = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**Google Sheets Spreadsheet Information:**\\n\\n**Title:** ${data.properties.title}\\n**Spreadsheet ID:** ${data.spreadsheetId}\\n**URL:** https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit\\n**Locale:** ${data.properties.locale}\\n**Auto Recalc:** ${data.properties.autoRecalc}\\n\\n**Sheets (${data.sheets?.length || 0}):**\\n${data.sheets?.map(sheet => {
                const props = sheet.properties;
                return `- **${props.title}** (ID: ${props.sheetId})\\n  Type: ${props.sheetType}\\n  Rows: ${props.gridProperties?.rowCount || 'N/A'}\\n  Columns: ${props.gridProperties?.columnCount || 'N/A'}`;
              }).join('\\n') || 'No sheets found'}\\n\\n**Named Ranges:** ${data.namedRanges?.map(range => range.name).join(', ') || 'None'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Google Sheets get failed: ${error.message}`);
      }
    },

    'google-sheets-update-values': async (args, apiKey, userId) => {
      if (!google) {
        throw new Error('Google APIs not available. Please install googleapis package: npm install googleapis');
      }
      
      if (!apiKey) {
        throw new Error('Google Sheets API key or service account credentials are required');
      }

      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: apiKey,
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.values.update({
          spreadsheetId: args.spreadsheet_id,
          range: args.range,
          valueInputOption: args.value_input_option || 'USER_ENTERED',
          resource: {
            values: args.values
          },
          auth
        });

        return {
          content: [
            {
              type: "text",
              text: `**Google Sheets Values Updated:**\\n\\n**Spreadsheet ID:** ${args.spreadsheet_id}\\n**Range:** ${args.range}\\n**Updated Rows:** ${response.data.updatedRows}\\n**Updated Columns:** ${response.data.updatedColumns}\\n**Updated Cells:** ${response.data.updatedCells}\\n**Updated Range:** ${response.data.updatedRange}\\n\\n**Values Updated:**\\n${args.values.map((row, i) => `Row ${i + 1}: ${row.join(', ')}`).join('\\n')}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Google Sheets update values failed: ${error.message}`);
      }
    },

    'google-sheets-get-values': async (args, apiKey, userId) => {
      if (!google) {
        throw new Error('Google APIs not available. Please install googleapis package: npm install googleapis');
      }
      
      if (!apiKey) {
        throw new Error('Google Sheets API key or service account credentials are required');
      }

      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: apiKey,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: args.spreadsheet_id,
          range: args.range,
          valueRenderOption: args.value_render_option || 'FORMATTED_VALUE',
          auth
        });

        const values = response.data.values || [];

        return {
          content: [
            {
              type: "text",
              text: `**Google Sheets Values Retrieved:**\\n\\n**Spreadsheet ID:** ${args.spreadsheet_id}\\n**Range:** ${args.range}\\n**Total Rows:** ${values.length}\\n**Major Dimension:** ${response.data.majorDimension}\\n\\n**Values:**\\n${values.map((row, i) => `Row ${i + 1}: ${Array.isArray(row) ? row.join(' | ') : row}`).join('\\n') || 'No data found'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Google Sheets get values failed: ${error.message}`);
      }
    },

    'google-sheets-batch-update': async (args, apiKey, userId) => {
      if (!google) {
        throw new Error('Google APIs not available. Please install googleapis package: npm install googleapis');
      }
      
      if (!apiKey) {
        throw new Error('Google Sheets API key or service account credentials are required');
      }

      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: apiKey,
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Convert simplified requests to Google Sheets API format
        const requests = args.requests.map(req => {
          if (req.add_sheet) {
            return {
              addSheet: {
                properties: req.add_sheet.properties
              }
            };
          }
          if (req.delete_sheet) {
            return {
              deleteSheet: {
                sheetId: req.delete_sheet.sheet_id
              }
            };
          }
          return req; // Pass through other request types as-is
        });

        const response = await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheet_id,
          resource: {
            requests: requests
          },
          auth
        });

        return {
          content: [
            {
              type: "text",
              text: `**Google Sheets Batch Update Completed:**\\n\\n**Spreadsheet ID:** ${args.spreadsheet_id}\\n**Requests Processed:** ${requests.length}\\n**Updated Spreadsheet URL:** https://docs.google.com/spreadsheets/d/${args.spreadsheet_id}/edit\\n\\n**Replies:** ${response.data.replies?.map((reply, i) => `Request ${i + 1}: ${Object.keys(reply).join(', ')}`).join('\\n') || 'No specific replies'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Google Sheets batch update failed: ${error.message}`);
      }
    },

    'google-sheets-share': async (args, apiKey, userId) => {
      if (!google) {
        throw new Error('Google APIs not available. Please install googleapis package: npm install googleapis');
      }
      
      if (!apiKey) {
        throw new Error('Google Sheets API key or service account credentials are required');
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
          fileId: args.spreadsheet_id,
          resource: permission,
          sendNotificationEmail: args.send_notification !== false,
          auth
        });

        return {
          content: [
            {
              type: "text",
              text: `**Google Sheets Sharing Updated:**\\n\\n**Spreadsheet ID:** ${args.spreadsheet_id}\\n**Shared with:** ${args.email}\\n**Permission Level:** ${args.role}\\n**Permission ID:** ${response.data.id}\\n**Notification Sent:** ${args.send_notification !== false ? 'Yes' : 'No'}\\n\\n**Spreadsheet URL:** https://docs.google.com/spreadsheets/d/${args.spreadsheet_id}/edit`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Google Sheets sharing failed: ${error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}