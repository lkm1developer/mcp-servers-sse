// Meerkats MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';
import * as dns from 'dns';
import { promisify } from 'util';
import { type } from 'os';

/**
 * Meerkats MCP Server adapter for multi-MCP system
 * Provides web scraping, email verification, Google services, and domain utilities
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'MEERKATS_API_KEY') {

  // External service configuration
  const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://34.46.80.154/api/email';
  const EMAIL_API_KEY = process.env.EMAIL_API_KEY || 'jhfgkjghtucvfg';

  // Promisify DNS functions
  const resolveMx = promisify(dns.resolveMx);

  const toolsDefinitions = [
    {
      name: "meerkats-scrape-url",
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
      name: "meerkats-web-search",
      title: "Meerkats Web Search",
      description: "Search the web and return results",
      inputSchema: {
        query: z.string().describe("Query to search for on the web")
      }
    },
    {
      name: "meerkats-verify-email",
      title: "Meerkats Verify Email",
      description: "Verify if an email address is valid and active using SMTP verification",
      inputSchema: {
        email: z.string().describe("Email address to verify"),
        fromEmail: z.string().optional().describe("Email address to use as the sender in SMTP verification")
      }
    },
    {
      name: "meerkats-guess-email",
      title: "Meerkats Guess Email",
      description: "Guess email addresses based on name and domain using common email patterns",
      inputSchema: {
        firstName: z.string().describe("First name of the person"),
        lastName: z.string().describe("Last name of the person"),
        domain: z.string().describe("Company domain name"),
        fromEmail: z.string().optional().describe("Email address to use as the sender in SMTP verification"),
        company: z.string().optional().describe("Company name (optional)")
      }
    },
    {
      name: "meerkats-generate-support-emails",
      title: "Meerkats Generate Support Emails",
      description: "Generate and verify group support email addresses for a domain",
      inputSchema: {
        domain: z.string().describe("Domain to generate support emails for"),
        emails: z.string().optional().describe("List of email prefixes to check, separated by commas"),
        fromEmail: z.string().optional().describe("Email address to use as the sender in SMTP verification")
      }
    },
    {
      name: "meerkats-check-domain-catch-all",
      title: "Meerkats Check Domain Catch-All",
      description: "Check if a domain has a catch-all email address",
      inputSchema: {
        domain: z.string().describe("Domain to check for catch-all")
      }
    },
    {
      name: "meerkats-get-mx-for-domain",
      title: "Meerkats Get MX Records",
      description: "Get MX records for a domain",
      inputSchema: {
        domain: z.string().describe("Domain to get MX records for")
      }
    },
    {
      name: "meerkats-google-serp",
      title: "Meerkats Google Search Results",
      description: "Get Google search results for a query with page limit",
      inputSchema: {
        query: z.string().describe("Search query"),
        limit: z.number().optional().describe("Maximum number of results to return (default: 10)")
      }
    },
    {
      name: "meerkats-google-map",
      title: "Meerkats Google Maps Search",
      description: "Get Google Maps data for a location query, optionally at specific coordinates",
      inputSchema: {
        query: z.string().describe("Location search query"),
        location: z.string().optional().describe("Optional location parameter. If in 'latitude,longitude' format, will search at those coordinates"),
        limit: z.number().optional().describe("Maximum number of results to return (default: 10)")
      }
    },
    {
      name: "meerkats-google-places",
      title: "Meerkats Google Places",
      description: "Get Google Maps Places API data for a search query",
      inputSchema: {
        googleApiKey: z.string().describe("Google Maps API key optional, if not provided system will use default key").optional(),
        query: z.string().describe("Search query for places")
      }
    }
  ];

  const toolHandlers = {
    'meerkats-scrape-url': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        const isTest = true
        if (isTest) {
          await new Promise((resolve) => setTimeout(resolve, 20000));
          return {
            content: [
              {
                type: "text",
                text: `Scraping Results: Automate growth workflows
by chatting with AI

Generate leads, onboard users, and track results
Decorative
VIBE CODING, BUT FOR
VIBE MARKETERS

Describe the leads, the logic, and the messaging style.

Build the whole thing: scraping, enrichment, sequences, and response handling.

No devs. No prompt chains. Just working campaigns.
Plug AI into your own data &
over 100 integrations
Stop wasting hours mapping flows and gluing tools to launch just one campaign
Benefit Icon

No more slow feedback loops that force guesswork and hides what is working
Benefit Icon

Modern GTM needs dynamic campaigns that convert better — not clunky workflows
With Meerkats AI you
chat your way to growth`
              }
            ]
          };
        }
        let url = args.url;
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
          url = `https://${url}`;
        }

        const payload = {
          url,
          pageOptions: {
            waitForMs: args.waitFor || 0,
          },
          instant: args.waitFor ? false : true
        };

        const SCRAPPER_API_URL = process.env.SCRAPPER_API_URL || 'https://crawlee-scrapper-126608443486.us-central1.run.app';
        const SCRAPPER_API_KEY = process.env.SCRAPPER_API_KEY || apiKey;
        const response = await axios.post(`${SCRAPPER_API_URL}/api/scraper/scrape`, payload, {
          headers: {
            'x-api-key': SCRAPPER_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: args.timeout || 30000,
          maxRedirects: 5,
          validateStatus: (status) => status < 500
        });

        if (response.data?.markdown) {
          let content = response.data.markdown.replace(/---/g, '');

          // Apply format filtering if requested
          if (args.formats && !args.formats.includes('markdown')) {
            if (args.formats.includes('html')) {
              // Keep as HTML - convert markdown back to HTML (basic)
              content = content
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/\\n/g, '<br>');
            }
          }

          return {
            content: [
              {
                type: "text",
                text: `**Meerkats URL Scraping Results:**\\n\\n**URL:** ${args.url}\\n**Status:** Success\\n**Content Length:** ${content.length} characters\\n\\n**Content:**\\n${content.substring(0, 3000)}${content.length > 3000 ? '...\\n\\n(Content truncated)' : ''}`
              }
            ]
          };
        }

        throw new Error('No content found in scraping result');
      } catch (error) {
        const errorMessage = error.response?.data?.error || error.message;
        throw new Error(`Meerkats URL scraping failed: ${errorMessage}`);
      }
    },

    'meerkats-web-search': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        // Clean up query - remove quotes and special characters
        const cleanQuery = (args.query ?? '').replace(/['"]/g, '');

        const payload = {
          url: '', // Empty URL for web search
          query: cleanQuery,
          pageOptions: {
            waitForMs: 0,
          },
          instant: true
        };

        const SCRAPPER_API_URL = process.env.SCRAPPER_API_URL || 'https://crawlee-scrapper-126608443486.us-central1.run.app';
        const SCRAPPER_API_KEY = process.env.SCRAPPER_API_KEY || apiKey;
        const response = await axios.post(`${SCRAPPER_API_URL}/api/scraper/scrape`, payload, {
          headers: {
            'x-api-key': SCRAPPER_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        if (response.data?.markdown) {
          let content = response.data.markdown.replace(/---/g, '');

          return {
            content: [
              {
                type: "text",
                text: `**Meerkats Web Search Results:**\\n\\n**Query:** ${args.query}\\n**Status:** Success\\n**Content Length:** ${content.length} characters\\n\\n**Search Results:**\\n${content.substring(0, 3000)}${content.length > 3000 ? '...\\n\\n(Content truncated)' : ''}`
              }
            ]
          };
        }

        throw new Error('No search results found');
      } catch (error) {
        const errorMessage = error.response?.data?.error || error.message;
        throw new Error(`Meerkats web search failed: ${errorMessage}`);
      }
    },

    'meerkats-verify-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        const response = await axios.post(`${EMAIL_SERVICE_URL}/verify`, {
          email: args.email,
          fromEmail: args.fromEmail || "test@example.com"
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': EMAIL_API_KEY
          },
          timeout: 15000
        });

        const result = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Email Verification Results:**\\n\\n**Email:** ${args.email}\\n**Valid:** ${result.exists ? 'Yes' : 'No'}\\n**Verification Method:** SMTP\\n**From Email:** ${args.fromEmail || 'test@example.com'}\\n\\n**Details:**\\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats email verification failed: ${error.message}`);
      }
    },

    'meerkats-guess-email': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        const response = await axios.post(`${EMAIL_SERVICE_URL}/guess`, {
          firstName: args.firstName,
          lastName: args.lastName,
          domain: args.domain,
          company: args.company
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': EMAIL_API_KEY
          },
          timeout: 15000
        });

        const result = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Email Guessing Results:**\\n\\n**Name:** ${args.firstName} ${args.lastName}\\n**Domain:** ${args.domain}\\n**Company:** ${args.company || 'N/A'}\\n\\n**Generated Email Patterns:**\\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats email guessing failed: ${error.message}`);
      }
    },

    'meerkats-generate-support-emails': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        // Generate support email list
        let emails = args.emails ? args.emails.split(',').map(e => e.trim()) : [];
        const defaultEmails = ['info', 'admin', 'sales', 'support', 'hello', 'contact', 'help', 'service', 'billing', 'marketing'];
        emails = [...new Set([...emails, ...defaultEmails])];
        emails = emails.map(email => `${email}@${args.domain}`);

        // Verify each email
        const verificationPromises = emails.map(async (email) => {
          try {
            const response = await axios.post(`${EMAIL_SERVICE_URL}/verify`, {
              email: email,
              fromEmail: args.fromEmail || `noreply@${args.domain}`
            }, {
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': EMAIL_API_KEY
              },
              timeout: 10000
            });
            return response.data.exists ? email : null;
          } catch (error) {
            return null;
          }
        });

        const results = await Promise.all(verificationPromises);
        const validEmails = results.filter(email => email !== null);

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Support Email Generation Results:**\\n\\n**Domain:** ${args.domain}\\n**Emails Tested:** ${emails.length}\\n**Valid Emails Found:** ${validEmails.length}\\n\\n**Valid Support Emails:**\\n${validEmails.map((email, i) => `${i + 1}. ${email}`).join('\\n') || 'None found'}\\n\\n**All Tested Emails:**\\n${emails.join(', ')}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats support email generation failed: ${error.message}`);
      }
    },

    'meerkats-check-domain-catch-all': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        const response = await axios.post(`${EMAIL_SERVICE_URL}/catchall`, {
          domain: args.domain
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': EMAIL_API_KEY
          },
          timeout: 15000
        });

        const result = response.data;

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Domain Catch-All Check:**\\n\\n**Domain:** ${args.domain}\\n**Has Catch-All:** ${result.isCatchAll ? 'Yes' : 'No'}\\n**Confidence:** ${result.confidence || 'N/A'}\\n\\n**Details:**\\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats domain catch-all check failed: ${error.message}`);
      }
    },

    'meerkats-get-mx-for-domain': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        // First try to get MX records using the email service API
        try {
          const response = await axios.post(`${EMAIL_SERVICE_URL}/mx`, {
            domain: args.domain
          }, {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': EMAIL_API_KEY
            },
            timeout: 15000
          });

          const result = response.data;
          return {
            content: [
              {
                type: "text",
                text: `**Meerkats MX Records for ${args.domain}:**\\n\\n**Total MX Records:** ${result.mxRecords?.length || 0}\\n\\n**Details:**\\n${JSON.stringify(result, null, 2)}`
              }
            ]
          };
        } catch (apiError) {
          // Fallback to DNS lookup if API fails
          const mxRecords = await resolveMx(args.domain);

          const sortedMxRecords = mxRecords
            .sort((a, b) => a.priority - b.priority)
            .map((record, index) => `${index + 1}. ${record.exchange} (Priority: ${record.priority})`);

          return {
            content: [
              {
                type: "text",
                text: `**Meerkats MX Records for ${args.domain}:**\\n\\n**Total MX Records:** ${mxRecords.length}\\n\\n**MX Records (sorted by priority):**\\n${sortedMxRecords.join('\\n') || 'No MX records found'}\\n\\n**Raw Data:**\\n${JSON.stringify(mxRecords, null, 2)}`
              }
            ]
          };
        }
      } catch (error) {
        throw new Error(`Meerkats MX record lookup failed: ${error.message}`);
      }
    },

    'meerkats-google-serp': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        const limit = args.limit || 10;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(args.query)}&num=${limit}`;

        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 15000
        });

        // Extract search results from Google SERP
        let content = response.data;
        const results = [];

        // Regex to extract search result blocks
        const resultRegex = /<div class="g"[^>]*>.*?<h3[^>]*><a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a><\/h3>.*?<span[^>]*>(.*?)<\/span>/gis;
        let match;
        let count = 0;

        while ((match = resultRegex.exec(content)) && count < limit) {
          const url = match[1];
          const title = match[2].replace(/<[^>]+>/g, '').trim();
          const snippet = match[3].replace(/<[^>]+>/g, '').trim();

          if (title && url && title.length > 5) {
            results.push({
              title,
              url,
              snippet: snippet.substring(0, 200) + (snippet.length > 200 ? '...' : ''),
              rank: count + 1
            });
            count++;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Google Search Results:**\\n\\n**Query:** ${args.query}\\n**Results Found:** ${results.length}\\n**Limit:** ${limit}\\n\\n**Search Results:**\\n${results.map(r => `${r.rank}. **${r.title}**\\n   URL: ${r.url}\\n   ${r.snippet}\\n`).join('\\n') || 'No results found'}\\n\\n**Note:** This is a basic SERP scraper. For production use, consider using Google Custom Search API.`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats Google search failed: ${error.message}`);
      }
    },

    'meerkats-google-map': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        const limit = args.limit || 10;
        let searchQuery = args.query;

        // If location is provided in latitude,longitude format, use it for location-based search
        if (args.location && /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(args.location)) {
          const [lat, lng] = args.location.split(',');
          searchQuery = `${args.query} near ${lat},${lng}`;
        } else if (args.location) {
          searchQuery = `${args.query} in ${args.location}`;
        }

        // Use Google Maps search URL
        const mapsSearchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

        const response = await axios.get(mapsSearchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 15000
        });

        // Basic extraction of place information from Google Maps
        let content = response.data;
        const places = [];

        // Simple regex to extract place names and addresses (this is very basic)
        const placeRegex = /<div[^>]*aria-label="([^"]*)"[^>]*>.*?<span[^>]*>(.*?)<\/span>/gis;
        let match;
        let count = 0;

        while ((match = placeRegex.exec(content)) && count < limit) {
          const name = match[1];
          const address = match[2];

          if (name && name.length > 3 && !name.includes('Search') && !name.includes('Map')) {
            places.push({
              name: name.substring(0, 100),
              address: address ? address.substring(0, 150) : 'Address not available',
              rank: count + 1
            });
            count++;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Google Maps Search:**\\n\\n**Query:** ${args.query}\\n**Location:** ${args.location || 'N/A'}\\n**Places Found:** ${places.length}\\n**Limit:** ${limit}\\n\\n**Places:**\\n${places.map(p => `${p.rank}. **${p.name}**\\n   Address: ${p.address}\\n`).join('\\n') || 'No places found'}\\n\\n**Note:** This is a basic Maps scraper. For production use, consider using Google Maps Places API.`
            }
          ]
        };
      } catch (error) {
        throw new Error(`Meerkats Google Maps search failed: ${error.message}`);
      }
    },

    'meerkats-google-places': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Meerkats API key is required');
      }

      try {
        const { query, location, googleApiKey } = args;
        const maxResults = 200;

        if (!query) {
          throw new Error('Search query is required');
        }

        // Construct the text query based on the provided parameters
        let textQuery = query;

        // If location is provided, add it to the query
        if (location) {
          // Check if it's a zipcode (simple check for numeric-only string)
          if (/^\d+$/.test(location)) {
            textQuery += ` at ${location} USA`;
            console.log(`Using zipcode in query: ${textQuery}`);
          } else {
            // Check if it looks like lat,lng format
            const latLng = location.split(',');
            if (latLng.length === 2) {
              const [lat, lng] = latLng;

              // Check if both parts are valid numbers
              if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                // Check if coordinates are in valid ranges
                const latNum = parseFloat(lat);
                const lngNum = parseFloat(lng);

                if (latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180) {
                  textQuery += ` near ${latNum},${lngNum}`;
                  console.log(`Using coordinates in query: ${textQuery}`);
                } else {
                  console.warn(`Coordinates out of valid range: ${location}`);
                  textQuery += ` ${location}`;
                }
              } else {
                console.warn(`Invalid coordinate format (not numeric): ${location}`);
                textQuery += ` ${location}`;
              }
            } else {
              console.warn(`Invalid coordinate format (wrong format): ${location}`);
              textQuery += ` ${location}`;
            }
          }
        }

        // Use the Places API v1 to search for places
        const url = 'https://places.googleapis.com/v1/places:searchText?fields=*';
        console.log(`Making request to Google Places API v1: ${url}`);
        console.log(`Text Query: ${textQuery}`);

        // Array to store all places from multiple requests
        let allPlaces = [];
        let pagesFetched = 0;
        let hasMore = false;
        let pageToken = '';

        // Function to make a request to the Places API
        const fetchPlacesPage = async (token) => {
          const requestBody = {
            textQuery: textQuery
          };

          // Add page token if provided
          if (token) {
            requestBody.pageToken = token;
          }

          // Make the request with the new API format
          const response = await axios.post(url, requestBody, {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': googleApiKey || apiKey
            }
          });

          return response;
        };

        // Make the initial request
        let response = await fetchPlacesPage();

        if (response.status !== 200) {
          throw new Error('Failed to get places from Google Maps API');
        }

        // Check if we have places in the response
        if (!response.data.places || !Array.isArray(response.data.places)) {
          throw new Error('No places found in API response');
        }

        // Add places from the first page
        allPlaces = [...response.data.places];
        pagesFetched = 1;

        // Check if there's a next page token
        if (response.data.nextPageToken) {
          pageToken = response.data.nextPageToken;
          hasMore = true;
        }

        // Fetch additional pages if needed to reach maxResults
        while (hasMore && allPlaces.length < maxResults && pagesFetched < 20) {
          try {
            // Wait a short delay before making the next request (API may require this)
            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log(`Fetching page ${pagesFetched + 1} with token: ${pageToken}`);

            // Make the next request with the page token
            response = await fetchPlacesPage(pageToken);

            if (response.status === 200 && response.data.places && Array.isArray(response.data.places)) {
              // Add places from this page
              allPlaces = [...allPlaces, ...response.data.places];
              pagesFetched++;

              console.log(`Retrieved page ${pagesFetched}, total places: ${allPlaces.length}`);

              // Check if there's another page token
              if (response.data.nextPageToken) {
                pageToken = response.data.nextPageToken;
                hasMore = true;
              } else {
                hasMore = false;
              }
            } else {
              console.warn(`Failed to get next page: ${response.status}`);
              hasMore = false;
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Error fetching next page: ${errorMessage}`);
            hasMore = false;
          }

          // Stop if we've reached the maximum number of results
          if (allPlaces.length >= maxResults) {
            break;
          }
        }

        console.log(`Total places retrieved: ${allPlaces.length} in ${pagesFetched} pages`);

        // Transform the results into the desired format
        const formattedResults = allPlaces.map((place) => {
          // Extract available data from the place result
          const {
            id,
            displayName,
            formattedAddress,
            location,
            rating,
            userRatingCount,
            types,
            photos,
            nationalPhoneNumber,
            internationalPhoneNumber,
            websiteUri,
            regularOpeningHours,
            primaryType
          } = place;

          // Construct image URLs if photos are available
          const imageUrl = photos ? photos.map((photo) => {
            return {
              name: photo.name,
              widthPx: photo.widthPx,
              heightPx: photo.heightPx,
              authorAttributions: photo.authorAttributions,
              googleMapsUri: photo.googleMapsUri
            };
          }) : [];

          // Construct a link to Google Maps for this place
          const detailLink = place.googleMapsUri || (id ?
            `https://www.google.com/maps/place/?q=place_id:${id}` :
            '');

          // Get the name from displayName or fallback
          const name = displayName?.text || 'Unnamed Place';

          // Use formattedAddress as the address
          const address = formattedAddress || '';

          // Use types as description
          const description = types?.join(', ') || '';

          // Format opening hours if available
          const hours = regularOpeningHours?.weekdayDescriptions?.join(', ') || '';

          // Combine all text content for the snippet
          const fullText = [name, address, description].filter(Boolean).join(' - ');

          // Return the formatted place object
          return {
            name,
            title: name,
            ratings: rating || 0,
            reviews: userRatingCount || 0,
            description,
            address,
            phone: nationalPhoneNumber || internationalPhoneNumber || '',
            website: websiteUri || '',
            hours,
            type: types || [],
            primaryType: primaryType || '',
            images: imageUrl,
            link: detailLink,
            snippet: fullText,
            // Include coordinates if available
            coordinates: location ? {
              lat: location.latitude,
              lng: location.longitude
            } : null,
            // Include the original data from Google Places API
            originalData: place
          };
        });

        // Limit results to maxResults if needed
        const limitedResults = formattedResults.length > maxResults ?
          formattedResults.slice(0, maxResults) :
          formattedResults;

        return {
          content: [
            {
              type: "text",
              text: `**Meerkats Google Places Search:**\n\n**Query:** ${textQuery}\n**Places Found:** ${limitedResults.length}\n**Pages Fetched:** ${pagesFetched}\n\n`
            }, 
            {
              type: "text",
              text: JSON.stringify({ places: limitedResults, total_results: limitedResults.length, pages_fetched: pagesFetched, has_more: hasMore })
            }
          ]
        };
      } catch (error) {
        console.log(error);
        throw new Error(`Meerkats Google Places search failed: ${error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}