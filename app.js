import dotenv from 'dotenv';
dotenv.config();

// Generate unique server session ID on startup
const SERVER_SESSION_ID = Date.now().toString(36) + Math.random().toString(36).substr(2);

// All other imports must come after dotenv.config()
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { getConfig } from './utils/config.js';
import { memoryMonitor, performanceMiddleware } from './utils/memoryMonitor.js';
import chatRoutes from './routes/chat.js';
import billingRoutes from './routes/billing.js';
import { startGracePeriodChecker } from './utils/gracePeriodChecker.js';

// Load and validate configuration
const config = getConfig();

// Deployment Mode Configuration  
const DEPLOYMENT_MODE = process.env.DEPLOYMENT_MODE || 'web'; // 'web' or 'desktop'
const IS_WEB_DEPLOYMENT = DEPLOYMENT_MODE === 'web';
const IS_DESKTOP_DEPLOYMENT = DEPLOYMENT_MODE === 'desktop';

// Configure Winston Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'meridian-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
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
} catch (e) {
  console.error('[AUTH] Routes not available:', e.message);
  authRoutes = (req, res, next) => next(); // No-op if not present
}

// Import Gmail authentication routes
let gmailAuthRoutes;
try {
  gmailAuthRoutes = (await import('./routes/gmailAuth.js')).default;
} catch (e) {
  console.error('[GMAIL AUTH] Routes not available:', e.message);
  gmailAuthRoutes = (req, res, next) => next(); // No-op if not present
}

// Import lead agent routes
let leadAgentRoutes;
try {
  const importResult = await import('./routes/leadAgent.js');
  leadAgentRoutes = importResult.default;
} catch (e) {
  console.error('[LEAD AGENT] Routes failed to load:', e.message);
  leadAgentRoutes = (req, res, next) => next(); // No-op if not present
}

// Import email queue routes
let emailQueueRoutes;
try {
  emailQueueRoutes = (await import('./routes/emailQueue.js')).default;
} catch (e) {
  console.log('Email queue routes not available:', e.message);
  emailQueueRoutes = (req, res, next) => next(); // No-op if not present
}

// Import analytics routes
let analyticsRoutes;
try {
  analyticsRoutes = (await import('./routes/analytics.js')).default;
} catch (e) {
  console.log('Analytics routes not available:', e.message);
  analyticsRoutes = (req, res, next) => next(); // No-op if not present
}

// Import webhook routes
let webhookRoutes;
try {
  webhookRoutes = (await import('./routes/webhooks.js')).default;
} catch (e) {
  console.log('Webhook routes not available:', e.message);
  webhookRoutes = (req, res, next) => next(); // No-op if not present
}

// Import email response webhook routes (replaces Netlify function)
let webhooksReplyRoutes;
try {
  webhooksReplyRoutes = (await import('./routes/webhooks-reply.js')).default;
} catch (e) {
  console.log('Email response webhook routes not available:', e.message);
  webhooksReplyRoutes = (req, res, next) => next(); // No-op if not present
}

// Import desktop webhook routes for domain tracking
let webhooksDesktopRoutes;
try {
  webhooksDesktopRoutes = (await import('./routes/webhooks-desktop.js')).default;
} catch (e) {
  console.log('Desktop webhook routes not available:', e.message);
  webhooksDesktopRoutes = (req, res, next) => next(); // No-op if not present
}

// Import AI Training routes
let trainingRoutes;
try {
  trainingRoutes = (await import('./routes/training.js')).default;
} catch (e) {
  console.log('AI Training routes not available:', e.message);
  trainingRoutes = (req, res, next) => next(); // No-op if not present
}

// Import Monitoring routes
let monitoringRoutes;
try {
  monitoringRoutes = (await import('./routes/monitoring.js')).default;
} catch (e) {
  console.log('Monitoring routes not available:', e.message);
  monitoringRoutes = (req, res, next) => next(); // No-op if not present
}

// Import Issues routes
let issuesRoutes;
try {
  issuesRoutes = (await import('./routes/issues.js')).default;
} catch (e) {
  console.log('Issues routes not available:', e.message);
  issuesRoutes = (req, res, next) => next(); // No-op if not present
}

// Import Unsubscribe routes
let unsubscribeRoutes;
try {
  unsubscribeRoutes = (await import('./routes/unsubscribe.js')).default;
} catch (e) {
  console.log('Unsubscribe routes not available:', e.message);
  unsubscribeRoutes = (req, res, next) => next(); // No-op if not present
}

