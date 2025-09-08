// Configuration management with validation
import dotenv from 'dotenv';

dotenv.config();

// Environment configuration with validation
const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.API_PORT || '8080'),
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development'
  },

  // Security configuration
  security: {
    sessionSecret: process.env.SESSION_SECRET,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100')
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.NODE_ENV !== 'production',
    enableFile: true,
    maxFileSize: '10m',
    maxFiles: '14d'
  },

  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'examark',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  },

  // External API configuration
  apis: {
    openai: process.env.OPENAI_API_KEY,
    serper: process.env.SERPER_API_KEY,
    mailgun: {
      key: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_DOMAIN
    },
    zilliz: {
      endpoint: process.env.ZILLIZ_ENDPOINT,
      token: process.env.ZILLIZ_TOKEN
    }
  },

  // Performance configuration
  performance: {
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
    requestSizeLimit: process.env.REQUEST_SIZE_LIMIT || '10mb',
    compressionLevel: parseInt(process.env.COMPRESSION_LEVEL || '6')
  }
};

// Configuration validation
function validateConfig() {
  const errors = [];

  // Required configurations
  if (!config.security.sessionSecret) {
    errors.push('SESSION_SECRET is required for production');
  }

  if (config.server.environment === 'production') {
    if (!config.apis.openai) {
      errors.push('OPENAI_API_KEY is required');
    }
    
    if (!config.apis.mailgun.key || !config.apis.mailgun.domain) {
      errors.push('Mailgun configuration (MAILGUN_API_KEY, MAILGUN_DOMAIN) is required');
    }
    
    if (config.security.sessionSecret === 'fallback-secret-change-in-production') {
      errors.push('SESSION_SECRET must be changed from default value in production');
    }
  }

  // Port validation
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('API_PORT must be between 1 and 65535');
  }

  // Rate limit validation
  if (config.security.rateLimitMax < 1) {
    errors.push('RATE_LIMIT_MAX must be greater than 0');
  }

  return errors;
}

// Get configuration with validation
export function getConfig() {
  const errors = validateConfig();
  
  if (errors.length > 0) {
    console.error('Configuration validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    
    if (config.server.environment === 'production') {
      throw new Error('Invalid configuration for production environment');
    } else {
      console.warn('Configuration issues detected - continuing in development mode');
    }
  }

  return config;
}

// Export individual sections for convenience
export const serverConfig = config.server;
export const securityConfig = config.security;
export const loggingConfig = config.logging;
export const apiConfig = config.apis;
export const performanceConfig = config.performance;

export default config;
