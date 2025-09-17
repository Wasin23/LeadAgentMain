import express from 'express';
import { ZillizEmailTracker } from '../utils/zillizEmailTracker.js';

const router = express.Router();

const tracker = new ZillizEmailTracker();

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
            'email_opened',
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

// API endpoint for polling tracking events
router.get('/events', async (req, res) => {
    try {
        const events = await tracker.getTrackingEvents();
        
        res.status(200).json({
            success: true,
            count: events.length,
            events: events
        });

    } catch (error) {
        console.error('❌ [ZILLIZ API] Error getting events:', error);
        res.status(500).json({ error: 'Failed to retrieve events' });
    }
});

// API endpoint for getting events by tracking ID
router.get('/events/:trackingId', async (req, res) => {
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

export default router;