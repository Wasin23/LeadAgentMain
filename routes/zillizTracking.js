import express from 'express';
import fetch from 'node-fetch';
import { ZillizEmailTracker } from '../utils/zillizEmailTracker.js';
import { authenticateToken } from '../middleware/jwt.js';

const router = express.Router();

const tracker = new ZillizEmailTracker();

// Simple test route to check if authentication is being applied globally
router.get('/test-no-auth', (req, res) => {
    res.json({ message: 'This endpoint works without auth!', timestamp: new Date().toISOString() });
});

// Internal API endpoint for polling tracking events (server-to-server with secret)
router.get('/internal/events', async (req, res) => {
    try {
        // Check for server secret for internal polling
        const serverSecret = req.headers['x-server-secret'] || req.query.serverSecret;
        const expectedSecret = process.env.SERVER_SECRET || 'internal-polling-secret-2024';
        
        if (serverSecret !== expectedSecret) {
            return res.status(403).json({ error: 'Invalid server secret for internal endpoint' });
        }
        
        const userId = req.query.userId;
        
        if (userId) {
            console.log(`📊 [ZILLIZ INTERNAL] Getting events for user ${userId}`);
            
            // Get both email tracking events and scheduled events
            const [trackingEvents, scheduledEvents] = await Promise.all([
                tracker.getTrackingEventsByUserId(userId),
                tracker.getScheduledEventsByUserId(userId)
            ]);
            
            // Combine both types of events
            const allEvents = {
                trackingEvents: trackingEvents,
                scheduledEvents: scheduledEvents,
                totalCount: trackingEvents.length + scheduledEvents.length
            };
            
            res.status(200).json({
                success: true,
                count: allEvents.totalCount,
                events: allEvents
            });
        } else {
            console.log('📊 [ZILLIZ INTERNAL] Getting all events for server polling');
            
            // Get all events for server-side polling (legacy support)
            const events = await tracker.getTrackingEvents();
            
            res.status(200).json({
                success: true,
                count: events.length,
                events: events
            });
        }

    } catch (error) {
        console.error('❌ [ZILLIZ API] Error getting events:', error);
        res.status(500).json({ error: 'Failed to retrieve events' });
    }
});

// Webhook endpoint for email tracking events from Netlify
router.post('/email-opened', async (req, res) => {
    try {
        const { trackingId, userAgent, ipAddress, emailAddress } = req.body;
        
        if (!trackingId) {
            return res.status(400).json({ error: 'Tracking ID is required' });
        }

        console.log(`📧 [ZILLIZ WEBHOOK] Received email open event: ${trackingId}`);
        
        const success = await tracker.storeTrackingEvent(
            trackingId,
            'email_open',
            userAgent || req.get('User-Agent'),
            ipAddress || req.ip,
            emailAddress
        );

        if (success) {
            res.status(200).json({ 
                success: true, 
                message: 'Tracking event stored successfully',
                trackingId: trackingId
            });
        } else {
            res.status(500).json({ error: 'Failed to store tracking event' });
        }

    } catch (error) {
        console.error('❌ [ZILLIZ WEBHOOK] Error processing email open:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint for polling tracking events (protected)
router.get('/events', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const requestedUserId = req.query.userId;
        
        // Security check: users can only access their own events
        if (requestedUserId && requestedUserId !== userId) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied: You can only access your own tracking events' 
            });
        }
        
        const allEvents = await tracker.getTrackingEvents();
        
        // Filter events by userId - tracking IDs contain user codes
        const userEvents = allEvents.filter(event => {
            const trackingId = event.tracking_id;
            // Match tracking IDs that contain the user ID pattern
            return trackingId && (
                trackingId.includes(`-${userId}_`) ||     // tracking-{userId}_xxx
                trackingId.includes(`_${userId}_`) ||     // other_userId_xxx patterns
                trackingId.startsWith(`${userId}-`) ||    // userId-xxx patterns
                trackingId === userId                      // exact match
            );
        });
        
        console.log(`📊 [ZILLIZ API] Filtered ${userEvents.length}/${allEvents.length} events for user ${userId}`);
        
        res.status(200).json({
            success: true,
            count: userEvents.length,
            events: userEvents
        });

    } catch (error) {
        console.error('❌ [ZILLIZ API] Error getting events:', error);
        res.status(500).json({ error: 'Failed to retrieve events' });
    }
});

// API endpoint for getting events by tracking ID
router.get('/events/:trackingId', authenticateToken, async (req, res) => {
    try {
        const { trackingId } = req.params;
        
        console.log(`📧 [ZILLIZ API] Getting events for tracking ID: ${trackingId}`);
        
        const events = await tracker.getEventsByTrackingId(trackingId);
        
        res.status(200).json({
            success: true,
            trackingId: trackingId,
            count: events.length,
            events: events
        });

    } catch (error) {
        console.error('❌ [ZILLIZ API] Error getting events by tracking ID:', error);
        res.status(500).json({ error: 'Failed to retrieve events' });
    }
});

