const { calendarManager } = require('./calendarIntegrationManager');

/**
 * Test function to simulate calendar event creation and Zilliz tracking
 */
exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        console.log('🧪 [TEST] Calendar event test function called');
        
        // Initialize calendar manager
        await calendarManager.initialize();

        let testEventData;

        if (event.httpMethod === 'POST') {
            // Use provided data from POST body
            try {
                testEventData = JSON.parse(event.body);
                console.log('📅 [TEST] Using provided event data:', testEventData);
            } catch (parseError) {
                console.error('❌ [TEST] Invalid JSON in request body');
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Invalid JSON in request body',
                        details: parseError.message 
                    })
                };
            }
        } else {
            // Use default test data for GET requests
            testEventData = {
                eventId: `test_event_${Date.now()}`,
                eventTitle: 'Test Demo Meeting',
                attendeeEmail: 'test@example.com',
                attendeeName: 'John Test',
                company: 'Test Company',
                scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
                calendarLink: 'https://calendar.google.com/calendar/event?eid=test123',
                meetingUrl: 'https://meet.google.com/test-meeting',
                description: 'This is a test calendar event to verify Zilliz integration',
                userId: 'test_user_12345'
            };
            console.log('📅 [TEST] Using default test event data');
        }

        // Track the event to Zilliz
        const result = await calendarManager.trackScheduledEvent(testEventData);

        if (result.success) {
            console.log('✅ [TEST] Successfully tracked test event to Zilliz');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Test calendar event successfully tracked to Zilliz',
                    eventId: result.eventId,
                    eventData: testEventData,
                    timestamp: new Date().toISOString()
                })
            };
        } else {
            console.error('❌ [TEST] Failed to track event to Zilliz');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Failed to track event to Zilliz',
                    details: result.error
                })
            };
        }

    } catch (error) {
        console.error('❌ [TEST] Error in test function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error',
                details: error.message
            })
        };
    }
};