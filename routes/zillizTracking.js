import express from 'express';
import fetch from 'node-fetch';
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

// Clear all tracking events (for analytics reset)
router.delete('/clear', async (req, res) => {
    try {
        console.log('🗑️ [ZILLIZ API] Request to clear all tracking events');
        
        const success = await tracker.clearAllTrackingEvents();
        
        if (success) {
            res.status(200).json({
                success: true,
                message: 'All tracking events cleared successfully'
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
router.post('/recreate-collection', async (req, res) => {
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
router.get('/replies/:trackingId', async (req, res) => {
    try {
        const { trackingId } = req.params;
        
        console.log(`📧 [ZILLIZ API] Getting replies for tracking ID: ${trackingId}`);
        
        // Call the Netlify function to get replies
        const netlifyUrl = `https://examarkchat.com/.netlify/functions/mailgun-webhook?tracking_id=${trackingId}`;
        const response = await fetch(netlifyUrl);
        
        if (response.ok) {
            const data = await response.json();
            res.status(200).json(data);
        } else {
            console.error(`❌ Failed to fetch replies: ${response.status}`);
            // Return empty result instead of error to prevent 404 spam
            res.status(200).json({
                success: true,
                trackingId: trackingId,
                replies: [],
                count: 0,
                note: 'Netlify function temporarily unavailable'
            });
        }

    } catch (error) {
        console.error('❌ [ZILLIZ API] Error getting replies:', error);
        res.status(500).json({ error: 'Failed to retrieve replies' });
    }
});

export default router;