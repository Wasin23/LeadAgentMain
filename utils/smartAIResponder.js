import 'dotenv/config';

/**
 * Smart AI Responder - Advanced email response system with configurable templates
 * Handles multi-turn conversations, intent classification, and personalized responses
 */
export class SmartAIResponder {
    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.initialized = false;
    }

    /**
     * Enhanced Intent Classification using OpenAI
     */
    async classifyIntent(emailContent, conversationHistory = []) {
        const prompt = `
Analyze this email reply and classify the sender's intent. Consider the context of a B2B sales conversation.

Email content: "${emailContent}"

Previous conversation: ${conversationHistory.length > 0 ? JSON.stringify(conversationHistory) : 'None'}

Classify the intent as ONE of these categories:
- meeting_request_positive: Wants to schedule a meeting/call
- meeting_request_negative: Declines meeting but still engaged  
- meeting_time_preference: Specifying preferred times/dates
- calendar_booking_request: Asking for calendar link
- technical_question: Asking how product/service works
- pricing_question: Asking about costs, rates, pricing
- timeline_question: Asking about implementation timeline
- case_study_request: Wants examples, references, case studies
- integration_question: How it works with existing systems
- compliance_question: Security, SOC2, GDPR concerns
- comparison_question: Comparing to competitors
- question_about_product: General product questions
- unsubscribe_request: Wants to opt out
- general_positive: Shows interest but no specific action
- general_negative: Polite rejection or not interested

Respond with just the intent category, nothing else.`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1,
                    max_tokens: 50
                })
            });

            const data = await response.json();
            const intent = data.choices[0].message.content.trim().toLowerCase();
            
            console.log('🎯 [AI RESPONDER] Intent classified:', intent);
            return intent;

        } catch (error) {
            console.error('❌ [AI RESPONDER] Intent classification failed:', error);
            // Fallback to simple keyword detection
            return this.fallbackIntentClassification(emailContent);
        }
    }

    /**
     * Fallback intent classification using keyword matching
     */
    fallbackIntentClassification(emailContent) {
        const lowerText = emailContent.toLowerCase();
        
        // Meeting-related intents
        if (lowerText.match(/yes.*meeting|schedule.*call|let.*schedule|sounds good.*meeting|interested.*call/)) {
            return 'meeting_request_positive';
        }
        if (lowerText.match(/calendar.*link|booking.*link|schedule.*link|send.*calendar/)) {
            return 'calendar_booking_request';
        }
        if (lowerText.match(/tuesday|wednesday|thursday|friday|monday|morning|afternoon|time.*work/)) {
            return 'meeting_time_preference';
        }
        
        // Question types
        if (lowerText.match(/how.*work|technical|integration|api|system|architecture/)) {
            return 'technical_question';
        }
        if (lowerText.match(/price|cost|rate|budget|expensive|affordable|pricing/)) {
            return 'pricing_question';
        }
        if (lowerText.match(/how long|timeline|when.*ready|implementation.*time/)) {
            return 'timeline_question';
        }
        if (lowerText.match(/example|case study|reference|similar.*company|who.*using/)) {
            return 'case_study_request';
        }
        if (lowerText.match(/security|compliance|soc2|gdpr|data.*protection/)) {
            return 'compliance_question';
        }
        if (lowerText.match(/vs|versus|compared.*to|better.*than|competitor/)) {
            return 'comparison_question';
        }
        
        // Negative responses
        if (lowerText.match(/unsubscribe|remove.*list|stop.*email|opt.*out/)) {
            return 'unsubscribe_request';
        }
        if (lowerText.match(/not.*interested|no.*thank|pass.*this.*time|not.*right.*now/)) {
            return 'general_negative';
        }
        
        // Positive but general
        if (lowerText.match(/interesting|good.*know|thanks.*info|appreciate/)) {
            return 'general_positive';
        }
        
        // Default for questions
        if (lowerText.includes('?') || lowerText.match(/what|how|when|where|why|can.*you/)) {
            return 'question_about_product';
        }
        
        return 'general_positive';
    }

    /**
     * Analyze sentiment of email content
     */
    async analyzeSentiment(emailContent) {
        const prompt = `
Analyze the sentiment of this email reply in a B2B sales context:

"${emailContent}"

Classify as one of: positive, negative, neutral, frustrated, excited, interested, skeptical

Respond with just the sentiment word, nothing else.`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1,
                    max_tokens: 20
                })
            });

            const data = await response.json();
            const sentiment = data.choices[0].message.content.trim().toLowerCase();
            
            console.log('💭 [AI RESPONDER] Sentiment analyzed:', sentiment);
            return sentiment;

        } catch (error) {
            console.error('❌ [AI RESPONDER] Sentiment analysis failed:', error);
            // Simple fallback
            const lowerText = emailContent.toLowerCase();
            if (lowerText.match(/great|excellent|perfect|love|excited|fantastic/)) return 'positive';
            if (lowerText.match(/not.*interested|no.*thanks|waste.*time/)) return 'negative';
            return 'neutral';
        }
    }

    /**
     * Default response settings (will be replaced with Zilliz storage)
     */
    getDefaultSettings() {
        return {
            company_info: {
                name: "Exabits",
                product_name: "AI GPU Compute Solutions",
                value_props: [
                    "30% cost reduction compared to general cloud services",
                    "40% faster model training with optimized infrastructure", 
                    "Custom AI infrastructure tailored to your needs"
                ],
                calendar_link: "https://calendly.com/yourname/meeting" // Will be configurable
            },
            response_style: {
                tone: "professional_friendly",
                meeting_pushiness: "soft",
                technical_depth: "medium",
                followup_frequency: "balanced"
            },
            meeting_triggers: {
                question_threshold: 2,
                positive_sentiment_immediate: true,
                technical_complexity_escalation: true
            }
        };
    }
}
