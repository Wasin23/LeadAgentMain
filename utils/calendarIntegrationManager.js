import 'dotenv/config';

/**
 * Calendar Integration Manager - Handles automatic meeting scheduling
 * Supports Google Calendar API and Calendly integration
 */
export class CalendarIntegrationManager {
    constructor() {
        this.googleServiceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        this.googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY;
        this.googleCalendarId = process.env.GOOGLE_CALENDAR_ID;
        this.calendlyApiKey = process.env.CALENDLY_API_KEY;
        this.calendlyUserId = process.env.CALENDLY_USER_ID;
        this.initialized = false;
    }

    async initialize() {
        console.log('📅 [CALENDAR] Initializing Calendar Integration Manager...');
        
        if (!this.googleServiceAccountEmail && !this.calendlyApiKey) {
            console.warn('⚠️ [CALENDAR] No calendar API keys found. Calendar features will be limited.');
        }
        
        this.initialized = true;
        console.log('✅ [CALENDAR] Calendar Integration Manager initialized');
    }

    /**
     * Parse and validate calendar link from settings
     */
    parseCalendarLink(calendarLink) {
        if (!calendarLink) return null;
        
        console.log(`📅 [CALENDAR] Parsing calendar link: ${calendarLink}`);
        
        // Calendly link detection
        if (calendarLink.includes('calendly.com')) {
            const match = calendarLink.match(/calendly\.com\/([^\/]+)\/([^\/\?]+)/);
            if (match) {
                return {
                    type: 'calendly',
                    username: match[1],
                    event_type: match[2],
                    full_url: calendarLink
                };
            }
        }
        
        // Acuity Scheduling
        if (calendarLink.includes('acuityscheduling.com')) {
            return {
                type: 'acuity',
                full_url: calendarLink
            };
        }
        
        // Cal.com
        if (calendarLink.includes('cal.com')) {
            return {
                type: 'cal_com',
                full_url: calendarLink
            };
        }
        
        // Google Calendar (meet.google.com or calendar.google.com)
        if (calendarLink.includes('calendar.google.com') || calendarLink.includes('meet.google.com')) {
            return {
                type: 'google_calendar',
                full_url: calendarLink
            };
        }
        
        // Zoom meeting links
        if (calendarLink.includes('zoom.us')) {
            return {
                type: 'zoom',
                full_url: calendarLink
            };
        }
        
        // Generic/unknown link
        return {
            type: 'generic',
            full_url: calendarLink
        };
    }

    /**
     * Generate smart calendar integration text based on link type
     */
    generateCalendarText(calendarLink, meetingContext = {}) {
        const parsed = this.parseCalendarLink(calendarLink);
        if (!parsed) return '';
        
        console.log(`📅 [CALENDAR] Generating calendar text for type: ${parsed.type}`);
        
        const { intent, urgency, duration } = meetingContext;
        
        // Determine meeting duration suggestion
        let suggestedDuration = '15-minute';
        if (intent === 'technical_question' || intent === 'feature_inquiry') {
            suggestedDuration = '30-minute';
        } else if (intent === 'pricing_inquiry' && urgency === 'high') {
            suggestedDuration = '20-minute';
        }
        
        // Generate contextual text based on platform
        switch (parsed.type) {
            case 'calendly':
                return `I'd love to schedule a ${suggestedDuration} call to discuss this further. You can pick a time that works best for you here: ${parsed.full_url}
                
The booking is quick and easy - just select your preferred time slot and you'll receive a calendar invite with all the details.`;

            case 'acuity':
                return `Let's schedule a ${suggestedDuration} call to dive deeper into this. You can book a convenient time through my scheduling system: ${parsed.full_url}
                
Simply choose a time that fits your schedule and we'll get everything set up automatically.`;

            case 'cal_com':
                return `I'd be happy to set up a ${suggestedDuration} call to discuss your specific needs. You can book directly here: ${parsed.full_url}
                
The scheduling system will send you a calendar invite once you've selected your preferred time.`;

            case 'google_calendar':
                return `Let's schedule a ${suggestedDuration} meeting to go over this in detail. You can view my availability and book a time here: ${parsed.full_url}
                
Once you select a time, Google Calendar will automatically send you an invite.`;

            case 'zoom':
                return `I'd like to schedule a ${suggestedDuration} video call to discuss this further. Here's the meeting link: ${parsed.full_url}
                
Please let me know what time works best for you and I'll send over a calendar invite.`;

            default:
                return `I'd love to schedule a ${suggestedDuration} call to discuss this in more detail. You can book a time that works for you here: ${parsed.full_url}
                
Looking forward to our conversation!`;
        }
    }

