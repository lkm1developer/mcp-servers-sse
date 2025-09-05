#!/usr/bin/env node

import jwt from 'jsonwebtoken';

// Test JWT token generation for Tavily server
function generateJWTToken(serverName, apiKey, userId = 'user123', expiresIn = '1h') {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
  
  const payload = {
    serverName,
    apiKey,
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (expiresIn === '1h' ? 3600 : 300)
  };
  
  return jwt.sign(payload, JWT_SECRET);
}

console.log('🔍 Tavily Server Integration Test');
console.log('================================');

// Generate tokens for different servers
const tavilyToken = generateJWTToken('tavily', 'tvly-your-tavily-api-key-here', 'user123');
const firecrawlToken = generateJWTToken('firecrawl', 'fc-your-firecrawl-api-key-here', 'user123');
const utilityToken = generateJWTToken('utility', 'any-value', 'user123');

console.log('\n📋 JWT Tokens for Testing:');
console.log('\n🔍 Tavily (Search/Extract/Crawl/Map):');
console.log(`Bearer ${tavilyToken}`);

console.log('\n🕷️ Firecrawl (Web Scraping):');
console.log(`Bearer ${firecrawlToken}`);

console.log('\n🛠️ Utility (Echo/Timestamp):');
console.log(`Bearer ${utilityToken}`);

console.log('\n🚀 Quick Test Commands:');
console.log('\n1. Start the server:');
console.log('npm start');

console.log('\n2. Test Tavily Search:');
console.log('curl -X POST http://localhost:8080/tavily/mcp \\');
console.log(`  -H "Authorization: Bearer ${tavilyToken}" \\`);
console.log('  -H "MCP-Protocol-Version: 2025-06-18" \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}\'');

console.log('\n3. Test Firecrawl Scrape:');
console.log('curl -X POST http://localhost:8080/firecrawl/mcp \\');
console.log(`  -H "Authorization: Bearer ${firecrawlToken}" \\`);
console.log('  -H "MCP-Protocol-Version: 2025-06-18" \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}\'');

console.log('\n✅ Available Routes:');
console.log('POST /utility/mcp - Utility tools (echo, timestamp)');
console.log('POST /tavily/mcp - Tavily search/extract/crawl/map tools');
console.log('POST /firecrawl/mcp - Firecrawl scraping tools');

console.log('\n📊 Health Check:');
console.log('curl http://localhost:8080/health');