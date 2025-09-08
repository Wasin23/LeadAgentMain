# 🚀 ExaMark Production Deployment Guide

## 📋 Pre-Deployment Checklist

### ✅ Environment Setup
- [ ] Copy `.env.example` to `.env`
- [ ] Update all API keys and secrets in `.env`
- [ ] Set `NODE_ENV=production`
- [ ] Generate secure `SESSION_SECRET`
- [ ] Configure `ADMIN_KEY` for system management
- [ ] Set appropriate `CORS_ORIGIN`

### ✅ Dependencies
- [ ] Run `npm install --production`
- [ ] Verify all required API keys are available
- [ ] Test database connectivity (if using external DB)

### ✅ Security
- [ ] Change default master password in `lib/userManager.js`
- [ ] Configure firewall rules
- [ ] Set up SSL/TLS certificates
- [ ] Review CORS settings
- [ ] Enable rate limiting

## 🛠️ Production Configuration

### Environment Variables (Required)
```bash
NODE_ENV=production
SESSION_SECRET=your-secure-session-secret
OPENAI_API_KEY=your-openai-key
MAILGUN_API_KEY=your-mailgun-key
MAILGUN_DOMAIN=your-domain.com
```

### Optional Performance Tuning
```bash
ENABLE_MONITORING=true
REQUEST_TIMEOUT=30000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

## 🚀 Deployment Methods

### Method 1: Direct Node.js
```bash
# Production mode
npm run start:prod

# With monitoring and garbage collection
npm run start:monitoring
```

### Method 2: Process Manager (PM2)
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start app.js --name "examark" --env production

# Enable auto-restart
pm2 startup
pm2 save
```

### Method 3: Docker Deployment
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
EXPOSE 8080

CMD ["npm", "run", "start:prod"]
```

### Method 4: Electron Desktop Distribution
```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build-win    # Windows
npm run build-mac    # macOS
npm run build-linux  # Linux
```

## 📊 Production Monitoring

### Health Checks
- **Health Endpoint**: `GET /health`
- **Readiness Check**: `GET /ready`
- **Metrics**: `GET /api/metrics`

### System Management (Admin Only)
- **Memory Stats**: `GET /api/system/memory/stats`
- **Create Backup**: `POST /api/system/backup/create`
- **System Status**: `GET /api/system/status`

### Admin Access
Set `X-Admin-Key` header with your `ADMIN_KEY` value:
```bash
curl -H "X-Admin-Key: your-admin-key" http://localhost:8080/api/system/status
```

## 🔧 Production Features

### ✅ Security
- **Helmet.js**: Security headers
- **CORS**: Cross-origin request filtering
- **Rate Limiting**: 100 requests per 15 minutes (configurable)
- **Session Management**: Secure HTTP-only cookies
- **Request Size Limits**: 10MB max (configurable)
- **Input Validation**: Required field validation throughout

### ✅ Performance
- **Request Timeouts**: 30-second default
- **Memory Monitoring**: Real-time memory usage tracking
- **Performance Metrics**: Response time tracking
- **Garbage Collection**: Automatic memory cleanup
- **Request Logging**: Structured logging with Winston

### ✅ Reliability
- **Graceful Shutdown**: SIGTERM/SIGINT handling
- **Error Handling**: Global error catching
- **Health Checks**: Kubernetes/Docker ready
- **Process Recovery**: Auto-restart on crash (Electron)
- **Structured Logging**: File-based logs with rotation

### ✅ Backup & Recovery
- **Automated Backups**: All user data and settings
- **Backup Compression**: Gzip compression for storage efficiency
- **Retention Policy**: 30-day default retention
- **One-Click Restore**: Easy backup restoration
- **Backup Scheduling**: Configurable backup intervals

## 🎯 Production Optimizations

### Memory Management
```bash
# Start with garbage collection enabled
node --expose-gc app.js

# Monitor memory usage
curl http://localhost:8080/api/system/memory/stats
```

### Backup Management
```bash
# Create manual backup
npm run backup

# Cleanup old backups
npm run backup:cleanup

# Via API
curl -X POST -H "X-Admin-Key: your-key" http://localhost:8080/api/system/backup/create
```

### Log Management
- **Error Logs**: `logs/error.log`
- **Combined Logs**: `logs/combined.log`
- **Console Output**: Disabled in production

## 🔍 Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check memory stats
   curl http://localhost:8080/api/system/memory/stats
   
   # Force garbage collection
   curl -X POST -H "X-Admin-Key: your-key" http://localhost:8080/api/system/maintenance/gc
   ```

2. **Performance Issues**
   ```bash
   # Check system status
   curl http://localhost:8080/api/system/status
   
   # Review performance metrics
   curl http://localhost:8080/api/system/memory/stats
   ```

3. **Configuration Errors**
   - Review logs in `logs/error.log`
   - Validate environment variables
   - Check API key configuration

### Health Check Script
```bash
#!/bin/bash
# health-check.sh
curl -f http://localhost:8080/health || {
  echo "Health check failed"
  exit 1
}
```

## 📈 Scaling Considerations

### Load Balancing
- Use nginx or similar for SSL termination
- Implement session affinity if needed
- Consider Redis for session storage

### Database Scaling
- Consider migrating from JSON files to PostgreSQL
- Implement database connection pooling
- Set up database backups

### Monitoring
- Set up external monitoring (Prometheus, Grafana)
- Configure alerting for memory/performance thresholds
- Monitor API response times

## 🔒 Security Best Practices

1. **Regular Updates**
   - Update dependencies regularly
   - Monitor security advisories
   - Apply security patches promptly

2. **Access Control**
   - Use strong admin keys
   - Implement proper authentication
   - Regular key rotation

3. **Network Security**
   - Use HTTPS in production
   - Configure proper firewall rules
   - Limit API access to trusted sources

## 📞 Support

For production issues:
1. Check health endpoints first
2. Review error logs
3. Use system management APIs for diagnostics
4. Create backups before making changes

## 🎉 Production Ready!

Your ExaMark application now includes:
- ✅ Enterprise-grade security
- ✅ Production monitoring
- ✅ Automated backups
- ✅ Performance optimization
- ✅ Graceful error handling
- ✅ Health checks
- ✅ Memory management
- ✅ Structured logging

The application is ready for production deployment with all the essential features for a robust, scalable, and maintainable system!
