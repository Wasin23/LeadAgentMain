// User Activity Tracking Middleware for Presence-Based Polling

// Track last activity for each user
const userLastActivity = new Map();
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes of inactivity before stopping polling

/**
 * Middleware to track user activity and manage polling based on presence
 * This replaces explicit login/logout polling triggers with activity-based detection
 */
export async function trackUserActivity(req, res, next) {
  // Only track authenticated users
  if (!req.user || !req.user.userId) {
    return next();
  }

  const userId = req.user.userId;
  const now = Date.now();
  
  // Don't log for polling/status routes
  const isPollingRoute = req.path.includes('/status') || 
                         req.path.includes('/api-usage') || 
                         req.path.includes('/metrics') ||
                         req.path.includes('/internal/events');
  
  // Update last activity time
  const lastActivity = userLastActivity.get(userId);
  userLastActivity.set(userId, now);
  
  // If this is the user's first activity (or they were inactive), start polling
  if (!lastActivity || (now - lastActivity) > INACTIVITY_TIMEOUT) {
    if (!isPollingRoute) {
      console.log(`[ACTIVITY] User ${userId} is active (Zilliz polling disabled - using AWS DynamoDB)`);
    }
    
    // DISABLED: No longer using Zilliz polling - tracking now handled by AWS DynamoDB + SSE
    // try {
    //   const { desktopEmailTracker } = await import('../utils/desktopEmailTracker.js');
    //   desktopEmailTracker.startUserPolling(userId);
    // } catch (error) {
    //   console.error(`[ACTIVITY] Failed to start polling for user ${userId}:`, error);
    // }
  }
  
  next();
}

/**
 * Background cleanup to stop polling for inactive users
 * Runs every minute to check for inactive users
 */
async function cleanupInactiveUsers() {
  const now = Date.now();
  
  for (const [userId, lastActivity] of userLastActivity.entries()) {
    if ((now - lastActivity) > INACTIVITY_TIMEOUT) {
      console.log(`[ACTIVITY] User ${userId} inactive for ${Math.round((now - lastActivity) / 1000)}s`);
      
      // DISABLED: No longer using Zilliz polling - tracking now handled by AWS DynamoDB + SSE
      // try {
      //   const { desktopEmailTracker } = await import('../utils/desktopEmailTracker.js');
      //   desktopEmailTracker.stopUserPolling(userId);
      //   userLastActivity.delete(userId);
      // } catch (error) {
      //   console.error(`[ACTIVITY] Failed to stop polling for inactive user ${userId}:`, error);
      // }
      
      userLastActivity.delete(userId);
    }
  }
}

// Start cleanup interval
const cleanupInterval = setInterval(cleanupInactiveUsers, 60 * 1000); // Check every minute

/**
 * Get currently active users (for debugging/monitoring)
 */
export function getActiveUsers() {
  const now = Date.now();
  const activeUsers = [];
  
  for (const [userId, lastActivity] of userLastActivity.entries()) {
    if ((now - lastActivity) <= INACTIVITY_TIMEOUT) {
      activeUsers.push({
        userId,
        lastActivity: new Date(lastActivity),
        secondsAgo: Math.round((now - lastActivity) / 1000)
      });
    }
  }
  
  return activeUsers;
}

/**
 * Manual cleanup for shutdown
 */
export function shutdown() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
}