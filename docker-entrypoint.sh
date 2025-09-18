#!/bin/sh
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Initialize database if it doesn't exist
if [ ! -f "/app/data/db.sqlite" ]; then
    log_info "Initializing database..."
    
    # Copy the pre-seeded database from init directory
    if [ -f "/app/init/db.sqlite" ]; then
        cp /app/init/db.sqlite /app/data/db.sqlite
        log_info "Database initialized from seed file"
    else
        log_warn "No seed database found, starting with empty database"
        # Create empty database file
        touch /app/data/db.sqlite
    fi
else
    log_info "Database already exists, skipping initialization"
fi

# Ensure proper permissions
chmod 644 /app/data/db.sqlite

# Initialize database schema to ensure all tables exist
log_info "Ensuring database schema is up to date..."
export DATABASE_URL="file:/app/data/db.sqlite"
node scripts/init-db.js

# Create uploads directories if they don't exist
mkdir -p /app/uploads/materials /app/uploads/thumbnails

log_info "Starting LearnSphereEdu application..."

# Start the application
exec node dist/index.js