    /**
     * Create a Google Calendar event (if API configured)
     */
    async createGoogleCalendarEvent(eventDetails) {
        if (!this.googleServiceAccountEmail || !this.googlePrivateKey || !this.googleCalendarId) {
            console.warn('⚠️ [CALENDAR] Google Calendar Service Account not configured');
            return { success: false, error: 'Google Calendar Service Account not configured' };
        }

        console.log('📅 [CALENDAR] Creating Google Calendar event...');
        
        try {
            // Create JWT token for service account authentication
            const jwt = await this.createJWT();
            
            const event = {
                summary: eventDetails.title || 'Sales Discussion',
                description: `${eventDetails.description || 'Scheduled through AI email responder'}\n\nProspect Details:\n${eventDetails.attendees?.map(a => `${a.displayName || 'Prospect'}: ${a.email}`).join('\n') || 'No attendees specified'}`,
                start: {
                    dateTime: eventDetails.startTime,
                    timeZone: eventDetails.timeZone || 'America/New_York'
                },
                end: {
                    dateTime: eventDetails.endTime,
                    timeZone: eventDetails.timeZone || 'America/New_York'
                }
                // Skip conference data for now to avoid permission issues
                // conferenceData: {
                //     createRequest: {
                //         requestId: `ai-responder-${Date.now()}`,
                //         conferenceSolutionKey: { type: 'hangoutsMeet' }
                //     }
                // }
            };

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${this.googleCalendarId}/events`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${jwt}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(event)
                }
            );

            if (response.ok) {
                const createdEvent = await response.json();
                console.log('✅ [CALENDAR] Google Calendar event created successfully');
                
                return {
                    success: true,
                    event_id: createdEvent.id,
                    event_link: createdEvent.htmlLink,
                    meeting_link: createdEvent.conferenceData?.entryPoints?.[0]?.uri
                };
            } else {
                const error = await response.json();
                console.error('❌ [CALENDAR] Failed to create Google Calendar event:', error);
                return { success: false, error: error.error?.message || 'Failed to create event' };
            }

        } catch (error) {
            console.error('❌ [CALENDAR] Error creating Google Calendar event:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create JWT token for service account authentication
     */
    async createJWT() {
        const header = {
            alg: 'RS256',
            typ: 'JWT'
        };

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: this.googleServiceAccountEmail,
            scope: 'https://www.googleapis.com/auth/calendar',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        // Simple JWT creation (in production, use a proper JWT library)
        const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
        const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
        
        const signatureInput = `${encodedHeader}.${encodedPayload}`;
        
        // Create signature using private key
        const crypto = await import('crypto');
        const signature = crypto.sign('RSA-SHA256', Buffer.from(signatureInput), this.googlePrivateKey);
        const encodedSignature = signature.toString('base64url');
        
        const jwt = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
        
        // Exchange JWT for access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt
            })
        });

        const tokenData = await tokenResponse.json();
        return tokenData.access_token;
    }

    /**
     * Get available time slots from Calendly (if API configured)
     */
    async getCalendlyAvailability(eventTypeUuid, startDate, endDate) {
        if (!this.calendlyApiKey) {
            console.warn('⚠️ [CALENDAR] Calendly API not configured');
            return { success: false, error: 'Calendly API not configured' };
        }

        console.log('📅 [CALENDAR] Getting Calendly availability...');
        
        try {
            const response = await fetch(
                `https://api.calendly.com/event_type_available_times?event_type=${eventTypeUuid}&start_time=${startDate}&end_time=${endDate}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.calendlyApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                console.log('✅ [CALENDAR] Retrieved Calendly availability');
                
                return {
                    success: true,
                    available_times: data.collection || []
                };
            } else {
                const error = await response.json();
                console.error('❌ [CALENDAR] Failed to get Calendly availability:', error);
                return { success: false, error: error.message || 'Failed to get availability' };
            }

        } catch (error) {
            console.error('❌ [CALENDAR] Error getting Calendly availability:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate meeting scheduling suggestions based on intent and urgency
     */
    generateMeetingStrategy(intent, conversationStage, leadData = {}) {
        console.log(`📅 [CALENDAR] Generating meeting strategy for intent: ${intent}, stage: ${conversationStage}`);
        
        let strategy = {
            should_suggest_meeting: false,
            urgency: 'low',
            suggested_duration: 15,
            meeting_type: 'discovery',
            custom_message: ''
        };

        // High-priority meeting scenarios
        if (intent === 'meeting_request' || intent === 'positive_interest') {
            strategy.should_suggest_meeting = true;
            strategy.urgency = 'high';
            strategy.meeting_type = 'demo';
            strategy.suggested_duration = 30;
        }
        
        // Pricing inquiries usually indicate readiness
        else if (intent === 'pricing_inquiry') {
            strategy.should_suggest_meeting = true;
            strategy.urgency = 'medium';
            strategy.meeting_type = 'pricing_discussion';
            strategy.suggested_duration = 20;
            strategy.custom_message = 'to provide you with accurate pricing based on your specific needs';
        }
        
        // Technical questions may need deeper discussion
        else if (intent === 'technical_question' || intent === 'feature_inquiry') {
            strategy.should_suggest_meeting = true;
            strategy.urgency = 'medium';
            strategy.meeting_type = 'technical_deep_dive';
            strategy.suggested_duration = 30;
            strategy.custom_message = 'for a technical deep-dive and live demonstration';
        }
        
        // Competitor comparisons indicate evaluation stage
        else if (intent === 'competitor_comparison') {
            strategy.should_suggest_meeting = true;
            strategy.urgency = 'medium';
            strategy.meeting_type = 'competitive_comparison';
            strategy.suggested_duration = 25;
            strategy.custom_message = 'to show you exactly how we compare and what makes us different';
        }
        
        // Engaged prospects (multiple questions)
        else if (conversationStage === 'engaged') {
            strategy.should_suggest_meeting = true;
            strategy.urgency = 'medium';
            strategy.meeting_type = 'consultation';
            strategy.suggested_duration = 20;
            strategy.custom_message = 'to address all your questions in detail';
        }

        console.log(`📅 [CALENDAR] Meeting strategy: ${JSON.stringify(strategy)}`);
        return strategy;
    }

    /**
     * Integration with template engine for calendar variables
     */
    generateCalendarTemplateVariables(calendarLink, meetingStrategy, leadData = {}) {
        const parsed = this.parseCalendarLink(calendarLink);
        
        return {
            calendar_platform: parsed?.type || 'unknown',
            meeting_duration: `${meetingStrategy.suggested_duration}-minute`,
            meeting_type: meetingStrategy.meeting_type,
            meeting_urgency: meetingStrategy.urgency,
            calendar_booking_text: this.generateCalendarText(calendarLink, {
                intent: meetingStrategy.meeting_type,
                duration: meetingStrategy.suggested_duration
            }),
            should_include_calendar: meetingStrategy.should_suggest_meeting,
            calendar_custom_message: meetingStrategy.custom_message
        };
    }

    /**
     * Suggest optimal meeting times based on timezone and preferences
     */
    suggestMeetingTimes(leadTimeZone = 'America/New_York', preferredTimes = ['morning', 'afternoon']) {
        console.log(`📅 [CALENDAR] Suggesting meeting times for timezone: ${leadTimeZone}`);
        
        const now = new Date();
        const suggestions = [];
        
        // Generate suggestions for next 5 business days
        for (let i = 1; i <= 5; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() + i);
            
            // Skip weekends
            if (date.getDay() === 0 || date.getDay() === 6) continue;
            
            // Morning slots (9 AM, 10 AM, 11 AM)
            if (preferredTimes.includes('morning')) {
                for (let hour = 9; hour <= 11; hour++) {
                    const meetingTime = new Date(date);
                    meetingTime.setHours(hour, 0, 0, 0);
                    
                    suggestions.push({
                        datetime: meetingTime.toISOString(),
                        display_text: meetingTime.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZoneName: 'short'
                        }),
                        time_slot: 'morning'
                    });
                }
            }
            
            // Afternoon slots (1 PM, 2 PM, 3 PM, 4 PM)
            if (preferredTimes.includes('afternoon')) {
                for (let hour = 13; hour <= 16; hour++) {
                    const meetingTime = new Date(date);
                    meetingTime.setHours(hour, 0, 0, 0);
                    
                    suggestions.push({
                        datetime: meetingTime.toISOString(),
                        display_text: meetingTime.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZoneName: 'short'
                        }),
                        time_slot: 'afternoon'
                    });
                }
            }
        }
        
        console.log(`📅 [CALENDAR] Generated ${suggestions.length} meeting time suggestions`);
        return suggestions.slice(0, 6); // Return top 6 suggestions
    }

    /**
     * Test calendar integration
     */
    async testCalendarIntegration(testCalendarLink) {
        console.log('🧪 [CALENDAR] Testing calendar integration...');
        
        const parsed = this.parseCalendarLink(testCalendarLink);
        const strategy = this.generateMeetingStrategy('pricing_inquiry', 'interested');
        const variables = this.generateCalendarTemplateVariables(testCalendarLink, strategy);
        const suggestions = this.suggestMeetingTimes();
        
        return {
            success: true,
            parsed_link: parsed,
            meeting_strategy: strategy,
            template_variables: variables,
            suggested_times: suggestions,
            calendar_text: this.generateCalendarText(testCalendarLink, { intent: 'pricing_inquiry' })
        };
    }
}

// Export singleton instance
export const calendarManager = new CalendarIntegrationManager();
