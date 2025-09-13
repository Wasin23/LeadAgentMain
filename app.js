import dotenv from 'dotenv';
dotenv.config();

// Generate unique server session ID on startup
const SERVER_SESSION_ID = Date.now().toString(36) + Math.random().toString(36).substr(2);
console.log('Server session ID:', SERVER_SESSION_ID);

// All other imports must come after dotenv.config()
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import session from 'express-session';
import { getConfig } from './utils/config.js';
import { memoryMonitor, performanceMiddleware } from './utils/memoryMonitor.js';
import chatRoutes from './routes/chat.js';

// Load and validate configuration
const config = getConfig();

// Configure Winston Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'examark-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.simple()
      })
    ] : [])
  ]
});

// Global error handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('=== ExaMark app.js is running! ===');
console.log('PORT from env:', process.env.PORT);

// Import email routes
let emailRoutes;
try {
  emailRoutes = (await import('./routes/email.js')).default;
} catch (e) {
  emailRoutes = (req, res, next) => next(); // No-op if not present
}

// Import authentication routes
let authRoutes;
try {
  authRoutes = (await import('./routes/auth.js')).default;
  console.log('Authentication routes loaded successfully');
} catch (e) {
  console.log('Auth routes not available:', e.message);
  authRoutes = (req, res, next) => next(); // No-op if not present
}

// Import lead agent routes
let leadAgentRoutes;
try {
  leadAgentRoutes = (await import('./routes/leadAgent.js')).default;
} catch (e) {
  console.log('Lead agent routes not available');
  leadAgentRoutes = (req, res, next) => next(); // No-op if not present
}

// Import email queue routes
let emailQueueRoutes;
try {
  emailQueueRoutes = (await import('./routes/emailQueue.js')).default;
  console.log('Email queue routes imported successfully');
} catch (e) {
  console.log('Email queue routes not available:', e.message);
  emailQueueRoutes = (req, res, next) => next(); // No-op if not present
}

// Import analytics routes
let analyticsRoutes;
try {
  analyticsRoutes = (await import('./routes/analytics.js')).default;
  console.log('Analytics routes imported successfully');
} catch (e) {
  console.log('Analytics routes not available:', e.message);
  analyticsRoutes = (req, res, next) => next(); // No-op if not present
}

// Import webhook routes
let webhookRoutes;
try {
  webhookRoutes = (await import('./routes/webhooks.js')).default;
  console.log('Webhook routes imported successfully');
} catch (e) {
  console.log('Webhook routes not available:', e.message);
  webhookRoutes = (req, res, next) => next(); // No-op if not present
}

// Import desktop webhook routes for domain tracking
let webhooksDesktopRoutes;
try {
  webhooksDesktopRoutes = (await import('./routes/webhooks-desktop.js')).default;
  console.log('Desktop webhook routes imported successfully');
} catch (e) {
  console.log('Desktop webhook routes not available:', e.message);
  webhooksDesktopRoutes = (req, res, next) => next(); // No-op if not present
}

// Import LinkedIn routes
let linkedinRoutes;
try {
  linkedinRoutes = (await import('./routes/linkedin.js')).default;
  console.log('LinkedIn routes imported successfully');
} catch (e) {
  console.log('LinkedIn routes not available:', e.message);
  linkedinRoutes = (req, res, next) => next(); // No-op if not present
}

// Import LinkedIn API routes
let linkedinApiRoutes;
try {
  linkedinApiRoutes = (await import('./routes/linkedinApi.js')).default;
  console.log('LinkedIn API routes imported successfully');
} catch (e) {
  console.log('LinkedIn API routes not available:', e.message);
  linkedinApiRoutes = (req, res, next) => next(); // No-op if not present
}

// Import Post Generator routes
let postGeneratorRoutes;
try {
  postGeneratorRoutes = (await import('./routes/postGenerator.js')).default;
  console.log('Post Generator routes imported successfully');
} catch (e) {
  console.log('Post Generator routes not available:', e.message);
  postGeneratorRoutes = (req, res, next) => next(); // No-op if not present
}

