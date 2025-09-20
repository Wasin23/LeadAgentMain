import 'dotenv/config';

/**
 * Response Template Engine - Handles dynamic variable substitution for AI email responses
 * Enables personalized responses using company info, lead data, and contextual information
 */
export class ResponseTemplateEngine {
    constructor() {
        this.variables = new Map();
        this.templates = new Map();
        this.initialized = false;
    }

    /**
     * Initialize the template engine with default variables and templates
     */
    initialize() {
        console.log('📝 [TEMPLATE ENGINE] Initializing response template engine...');
        
        // Initialize default system variables
        this.setVariable('current_date', new Date().toLocaleDateString());
        this.setVariable('current_time', new Date().toLocaleTimeString());
        this.setVariable('current_year', new Date().getFullYear().toString());
        
        // Load default response templates
        this.loadDefaultTemplates();
        
        this.initialized = true;
        console.log('✅ [TEMPLATE ENGINE] Template engine initialized successfully');
    }

    /**
     * Set a variable for template substitution
     */
    setVariable(key, value) {
        this.variables.set(key, value);
        console.log(`📝 [TEMPLATE ENGINE] Set variable: ${key} = ${value}`);
    }

    /**
     * Set multiple variables at once
     */
    setVariables(variableObject) {
        for (const [key, value] of Object.entries(variableObject)) {
            this.setVariable(key, value);
        }
    }

    /**
     * Get a variable value
     */
    getVariable(key) {
        return this.variables.get(key);
    }

    /**
     * Load company settings as template variables
     */
    loadCompanySettings(settings) {
        console.log('📝 [TEMPLATE ENGINE] Loading company settings as variables...');
        
        // Company information variables
        this.setVariable('company_name', settings.company_name || 'Our Company');
        this.setVariable('product_name', settings.product_name || 'our solution');
        this.setVariable('calendar_link', settings.calendar_link || '');
        
        // Value propositions (convert array to string)
        if (settings.value_propositions && Array.isArray(settings.value_propositions)) {
            this.setVariable('value_props_list', settings.value_propositions.join(', '));
            this.setVariable('primary_value_prop', settings.value_propositions[0] || '');
            
            // Individual value props for targeted use
            settings.value_propositions.forEach((prop, index) => {
                this.setVariable(`value_prop_${index + 1}`, prop);
            });
        }
        
        // Response style settings
        this.setVariable('response_tone', settings.response_tone || 'professional_friendly');
        this.setVariable('meeting_pushiness', settings.meeting_pushiness || 'medium');
        this.setVariable('technical_depth', settings.technical_depth || 'medium');
        
        console.log('✅ [TEMPLATE ENGINE] Company settings loaded as variables');
    }

    /**
     * Load lead/contact information as template variables
     */
    loadLeadData(leadData) {
        console.log('📝 [TEMPLATE ENGINE] Loading lead data as variables...');
        
        this.setVariable('lead_name', leadData.name || 'there');
        this.setVariable('lead_email', leadData.email || '');
        this.setVariable('lead_company', leadData.company || '');
        this.setVariable('lead_title', leadData.title || '');
        this.setVariable('lead_industry', leadData.industry || '');
        
        console.log('✅ [TEMPLATE ENGINE] Lead data loaded as variables');
    }

    /**
     * Load conversation context as template variables
     */
    loadConversationContext(context) {
        console.log('📝 [TEMPLATE ENGINE] Loading conversation context as variables...');
        
        this.setVariable('conversation_stage', context.stage || 'initial');
        this.setVariable('question_count', context.questionCount || 0);
        this.setVariable('last_response_date', context.lastResponseDate || '');
        this.setVariable('original_subject', context.originalSubject || '');
        
        console.log('✅ [TEMPLATE ENGINE] Conversation context loaded as variables');
    }

    /**
     * Process template string and substitute variables
     */
    processTemplate(templateString) {
        if (!templateString) return '';
        
        let processed = templateString;
        
        // Replace variables in format {{variable_name}}
        const variableRegex = /\{\{([^}]+)\}\}/g;
        processed = processed.replace(variableRegex, (match, variableName) => {
            const cleanName = variableName.trim();
            const value = this.getVariable(cleanName);
            
            if (value !== undefined) {
                console.log(`📝 [TEMPLATE ENGINE] Substituted {{${cleanName}}} with: ${value}`);
                return value;
            } else {
                console.warn(`⚠️ [TEMPLATE ENGINE] Variable not found: ${cleanName}`);
                return match; // Keep original if variable not found
            }
        });

