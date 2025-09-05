// HubSpot MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * HubSpot MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'HUBSPOT_ACCESS_TOKEN') {
  
  const toolsDefinitions = [
    {
      name: 'hubspot-create-contact',
      title: 'HubSpot Create Contact',
      description: 'Create a new contact in HubSpot CRM',
      inputSchema: {
        email: z.string().describe('Contact email address'),
        firstname: z.string().optional().describe('Contact first name'),
        lastname: z.string().optional().describe('Contact last name'),
        phone: z.string().optional().describe('Contact phone number'),
        company: z.string().optional().describe('Contact company name'),
        website: z.string().optional().describe('Contact website URL'),
        jobtitle: z.string().optional().describe('Contact job title'),
        lifecyclestage: z.string().optional().describe('Contact lifecycle stage')
      }
    },
    {
      name: 'hubspot-create-company',
      title: 'HubSpot Create Company',
      description: 'Create a new company in HubSpot CRM',
      inputSchema: {
        name: z.string().describe('Company name'),
        domain: z.string().optional().describe('Company domain'),
        city: z.string().optional().describe('Company city'),
        state: z.string().optional().describe('Company state'),
        country: z.string().optional().describe('Company country'),
        industry: z.string().optional().describe('Company industry'),
        phone: z.string().optional().describe('Company phone number'),
        description: z.string().optional().describe('Company description')
      }
    },
    {
      name: 'hubspot-update-contact',
      title: 'HubSpot Update Contact',
      description: 'Update an existing contact in HubSpot CRM',
      inputSchema: {
        contactId: z.string().describe('Contact ID to update'),
        email: z.string().optional().describe('Contact email address'),
        firstname: z.string().optional().describe('Contact first name'),
        lastname: z.string().optional().describe('Contact last name'),
        phone: z.string().optional().describe('Contact phone number'),
        company: z.string().optional().describe('Contact company name'),
        website: z.string().optional().describe('Contact website URL'),
        jobtitle: z.string().optional().describe('Contact job title'),
        lifecyclestage: z.string().optional().describe('Contact lifecycle stage')
      }
    },
    {
      name: 'hubspot-update-company',
      title: 'HubSpot Update Company',
      description: 'Update an existing company in HubSpot CRM',
      inputSchema: {
        companyId: z.string().describe('Company ID to update'),
        name: z.string().optional().describe('Company name'),
        domain: z.string().optional().describe('Company domain'),
        city: z.string().optional().describe('Company city'),
        state: z.string().optional().describe('Company state'),
        country: z.string().optional().describe('Company country'),
        industry: z.string().optional().describe('Company industry'),
        phone: z.string().optional().describe('Company phone number'),
        description: z.string().optional().describe('Company description')
      }
    },
    {
      name: 'hubspot-get-active-contacts',
      title: 'HubSpot Get Active Contacts',
      description: 'Get a list of active contacts from HubSpot CRM',
      inputSchema: {
        limit: z.number().optional().describe('Maximum number of contacts to retrieve (default: 100)'),
        offset: z.string().optional().describe('Pagination offset'),
        properties: z.array(z.string()).optional().describe('Contact properties to retrieve')
      }
    },
    {
      name: 'hubspot-get-active-companies',
      title: 'HubSpot Get Active Companies',
      description: 'Get a list of active companies from HubSpot CRM',
      inputSchema: {
        limit: z.number().optional().describe('Maximum number of companies to retrieve (default: 100)'),
        offset: z.string().optional().describe('Pagination offset'),
        properties: z.array(z.string()).optional().describe('Company properties to retrieve')
      }
    },
    {
      name: 'hubspot-get-company-activity',
      title: 'HubSpot Get Company Activity',
      description: 'Get recent activity for a specific company',
      inputSchema: {
        companyId: z.string().describe('Company ID to get activity for'),
        limit: z.number().optional().describe('Maximum number of activities to retrieve (default: 50)')
      }
    },
    {
      name: 'hubspot-get-recent-engagements',
      title: 'HubSpot Get Recent Engagements',
      description: 'Get recent engagements (calls, emails, meetings, etc.)',
      inputSchema: {
        limit: z.number().optional().describe('Maximum number of engagements to retrieve (default: 100)'),
        engagementType: z.string().optional().describe('Type of engagement (CALL, EMAIL, MEETING, TASK, NOTE)')
      }
    }
  ];

  const toolHandlers = {
    'hubspot-create-contact': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('HubSpot access token is required');
      }

      try {
        const properties = {};
        Object.keys(args).forEach(key => {
          if (args[key] !== undefined) {
            properties[key] = args[key];
          }
        });

        const response = await axios.post(
          'https://api.hubapi.com/crm/v3/objects/contacts',
          { properties },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        return {
          content: [
            {
              type: "text",
              text: `Created HubSpot contact successfully:\\n\\nContact ID: ${response.data.id}\\nEmail: ${response.data.properties.email || 'N/A'}\\nName: ${response.data.properties.firstname || ''} ${response.data.properties.lastname || ''}\\nCreated: ${response.data.createdAt}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`HubSpot create contact failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'hubspot-create-company': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('HubSpot access token is required');
      }

      try {
        const properties = {};
        Object.keys(args).forEach(key => {
          if (args[key] !== undefined) {
            properties[key] = args[key];
          }
        });

        const response = await axios.post(
          'https://api.hubapi.com/crm/v3/objects/companies',
          { properties },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        return {
          content: [
            {
              type: "text",
              text: `Created HubSpot company successfully:\\n\\nCompany ID: ${response.data.id}\\nName: ${response.data.properties.name || 'N/A'}\\nDomain: ${response.data.properties.domain || 'N/A'}\\nCreated: ${response.data.createdAt}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`HubSpot create company failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'hubspot-update-contact': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('HubSpot access token is required');
      }

      try {
        const { contactId, ...updateProperties } = args;
        const properties = {};
        Object.keys(updateProperties).forEach(key => {
          if (updateProperties[key] !== undefined) {
            properties[key] = updateProperties[key];
          }
        });

        const response = await axios.patch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
          { properties },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        return {
          content: [
            {
              type: "text",
              text: `Updated HubSpot contact successfully:\\n\\nContact ID: ${response.data.id}\\nEmail: ${response.data.properties.email || 'N/A'}\\nName: ${response.data.properties.firstname || ''} ${response.data.properties.lastname || ''}\\nUpdated: ${response.data.updatedAt}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`HubSpot update contact failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'hubspot-update-company': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('HubSpot access token is required');
      }

      try {
        const { companyId, ...updateProperties } = args;
        const properties = {};
        Object.keys(updateProperties).forEach(key => {
          if (updateProperties[key] !== undefined) {
            properties[key] = updateProperties[key];
          }
        });

        const response = await axios.patch(
          `https://api.hubapi.com/crm/v3/objects/companies/${companyId}`,
          { properties },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        return {
          content: [
            {
              type: "text",
              text: `Updated HubSpot company successfully:\\n\\nCompany ID: ${response.data.id}\\nName: ${response.data.properties.name || 'N/A'}\\nDomain: ${response.data.properties.domain || 'N/A'}\\nUpdated: ${response.data.updatedAt}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`HubSpot update company failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'hubspot-get-active-contacts': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('HubSpot access token is required');
      }

      try {
        const limit = args.limit || 100;
        const properties = args.properties || ['email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle'];
        
        const response = await axios.get(
          'https://api.hubapi.com/crm/v3/objects/contacts',
          {
            params: {
              limit,
              after: args.offset,
              properties: properties.join(',')
            },
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const contacts = response.data.results.map((contact, index) => {
          const props = contact.properties;
          return `${index + 1}. **${props.firstname || ''} ${props.lastname || 'Unknown'}**\\n   Email: ${props.email || 'N/A'}\\n   Company: ${props.company || 'N/A'}\\n   Phone: ${props.phone || 'N/A'}\\n   Job Title: ${props.jobtitle || 'N/A'}\\n   ID: ${contact.id}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `Retrieved ${contacts.length} active contacts from HubSpot:\\n\\n${contacts.join('\\n')}\\n\\nTotal contacts: ${response.data.total || contacts.length}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`HubSpot get contacts failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'hubspot-get-active-companies': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('HubSpot access token is required');
      }

      try {
        const limit = args.limit || 100;
        const properties = args.properties || ['name', 'domain', 'city', 'state', 'country', 'industry', 'phone'];
        
        const response = await axios.get(
          'https://api.hubapi.com/crm/v3/objects/companies',
          {
            params: {
              limit,
              after: args.offset,
              properties: properties.join(',')
            },
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const companies = response.data.results.map((company, index) => {
          const props = company.properties;
          return `${index + 1}. **${props.name || 'Unknown Company'}**\\n   Domain: ${props.domain || 'N/A'}\\n   Industry: ${props.industry || 'N/A'}\\n   Location: ${props.city || 'N/A'}, ${props.state || ''} ${props.country || ''}\\n   Phone: ${props.phone || 'N/A'}\\n   ID: ${company.id}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `Retrieved ${companies.length} active companies from HubSpot:\\n\\n${companies.join('\\n')}\\n\\nTotal companies: ${response.data.total || companies.length}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`HubSpot get companies failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'hubspot-get-company-activity': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('HubSpot access token is required');
      }

      try {
        const limit = args.limit || 50;
        
        const response = await axios.get(
          `https://api.hubapi.com/crm/v3/objects/companies/${args.companyId}/associations/notes`,
          {
            params: { limit },
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const activities = response.data.results.map((activity, index) => {
          return `${index + 1}. Activity ID: ${activity.id}\\n   Type: ${activity.type || 'N/A'}\\n   Created: ${activity.createdAt || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `Company activity for ID ${args.companyId}:\\n\\n${activities.join('\\n') || 'No activities found'}\\n\\nTotal activities: ${activities.length}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`HubSpot get company activity failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'hubspot-get-recent-engagements': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('HubSpot access token is required');
      }

      try {
        const limit = args.limit || 100;
        const engagementType = args.engagementType ? `&engagementType=${args.engagementType}` : '';
        
        const response = await axios.get(
          `https://api.hubapi.com/engagements/v1/engagements/paged?limit=${limit}${engagementType}`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const engagements = response.data.results.map((engagement, index) => {
          const eng = engagement.engagement;
          return `${index + 1}. **${eng.type || 'Unknown'}**\\n   ID: ${eng.id}\\n   Created: ${eng.createdAt ? new Date(eng.createdAt).toLocaleString() : 'N/A'}\\n   Owner: ${eng.ownerId || 'N/A'}\\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: `Retrieved ${engagements.length} recent engagements from HubSpot:\\n\\n${engagements.join('\\n') || 'No engagements found'}\\n\\nTotal engagements: ${response.data.total || engagements.length}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`HubSpot get engagements failed: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}