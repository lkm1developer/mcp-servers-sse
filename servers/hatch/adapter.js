// Hatch MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';

/**
 * Hatch MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'HATCH_API_KEY') {
  
  const toolsDefinitions = [
    {
      name: 'find-email',
      title: 'Find Email',
      description: 'Find email address using firstName, lastName and domain',
      inputSchema: {
        firstName: z.string().describe('First name of the person'),
        lastName: z.string().describe('Last name of the person'),
        domain: z.string().describe('Company domain')
      }
    },
    {
      name: 'verify-email',
      title: 'Verify Email',
      description: 'Verify email address validity',
      inputSchema: {
        email: z.string().describe('Email address to verify')
      }
    }
  ];

  const toolHandlers = {
    'find-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Hatch API key is required');
      }

      try {
        const response = await fetch('https://api.hatchhq.ai/v1/findEmail', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            firstName: args.firstName,
            lastName: args.lastName,
            domain: args.domain
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'API request failed');
        }

        return {
          content: [
            {
              type: "text",
              text: `**Email Found:**\n\nEmail: ${data.email || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Find email failed: ${error.message}`);
      }
    },

    'verify-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Hatch API key is required');
      }

      try {
        const response = await fetch('https://api.hatchhq.ai/v1/verifyEmail', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: args.email
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'API request failed');
        }

        return {
          content: [
            {
              type: "text",
              text: `**Email Verification Result:**\n\nEmail: ${args.email}\nStatus: ${data.emailVerificationStatus || 'N/A'}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Verify email failed: ${error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}