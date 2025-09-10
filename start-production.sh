#!/bin/bash

# Production startup script for Multi-MCP Server
# This script handles production deployment with monitoring and logging

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NODE_ENV=${NODE_ENV:-production}
PORT=${PORT:-8080}
LOG_LEVEL=${LOG_LEVEL:-info}
CONFIG_FILE=${CONFIG_FILE:-server-production.json}
SCRIPT_FILE=${SCRIPT_FILE:-multi-mcp-server-production.js}

echo -e "${BLUE}🚀 Starting Multi-MCP Server in Production Mode${NC}"
echo -e "${BLUE}================================================${NC}"

# Check if required files exist
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ Configuration file not found: $CONFIG_FILE${NC}"
    exit 1
fi

if [ ! -f "$SCRIPT_FILE" ]; then
    echo -e "${RED}❌ Server script not found: $SCRIPT_FILE${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js version: $NODE_VERSION${NC}"

# Check environment variables
echo -e "${BLUE}🔧 Checking environment variables...${NC}"

if [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}❌ JWT_SECRET environment variable is required${NC}"
    exit 1
fi

if [ -z "$MONGODB_URI" ] && [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  Database connection not configured. Using default connection.${NC}"
fi

# Create necessary directories
echo -e "${BLUE}📁 Creating directories...${NC}"
mkdir -p logs
mkdir -p tmp
mkdir -p data

# Set up log rotation (if logrotate is available)
if command -v logrotate &> /dev/null; then
    echo -e "${GREEN}📋 Setting up log rotation...${NC}"
    cat > /tmp/mcp-server-logrotate.conf << EOF
logs/multi-mcp-production.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $(whoami) $(whoami)
    postrotate
        pkill -USR1 -f "multi-mcp-server-production.js" || true
    endscript
}

logs/requests.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $(whoami) $(whoami)
}
EOF
fi

# Set production environment variables
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"

# Performance tuning
export UV_THREADPOOL_SIZE=16  # Increase thread pool for I/O operations

echo -e "${BLUE}⚙️  Production Environment Configuration:${NC}"
echo -e "   NODE_ENV: $NODE_ENV"
echo -e "   PORT: $PORT"
echo -e "   CONFIG_FILE: $CONFIG_FILE"
echo -e "   Max Memory: 4GB"
echo -e "   Thread Pool Size: 16"

# Function to handle graceful shutdown
graceful_shutdown() {
    echo -e "\n${YELLOW}🛑 Received shutdown signal. Starting graceful shutdown...${NC}"
    if [ ! -z "$SERVER_PID" ]; then
        kill -TERM $SERVER_PID
        wait $SERVER_PID
    fi
    echo -e "${GREEN}✅ Graceful shutdown completed${NC}"
    exit 0
}

# Set up signal handlers
trap graceful_shutdown SIGTERM SIGINT

# Health check function
health_check() {
    local max_attempts=30
    local attempt=1
    
    echo -e "${BLUE}🏥 Waiting for server to be healthy...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Server is healthy and ready!${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏳ Health check attempt $attempt/$max_attempts...${NC}"
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}❌ Health check failed after $max_attempts attempts${NC}"
    return 1
}

# Start the server
echo -e "${BLUE}🚀 Starting Multi-MCP Server...${NC}"

# Use PM2 for production process management if available
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}📊 Using PM2 for process management${NC}"
    
    # PM2 ecosystem configuration
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'multi-mcp-server',
    script: '$SCRIPT_FILE',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: $PORT
    },
    max_memory_restart: '4G',
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_file: 'logs/pm2.log',
    time: true,
    autorestart: true,
    watch: false,
    max_restarts: 5,
    min_uptime: '10s',
    kill_timeout: 30000,
    listen_timeout: 10000,
    shutdown_with_message: true,
    wait_ready: true
  }]
};
EOF
    
    # Start with PM2
    pm2 start ecosystem.config.js --env production
    
    # Wait for health check
    sleep 5
    if health_check; then
        echo -e "${GREEN}🎉 Multi-MCP Server started successfully with PM2!${NC}"
        echo -e "${BLUE}📊 Monitor with: pm2 monit${NC}"
        echo -e "${BLUE}📋 Logs with: pm2 logs multi-mcp-server${NC}"
        echo -e "${BLUE}🔄 Restart with: pm2 restart multi-mcp-server${NC}"
        echo -e "${BLUE}🛑 Stop with: pm2 stop multi-mcp-server${NC}"
        
        # Show PM2 status
        pm2 list
        
        # Keep script running if not in daemon mode
        if [ "$1" != "--daemon" ]; then
            echo -e "${BLUE}📱 Press Ctrl+C to stop the server${NC}"
            pm2 logs multi-mcp-server --follow
        fi
    else
        echo -e "${RED}❌ Failed to start server with PM2${NC}"
        pm2 delete multi-mcp-server 2>/dev/null || true
        exit 1
    fi

else
    # Start without PM2
    echo -e "${YELLOW}⚠️  PM2 not available, starting directly with Node.js${NC}"
    echo -e "${BLUE}💡 For production, consider installing PM2: npm install -g pm2${NC}"
    
    node "$SCRIPT_FILE" &
    SERVER_PID=$!
    
    # Wait for health check
    sleep 5
    if health_check; then
        echo -e "${GREEN}🎉 Multi-MCP Server started successfully!${NC}"
        echo -e "${BLUE}🔗 Health check: http://localhost:$PORT/health${NC}"
        echo -e "${BLUE}📊 Metrics: http://localhost:$PORT/metrics${NC}"
        echo -e "${BLUE}📋 Process ID: $SERVER_PID${NC}"
        
        # Wait for the process
        wait $SERVER_PID
    else
        echo -e "${RED}❌ Failed to start server${NC}"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
fi