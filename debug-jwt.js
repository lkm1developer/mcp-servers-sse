#!/usr/bin/env node

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'a';

console.log('🔍 JWT Debug Tool');
console.log('================');
console.log(`JWT_SECRET from env: "${JWT_SECRET}"`);

// Function to generate a test token
function generateTestToken(serverName, apiKey, userId = 'test-user') {
  const payload = {
    serverName,
    apiKey,
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  };
  
  return jwt.sign(payload, JWT_SECRET);
}

// Function to decode and verify a token
function debugToken(token) {
  console.log('\n🔑 Token Debug:');
  console.log('===============');
  
  try {
    // Remove Bearer prefix if present
    const cleanToken = token.replace('Bearer ', '');
    console.log(`Clean token: ${cleanToken.substring(0, 50)}...`);
    
    // Decode without verification first
    const decoded = jwt.decode(cleanToken, { complete: true });
    console.log('\n📋 Decoded Header:', JSON.stringify(decoded?.header, null, 2));
    console.log('\n📋 Decoded Payload:', JSON.stringify(decoded?.payload, null, 2));
    
    // Verify with secret
    const verified = jwt.verify(cleanToken, JWT_SECRET);
    console.log('\n✅ Verification: SUCCESS');
    console.log('📋 Verified Payload:', JSON.stringify(verified, null, 2));
    
    // Check required fields
    console.log('\n🔍 Field Check:');
    console.log(`- serverName: ${verified.serverName || 'MISSING'}`);
    console.log(`- apiKey: ${verified.apiKey || 'MISSING'}`);
    console.log(`- userId: ${verified.userId || 'MISSING'}`);
    console.log(`- exp: ${verified.exp} (${new Date(verified.exp * 1000)})`);
    console.log(`- iat: ${verified.iat} (${new Date(verified.iat * 1000)})`);
    
    return verified;
  } catch (error) {
    console.log('\n❌ Verification: FAILED');
    console.log(`Error: ${error.message}`);
    
    if (error.message.includes('signature')) {
      console.log('\n💡 Possible fixes:');
      console.log('- Check JWT_SECRET matches token creation secret');
      console.log('- Ensure token was not corrupted');
    }
    
    if (error.message.includes('expired')) {
      console.log('\n💡 Token has expired, generate a new one');
    }
    
    return null;
  }
}

// Generate test tokens for all servers
console.log('\n🎯 Test Tokens:');
console.log('===============');

const tavilyToken = generateTestToken('tavily', 'tvly-test-key');
const firecrawlToken = generateTestToken('firecrawl', 'fc-test-key');
const utilityToken = generateTestToken('utility', 'util-test-key');

console.log('\n🔍 Tavily Token:');
console.log(`Bearer ${tavilyToken}`);

console.log('\n🕷️ Firecrawl Token:');
console.log(`Bearer ${firecrawlToken}`);

console.log('\n🛠️ Utility Token:');
console.log(`Bearer ${utilityToken}`);

// If user provides a token as argument, debug it
const userToken = process.argv[2];
if (userToken) {
  console.log('\n🐛 Debugging provided token:');
  debugToken(userToken);
} else {
  console.log('\n💡 Usage: node debug-jwt.js "Bearer <your-token-here>"');
  
  // Debug one of our test tokens as example
  console.log('\n🔍 Example - Debugging Tavily test token:');
  debugToken(`Bearer ${tavilyToken}`);
}

console.log('\n📋 Quick Test Commands:');
console.log('======================');
console.log('# Test initialization:');
console.log(`curl -X POST http://localhost:8080/tavily/mcp \\`);
console.log(`  -H "Authorization: Bearer ${tavilyToken}" \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'`);