// Clear tracking events for the current user (user-specific reset)
router.delete('/clear', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID not found in token'
            });
        }

        console.log(`🗑️ [ZILLIZ API] Request to clear tracking events for user: ${userId.substring(0, 8)}`);
        
        const success = await tracker.clearUserTrackingEvents(userId);
        
        if (success) {
            res.status(200).json({
                success: true,
                message: `Tracking events cleared successfully for user ${userId.substring(0, 8)}`
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to clear tracking events'
            });
        }

    } catch (error) {
        console.error('❌ [ZILLIZ API] Error clearing events:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Recreate collection with updated schema
router.post('/recreate-collection', authenticateToken, async (req, res) => {
    try {
        console.log('🔄 [ZILLIZ API] Request to recreate collection');
        
        const success = await tracker.recreateCollection();
        
        if (success) {
            res.status(200).json({
                success: true,
                message: 'Collection recreated successfully with updated schema'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to recreate collection'
            });
        }

    } catch (error) {
        console.error('❌ [ZILLIZ API] Error recreating collection:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// API endpoint for getting reply data by tracking ID
router.get('/replies/:trackingId', authenticateToken, async (req, res) => {
    try {
        const { trackingId } = req.params;
        
        console.log(`📧 [ZILLIZ API] Getting replies for tracking ID: ${trackingId}`);
        
        // Query Zilliz directly for reply events
        let replies = [];
        
        try {
            if (process.env.ZILLIZ_ENDPOINT && process.env.ZILLIZ_TOKEN) {
                const { MilvusClient } = await import('@zilliz/milvus2-sdk-node');
                const client = new MilvusClient({
                    address: process.env.ZILLIZ_ENDPOINT,
                    token: process.env.ZILLIZ_TOKEN
                });

                const collectionName = 'email_tracking_events';
                
                // Load collection
                await client.loadCollection({ collection_name: collectionName });

                // Extract base tracking ID from various formats
                // For new format: tracking-76e84c79_1234567890_abc123 -> 76e84c79_1234567890_abc123
                // For old format: tracking-default_1234567890_abc123 -> default_1234567890_abc123
                let baseTrackingId = trackingId;
                
                // Remove prefixes but preserve the user code format
                if (baseTrackingId.startsWith('tracking-')) {
                    baseTrackingId = baseTrackingId.replace(/^tracking-/, '');
                }
                if (baseTrackingId.startsWith('ai-response-')) {
                    baseTrackingId = baseTrackingId.replace(/^ai-response-/, '');
                }
                if (baseTrackingId.startsWith('ai-response-tracking-')) {
                    baseTrackingId = baseTrackingId.replace(/^ai-response-tracking-/, '');
                }
                
                // Don't split by dashes anymore - preserve the full format including user code

                // Query for all events related to this tracking ID
                const expr = `tracking_id like "${baseTrackingId}%" || tracking_id like "%${baseTrackingId}%"`;
                
                const queryResult = await client.query({
                    collection_name: collectionName,
                    expr: expr,
                    limit: 100,
                    consistency_level: 'Strong',
                    output_fields: ['tracking_id', 'event_type', 'timestamp', 'user_agent', 'ip_address', 'email_address', 'recipient', 'processed']
                });

                const allEvents = queryResult.data || queryResult || [];
                console.log(`📧 [ZILLIZ API] Found ${allEvents.length} events for tracking ID pattern: ${baseTrackingId}`);
                
                // Filter for reply events (ai_reply and lead_message)
                const replyEvents = allEvents.filter(event => 
                    event.event_type === 'ai_reply' || event.event_type === 'lead_message'
                );
                
                // Group events into conversations
                const conversations = {};
                replyEvents.forEach(event => {
                    const key = event.tracking_id;
                    if (!conversations[key]) {
                        conversations[key] = [];
                    }
                    conversations[key].push(event);
                });
                
                // Convert to reply format
                replies = Object.values(conversations).flat().map(event => ({
                    trackingId: event.tracking_id,
                    type: event.event_type,
                    timestamp: event.timestamp,
                    from: event.email_address || 'Unknown',
                    to: event.recipient || 'Unknown',
                    ai_response: event.event_type === 'ai_reply' ? event.user_agent : null,
                    lead_message: event.event_type === 'lead_message' ? event.user_agent : null,
                    ai_response_sent: event.event_type === 'ai_reply',
                    sentiment: 'neutral' // Default sentiment
                }));
                
                console.log(`📧 [ZILLIZ API] Processed ${replies.length} reply events`);

            } else {
                console.log('📧 [ZILLIZ API] Zilliz credentials not configured');
            }
        } catch (zillizError) {
            console.error('📧 [ZILLIZ API] Zilliz query failed:', zillizError);
        }
        
        res.status(200).json({
            success: true,
            trackingId: trackingId,
            replies: replies,
            count: replies.length
        });

    } catch (error) {
        console.error('❌ [ZILLIZ API] Error getting replies:', error);
        res.status(500).json({ error: 'Failed to retrieve replies' });
    }
});

// Test route to create Zilliz replies collection manually
router.post('/create-replies-collection', authenticateToken, async (req, res) => {
    try {
        console.log('🔧 [ZILLIZ API] Creating replies collection manually...');
        
        const success = await tracker.createRepliesCollection();
        
        if (success) {
            res.status(200).json({
                success: true,
                message: 'Replies collection created successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to create replies collection'
            });
        }

    } catch (error) {
        console.error('❌ [ZILLIZ API] Error creating replies collection:', error);
        res.status(500).json({ error: 'Failed to create replies collection' });
    }
});

export default router;
