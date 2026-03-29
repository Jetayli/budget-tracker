# Use Node.js 20 as base image
FROM node:20-alpine

# Install curl and PostgreSQL client for health checks and database waiting
RUN apk add --no-cache curl postgresql-client

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for database operations)
RUN npm install

# Copy source code
COPY . .

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Build application
RUN npm run build

# Expose port 5000
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Health check - use root endpoint (serves the frontend)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/ || exit 1

# Use entrypoint script to handle database initialization
ENTRYPOINT ["docker-entrypoint.sh"]

# Start the application
CMD ["npm", "start"]
