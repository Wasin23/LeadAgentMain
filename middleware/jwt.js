// JWT Authentication Middleware
import jwt from 'jsonwebtoken';
import { trackUserActivity } from './activityTracker.js';

/**
 * Middleware to authenticate JWT tokens and populate req.user
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object 
 * @param {NextFunction} next - Express next function
 */
export function authenticateToken(req, res, next) {
  // Get token from Authorization header: "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  console.log(`[JWT] Auth check for ${req.method} ${req.path} - Token present: ${!!token}`);

  if (!token) {
    console.log(`[JWT] No token provided for ${req.method} ${req.path}`);
    return res.status(401).json({ 
      error: 'Access denied. No token provided.',
      requiresAuth: true 
    });
  }

  try {
    // Verify token and extract payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log(`[JWT] Decoded token:`, decoded);
    console.log(`[JWT] Setting req.user.userId to:`, decoded.userId);
    
    // Add user info to request object
    req.user = decoded;
    
    // Track user activity for presence-based polling (async)
    trackUserActivity(req, res, next).catch(error => {
      console.error('[JWT] Error in activity tracking:', error);
      // Continue anyway - don't block the request
      next();
    });
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
    email: user.email
  };
  
  const options = {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, options);
}