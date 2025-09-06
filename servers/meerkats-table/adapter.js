// Meerkats MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * Meerkats MCP Server adapter for multi-MCP system
 * Provides comprehensive table/sheet management with AI capabilities
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'MEERKATS_TABLE_API_KEY') {
  const toolsDefinitions = [
    {
      name: "scrape_url",
      title: "Meerkats Scrape URL",
      description: "Scrape a URL and return the content as markdown or HTML",
      inputSchema: {
        url: z.string().describe("URL to scrape"),
        formats: z.array(z.enum(["markdown", "html"])).optional().describe("Content formats to extract (default: ['markdown'])"),
        onlyMainContent: z.boolean().optional().describe("Extract only the main content, filtering out navigation, footers, etc."),
        includeTags: z.array(z.string()).optional().describe("HTML tags to specifically include in extraction"),
        excludeTags: z.array(z.string()).optional().describe("HTML tags to exclude from extraction"),
        waitFor: z.number().optional().describe("Time in milliseconds to wait for dynamic content to load"),
        timeout: z.number().optional().describe("Maximum time in milliseconds to wait for the page to load")
      }
    },
    {
      name: "web_search",
      title: "Meerkats Web Search",
      description: "Search the web and return results",
      inputSchema: {
        query: z.string().describe("Query to search for on the web")
      }
    },
    {
      name: "list_tables",
      description: "List tables for the authenticated user with pagination support (name, description, createdAt)",
      inputSchema: {
        search: z.string().optional().describe("Search term to filter tables by name"),
        limit: z.number().min(1).max(100).optional().describe("Number of tables to return (default: 10, max: 100)"),
        page: z.number().min(1).optional().describe("Page number for pagination (1-based, default: 1)")
      },
    },
    {
      name: "get_table",
      description: "Get details of a specific table by ID",
      inputSchema: {
        tableId: z.string().describe("The ID of the table to retrieve")
      },
    },
    {
      name: "create_table",
      description: "Create a new table with name, description, and columns",
      inputSchema: {
        name: z.string().describe("Name of the table/table"),
        description: z.string().describe("Description of the table/table"),
        columns: z.array(z.object({
          name: z.string().describe("Column name (becomes label in backend)"),
          dataType: z.enum(["text", "url", "date", "number", "uuid"]).describe("Data type: text, url, date, number, uuid"),
          type: z.enum(["AI", "Input"]).describe("Column type: AI or Input"),
          prompt: z.string().optional().describe("AI prompt for AI type columns"),
          tools: z.array(z.string()).optional().describe("Array of MCP tools in format 'server_name.tool_name' for AI columns")
        })).optional().describe("Array of columns for the table")
      },
    },
    {
      name: "update_table",
      description: "Update an existing table",
      inputSchema: {
        tableId: z.string().describe("The ID of the table to update"),
        name: z.string().optional().describe("New name for the table"),
        description: z.string().optional().describe("New description for the table"),
        prompt: z.string().optional().describe("AI prompt for the table"),
        autoEnrich: z.boolean().optional().describe("Enable auto-enrichment for the table")
      },
    },
    {
      name: "delete_table",
      description: "Delete a table",
      inputSchema: {
        tableId: z.string().describe("The ID of the table to delete")
      },
    },
    {
      name: "get_table_rows",
      description: "Get rows from a table with pagination support",
      inputSchema: {
        tableId: z.string().describe("The ID of the table"),
        limit: z.number().min(1).max(1000).optional().describe("Number of rows to return (default: 50, max: 1000)"),
        page: z.number().min(1).optional().describe("Page number for pagination (1-based, default: 1)")
      },
    },
    {
      name: "add_table_row",
      description: "Add a new row to a table with column name to value mapping",
      inputSchema: {
        tableId: z.string().describe("The ID of the table"),
        data: z.record(z.any()).describe("Row data as column name to value pairs")
      },
    },
    {
      name: "update_table_row",
      description: "Update an existing row in a table",
      inputSchema: {
        tableId: z.string().describe("The ID of the table"),
        rowId: z.string().describe("The ID of the row to update"),
        data: z.record(z.any()).describe("Updated row data as column name to value pairs")
      },
    },
    {
      name: "delete_table_row",
      description: "Delete a row from a table",
      inputSchema: {
        tableId: z.string().describe("The ID of the table"),
        rowId: z.string().describe("The ID of the row to delete")
      },
    },
    {
      name: "get_table_stats",
      description: "Get statistics about user's tables",
      inputSchema: {},
    },
    {
      name: "add_table_rows_bulk",
      description: "Add multiple rows to a table in a single operation",
      inputSchema: {
        tableId: z.string().describe("The ID of the table"),
        rows: z.array(z.record(z.any()).describe("Row data as column name to value pairs")).min(1).describe("Array of row objects, each containing column name to value pairs")
      },
    },
    {
      name: "get_mcp_servers",
      description: "Get available MCP servers that can be used for AI columns",
      inputSchema: {},
    },
    {
      name: "add_table_column",
      description: "Add a new column to an existing table",
      inputSchema: {
        tableId: z.string().describe("The ID of the table to add column to"),
        name: z.string().describe("Name of the column (becomes label in backend)"),
        dataType: z.enum(["text", "url", "date", "number", "uuid"]).describe("Data type of the column"),
        type: z.enum(["AI", "Input"]).describe("Column type"),
        prompt: z.string().optional().describe("AI prompt for AI type columns. Use {Column Name} for dependencies on other columns"),
        tools: z.array(z.string()).describe("Array of MCP tools for AI columns in format 'server_name.tool_name'")
      },
    },
    {
      name: "add_table_columns",
      description: "Add multiple columns to an existing table",
      inputSchema: {
        tableId: z.string().describe("The ID of the table to add columns to"),
        columns: z.array(z.object({
          name: z.string().describe("Name of the column (becomes label in backend)"),
          dataType: z.enum(["text", "url", "date", "number", "uuid"]).describe("Data type of the column"),
          type: z.enum(["AI", "Input"]).describe("Column type"),
          prompt: z.string().optional().describe("AI prompt for AI type columns. Use {Column Name} for dependencies on other columns"),
          tools: z.array(z.string()).describe("Array of MCP tools for AI columns in format 'server_name.tool_name'")
        })).describe("Array of column objects to add")
      }
    },
    {
      name: "update_table_column",
      description: "Update an existing column in a table",
      inputSchema: {
        tableId: z.string().describe("The ID of the table containing the column"),
        columnId: z.string().describe("The ID of the column to update"),
        name: z.string().optional().describe("New name for the column"),
        dataType: z.enum(["text", "url", "date", "number", "uuid"]).optional().describe("New data type of the column"),
        type: z.enum(["AI", "Input"]).optional().describe("New column type"),
        prompt: z.string().optional().describe("New AI prompt for AI type columns"),
        tools: z.array(z.string()).describe("Array of MCP tools for AI columns in format 'server_name.tool_name'")
      },
    },
    {
      name: "schedule_table_column",
      description: "Schedule an AI column to run automatically on a cron schedule or single run",
      inputSchema: {
        tableId: z.string().describe("The ID of the table containing the column"),
        columnId: z.string().describe("The ID of the AI column to schedule"),
        isScheduled: z.boolean().optional().describe("Enable or disable scheduling for the column"),
        scheduleType: z.enum(["recurring", "single"]).optional().describe("Type of schedule: 'recurring' for cron-based, 'single' for one-time run"),
        cronExpression: z.string().optional().describe("Cron expression for recurring schedules"),
        singleRunTime: z.string().optional().describe("ISO datetime string for single run schedules")
      },
    },
    {
      name: "get_table_column_schedule",
      description: "Get the current scheduling information for an AI column",
      inputSchema: {
        tableId: z.string().describe("The ID of the table containing the column"),
        columnId: z.string().describe("The ID of the column to get schedule information for")
      },
    },
    {
      name: "filter_table_rows",
      description: "Filter and search rows in a table using column filters and row range",
      inputSchema: {
        tableId: z.string().describe("The ID of the table to filter rows from"),
        filters: z.array(z.object({
          column: z.object({
            _id: z.string().describe("Column ID"),
            label: z.string().describe("Column name/label"),
            datatype: z.string().describe("Column data type")
          }).describe("Filter column"),
          operator: z.object({
            id: z.string().describe("Operator ID"),
            title: z.string().describe("Human readable operator name")
          }).describe("Filter operator"),
          value: z.string().optional().describe("Filter value to compare against"),
          condition: z.enum(["And", "Or"]).optional().describe("Logical condition to combine with other filters")
        })).optional().describe("Array of filter conditions to apply to rows"),
        from: z.number().optional().describe("Starting row number for row range filtering"),
        to: z.number().optional().describe("Ending row number for row range filtering"),
        limit: z.number().optional().describe("Maximum number of rows to return (default: 50)"),
        page: z.number().optional().describe("Page number for pagination (default: 0)")
      },
    },
    {
      name: "list_table_sheets",
      description: "List all sheets within a table with pagination support",
      inputSchema: {
        tableId: z.string().describe("The ID of the parent table"),
        limit: z.number().min(1).max(100).optional().describe("Number of sheets to return (default: 10, max: 100)"),
        page: z.number().min(1).optional().describe("Page number for pagination (1-based, default: 1)")
      },
    },
    {
      name: "get_table_sheet",
      description: "Get details of a specific sheet by ID",
      inputSchema: {
        sheetId: z.string().describe("The ID of the sheet to retrieve")
      },
    },
    {
      name: "create_table_sheet",
      description: "Create a new sheet within a table",
      inputSchema: {
        tableId: z.string().describe("The ID of the parent table"),
        sheetName: z.string().describe("Name of the new sheet"),
        description: z.string().optional().describe("Description of the sheet (optional)")
      },
    },
    {
      name: "update_table_sheet",
      description: "Update an existing sheet",
      inputSchema: {
        sheetId: z.string().describe("The ID of the sheet to update"),
        sheetName: z.string().optional().describe("New name for the sheet (optional)"),
        description: z.string().optional().describe("New description for the sheet (optional)")
      },
    },
    {
      name: "delete_table_sheet",
      description: "Delete a sheet from a table",
      inputSchema: {
        sheetId: z.string().describe("The ID of the sheet to delete")
      },
    },
    {
      name: "get_table_sheet_rows",
      description: "Get rows from a specific sheet with pagination support",
      inputSchema: {
        sheetId: z.string().describe("The ID of the sheet"),
        limit: z.number().min(1).max(1000).optional().describe("Number of rows to return (default: 50, max: 1000)"),
        page: z.number().min(1).optional().describe("Page number for pagination (1-based, default: 1)")
      },
    },
    {
      name: "add_table_sheet_row",
      description: "Add a new row to a sheet",
      inputSchema: {
        sheetId: z.string().describe("The ID of the sheet"),
        data: z.record(z.any()).describe("Row data as key-value pairs where keys are column names")
      },
    },
    {
      name: "update_table_sheet_row",
      description: "Update an existing row in a sheet",
      inputSchema: {
        sheetId: z.string().describe("The ID of the sheet"),
        rowId: z.string().describe("The ID of the row to update"),
        data: z.record(z.any()).describe("Updated row data as key-value pairs")
      },
    },
    {
      name: "delete_table_sheet_row",
      description: "Delete a row from a sheet",
      inputSchema: {
        sheetId: z.string().describe("The ID of the sheet"),
        rowId: z.string().describe("The ID of the row to delete")
      },
    },
    {
      name: "filter_table_sheet_rows",
      description: "Filter and search rows in a sheet using column filters and row range",
      inputSchema: {
        sheetId: z.string().describe("The ID of the sheet to filter rows from"),
        filters: z.array(z.any()).optional().describe("Array of filter conditions to apply to rows"),
        from: z.number().optional().describe("Starting row number for row range filtering"),
        to: z.number().optional().describe("Ending row number for row range filtering"),
        limit: z.number().optional().describe("Maximum number of rows to return (default: 50)"),
        page: z.number().optional().describe("Page number for pagination (default: 0)")
      },
    },
    {
      name: "run_table_ai_cell",
      description: "Run AI processing for a single table cell",
      inputSchema: {
        sheetId: z.string().describe("The ID of the sheet containing the cell"),
        tableId: z.string().describe("The ID of the table containing the cell"),
        columnId: z.string().describe("The ID of the column containing the cell"),
        rowId: z.string().describe("The ID of the row containing the cell")
      },
    },
    {
      name: "run_table_ai_cells_bulk",
      description: "Run AI processing for multiple table cells in bulk",
      inputSchema: {
        type: z.enum(["first_10", "all", "errored_only", "specific_count"]).describe("Type of bulk run"),
        columnId: z.string().describe("The ID of a reference column for the column to run"),
        sheetId: z.string().describe("The ID of the sheet to run bulk processing on"),
        tableId: z.string().describe("The ID of the table to run bulk processing on"),
        onlyErrored: z.boolean().optional().describe("Only run on cells that have errors (default: false)"),
        count: z.number().min(1).max(1000).optional().describe("Number of rows to process when type is 'specific_count'"),
        rowIds: z.array(z.string()).optional().describe("Array of row IDs to run bulk processing on")
      },
    },
    {
      name: "generate_artifact",
      description: "Generate dynamic artifacts using vibe coding",
      inputSchema: {
        sourceData: z.string().describe("the data source for the artifact"),
        tableId: z.string().optional().describe("The ID of the table (optional)"),
        artifact: {
          name: z.string().describe("the name of the artifact"),
          description: z.string().describe("the description of the artifact"),
          code: z.string().describe("the code of the artifact"),
          type: z.enum(['HTML', 'CSS', 'JavaScript', 'JSON', 'Text', 'React.js', 'Node.js']).describe("the type of the artifact")
        }
      },
    },
    {
      name: "list_artifacts",
      description: "List all artifacts for the authenticated user with pagination and search support",
      inputSchema: {
        search: z.string().optional().describe("Search term to filter artifacts by name or description"),
        type: z.enum(['HTML', 'CSS', 'JavaScript', 'JSON', 'Text', 'React.js', 'Node.js']).optional().describe("Filter artifacts by type"),
        limit: z.number().min(1).max(100).optional().describe("Number of artifacts to return (default: 10, max: 100)"),
        page: z.number().min(1).optional().describe("Page number for pagination (1-based, default: 1)")
      },
    },
    {
      name: "get_artifact",
      description: "Get details of a specific artifact by ID",
      inputSchema: {
        artifactId: z.string().describe("The ID of the artifact to retrieve")
      },
    },
    {
      name: 'google_map_search',
      description: 'Search for locations using the Google Maps API',
      inputSchema: {
        tableId: z.string().optional().describe('the current working table id if available else leave blank'),
        query: z.string().describe('The search query to use for location search')
      }
    },
    {
      name: "get_mcp_server_rate_limits",
      description: "Get MCP server rate limits for the authenticated user",
      inputSchema: {
        serverName: z.string().optional().describe("Specific MCP server name to get rate limits for (optional)")
      }
    },
    {
      name: "update_mcp_server_rate_limit",
      description: "Update MCP server rate limit settings for the authenticated user",
      inputSchema: {
        serverName: z.string().describe("The server name of the MCP server to update rate limits for"),
        limit: z.number().min(1).describe("Maximum number of requests allowed in the time window"),
        timeperiod: z.number().min(1).describe("Time period duration"),
        entity: z.enum(["seconds", "minutes", "hours", "days"]).describe("Time entity for the rate limit period")
      }
    },
    {
      name: "check_duplicate_rows",
      description: "Check for duplicate rows in a table based on specified column names",
      inputSchema: {
        tableId: z.string().describe("The ID of the table to check for duplicates"),
        attributeKeys: z.array(z.string()).describe("Array of column names (labels) to check for duplicates - will be automatically converted to column IDs")
      }
    },
    {
      name: "delete_duplicate_rows",
      description: "Delete duplicate rows from a table based on specified column names",
      inputSchema: {
        tableId: z.string().describe("The ID of the table to delete duplicates from"),
        attributeKeys: z.array(z.string()).describe("Array of column names (labels) to identify duplicates for deletion - will be automatically converted to column IDs")
      }
    }
  ];
  // Configuration for Google Cloud Run production
  const isLocal = true
  const API_BASE_URL = isLocal ? "http://localhost:5000/api/v1" : "https://prod-api-126608443486.us-central1.run.app/api/v1";
  const JOB_INSERTER_URL = process.env.JOB_INSERTER_URL || "https://prod-api-126608443486.us-central1.run.app";
  const API_VERSION = process.env.API_VERSION || "v1";

  // Enhanced API request utility with API key
  async function makeAuthenticatedApiRequest(endpoint, method = 'GET', data = null, apiKey) {
    const url = `${API_BASE_URL}${endpoint}`;

    log(`API Request: ${method} ${url}`, { hasApiKey: !!apiKey });
    try {
      const config = {
        method,
        url,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key_lkm': apiKey
        }
      }
      if (data && method === 'POST' || method === 'PUT') {
        config.data = data;
      }
      const response = await axios(config);
      return response.data;
    } catch (error) {
      log(`API Request failed: ${JSON.stringify(error)}`)
      log(`API Request failed: ${error.message}`, {
        status: error.response?.status,
        data: error.response?.data
      });

      if (error.response?.status === 401) {
        throw new Error('Authentication failed - token may be expired');
      }

      throw new Error(`API request failed: ${error.response?.data?.message || error.response?.data?.error || error.message}`);
    }
  }

  // Helper function for running AI cells
  async function runTableAICell(data = null, accessToken) {
    const url = `${JOB_INSERTER_URL}/api/v2/batches/${data.tableId}/aiColumnData`;
    if (data) {
      data.sheetId = data.sheetId || data.tableId;
      data.cellId = data.cellId || data.columnId;
    }

    try {
      const { data: result, status } = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': accessToken
        }
      });
      return {
        content: [{
          type: "text",
          text: `Successfully started ai cell run, can take a few seconds to few minutes. api result: ${JSON.stringify(result)}`
        }]
      }
    } catch (error) {
      log('AI Cell run failed', { error: error.message, stack: error.stack });
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  // Helper function for generating artifacts
  async function generateVibeChart(args, accessToken) {
    try {
      const url = `${API_BASE_URL}/save-artifact`;
      const result = await axios.post(url, args, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      })
      log('Artifact generated and saved', { artifactData: result.data });
      return {
        content: [{
          type: "text",
          text: `artifact generated and saved `
        }, {
          type: "text",
          text: JSON.stringify(result.data)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `artifact failed to save ${error.message}`
        }]
      }
    }
  }
  const toolHandlersOriginal = {
    async scrape_url(args, apiKey, userId){
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        return {
          content: [
            {
              type: "text",
              text: `Coming soon`
            }
          ]
        }
        // Use a simple scraping approach with axios
        // const response = await axios.get(args.url, {
        //   timeout: args.timeout || 30000,
        //   headers: {
        //     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        //   }
        // });

        // let content = response.data;
        
        // // Basic HTML to markdown conversion (simplified)
        // if (args.formats && args.formats.includes('markdown')) {
        //   content = content
        //     .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '# $1\\n\\n')
        //     .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\\n\\n')
        //     .replace(/<br[^>]*>/gi, '\\n')
        //     .replace(/<[^>]+>/g, '') // Remove all HTML tags
        //     .replace(/\\n\\s*\\n/g, '\\n\\n'); // Clean up multiple newlines
        // }

        // return {
        //   content: [
        //     {
        //       type: "text",
        //       text: `**Meerkats URL Scraping Results:**\\n\\n**URL:** ${args.url}\\n**Status:** Success\\n**Content Length:** ${content.length} characters\\n\\n**Content:**\\n${content.substring(0, 2000)}${content.length > 2000 ? '...\\n\\n(Content truncated)' : ''}`
        //     }
        //   ]
        // };
      } catch (error) {
        throw new Error(`Meerkats URL scraping failed: ${error.message}`);
      }
    },

    async web_search(args, apiKey, userId){
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        // This is a placeholder implementation - you would integrate with a real search API
        return {
          content: [
            {
              type: "text",
              text: `Coming soon`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats web search failed: ${error.message}`);
      }
    },
    async list_tables(args, accessToken) {
      const params = new URLSearchParams();
      if (args.search) params.append('search', args.search);
      if (args.limit) params.append('limit', args.limit.toString());
      if (args.page) params.append('page', args.page.toString());

      const result = await makeAuthenticatedApiRequest(
        `/automations?${params.toString()}`,
        'GET',
        null,
        accessToken
      );

      log(`Successfully listed ${result.data?.length || 0} tables`, {
        pagination: result.pagination
      });

      return {
        content: [{
          type: "text",
          text: `Found ${result.data?.length || 0} tables${result.pagination ?
            ` (page ${result.pagination.page} of ${result.pagination.totalPages}, total: ${result.pagination.total})` :
            ''}:\n\n${JSON.stringify(result.data, null, 2)}${result.pagination ?
              `\n\nPagination Info:\n${JSON.stringify(result.pagination, null, 2)}` : ''} table links format  tableLink:[📊 table.name](https://app.meerkats.ai/dashboard/table/table._id)",`
        }]
      };
    },

    async get_table(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}`,
        'GET',
        null,
        accessToken
      );
      log(`Retrieved table details for table `);
      log(JSON.stringify(result, null, 2));
      return {
        content: [{
          type: "text",
          text: `Table details:\n${JSON.stringify(result, null, 2)}`
        }]
      };
    },

    async create_table(args, accessToken) {
      log(`Creating table with columns=>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`);

      // Validate AI columns have required tools
      if (args.columns) {
        for (const column of args.columns) {
          if (column.type === 'AI') {
            if (!column.tools || column.tools.length === 0) {
              throw new Error(`AI column "${column.name}" must specify at least one tool in "servername.toolname" format`);
            }

            // Validate tools format
            for (const tool of column.tools) {
              if (!tool.includes('.')) {
                throw new Error(`Tool "${tool}" for column "${column.name}" must be in "servername.toolname" format`);
              }
            }
          }
        }
      }

      const result = await makeAuthenticatedApiRequest(
        '/automations',
        'POST',
        {
          name: args.name,
          description: args.description,
          columns: args.columns || [],
        },
        accessToken
      );

      log(`Created table with ${args?.columns?.length} columns`);
      return {
        content: [{
          type: "text",
          text: `Created table successfully:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async update_table(args, accessToken) {
      const updateData = {};
      if (args.name) updateData.name = args.name;
      if (args.description) updateData.description = args.description;
      if (args.prompt) updateData.prompt = args.prompt;
      if (args.autoEnrich !== undefined) updateData.autoEnrich = args.autoEnrich;

      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}`,
        'PUT',
        updateData,
        accessToken
      );

      return {
        content: [{
          type: "text",
          text: `Updated table successfully:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async delete_table(args, accessToken) {
      await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}`,
        'DELETE',
        null,
        accessToken
      );

      return {
        content: [{
          type: "text",
          text: `Table ${args.tableId} deleted successfully.`
        }]
      };
    },

    async get_table_rows(args, accessToken) {
      const params = new URLSearchParams();
      if (args.limit) params.append('limit', args.limit.toString());
      if (args.page) params.append('page', args.page.toString());

      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}/rows?${params.toString()}`,
        'GET',
        null,
        accessToken
      );

      log(`Retrieved ${result.data?.length || 0} rows from table ${args.tableId}`, {
        pagination: result.pagination
      });

      return {
        content: [{
          type: "text",
          text: `Retrieved ${result.data?.length || 0} rows from table${result.pagination ? ` (page ${result.pagination.page} of ${result.pagination.totalPages}, total: ${result.pagination.total})` : ''}:\n\n${JSON.stringify(result.data, null, 2)}${result.pagination ? `\n\nPagination Info:\n${JSON.stringify(result.pagination, null, 2)}` : ''}`
        }]
      };
    },

    async add_table_row(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}/rows`,
        'POST',
        { data: args.data },
        accessToken
      );

      return {
        content: [{
          type: "text",
          text: `Added row successfully:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async update_table_row(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}/rows/${args.rowId}`,
        'PUT',
        { data: args.data },
        accessToken
      );

      return {
        content: [{
          type: "text",
          text: `Updated row successfully:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async delete_table_row(args, accessToken) {
      await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}/rows/${args.rowId}`,
        'DELETE',
        null,
        accessToken
      );

      return {
        content: [{
          type: "text",
          text: `Row ${args.rowId} deleted successfully from table ${args.tableId}.`
        }]
      };
    },

    async get_table_stats(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        '/automations/stats',
        'GET',
        null,
        accessToken
      );

      return {
        content: [{
          type: "text",
          text: `Table statistics:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async add_table_rows_bulk(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}/rows/bulk`,
        'POST',
        { rows: args.rows },
        accessToken
      );

      log(`Added ${args.rows.length} rows in bulk to table ${args.tableId}`);
      return {
        content: [{
          type: "text",
          text: `Added ${args.rows.length} rows successfully:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async get_mcp_servers(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        '/automations/mcp-servers',
        'GET',
        null,
        accessToken
      );

      log(`Retrieved ${result.data?.length || 0} available MCP servers`);
      return {
        content: [{
          type: "text",
          text: `Available MCP servers for AI columns:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async add_table_column(args, accessToken) {
      // Validate AI columns have required tools in servername.toolname format
      if (args.type === 'AI') {
        if (!args.tools || args.tools.length === 0) {
          throw new Error('AI columns must specify at least one tool in "servername.toolname" format');
        }

        // Validate tools format
        for (const tool of args.tools) {
          if (!tool.includes('.')) {
            throw new Error(`Tool "${tool}" must be in "servername.toolname" format`);
          }
        }
      }

      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}/columns`,
        'POST',
        {
          name: args.name,
          dataType: args.dataType,
          type: args.type,
          prompt: args.prompt || '',
          tools: args.tools || []
        },
        accessToken
      );

      log(`Added column '${args.name}' to table ${args.tableId}`);
      return {
        content: [{
          type: "text",
          text: `Column '${args.name}' added successfully:\n${JSON.stringify(result, null, 2)}`
        }]
      };
    },
    async add_table_columns(args, accessToken) {
      log(`Adding columns to table ${args.tableId}`);

      // Parse columns if it's a string (for backward compatibility)
      let columns = args.columns;
      if (typeof columns === 'string') {
        try {
          columns = JSON.parse(columns);
        } catch (error) {
          log(`Failed to parse columns JSON: ${error.message}`);
          throw new Error(`Invalid columns format: ${error.message}`);
        }
      }

      // Validate AI columns have required tools
      for (const column of columns) {
        if (column.type === 'AI') {
          if (!column.tools || column.tools.length === 0) {
            throw new Error(`AI column "${column.name}" must specify at least one tool in "servername.toolname" format`);
          }

          // Validate tools format
          for (const tool of column.tools) {
            if (!tool.includes('.')) {
              throw new Error(`Tool "${tool}" for column "${column.name}" must be in "servername.toolname" format`);
            }
          }
        }
      }

      log(`Validated columns:`, columns);
      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}/columns`,
        'POST',
        columns,
        accessToken
      );
      return {
        content: [{
          type: "text",
          text: `Successfully validated ${columns.length} columns for table ${args.tableId}:\n${JSON.stringify(result, null, 2)}`
        }]
      };
    },

    async update_table_column(args, accessToken) {
      // Validate AI columns have required tools in servername.toolname format
      if (args.type === 'AI') {
        if (!args.tools || args.tools.length === 0) {
          throw new Error('AI columns must specify at least one tool in "servername.toolname" format');
        }

        // Validate tools format
        for (const tool of args.tools) {
          if (!tool.includes('.')) {
            throw new Error(`Tool "${tool}" must be in "servername.toolname" format`);
          }
        }
      }

      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}/columns/${args.columnId}`,
        'PUT',
        {
          name: args.name,
          dataType: args.dataType,
          type: args.type,
          prompt: args.prompt,
          tools: args.tools
        },
        accessToken
      );

      log(`Updated column '${args.columnId}' in table ${args.tableId}`);
      return {
        content: [{
          type: "text",
          text: `Column updated successfully:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async schedule_table_column(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}/columns/${args.columnId}/schedule`,
        'POST',
        {
          isScheduled: args.isScheduled,
          scheduleType: args.scheduleType,
          cronExpression: args.cronExpression,
          singleRunTime: args.singleRunTime
        },
        accessToken
      );

      log(`${args.isScheduled === false ? 'Disabled' : 'Configured'} scheduling for column '${args.columnId}' in table ${args.tableId}`);
      return {
        content: [{
          type: "text",
          text: `Column scheduling ${args.isScheduled === false ? 'disabled' : 'configured'} successfully:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async get_table_column_schedule(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}/columns/${args.columnId}/schedule`,
        'GET',
        null,
        accessToken
      );

      log(`Retrieved schedule information for column '${args.columnId}' in table ${args.tableId}`);
      return {
        content: [{
          type: "text",
          text: `Column schedule information:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async filter_table_rows(args, accessToken) {
      const filterRequestBody = {
        filters: args.filters || [],
        from: args.from,
        to: args.to,
        limit: args.limit || 50,
        page: args.page || 0
      };

      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}/rows/filter`,
        'POST',
        filterRequestBody,
        accessToken
      );

      log(`Filtered rows in table ${args.tableId}`, {
        totalRows: result.data.totalRows,
        filteredCount: result.data.filteredRowsCount,
        page: result.data.pagination.page,
        hasMore: result.data.pagination.hasMore
      });

      return {
        content: [{
          type: "text",
          text: `Successfully filtered table rows:\n\nSummary:\n- Total rows matching filter: ${result.data.totalRows}\n- Rows returned: ${result.data.filteredRowsCount}\n- Page: ${result.data.pagination.page + 1}\n- Has more pages: ${result.data.pagination.hasMore}\n\nFiltered Rows:\n${JSON.stringify(result.data.rows, null, 2)}${result.data.filter.columns.length > 0 ? `\n\nApplied Filters:\n${JSON.stringify(result.data.filter.columns, null, 2)}` : ''}${result.data.filter.from || result.data.filter.to ? `\n\nRow Range Filter: ${result.data.filter.from ? `from row ${result.data.filter.from}` : ''}${result.data.filter.from && result.data.filter.to ? ' ' : ''}${result.data.filter.to ? `to row ${result.data.filter.to}` : ''}` : ''}`
        }]
      };
    },

    async list_table_sheets(args, accessToken) {
      const params = new URLSearchParams();
      if (args.limit) params.append('limit', args.limit.toString());
      if (args.page) params.append('page', args.page.toString());

      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}/sheets?${params.toString()}`,
        'GET',
        null,
        accessToken
      );

      log(`Successfully listed ${result.data?.length || 0} sheets for table ${args.tableId}`, {
        pagination: result.pagination
      });

      return {
        content: [{
          type: "text",
          text: `Found ${result.data?.length || 0} sheets in table${result.pagination ? ` (page ${result.pagination.page} of ${result.pagination.totalPages}, total: ${result.pagination.total})` : ''}:\n\n${JSON.stringify(result.data, null, 2)}${result.pagination ? `\n\nPagination Info:\n${JSON.stringify(result.pagination, null, 2)}` : ''}`
        }]
      };
    },

    async get_table_sheet(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/sheets/${args.sheetId}`,
        'GET',
        null,
        accessToken
      );

      log(`Retrieved sheet details for ${args.sheetId}`);
      return {
        content: [{
          type: "text",
          text: `Sheet details:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async create_table_sheet(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/${args.tableId}/sheets`,
        'POST',
        {
          name: args.sheetName,
          description: args.description || '',
          isSheet: true
        },
        accessToken
      );

      log(`Created new sheet '${args.sheetName}' in table ${args.tableId}`);
      return {
        content: [{
          type: "text",
          text: `Successfully created sheet '${args.sheetName}':\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async update_table_sheet(args, accessToken) {
      const updates = {};
      if (args.sheetName) updates.name = args.sheetName;
      if (args.description !== undefined) updates.description = args.description;

      const result = await makeAuthenticatedApiRequest(
        `/automations/sheets/${args.sheetId}`,
        'PUT',
        updates,
        accessToken
      );

      log(`Updated sheet ${args.sheetId}`);
      return {
        content: [{
          type: "text",
          text: `Successfully updated sheet:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async delete_table_sheet(args, accessToken) {
      await makeAuthenticatedApiRequest(
        `/automations/sheets/${args.sheetId}`,
        'DELETE',
        null,
        accessToken
      );

      log(`Deleted sheet ${args.sheetId}`);
      return {
        content: [{
          type: "text",
          text: `Successfully deleted sheet ${args.sheetId}`
        }]
      };
    },

    async get_table_sheet_rows(args, accessToken) {
      const params = new URLSearchParams();
      if (args.limit) params.append('limit', args.limit.toString());
      if (args.page) params.append('page', args.page.toString());

      const result = await makeAuthenticatedApiRequest(
        `/automations/sheets/${args.sheetId}/rows?${params.toString()}`,
        'GET',
        null,
        accessToken
      );

      log(`Retrieved ${result.data?.length || 0} rows from sheet ${args.sheetId}`, {
        pagination: result.pagination
      });

      return {
        content: [{
          type: "text",
          text: `Retrieved ${result.data?.length || 0} rows from sheet${result.pagination ? ` (page ${result.pagination.page} of ${result.pagination.totalPages}, total: ${result.pagination.total})` : ''}:\n\n${JSON.stringify(result.data, null, 2)}${result.pagination ? `\n\nPagination Info:\n${JSON.stringify(result.pagination, null, 2)}` : ''}`
        }]
      };
    },

    async add_table_sheet_row(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/sheets/${args.sheetId}/rows`,
        'POST',
        { data: args.data },
        accessToken
      );

      log(`Added new row to sheet ${args.sheetId}`);
      return {
        content: [{
          type: "text",
          text: `Successfully added row to sheet:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async update_table_sheet_row(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/sheets/${args.sheetId}/rows/${args.rowId}`,
        'PUT',
        { data: args.data },
        accessToken
      );

      log(`Updated row ${args.rowId} in sheet ${args.sheetId}`);
      return {
        content: [{
          type: "text",
          text: `Successfully updated row in sheet:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async delete_table_sheet_row(args, accessToken) {
      await makeAuthenticatedApiRequest(
        `/automations/sheets/${args.sheetId}/rows/${args.rowId}`,
        'DELETE',
        null,
        accessToken
      );

      log(`Deleted row ${args.rowId} from sheet ${args.sheetId}`);
      return {
        content: [{
          type: "text",
          text: `Successfully deleted row ${args.rowId} from sheet`
        }]
      };
    },

    async filter_table_sheet_rows(args, accessToken) {
      const filterRequestBody = {
        filters: args.filters || [],
        from: args.from,
        to: args.to,
        limit: args.limit || 50,
        page: args.page || 0
      };

      const result = await makeAuthenticatedApiRequest(
        `/automations/sheets/${args.sheetId}/rows/filter`,
        'POST',
        filterRequestBody,
        accessToken
      );

      log(`Filtered rows in sheet ${args.sheetId}`, {
        totalRows: result.data.totalRows,
        filteredCount: result.data.filteredRowsCount,
        page: result.data.pagination.page,
        hasMore: result.data.pagination.hasMore
      });

      return {
        content: [{
          type: "text",
          text: `Successfully filtered sheet rows:\n\nSummary:\n- Total rows matching filter: ${result.data.totalRows}\n- Rows returned: ${result.data.filteredRowsCount}\n- Page: ${result.data.pagination.page + 1}\n- Has more pages: ${result.data.pagination.hasMore}\n\nFiltered Rows:\n${JSON.stringify(result.data.rows, null, 2)}${result.data.filter.columns.length > 0 ? `\n\nApplied Filters:\n${JSON.stringify(result.data.filter.columns, null, 2)}` : ''}${result.data.filter.from || result.data.filter.to ? `\n\nRow Range Filter: ${result.data.filter.from ? `from row ${result.data.filter.from}` : ''}${result.data.filter.from && result.data.filter.to ? ' ' : ''}${result.data.filter.to ? `to row ${result.data.filter.to}` : ''}` : ''}`
        }]
      };
    },

    async run_table_ai_cell(args, accessToken) {
      const modifiedArgs = {
        ...args,
        cellId: args.cellId || args.columnId,
        rowIds: args.rowIds || [args.rowId]
      }
      return await runTableAICell(modifiedArgs, accessToken);
    },

    async run_table_ai_cells_bulk(args, accessToken) {
      return await runTableAICell(args, accessToken);
    },

    async generate_artifact(args, accessToken) {
      return await generateVibeChart({
        ...args
      }, accessToken);
    },

    async list_artifacts(args, accessToken) {
      const params = new URLSearchParams();
      if (args.search) params.append('search', args.search);
      if (args.type) params.append('type', args.type);
      if (args.limit) params.append('limit', args.limit.toString());
      if (args.page) params.append('page', args.page.toString());

      const result = await makeAuthenticatedApiRequest(
        `/automations/artifacts?${params.toString()}`,
        'GET',
        null,
        accessToken
      );

      log(`Successfully listed ${result.data?.length || 0} artifacts`, {
        pagination: result.pagination
      });

      return {
        content: [{
          type: "text",
          text: `Found ${result.data?.length || 0} artifacts${result.pagination ? ` (page ${result.pagination.page} of ${result.pagination.totalPages}, total: ${result.pagination.total})` : ''}:\n\n${JSON.stringify(result.data, null, 2)}${result.pagination ? `\n\nPagination Info:\n${JSON.stringify(result.pagination, null, 2)}` : ''}`
        }]
      };
    },

    async get_artifact(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/artifacts/${args.artifactId}`,
        'GET',
        null,
        accessToken
      );

      log(`Retrieved artifact details for ${args.artifactId}`);
      return {
        content: [{
          type: "text",
          text: `Artifact details:\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },
    async google_map_search(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/GoogleMapPlaces`,
        'POST',
        args,
        accessToken
      );
      return {
        content: [{
          type: "text",
          text: `Google Map result :\n${JSON.stringify(result)}`
        }]
      };
    },

    async get_mcp_server_rate_limits(args, accessToken) {
      log('Retrieving MCP Server Rate Limits');
      log(JSON.stringify(args));
      const params = new URLSearchParams();
      if (args.serverName) params.append('serverName', args.serverName);

      const result = await makeAuthenticatedApiRequest(
        `/automations/mcp-server-rate-limits?${params.toString()}`,
        'GET',
        null,
        accessToken
      );

      log(`Successfully retrieved ${result.data?.length || 0} rate limit settings`, {
        serverName: args.serverName
      });

      return {
        content: [{
          type: "text",
          text: `MCP Server Rate Limits${args.serverName ? ` for server ${args.serverName}` : ''}:\n\n${JSON.stringify(result.data, null, 2)}`
        }]
      };
    },

    async update_mcp_server_rate_limit(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/mcp-server-rate-limit`,
        'PUT',
        {
          serverName: args.serverName,
          limit: args.limit,
          timeperiod: args.timeperiod,
          entity: args.entity
        },
        accessToken
      );

      log(`Updated rate limit for server ${args.serverName}`, {
        limit: args.limit,
        timeperiod: args.timeperiod,
        entity: args.entity
      });

      return {
        content: [{
          type: "text",
          text: `Successfully updated MCP server rate limit:\n\n${JSON.stringify(result, null, 2)}`
        }]
      };
    },

    async check_duplicate_rows(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/check-duplicate-rows`,
        'POST',
        {
          tableId: args.tableId,
          attributeKeys: args.attributeKeys
        },
        accessToken
      );

      log(`Checked for duplicates in table ${args.tableId}`, {
        attributeKeys: args.attributeKeys,
        duplicatesFound: result.data?.totalDuplicateRows || 0
      });

      return {
        content: [{
          type: "text",
          text: `Duplicate row check completed for table ${args.tableId}:\n\n- Columns checked: ${args.attributeKeys.join(', ')}\n- Total duplicate rows found: ${result.data?.totalDuplicateRows || 0}\n\nFull Result:\n${JSON.stringify(result, null, 2)}`
        }]
      };
    },

    async delete_duplicate_rows(args, accessToken) {
      const result = await makeAuthenticatedApiRequest(
        `/automations/delete-duplicate-rows`,
        'POST',
        {
          tableId: args.tableId,
          attributeKeys: args.attributeKeys
        },
        accessToken
      );

      log(`Deleted duplicate rows from table ${args.tableId}`, {
        attributeKeys: args.attributeKeys,
        result: result.data || result
      });

      return {
        content: [{
          type: "text",
          text: `Duplicate row deletion completed for table ${args.tableId}:\n\n- Columns used for duplicate detection: ${args.attributeKeys.join(', ')}\n- Operation: ${result.message || 'Completed'}\n\nFull Result:\n${JSON.stringify(result, null, 2)}`
        }]
      };
    }
  };
  //  'meerkats-list-tables': async (args, apiKey, userId) => {
  //       if (!apiKey) {
  //         throw new Error('Meerkats API key is required');
  //       }

  const toolHandlers = {}
  for (const tool of toolsDefinitions) {
    toolHandlers[tool.name] = toolHandlersOriginal[tool.name];
  }
  return {
    toolsDefinitions,
    toolHandlers
  };
}