// AI Report and AI Search routes removed - unused features
// let aiReportRoutes;
// let aiSearchRoutes;

// Import Zilliz Email Tracking routes
let zillizTrackingRoutes;
try {
  zillizTrackingRoutes = (await import('./routes/zillizTracking.js')).default;
} catch (e) {
  console.log('Zilliz email tracking routes not available:', e.message);
  zillizTrackingRoutes = (req, res, next) => next(); // No-op if not present
}

// Import Desktop Email Tracking routes
let trackingRoutes;
try {
  trackingRoutes = (await import('./routes/tracking.js')).default;
} catch (e) {
  console.log('Desktop email tracking routes not available:', e.message);
  trackingRoutes = (req, res, next) => next(); // No-op if not present
}

// Import Email Response Settings routes
let emailResponseSettingsRoutes;
try {
  emailResponseSettingsRoutes = (await import('./routes/emailResponseSettings.js')).default;
} catch (e) {
  console.log('Email response settings routes not available:', e.message);
  emailResponseSettingsRoutes = (req, res, next) => next(); // No-op if not present
}

// Import Company Profile routes
let companyProfileRoutes;
try {
  companyProfileRoutes = (await import('./routes/companyProfile.js')).default;
} catch (e) {
  console.log('Company profile routes not available:', e.message);
  companyProfileRoutes = (req, res, next) => next(); // No-op if not present
}

// Import Settings routes
let settingsRoutes;
try {
  settingsRoutes = (await import('./routes/settings.js')).default;
} catch (e) {
  console.log('Settings routes not available:', e.message);
  settingsRoutes = (req, res, next) => next(); // No-op if not present
}

// Import System Management routes
let systemRoutes;
try {
  systemRoutes = (await import('./routes/system.js')).default;
} catch (e) {
  console.log('System management routes not available:', e.message);
  systemRoutes = (req, res, next) => next(); // No-op if not present
}

// Import Outreach routes
let outreachRoutes;
try {
  outreachRoutes = (await import('./routes/outreach.js')).default;
} catch (e) {
  console.log('Outreach routes not available:', e.message);
  outreachRoutes = (req, res, next) => next(); // No-op if not present
}

const app = express();

// Security Configuration
const isProduction = process.env.NODE_ENV === 'production';

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
  origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? false : true),
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
app.use(cookieParser()); // Parse cookies for JWT auth in SSE

// Performance monitoring middleware - DISABLED FOR RENDER
// app.use(performanceMiddleware());

// Request timeout middleware
app.use((req, res, next) => {
  res.setTimeout(config.performance.requestTimeout, () => {
    logger.error('Request timeout:', req.path);
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  });
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  // Skip logging for polling endpoints
  const pollingEndpoints = [
    '/api/monitoring/metrics',
    '/api/lead-agent/status',
    '/api/lead-agent/api-usage/total',
    '/api/lead-agent/api-usage/timeseries',
    '/api/lead-agent/rate-limits',
    '/api/lead-agent/api-usage',
    '/api/zilliz-tracking/internal/events',
    '/api/issues',
    '/api/notifications/count',
    '/api/email-queue/queue',
    '/api/email-queue/sent',
    '/api/email-queue/replied'
  ];
  
  if (!pollingEndpoints.includes(req.path)) {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  }
  next();
});

