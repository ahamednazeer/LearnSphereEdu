# Docker Deployment Guide for LearnSphereEdu

This guide explains how to deploy LearnSphereEdu using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB of available RAM
- At least 5GB of available disk space

## Quick Start

### Development Environment

1. **Clone the repository and navigate to the project directory:**
   ```bash
   git clone <repository-url>
   cd LearnSphereEdu
   ```

2. **Start the development environment:**
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

3. **Access the application:**
   - Application: http://localhost:5000
   - Vite dev server: http://localhost:5173

### Production Environment

1. **Build and start the production environment:**
   ```bash
   docker-compose up --build -d
   ```

2. **Access the application:**
   - Application: http://localhost:5000

### Production with Nginx (Recommended)

1. **Start with Nginx reverse proxy:**
   ```bash
   docker-compose -f docker-compose.prod.yml --profile with-nginx up --build -d
   ```

2. **Access the application:**
   - Application: http://localhost (port 80)

## Configuration

### Environment Variables

Create a `.env` file in the project root for custom configuration:

```env
# Application
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=file:/app/data/db.sqlite

# Security (generate secure values for production)
JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-super-secret-session-key

# File Upload Limits
MAX_FILE_SIZE=500MB
```

### Volume Mounts

The application uses the following volumes:

- `app_data`: SQLite database storage
- `app_uploads`: User uploaded files (materials, thumbnails)

## Docker Commands

### Build Commands

```bash
# Build development image
docker build -f Dockerfile.dev -t learnsphere-dev .

# Build production image
docker build -t learnsphere-prod .
```

### Run Commands

```bash
# Run development container
docker run -p 5000:5000 -p 5173:5173 -v $(pwd):/app learnsphere-dev

# Run production container
docker run -p 5000:5000 -v learnsphere_data:/app/data -v learnsphere_uploads:/app/uploads learnsphere-prod
```

### Management Commands

```bash
# View logs
docker-compose logs -f app

# Access container shell
docker-compose exec app sh

# Stop services
docker-compose down

# Stop and remove volumes (WARNING: This will delete all data)
docker-compose down -v

# Update and restart
docker-compose pull
docker-compose up --build -d
```

## Health Checks

The application includes a health check endpoint at `/health`. You can monitor the application status:

```bash
# Check health
curl http://localhost:5000/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "production"
}
```

## Backup and Restore

### Database Backup

```bash
# Create backup
docker-compose exec app cp /app/data/db.sqlite /app/data/backup-$(date +%Y%m%d-%H%M%S).sqlite

# Copy backup to host
docker cp $(docker-compose ps -q app):/app/data/backup-20240101-120000.sqlite ./backup.sqlite
```

### Uploads Backup

```bash
# Create uploads backup
docker run --rm -v learnsphere_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

### Restore

```bash
# Restore database
docker cp ./backup.sqlite $(docker-compose ps -q app):/app/data/db.sqlite
docker-compose restart app

# Restore uploads
docker run --rm -v learnsphere_uploads:/data -v $(pwd):/backup alpine tar xzf /backup/uploads-backup.tar.gz -C /data
```

## Monitoring

### Container Stats

```bash
# View resource usage
docker stats

# View specific container stats
docker stats learnsphere_app_1
```

### Logs

```bash
# View all logs
docker-compose logs

# Follow logs
docker-compose logs -f

# View specific service logs
docker-compose logs app
docker-compose logs nginx
```

## Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   # Check what's using the port
   lsof -i :5000
   
   # Use different port
   docker-compose up -p 5001:5000
   ```

2. **Permission issues with uploads:**
   ```bash
   # Fix permissions
   docker-compose exec app chown -R nextjs:nodejs /app/uploads
   ```

3. **Database locked:**
   ```bash
   # Restart the application
   docker-compose restart app
   ```

4. **Out of disk space:**
   ```bash
   # Clean up Docker
   docker system prune -a
   docker volume prune
   ```

### Debug Mode

Run the application in debug mode:

```bash
# Development with debug
docker-compose -f docker-compose.dev.yml up

# Production with debug logs
docker-compose up --build
docker-compose logs -f app
```

## Security Considerations

1. **Change default secrets** in production
2. **Use HTTPS** with proper SSL certificates
3. **Configure firewall** to restrict access
4. **Regular backups** of data and uploads
5. **Monitor logs** for suspicious activity
6. **Keep Docker images updated**

## Performance Tuning

### Resource Limits

Adjust resource limits in `docker-compose.prod.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
    reservations:
      memory: 1G
      cpus: '0.5'
```

### Database Optimization

For better performance with larger datasets, consider:

1. Using PostgreSQL instead of SQLite
2. Implementing database connection pooling
3. Adding database indexes for frequently queried fields

## Scaling

For high-traffic deployments:

1. **Use multiple app instances:**
   ```yaml
   app:
     deploy:
       replicas: 3
   ```

2. **Add load balancer** (Nginx or HAProxy)
3. **Use external database** (PostgreSQL, MySQL)
4. **Implement Redis** for session storage
5. **Use CDN** for static assets

## Support

For issues related to Docker deployment:

1. Check the logs: `docker-compose logs`
2. Verify system requirements
3. Ensure all required ports are available
4. Check Docker and Docker Compose versions
5. Review the troubleshooting section above

For application-specific issues, refer to the main README.md file.