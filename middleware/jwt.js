// JWT Authentication Middleware
import jwt from 'jsonwebtoken';
import { trackUserActivity } from './activityTracker.js';
import AWSManager from '../utils/awsManager.js';

const _awsManager = new AWSManager();
// userId#ip → last recorded timestamp; throttles to once per hour per pair
const _ownerIpCache = new Map();

/**
 * Middleware to authenticate JWT tokens and populate req.user
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object 
 * @param {NextFunction} next - Express next function
 */
export function authenticateToken(req, res, next) {
  // Get token from Authorization header: "Bearer <token>", cookies, or query params (for SSE)
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  // If no header token, try cookies (for EventSource/SSE requests)
  if (!token && req.cookies && req.cookies.authToken) {
    token = req.cookies.authToken;
  }
  
  // If no cookie token, try query parameter (for EventSource with URL params)
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }
  
  // Only log for non-polling routes
  const isPollingRoute = req.path.includes('/status') || 
                         req.path.includes('/api-usage') || 
                         req.path.includes('/metrics') ||
                         req.path.includes('/internal/events');

  if (!token) {
    const ip = req.ip || req.connection.remoteAddress;
    if (!isPollingRoute) {
      console.log(`[JWT] ⚠️  UNAUTHORIZED ACCESS: ${req.method} ${req.path} from ${ip}`);
    }
    return res.status(401).json({ 
      error: 'Access denied. No token provided.',
      requiresAuth: true 
    });
  }

  try {
    // Verify token and extract payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Every authenticated response is per-user — tell any intermediary (CDN, browser
    // back/forward cache, Cloudflare, etc.) it must never be reused for a different
    // request. Without this, a proxy that caches by URL alone (ignoring the Authorization
    // header) can serve one user's authenticated response — Gmail connection status,
    // account data, anything — to a completely different user who happens to hit the
    // same route next.
    res.set('Cache-Control', 'private, no-store');

    // Add user info to request object
    req.user = decoded;

    // Team proxy: if the user is a team member, swap userId to team owner's userId
    // actualUserId retains the real user's id for team management routes
    if (decoded.proxyUserId) {
      const memberUserId = decoded.userId; // capture before mutation
      req.user.userId = decoded.proxyUserId;
      req.user.actualUserId = memberUserId;
    }

    // Track user activity for presence-based polling (async) - but don't let it consume next()
    trackUserActivity(req, res, () => {}).catch(error => {
      console.error('[JWT] Error in activity tracking:', error);
    });

    // Record user's own IP (throttled to once/hour per user+IP pair) for owner-vs-lead open detection
    const ip = req.ip || req.connection?.remoteAddress;
    if (ip && req.user?.userId) {
      const cacheKey = `${req.user.userId}#${ip}`;
      const lastSeen = _ownerIpCache.get(cacheKey) || 0;
      if (Date.now() - lastSeen > 3600000) {
        _ownerIpCache.set(cacheKey, Date.now());
        _awsManager.recordOwnerIp(req.user.userId, ip).catch(() => {});
      }
    }

    // Continue to next middleware/route handler
    next();
  } catch (error) {
    console.error('[AUTH] JWT verification failed:', error.message);
    
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired. Please log in again.',
        requiresAuth: true,
        expired: true
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        error: 'Invalid token. Please log in again.',
        requiresAuth: true 
      });
    }
    
    // Generic error
    return res.status(403).json({ 
      error: 'Token verification failed.',
      requiresAuth: true 
    });
  }
}

/**
 * Optional middleware for routes that can work with or without authentication
 * Populates req.user if valid token exists, but doesn't require it
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (error) {
    console.warn('[AUTH] Optional auth failed, continuing without user:', error.message);
    req.user = null;
  }
  
  next();
}

/**
 * Generate JWT token for user
 * @param {Object} user - User object with userId, username, email
 * @returns {string} JWT token
 */
export function generateToken(user) {
  const payload = {
    userId: user.userId,
    username: user.username,
    email: user.email,
    ...(user.proxyUserId && { proxyUserId: user.proxyUserId }),
    ...(user.teamId && { teamId: user.teamId }),
    ...(user.teamRole && { teamRole: user.teamRole }),
  };
  
  const options = {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, options);
}