app.use(express.json());
// Serve static files from public directory with security restrictions
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Block access to sensitive files
app.use((req, res, next) => {
  const sensitivePatterns = [
    /email_logs.*\.json$/,
    /email_queue.*\.json$/,
    /email_approved.*\.json$/,
    /leads_database\.json$/,
    /user_settings\.json$/,
    /users\.json$/,
    /message_tracking_map\.json$/,
    /leadAgent_state\.json$/
  ];
  
  if (sensitivePatterns.some(pattern => pattern.test(req.path))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
});

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

app.use('/api/zilliz-tracking', zillizTrackingRoutes); // Zilliz email tracking for polling - MUST BE FIRST
app.use('/api', emailRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth/gmail', gmailAuthRoutes); // Gmail OAuth routes
app.use('/api/chat', chatRoutes);

// Test route for deep research without authentication - with streaming
app.post('/api/research/debug', async (req, res) => {
  console.log('[DEBUG] Deep research debug route hit');
  console.log('[DEBUG] Request body:', req.body);
  
  try {
    const { query, mode, limit } = req.body;
    
    if (!query) {
      console.log('[DEBUG] Missing query parameter');
      return res.status(400).json({ error: 'Missing required field: query' });
    }

    console.log(`[DEBUG] Starting streamed research for: "${query}"`);
    
    // Set up Server-Sent Events for progress streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Import and call the actual deep research function
    const { deepResearch } = await import('./tools/deepResearch.js');
    
    console.log('[DEBUG] Deep research function imported successfully');
    
    // Configure options for deep research with streaming progress
    const options = {
      mode: mode || 'fresh',
      limit: limit || 15,
      progressCallback: (progress) => {
        console.log(`[DEBUG] Progress: ${progress.stage} - ${progress.progress}% - ${progress.message}`);
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
      }
    };

    console.log('[DEBUG] Calling deepResearch function...');
    const userId = req.user?.userId; // May be null for debug route
    const result = await deepResearch(query, options, userId);
    
    console.log(`[DEBUG] Deep research completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    
    // Send final result
    res.write(`data: ${JSON.stringify({ 
      stage: 'complete', 
      progress: 100, 
      message: 'Research completed!', 
      result 
    })}\n\n`);
    
    res.end();
    
  } catch (error) {
    console.error('[DEBUG] Error in debug route:', error);
    res.write(`data: ${JSON.stringify({ 
      stage: 'error', 
      progress: 0, 
      message: 'Research failed: ' + error.message,
      error: error.message 
    })}\n\n`);
    res.end();
  }
});

app.use('/api/lead-agent', leadAgentRoutes);
app.use('/api/email-queue', emailQueueRoutes);
app.use('/api/email-response-settings', emailResponseSettingsRoutes);
app.use('/api/company-profile', companyProfileRoutes); // Company profile onboarding
app.use('/api/settings', settingsRoutes); // Settings presets management
app.use('/', analyticsRoutes); // Analytics routes include tracking endpoints
app.use('/', webhookRoutes); // Webhook routes for email replies
app.use('/webhooks', webhooksDesktopRoutes); // Desktop webhook routes for domain tracking
app.use('/api/tracking', trackingRoutes); // Desktop email tracking (safe, no external deps)
app.use('/api/training', trainingRoutes); // AI Training with Zilliz integration
app.use('/api/monitoring', monitoringRoutes); // Agent monitoring and analytics
app.use('/api/issues', issuesRoutes); // Issues and alerts tracking

// Notification routes
let notificationRoutes;
try {
  notificationRoutes = (await import('./routes/notifications.js')).default;
  app.use('/api/notifications', notificationRoutes); // Notification count and management
  console.log('[APP] Notification routes loaded successfully');
} catch (error) {
  console.warn('[WARNING] Notification routes not available:', error.message);
}

app.use('/api/unsubscribe', unsubscribeRoutes); // Unsubscribe management
// app.use('/api/ai-report', aiReportRoutes); // REMOVED - unused feature
// app.use('/api/ai-search', aiSearchRoutes); // REMOVED - unused feature
app.use('/api/billing', billingRoutes); // Billing and payment management
app.use('/api/outreach', outreachRoutes); // Outreach dashboard stats and conversations

// Webhook routes for email response agent (replaces Netlify function)
app.use('/api/webhooks', webhooksReplyRoutes); // Mailgun email response webhooks

// Gmail Pub/Sub push notification webhooks
let gmailPubSubRoutes;
try {
  gmailPubSubRoutes = (await import('./routes/gmail-pubsub.js')).default;
  app.use('/api/gmail-pubsub', gmailPubSubRoutes);
  console.log('[APP] Gmail Pub/Sub routes loaded successfully');
} catch (error) {
  console.warn('[WARNING] Gmail Pub/Sub routes not available:', error.message);
}

// Admin routes
let adminRoutes;
try {
  adminRoutes = (await import('./routes/admin.js')).default;
  app.use('/api/admin', adminRoutes); // Admin utilities for billing/testing
  console.log('[APP] Admin routes loaded successfully');
} catch (error) {
  console.warn('[WARNING] Admin routes not available:', error.message);
}

// Import manual sync routes
let manualSyncRoutes;
try {
  manualSyncRoutes = (await import('./routes/manualSync.js')).default;
  app.use('/api/sync', manualSyncRoutes); // Manual sync routes for analytics
} catch (error) {
  console.warn('[WARNING] Manual sync routes not available:', error.message);
}

// Import reply tracking routes
let repliesRoutes;
try {
  repliesRoutes = (await import('./routes/replies.js')).default;
  app.use('/api', repliesRoutes); // Reply tracking and analytics routes
} catch (error) {
  console.warn('[WARNING] Reply routes not available:', error.message);
}

app.use('/api/system', systemRoutes); // System management and monitoring

// Deployment Mode Validation
function validateDeploymentMode() {
  console.log(`\n🛡️  [DEPLOYMENT VALIDATION] Checking multi-user safety...`);
  
  if (IS_WEB_DEPLOYMENT) {
    console.log(`✅ [WEB MODE] User isolation: ENABLED`);
    console.log(`✅ [WEB MODE] JWT authentication: ENABLED`);
    console.log(`✅ [WEB MODE] User-scoped data: ENABLED`);
    console.log(`✅ [WEB MODE] Global file protection: ENABLED`);
    console.log(`🌐 [WEB MODE] Ready for multi-user deployment!`);
  } else {
    console.log(`🖥️  [DESKTOP MODE] Single-user mode: ENABLED`);
    console.log(`📁 [DESKTOP MODE] Global files: ALLOWED`);
    console.log(`🔄 [DESKTOP MODE] Background polling: ACTIVE`);
    console.log(`💻 [DESKTOP MODE] Desktop features: FULL ACCESS`);
  }
  
  // Warning for common deployment issues
  if (IS_WEB_DEPLOYMENT && !process.env.JWT_SECRET) {
    console.warn(`⚠️  [SECURITY WARNING] JWT_SECRET not set! Users may not be properly authenticated.`);
  }
  
  if (IS_WEB_DEPLOYMENT && !process.env.ZILLIZ_ENDPOINT) {
    console.warn(`⚠️  [DATA WARNING] ZILLIZ_ENDPOINT not set! User data storage may not work.`);
  }
  
  console.log(`🛡️  [DEPLOYMENT VALIDATION] Complete.\n`);
}

// Run deployment validation
validateDeploymentMode();

const PORT = process.env.PORT || process.env.API_PORT || 8080;
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server is live on port ${PORT} (${DEPLOYMENT_MODE.toUpperCase()} mode)`);
  logger.info(`Meridian server started on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    deploymentMode: DEPLOYMENT_MODE,
    sessionId: SERVER_SESSION_ID
  });
  
  // Start grace period checker (hourly checks for suspensions/warnings)
  startGracePeriodChecker();
  
  // Start Gmail watch auto-renewal (runs daily)
  try {
    const { gmailWatchRenewer } = await import('./utils/gmailWatchRenewer.js');
    gmailWatchRenewer.start();
    console.log('✅ [GMAIL WATCH] Auto-renewal service started');
  } catch (error) {
    console.error('❌ [GMAIL WATCH] Failed to start auto-renewal:', error.message);
  }
  
  // Set up Gmail watches for users with auto-response enabled
  try {
    const AWSManager = (await import('./utils/awsManager.js')).default;
    const GmailManager = (await import('./utils/gmailManager.js')).default;
    const awsManager = new AWSManager();
    const gmailManager = new GmailManager();
    
    const users = await awsManager.getAllUsersWithGmail();
    console.log(`🔍 [GMAIL WATCH] Checking ${users.length} users with Gmail connected`);
    
    for (const user of users) {
      try {
        const settings = await awsManager.getUserSettings(user.userId);
        const hasAutoResponseEnabled = settings?.settingsPresets?.some(p => p.enableAutoResponse);
        
        if (hasAutoResponseEnabled) {
          console.log(`✅ [GMAIL WATCH] Setting up watch for user ${user.userId} (auto-response enabled)`);
          await gmailManager.setupPushNotifications(user.userId);
        }
      } catch (error) {
        console.error(`⚠️ [GMAIL WATCH] Failed to setup watch for user ${user.userId}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ [GMAIL WATCH] Failed to setup watches on startup:', error.message);
  }
  
  // Gmail reply polling disabled - using Pub/Sub instead
  // TODO: Implement webhook-based reply detection or user-initiated manual sync
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Stop Gmail poller
  try {
    import('./utils/gmailReplyPoller.js').then(({ gmailReplyPoller }) => {
      gmailReplyPoller.stop();
      console.log('✅ [GMAIL POLLER] Stopped');
    });
  } catch (error) {
    // Ignore if not started
  }
  
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
