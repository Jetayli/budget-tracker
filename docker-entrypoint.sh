#!/bin/sh
# Exit immediately if a command exits with a non-zero status.
set -e

# Function to wait for PostgreSQL to be ready
wait_for_db() {
  echo "Waiting for database to be ready..."

  # Extract host and port from DATABASE_URL
  DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
  DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

  # Wait for PostgreSQL to be ready
  until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
    echo "Database is unavailable - sleeping"
    sleep 1
  done

  echo "Database is ready!"
}

# Function to initialize database schema
init_db_schema() {
  echo "Initializing database schema..."

  # Run database migrations
  npm run db:push

  echo "Database schema initialized successfully!"
}

# Main execution
echo "Starting Budget Tracker application..."

# Wait for database to be ready
wait_for_db

# Initialize database schema
init_db_schema

# Start the application
echo "Starting application server..."
exec "$@"
