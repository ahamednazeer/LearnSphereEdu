#!/bin/bash

# LearnSphereEdu Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    log_info "Requirements check passed"
}

create_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        log_warn "No .env file found, creating default one..."
        cat > "$ENV_FILE" << EOF
NODE_ENV=production
PORT=5000
DATABASE_URL=file:/app/data/db.sqlite
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
EOF
        log_info "Created $ENV_FILE with default values"
        log_warn "Please review and update the environment variables in $ENV_FILE"
    fi
}

backup_data() {
    if docker-compose ps | grep -q "Up"; then
        log_info "Creating backup before deployment..."
        BACKUP_DIR="backups/$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        
        # Backup database
        if docker-compose exec -T app test -f /app/data/db.sqlite; then
            docker-compose exec -T app cp /app/data/db.sqlite /app/data/backup.sqlite
            docker cp "$(docker-compose ps -q app):/app/data/backup.sqlite" "$BACKUP_DIR/db.sqlite"
            log_info "Database backed up to $BACKUP_DIR/db.sqlite"
        fi
        
        # Backup uploads
        docker run --rm -v "$(basename $(pwd))_app_uploads:/data" -v "$(pwd)/$BACKUP_DIR:/backup" alpine tar czf /backup/uploads.tar.gz -C /data . 2>/dev/null || true
        
        log_info "Backup completed in $BACKUP_DIR"
    fi
}

deploy() {
    log_info "Starting deployment..."
    
    # Pull latest images
    log_info "Pulling latest images..."
    docker-compose pull || true
    
    # Build and start services
    log_info "Building and starting services..."
    docker-compose up --build -d
    
    # Wait for health check
    log_info "Waiting for application to be ready..."
    for i in {1..30}; do
        if curl -f http://localhost:5000/health &>/dev/null; then
            log_info "Application is ready!"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "Application failed to start within 30 seconds"
            docker-compose logs app
            exit 1
        fi
        sleep 1
    done
    
    log_info "Deployment completed successfully!"
}

show_status() {
    log_info "Application status:"
    docker-compose ps
    
    echo ""
    log_info "Application health:"
    curl -s http://localhost:5000/health | jq . || curl -s http://localhost:5000/health
    
    echo ""
    log_info "Access your application at: http://localhost:5000"
}

cleanup() {
    log_info "Cleaning up old Docker images..."
    docker image prune -f
    log_info "Cleanup completed"
}

# Main script
case "${1:-deploy}" in
    "check")
        check_requirements
        ;;
    "backup")
        backup_data
        ;;
    "deploy")
        check_requirements
        create_env_file
        backup_data
        deploy
        show_status
        cleanup
        ;;
    "status")
        show_status
        ;;
    "logs")
        docker-compose logs -f "${2:-app}"
        ;;
    "stop")
        log_info "Stopping services..."
        docker-compose down
        log_info "Services stopped"
        ;;
    "restart")
        log_info "Restarting services..."
        docker-compose restart
        show_status
        ;;
    "update")
        check_requirements
        backup_data
        log_info "Updating application..."
        docker-compose pull
        docker-compose up --build -d
        show_status
        cleanup
        ;;
    "clean")
        log_warn "This will remove all containers, images, and volumes. Are you sure? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            docker-compose down -v
            docker system prune -a -f
            log_info "Cleanup completed"
        else
            log_info "Cleanup cancelled"
        fi
        ;;
    *)
        echo "Usage: $0 {check|backup|deploy|status|logs|stop|restart|update|clean}"
        echo ""
        echo "Commands:"
        echo "  check   - Check system requirements"
        echo "  backup  - Create backup of current data"
        echo "  deploy  - Full deployment (default)"
        echo "  status  - Show application status"
        echo "  logs    - Show application logs"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  update  - Update and restart services"
        echo "  clean   - Remove all containers and data (DANGEROUS)"
        exit 1
        ;;
esac