// Import AI Training routes
let trainingRoutes;
try {
  trainingRoutes = (await import('./routes/training.js')).default;
  console.log('AI Training routes imported successfully');
} catch (e) {
  console.log('AI Training routes not available:', e.message);
  trainingRoutes = (req, res, next) => next(); // No-op if not present
}

// Import Desktop Email Tracking routes
let trackingRoutes;
try {
  trackingRoutes = (await import('./routes/tracking.js')).default;
  console.log('Desktop email tracking routes imported successfully');
} catch (e) {
  console.log('Desktop email tracking routes not available:', e.message);
  trackingRoutes = (req, res, next) => next(); // No-op if not present
}

// Import System Management routes
let systemRoutes;
try {
  systemRoutes = (await import('./routes/system.js')).default;
  console.log('System management routes imported successfully');
} catch (e) {
  console.log('System management routes not available:', e.message);
  systemRoutes = (req, res, next) => next(); // No-op if not present
}

const app = express();

// Security Configuration
const isProduction = process.env.NODE_ENV === 'production';

// Start memory monitoring in production
if (isProduction || process.env.ENABLE_MONITORING === 'true') {
  memoryMonitor.start();
  console.log('[SYSTEM] Memory monitoring started');
}

// Rate Limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for Electron app
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

app.use(limiter);

// Session Management
app.use(session({
  secret: config.security.sessionSecret || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Request parsing with limits
app.use(express.json({ limit: config.performance.requestSizeLimit }));
app.use(express.urlencoded({ extended: true, limit: config.performance.requestSizeLimit }));

// Performance monitoring middleware
app.use(performanceMiddleware());

// Request timeout middleware
app.use((req, res, next) => {
  res.setTimeout(config.performance.requestTimeout, () => {
    logger.error('Request timeout:', req.path);
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

app.use(express.json());
// Serve static files from public directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// Health Check and Monitoring Endpoints
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
    environment: process.env.NODE_ENV || 'development'
  };
  
  logger.info('Health check requested', healthCheck);
  res.json(healthCheck);
});

app.get('/api/metrics', (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    sessionId: SERVER_SESSION_ID,
    nodeVersion: process.version,
    platform: process.platform
  };
  
  res.json(metrics);
});

// Readiness check (for Kubernetes/Docker)
app.get('/ready', (req, res) => {
  // Add any dependency checks here (database, external APIs, etc.)
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

// Add server session endpoint
app.get('/api/session', (req, res) => {
  res.json({ sessionId: SERVER_SESSION_ID });
});

app.use('/api', emailRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', chatRoutes);
app.use('/api/lead-agent', leadAgentRoutes);
app.use('/api/email-queue', emailQueueRoutes);
app.use('/', analyticsRoutes); // Analytics routes include tracking endpoints
app.use('/', webhookRoutes); // Webhook routes for email replies
app.use('/webhooks', webhooksDesktopRoutes); // Desktop webhook routes for domain tracking
app.use('/track', trackingRoutes); // Desktop email tracking (safe, no external deps)
app.use('/api/linkedin', linkedinRoutes); // LinkedIn profile builder routes
app.use('/api/linkedin-api', linkedinApiRoutes); // LinkedIn API integration routes
app.use('/api/post-generator', postGeneratorRoutes); // Post generator routes
app.use('/api/training', trainingRoutes); // AI Training with Zilliz integration
app.use('/api/system', systemRoutes); // System management and monitoring

const PORT = process.env.PORT || process.env.API_PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`Server is live on port ${PORT}`);
  logger.info(`ExaMark server started on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    sessionId: SERVER_SESSION_ID
  });
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    logger.info('Server closed gracefully');
    process.exit(0);
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Global error handling middleware (should be last)
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && { details: err.message })
  });
});

export { logger }; // Export logger for use in other modules