        // Handle conditional blocks in format {{#if variable_name}}content{{/if}}
        const conditionalRegex = /\{\{#if\s+([^}]+)\}\}(.*?)\{\{\/if\}\}/gs;
        processed = processed.replace(conditionalRegex, (match, condition, content) => {
            const cleanCondition = condition.trim();
            const value = this.getVariable(cleanCondition);
            
            if (value && value !== '' && value !== '0' && value !== 'false') {
                console.log(`📝 [TEMPLATE ENGINE] Conditional {{#if ${cleanCondition}}} is true, including content`);
                return this.processTemplate(content); // Recursively process the content
            } else {
                console.log(`📝 [TEMPLATE ENGINE] Conditional {{#if ${cleanCondition}}} is false, excluding content`);
                return '';
            }
        });

        return processed;
    }

    /**
     * Load default response templates
     */
    loadDefaultTemplates() {
        console.log('📝 [TEMPLATE ENGINE] Loading default response templates...');
        
        // Interest/Positive Response Template
        this.templates.set('positive_response', `Hi {{lead_name}},

Thank you for your interest in {{product_name}}! I'm excited to help you learn more about how we can {{primary_value_prop}}.

{{#if smart_calendar_text}}{{smart_calendar_text}}{{/if}}{{#if calendar_link}}{{#if meeting_suggested}}I'd love to schedule a quick {{meeting_duration}} call to discuss your specific needs and show you exactly how {{company_name}} can benefit your organization. You can book a convenient time here: {{calendar_link}}{{/if}}{{/if}}

{{#if value_props_list}}Here are some key benefits our clients typically see:
• {{value_props_list}}{{/if}}

Looking forward to connecting with you!

Best regards,
{{company_name}} Team`);

        // Pricing Inquiry Template
        this.templates.set('pricing_inquiry', `Hi {{lead_name}},

Great question about pricing! {{company_name}}'s {{product_name}} is designed to {{primary_value_prop}}, and our pricing reflects the significant value it delivers.

{{#if smart_calendar_text}}{{smart_calendar_text}}{{/if}}{{#if calendar_link}}{{#if meeting_suggested}}I'd be happy to provide you with a customized quote based on your specific requirements. Could we schedule a brief {{meeting_duration}} call {{calendar_custom_message}}? You can pick a time that works for you: {{calendar_link}}{{/if}}{{/if}}

{{#if value_prop_1}}During our call, I'll show you how we typically help companies achieve {{value_prop_1}}{{/if}}{{#if value_prop_2}} and {{value_prop_2}}{{/if}}.

Would that work for you?

Best regards,
{{company_name}} Team`);

        // Technical Question Template
        this.templates.set('technical_question', `Hi {{lead_name}},

Excellent technical question! {{#if lead_company}}I can see why this would be important for {{lead_company}}.{{/if}}

{{product_name}} handles this through our advanced architecture that enables {{primary_value_prop}}. The technical implementation varies based on your specific infrastructure and requirements.

{{#if smart_calendar_text}}{{smart_calendar_text}}{{/if}}{{#if calendar_link}}{{#if meeting_suggested}}I'd love to schedule a {{meeting_duration}} technical deep-dive call where I can walk you through exactly how this works in your environment. You can book a time here: {{calendar_link}}{{/if}}{{/if}}

{{#if technical_depth}}Based on your question, I think you'd appreciate seeing our detailed technical documentation and perhaps a live demo of the system in action.{{/if}}

Looking forward to diving into the details with you!

Best regards,
{{company_name}} Technical Team`);

        // Follow-up Template
        this.templates.set('follow_up', `Hi {{lead_name}},

I wanted to follow up on our conversation about {{product_name}}. {{#if lead_company}}I've been thinking about how {{company_name}} could specifically help {{lead_company}}{{/if}} {{primary_value_prop}}.

{{#if question_count}}Since you had some great questions, I thought you might be interested in seeing a personalized demo that addresses your specific use case.{{/if}}

{{#if smart_calendar_text}}{{smart_calendar_text}}{{/if}}{{#if calendar_link}}{{#if meeting_suggested}}Would you be available for a quick {{meeting_duration}} call this week? You can choose a time that works best for you: {{calendar_link}}{{/if}}{{/if}}

{{#if value_props_list}}Just as a reminder, here's what we typically help companies achieve:
• {{value_props_list}}{{/if}}

Let me know what questions you have!

Best regards,
{{company_name}} Team`);

        console.log(`✅ [TEMPLATE ENGINE] Loaded ${this.templates.size} default templates`);
    }

    /**
     * Get a template by name
     */
    getTemplate(templateName) {
        return this.templates.get(templateName);
    }

    /**
     * Process a template by name with current variables
     */
    renderTemplate(templateName, additionalVariables = {}) {
        console.log(`📝 [TEMPLATE ENGINE] Rendering template: ${templateName}`);
        
        // Set any additional variables
        if (additionalVariables && Object.keys(additionalVariables).length > 0) {
            this.setVariables(additionalVariables);
        }
        
        const template = this.getTemplate(templateName);
        if (!template) {
            console.warn(`⚠️ [TEMPLATE ENGINE] Template not found: ${templateName}`);
            return null;
        }
        
        const rendered = this.processTemplate(template);
        console.log(`✅ [TEMPLATE ENGINE] Successfully rendered template: ${templateName}`);
        return rendered;
    }

    /**
     * Add a custom template
     */
    addTemplate(name, templateString) {
        console.log(`📝 [TEMPLATE ENGINE] Adding custom template: ${name}`);
        this.templates.set(name, templateString);
    }

    /**
     * Get all available template names
     */
    getAvailableTemplates() {
        return Array.from(this.templates.keys());
    }

    /**
     * Get all current variables
     */
    getAllVariables() {
        return Object.fromEntries(this.variables);
    }

    /**
     * Clear all variables (except system variables)
     */
    clearVariables() {
        const systemVars = ['current_date', 'current_time', 'current_year'];
        const newVariables = new Map();
        
        systemVars.forEach(key => {
            if (this.variables.has(key)) {
                newVariables.set(key, this.variables.get(key));
            }
        });
        
        this.variables = newVariables;
        console.log('📝 [TEMPLATE ENGINE] Cleared all variables except system variables');
    }

    /**
     * Generate a contextual response based on intent and available data
     */
    async generateContextualResponse(intent, companySettings, leadData = {}, conversationContext = {}) {
        console.log(`📝 [TEMPLATE ENGINE] Generating contextual response for intent: ${intent}`);
        
        if (!this.initialized) {
            this.initialize();
        }
        
        // Load all available data as variables
        this.loadCompanySettings(companySettings);
        this.loadLeadData(leadData);
        this.loadConversationContext(conversationContext);
        
        // Integrate calendar functionality if calendar link is available
        if (companySettings.calendar_link) {
            await this.loadCalendarIntegration(companySettings.calendar_link, intent, conversationContext);
        }
        
        // Map intent to template
        let templateName;
        switch (intent) {
            case 'positive_interest':
            case 'wants_more_info':
                templateName = 'positive_response';
                break;
            case 'pricing_inquiry':
            case 'cost_question':
                templateName = 'pricing_inquiry';
                break;
            case 'technical_question':
            case 'implementation_question':
                templateName = 'technical_question';
                break;
            case 'follow_up_needed':
            case 'general_inquiry':
            default:
                templateName = 'follow_up';
                break;
        }
        
        console.log(`📝 [TEMPLATE ENGINE] Selected template: ${templateName} for intent: ${intent}`);
        
        const response = this.renderTemplate(templateName);
        
        if (response) {
            console.log(`✅ [TEMPLATE ENGINE] Generated ${response.length} character response`);
            return {
                success: true,
                response: response,
                template_used: templateName,
                variables_count: this.variables.size
            };
        } else {
            console.error(`❌ [TEMPLATE ENGINE] Failed to generate response for intent: ${intent}`);
            return {
                success: false,
                error: `Failed to generate response for intent: ${intent}`
            };
        }
    }

    /**
     * Load calendar integration variables
     */
    async loadCalendarIntegration(calendarLink, intent, conversationContext) {
        try {
            console.log('📅 [TEMPLATE ENGINE] Loading calendar integration variables...');
            
            // Import calendar manager
            const { calendarManager } = await import('./calendarIntegrationManager.js');
            
            // Initialize if needed
            if (!calendarManager.initialized) {
                await calendarManager.initialize();
            }
            
            // Generate meeting strategy
            const strategy = calendarManager.generateMeetingStrategy(
                intent, 
                conversationContext.stage || 'initial'
            );
            
            // Generate calendar variables
            const calendarVars = calendarManager.generateCalendarTemplateVariables(
                calendarLink, 
                strategy
            );
            
            // Set calendar-specific variables
            this.setVariables(calendarVars);
            
            // Add smart calendar text
            const calendarText = calendarManager.generateCalendarText(calendarLink, {
                intent: intent,
                urgency: strategy.urgency,
                duration: strategy.suggested_duration
            });
            
            this.setVariable('smart_calendar_text', calendarText);
            this.setVariable('meeting_suggested', strategy.should_suggest_meeting);
            
            console.log('✅ [TEMPLATE ENGINE] Calendar integration variables loaded');
            
        } catch (error) {
            console.error('❌ [TEMPLATE ENGINE] Error loading calendar integration:', error);
            // Fallback to basic calendar link
            this.setVariable('calendar_link', calendarLink);
            this.setVariable('meeting_suggested', true);
        }
    }
}

// Export a singleton instance
export const templateEngine = new ResponseTemplateEngine();
