import 'dotenv/config';
import { AgentSettingsManager } from './agentSettingsManager.js';
import { templateEngine } from './responseTemplateEngine.js';

/**
 * Enhanced Smart AI Responder - Handles intelligent email responses with multi-turn conversation support
 * Integrates with AgentSettingsManager for configuration and ResponseTemplateEngine for personalization
 */
export class SmartAIResponder {
    constructor() {
        this.settingsManager = new AgentSettingsManager();
        this.conversationHistory = new Map(); // Track conversation context by tracking ID
        this.initialized = false;
    }

    async initialize() {
        console.log('🤖 [AI RESPONDER] Initializing Smart AI Responder...');
        
        try {
            await this.settingsManager.initialize();
            templateEngine.initialize();
            
            this.initialized = true;
            console.log('✅ [AI RESPONDER] Smart AI Responder initialized successfully');
        } catch (error) {
            console.error('❌ [AI RESPONDER] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Enhanced intent classification with more granular categories
     */
    classifyIntent(emailContent, subject = '') {
        console.log('🎯 [AI RESPONDER] Classifying intent...');
        
        const content = (emailContent + ' ' + subject).toLowerCase();
        
        // Positive interest signals
        if (this.containsKeywords(content, ['interested', 'sounds good', 'looks great', 'love to', 'excited', 'perfect', 'exactly what', 'this is great'])) {
            return 'positive_interest';
        }
        
        // Pricing and cost inquiries
        if (this.containsKeywords(content, ['price', 'cost', 'pricing', 'budget', 'how much', 'expensive', 'affordable', 'quote', 'estimate'])) {
            return 'pricing_inquiry';
        }
        
        // Technical questions
        if (this.containsKeywords(content, ['how does', 'technical', 'integration', 'api', 'security', 'implementation', 'infrastructure', 'architecture', 'setup'])) {
            return 'technical_question';
        }
        
        // Meeting/demo requests
        if (this.containsKeywords(content, ['demo', 'meeting', 'call', 'schedule', 'available', 'when can', 'show me', 'presentation'])) {
            return 'meeting_request';
        }
        
        // Timeline questions
        if (this.containsKeywords(content, ['when', 'timeline', 'how long', 'how soon', 'implementation time', 'delivery', 'launch'])) {
            return 'timeline_question';
        }
        
        // Feature questions
        if (this.containsKeywords(content, ['features', 'capabilities', 'can it', 'does it support', 'functionality', 'what can'])) {
            return 'feature_inquiry';
        }
        
        // Objections or concerns
        if (this.containsKeywords(content, ['concern', 'worried', 'but', 'however', 'problem', 'issue', 'not sure', 'hesitant'])) {
            return 'objection_concern';
        }
        
        // Competitor comparisons
        if (this.containsKeywords(content, ['competitor', 'versus', 'compared to', 'alternative', 'other options', 'different from'])) {
            return 'competitor_comparison';
        }
        
        // Not interested
        if (this.containsKeywords(content, ['not interested', 'no thanks', 'unsubscribe', 'remove me', 'stop', 'don\'t contact'])) {
            return 'not_interested';
        }
        
        // General information request
        if (this.containsKeywords(content, ['tell me more', 'more information', 'learn more', 'details', 'explain', 'what is'])) {
            return 'wants_more_info';
        }
        
        // Follow-up needed (default for unclear intent)
        console.log('🎯 [AI RESPONDER] Intent classified as: general_inquiry (default)');
        return 'general_inquiry';
    }

    /**
     * Helper function to check if content contains any of the keywords
     */
    containsKeywords(content, keywords) {
        return keywords.some(keyword => content.includes(keyword));
    }

    /**
     * Track conversation context and history
     */
    updateConversationHistory(trackingId, emailData, intent) {
        console.log(`💬 [AI RESPONDER] Updating conversation history for tracking ID: ${trackingId}`);
        
        const now = new Date().toISOString();
        
        if (!this.conversationHistory.has(trackingId)) {
            this.conversationHistory.set(trackingId, {
                trackingId: trackingId,
                startDate: now,
                emailCount: 0,
                questionCount: 0,
                intents: [],
                lastResponseDate: null,
                leadData: {},
                stage: 'initial'
            });
        }
        
        const conversation = this.conversationHistory.get(trackingId);
        conversation.emailCount++;
        conversation.lastResponseDate = now;
        conversation.intents.push({ intent, timestamp: now });
        
        // Update lead data if available
        if (emailData.from) {
            conversation.leadData.email = emailData.from;
            // Try to extract name from email or headers
            conversation.leadData.name = this.extractNameFromEmail(emailData);
        }
        
        // Count questions (rough heuristic)
        if (emailData.body && emailData.body.includes('?')) {
            conversation.questionCount++;
        }
        
        // Update conversation stage based on history
        this.updateConversationStage(conversation, intent);
        
        console.log(`💬 [AI RESPONDER] Conversation updated: ${conversation.emailCount} emails, ${conversation.questionCount} questions, stage: ${conversation.stage}`);
    }

    /**
     * Extract lead name from email data
     */
    extractNameFromEmail(emailData) {
        // Try to get name from sender field
        if (emailData.sender && emailData.sender !== emailData.from) {
            return emailData.sender;
        }
        
        // Try to extract from email address
        if (emailData.from) {
            const emailParts = emailData.from.split('@')[0];
            return emailParts.split('.').map(part => 
                part.charAt(0).toUpperCase() + part.slice(1)
            ).join(' ');
        }
        
        return 'there'; // Default friendly greeting
    }

    /**
     * Update conversation stage based on intent history
     */
    updateConversationStage(conversation, currentIntent) {
        const recentIntents = conversation.intents.slice(-3).map(i => i.intent);
        
        if (currentIntent === 'positive_interest' || currentIntent === 'meeting_request') {
            conversation.stage = 'interested';
        } else if (currentIntent === 'not_interested') {
            conversation.stage = 'not_interested';
        } else if (conversation.questionCount >= 3) {
            conversation.stage = 'engaged';
        } else if (conversation.emailCount >= 2) {
            conversation.stage = 'ongoing';
        } else {
            conversation.stage = 'initial';
        }
    }

    /**
     * Determine if meeting should be suggested based on settings and conversation
     */
    shouldSuggestMeeting(settings, conversation, intent) {
        // Check if user wants immediate meetings for positive responses
        if (settings.positive_immediate_booking && intent === 'positive_interest') {
            return true;
        }
        
        // Check question threshold
        if (conversation.questionCount >= (settings.question_threshold || 2)) {
            return true;
        }
        
        // Check for complex questions
        if (settings.complex_question_escalation && 
            ['technical_question', 'feature_inquiry', 'competitor_comparison'].includes(intent)) {
            return true;
        }
        
        // Meeting request intent
        if (intent === 'meeting_request') {
            return true;
        }
        
        return false;
    }

    /**
     * Generate intelligent response using OpenAI and template engine
     */
    async generateResponse(emailData, trackingId = null) {
        console.log('🤖 [AI RESPONDER] Generating intelligent response...');
        
        if (!this.initialized) {
            await this.initialize();
        }
        
        try {
            // Get current settings
            const settings = await this.settingsManager.getSettings();
            console.log('🤖 [AI RESPONDER] Loaded settings for response generation');
            
            // Classify intent
            const intent = this.classifyIntent(emailData.body, emailData.subject);
            console.log(`🎯 [AI RESPONDER] Classified intent: ${intent}`);
            
            // Update conversation history if tracking ID available
            let conversation = null;
            if (trackingId) {
                this.updateConversationHistory(trackingId, emailData, intent);
                conversation = this.conversationHistory.get(trackingId);
            }
            
            // Handle "not interested" responses
            if (intent === 'not_interested') {
                console.log('🤖 [AI RESPONDER] Not interested response detected, not generating reply');
                return {
                    success: true,
                    shouldRespond: false,
                    intent: intent,
                    reason: 'Lead expressed no interest'
                };
            }
            
            // Prepare context for template engine
            const conversationContext = conversation ? {
                stage: conversation.stage,
                questionCount: conversation.questionCount,
                lastResponseDate: conversation.lastResponseDate,
                originalSubject: emailData.subject
            } : {};
            
            const leadData = conversation ? conversation.leadData : {
                name: this.extractNameFromEmail(emailData),
                email: emailData.from
            };
            
            // Generate response using template engine
            const templateResult = templateEngine.generateContextualResponse(
                intent,
                settings,
                leadData,
                conversationContext
            );
            
            if (!templateResult.success) {
                throw new Error(templateResult.error);
            }
            
            // Determine response strategy
            const shouldSuggestMeeting = this.shouldSuggestMeeting(settings, conversation || {}, intent);
            
            console.log(`✅ [AI RESPONDER] Generated response: ${templateResult.response.length} characters`);
            
            return {
                success: true,
                shouldRespond: true,
                response: templateResult.response,
                intent: intent,
                template_used: templateResult.template_used,
                conversation_stage: conversation ? conversation.stage : 'initial',
                should_suggest_meeting: shouldSuggestMeeting,
                variables_used: templateResult.variables_count,
                response_metadata: {
                    tracking_id: trackingId,
                    email_count: conversation ? conversation.emailCount : 1,
                    question_count: conversation ? conversation.questionCount : 0,
                    generated_at: new Date().toISOString()
                }
            };
            
        } catch (error) {
            console.error('❌ [AI RESPONDER] Error generating response:', error);
            
            return {
                success: false,
                error: error.message,
                intent: 'error',
                fallback_response: this.generateFallbackResponse(emailData)
            };
        }
    }

    /**
     * Generate a simple fallback response if AI generation fails
     */
    generateFallbackResponse(emailData) {
        const name = this.extractNameFromEmail(emailData);
        
        return `Hi ${name},

Thank you for your email! I appreciate your interest and will make sure you get a detailed response.

I'll have someone from our team reach out to you shortly to address your questions and discuss how we can help.

Best regards,
Our Team`;
    }

    /**
     * Test the response generation system
     */
    async testResponse(testEmail, testSettings = {}) {
        console.log('🧪 [AI RESPONDER] Testing response generation...');
        
        const mockEmailData = {
            from: 'test@example.com',
            subject: 'Interested in your solution',
            body: testEmail || 'Hi, I\'m interested in learning more about your solution. Can you tell me about pricing and implementation timeline?',
            sender: 'Test User'
        };
        
        // Override settings for testing if provided
        if (Object.keys(testSettings).length > 0) {
            await this.settingsManager.updateSettings(testSettings);
        }
        
        const startTime = Date.now();
        const result = await this.generateResponse(mockEmailData, 'test-tracking-id');
        const endTime = Date.now();
        
        result.response_time = endTime - startTime;
        
        console.log('🧪 [AI RESPONDER] Test completed');
        return result;
    }

    /**
     * Get conversation history for a tracking ID
     */
    getConversationHistory(trackingId) {
        return this.conversationHistory.get(trackingId);
    }

    /**
     * Get all conversation histories (for analytics)
     */
    getAllConversations() {
        return Array.from(this.conversationHistory.values());
    }

    /**
     * Clear conversation history
     */
    clearConversationHistory() {
        this.conversationHistory.clear();
        console.log('💬 [AI RESPONDER] Conversation history cleared');
    }
}

// Export singleton instance
export const smartAIResponder = new SmartAIResponder();
