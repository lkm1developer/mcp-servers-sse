// Apify MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * Apify MCP Server adapter for multi-MCP system
 * Focuses on LinkedIn scraping and actor execution
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'APIFY_API_TOKEN') {

  const toolsDefinitions = [
    {
      name: 'apify-linkedin-profile-scraper',
      title: 'LinkedIn Profile Scraper',
      description: 'Scrape LinkedIn profile data including name, headline, experience, education, skills, and more',
      inputSchema: {
        profileUrls: z.array(z.string()).describe('Array of LinkedIn profile URLs to scrape'),
        proxyConfiguration: z.object({
          useApifyProxy: z.boolean().optional().describe('Use Apify proxy (default: true)')
        }).optional().describe('Proxy configuration')
      }
    },
    {
      name: 'apify-linkedin-company-scraper',
      title: 'LinkedIn Company Scraper',
      description: 'Scrape LinkedIn company data including about, employees, posts, and more',
      inputSchema: {
        companyUrls: z.array(z.string()).describe('Array of LinkedIn company URLs to scrape'),
        proxyConfiguration: z.object({
          useApifyProxy: z.boolean().optional().describe('Use Apify proxy (default: true)')
        }).optional().describe('Proxy configuration')
      }
    },
    {
      name: 'apify-linkedin-job-scraper',
      title: 'LinkedIn Job Scraper',
      description: 'Scrape LinkedIn job postings by search query or job URLs',
      inputSchema: {
        searchQueries: z.array(z.string()).optional().describe('Array of search queries for jobs'),
        jobUrls: z.array(z.string()).optional().describe('Array of specific job URLs to scrape'),
        location: z.string().optional().describe('Location filter for job search'),
        maxResults: z.number().optional().describe('Maximum number of jobs to scrape (default: 50)')
      }
    },
    {
      name: 'apify-call-actor',
      title: 'Call Apify Actor',
      description: 'Execute any Apify actor with custom input and retrieve results',
      inputSchema: {
        actorId: z.string().describe('Actor ID (e.g., "apify/linkedin-profile-scraper")'),
        input: z.record(z.any()).describe('Input object for the actor'),
        timeout: z.number().optional().describe('Timeout in seconds (default: 300)'),
        memory: z.number().optional().describe('Memory in MB (default: 2048)')
      }
    },
    {
      name: 'apify-get-actor-run',
      title: 'Get Actor Run Status',
      description: 'Get the status and details of a running or completed actor',
      inputSchema: {
        runId: z.string().describe('Actor run ID to check')
      }
    },
    {
      name: 'apify-get-dataset-items',
      title: 'Get Dataset Items',
      description: 'Retrieve items from an Apify dataset (actor results)',
      inputSchema: {
        datasetId: z.string().describe('Dataset ID to retrieve items from'),
        limit: z.number().optional().describe('Maximum number of items to retrieve (default: 100)'),
        offset: z.number().optional().describe('Number of items to skip (default: 0)'),
        format: z.enum(['json', 'csv', 'xml']).optional().describe('Output format (default: json)')
      }
    },
    {
      name: 'apify-search-actors',
      title: 'Search Apify Actors',
      description: 'Search for actors in the Apify Store',
      inputSchema: {
        query: z.string().describe('Search query to find actors'),
        limit: z.number().optional().describe('Maximum number of results (default: 10)')
      }
    },
    {
      name: 'apify-get-actor-details',
      title: 'Get Actor Details',
      description: 'Get detailed information about a specific actor',
      inputSchema: {
        actorId: z.string().describe('Actor ID to get details for')
      }
    }
  ];

  const toolHandlers = {
    'apify-linkedin-profile-scraper': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apify API token is required');
      }

      try {
        // Use a popular LinkedIn profile scraper actor
        const actorId = 'apify/linkedin-profile-scraper';

        const input = {
          startUrls: args.profileUrls.map(url => ({ url })),
          proxyConfiguration: args.proxyConfiguration || { useApifyProxy: true }
        };

        // Start the actor
        const runResponse = await axios.post(
          `https://api.apify.com/v2/acts/${actorId}/runs`,
          input,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            params: {
              waitForFinish: 120 // Wait up to 2 minutes for completion
            }
          }
        );

        const run = runResponse.data.data;

        // If run completed, fetch results
        if (run.status === 'SUCCEEDED') {
          const datasetResponse = await axios.get(
            `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`
              },
              params: {
                format: 'json'
              }
            }
          );

          const profiles = datasetResponse.data.map((profile, index) => {
            return `${index + 1}. **${profile.fullName || 'Unknown'}**\n   Headline: ${profile.headline || 'N/A'}\n   Location: ${profile.location || 'N/A'}\n   Connections: ${profile.connectionsCount || 'N/A'}\n   Profile URL: ${profile.url || 'N/A'}\n   Skills: ${profile.skills?.slice(0, 5).join(', ') || 'N/A'}\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: `LinkedIn profile scraping completed successfully!\n\nScraped ${profiles.length} profile(s):\n\n${profiles.join('\n')}\n\nRun ID: ${run.id}\nDataset ID: ${run.defaultDatasetId}`
              }
            ]
          };
        } else if (run.status === 'RUNNING') {
          return {
            content: [
              {
                type: "text",
                text: `LinkedIn profile scraping started but still running.\n\nRun ID: ${run.id}\nStatus: ${run.status}\n\nUse 'apify-get-actor-run' with this run ID to check status later.`
              }
            ]
          };
        } else {
          throw new Error(`Actor run failed with status: ${run.status}`);
        }

      } catch (error) {
        throw new Error(`LinkedIn profile scraping failed: ${error.response?.data?.error?.message || error.message}`);
      }
    },

    'apify-linkedin-company-scraper': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apify API token is required');
      }

      try {
        const actorId = 'apify/linkedin-company-scraper';

        const input = {
          startUrls: args.companyUrls.map(url => ({ url })),
          proxyConfiguration: args.proxyConfiguration || { useApifyProxy: true }
        };

        const runResponse = await axios.post(
          `https://api.apify.com/v2/acts/${actorId}/runs`,
          input,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            params: {
              waitForFinish: 120
            }
          }
        );

        const run = runResponse.data.data;

        if (run.status === 'SUCCEEDED') {
          const datasetResponse = await axios.get(
            `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`
              },
              params: {
                format: 'json'
              }
            }
          );

          const companies = datasetResponse.data.map((company, index) => {
            return `${index + 1}. **${company.name || 'Unknown Company'}**\n   Industry: ${company.industry || 'N/A'}\n   Website: ${company.website || 'N/A'}\n   Employees: ${company.employeeCount || 'N/A'}\n   Location: ${company.headquarter || 'N/A'}\n   Description: ${company.description?.substring(0, 150) || 'N/A'}...\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: `LinkedIn company scraping completed!\n\nScraped ${companies.length} company(ies):\n\n${companies.join('\n')}\n\nRun ID: ${run.id}\nDataset ID: ${run.defaultDatasetId}`
              }
            ]
          };
        } else if (run.status === 'RUNNING') {
          return {
            content: [
              {
                type: "text",
                text: `LinkedIn company scraping started but still running.\n\nRun ID: ${run.id}\nStatus: ${run.status}\n\nUse 'apify-get-actor-run' to check status later.`
              }
            ]
          };
        } else {
          throw new Error(`Actor run failed with status: ${run.status}`);
        }

      } catch (error) {
        throw new Error(`LinkedIn company scraping failed: ${error.response?.data?.error?.message || error.message}`);
      }
    },

    'apify-linkedin-job-scraper': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apify API token is required');
      }

      try {
        const actorId = 'apify/linkedin-job-scraper';

        const input = {
          queries: args.searchQueries || [],
          startUrls: args.jobUrls?.map(url => ({ url })) || [],
          location: args.location || '',
          maxResults: args.maxResults || 50
        };

        const runResponse = await axios.post(
          `https://api.apify.com/v2/acts/${actorId}/runs`,
          input,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            params: {
              waitForFinish: 120
            }
          }
        );

        const run = runResponse.data.data;

        if (run.status === 'SUCCEEDED') {
          const datasetResponse = await axios.get(
            `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`
              },
              params: {
                format: 'json',
                limit: args.maxResults || 50
              }
            }
          );

          const jobs = datasetResponse.data.map((job, index) => {
            return `${index + 1}. **${job.title || 'Unknown Position'}**\n   Company: ${job.company || 'N/A'}\n   Location: ${job.location || 'N/A'}\n   Type: ${job.employmentType || 'N/A'}\n   Posted: ${job.postedAt || 'N/A'}\n   URL: ${job.url || 'N/A'}\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: `LinkedIn job scraping completed!\n\nFound ${jobs.length} job(s):\n\n${jobs.join('\n')}\n\nRun ID: ${run.id}\nDataset ID: ${run.defaultDatasetId}`
              }
            ]
          };
        } else if (run.status === 'RUNNING') {
          return {
            content: [
              {
                type: "text",
                text: `LinkedIn job scraping started but still running.\n\nRun ID: ${run.id}\nStatus: ${run.status}`
              }
            ]
          };
        } else {
          throw new Error(`Actor run failed with status: ${run.status}`);
        }

      } catch (error) {
        throw new Error(`LinkedIn job scraping failed: ${error.response?.data?.error?.message || error.message}`);
      }
    },

    'apify-call-actor': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apify API token is required');
      }

      try {
        const runResponse = await axios.post(
          `https://api.apify.com/v2/acts/${args.actorId}/runs`,
          args.input,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            params: {
              timeout: args.timeout || 300,
              memory: args.memory || 2048,
              waitForFinish: 60
            }
          }
        );

        const run = runResponse.data.data;

        return {
          content: [
            {
              type: "text",
              text: `Actor execution initiated!\n\nActor: ${args.actorId}\nRun ID: ${run.id}\nStatus: ${run.status}\nStarted: ${run.startedAt}\n\nUse 'apify-get-actor-run' with run ID to check progress.\nUse 'apify-get-dataset-items' with dataset ID to get results once completed.\n\nDataset ID: ${run.defaultDatasetId}`
            }
          ]
        };

      } catch (error) {
        throw new Error(`Actor execution failed: ${error.response?.data?.error?.message || error.message}`);
      }
    },

    'apify-get-actor-run': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apify API token is required');
      }

      try {
        const response = await axios.get(
          `https://api.apify.com/v2/actor-runs/${args.runId}`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            }
          }
        );

        const run = response.data.data;

        let statusMessage = `Actor Run Status:\n\nRun ID: ${run.id}\nStatus: ${run.status}\nStarted: ${run.startedAt}\nFinished: ${run.finishedAt || 'Still running'}\n`;

        if (run.stats) {
          statusMessage += `\nStats:\n- Compute units: ${run.stats.computeUnits || 0}\n- Duration: ${run.stats.durationMillis ? (run.stats.durationMillis / 1000).toFixed(2) + 's' : 'N/A'}\n`;
        }

        if (run.status === 'SUCCEEDED') {
          statusMessage += `\nRun completed successfully!\nDataset ID: ${run.defaultDatasetId}\n\nUse 'apify-get-dataset-items' to retrieve results.`;
        } else if (run.status === 'FAILED') {
          statusMessage += `\nRun failed.\nError: ${run.statusMessage || 'Unknown error'}`;
        }

        return {
          content: [
            {
              type: "text",
              text: statusMessage
            }
          ]
        };

      } catch (error) {
        throw new Error(`Failed to get actor run: ${error.response?.data?.error?.message || error.message}`);
      }
    },

    'apify-get-dataset-items': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apify API token is required');
      }

      try {
        const response = await axios.get(
          `https://api.apify.com/v2/datasets/${args.datasetId}/items`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            },
            params: {
              format: args.format || 'json',
              limit: args.limit || 100,
              offset: args.offset || 0
            }
          }
        );

        const items = response.data;
        const itemCount = Array.isArray(items) ? items.length : 0;

        let resultText = `Retrieved ${itemCount} items from dataset ${args.datasetId}\n\n`;

        if (Array.isArray(items) && items.length > 0) {
          // Show first few items as preview
          const preview = items.slice(0, 3).map((item, index) => {
            return `Item ${index + 1}:\n${JSON.stringify(item, null, 2)}\n`;
          });

          resultText += preview.join('\n---\n\n');

          if (items.length > 3) {
            resultText += `\n... and ${items.length - 3} more items`;
          }
        } else {
          resultText += 'No items found in dataset.';
        }

        return {
          content: [
            {
              type: "text",
              text: resultText
            }
          ]
        };

      } catch (error) {
        throw new Error(`Failed to get dataset items: ${error.response?.data?.error?.message || error.message}`);
      }
    },

    'apify-search-actors': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apify API token is required');
      }

      try {
        const response = await axios.get(
          'https://api.apify.com/v2/store',
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            },
            params: {
              search: args.query,
              limit: args.limit || 10
            }
          }
        );

        const actors = response.data.data.items;

        const actorList = actors.map((actor, index) => {
          return `${index + 1}. **${actor.title || actor.name}**\n   ID: ${actor.id}\n   Username: ${actor.username}\n   Description: ${actor.description?.substring(0, 150) || 'N/A'}...\n   Stats: ${actor.stats?.totalRuns || 0} runs\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `Found ${actors.length} actors matching "${args.query}":\n\n${actorList.join('\n')}`
            }
          ]
        };

      } catch (error) {
        throw new Error(`Actor search failed: ${error.response?.data?.error?.message || error.message}`);
      }
    },

    'apify-get-actor-details': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Apify API token is required');
      }

      try {
        const response = await axios.get(
          `https://api.apify.com/v2/acts/${args.actorId}`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            }
          }
        );

        const actor = response.data.data;

        let detailsText = `Actor Details:\n\n`;
        detailsText += `**${actor.title || actor.name}**\n\n`;
        detailsText += `ID: ${actor.id}\n`;
        detailsText += `Username: ${actor.username}\n`;
        detailsText += `Version: ${actor.taggedBuilds?.latest || 'N/A'}\n`;
        detailsText += `Description: ${actor.description || 'N/A'}\n\n`;

        if (actor.stats) {
          detailsText += `Stats:\n`;
          detailsText += `- Total runs: ${actor.stats.totalRuns || 0}\n`;
          detailsText += `- Total users: ${actor.stats.totalUsers || 0}\n`;
          detailsText += `- Total compute units: ${actor.stats.totalCompute || 0}\n\n`;
        }

        if (actor.exampleRunInput) {
          detailsText += `Example Input:\n${JSON.stringify(actor.exampleRunInput, null, 2)}\n`;
        }

        return {
          content: [
            {
              type: "text",
              text: detailsText
            }
          ]
        };

      } catch (error) {
        throw new Error(`Failed to get actor details: ${error.response?.data?.error?.message || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}
