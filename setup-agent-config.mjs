import 'dotenv/config';
import { AgentSettingsManager } from './utils/agentSettingsManager.js';

console.log('⚙️ Setting up Agent Configuration System...');

// Get userId from command line argument or environment variable
const userId = process.argv[2] || process.env.USER_ID;

if (!userId) {
    console.error('❌ User ID is required!');
    console.log('Usage: node setup-agent-config.mjs <userId>');
    console.log('   or: Set USER_ID environment variable');
    process.exit(1);
}

console.log(`Setting up configuration for user: ${userId}`);

const settingsManager = new AgentSettingsManager();

try {
    await settingsManager.initialize();
    
    // Initialize default settings for Exabits with your user ID
    await settingsManager.updateSetting('company_info', {
        name: "Exabits",
        product_name: "AI GPU Compute Solutions",
        value_props: [
            "30% cost reduction compared to general cloud services",
            "40% faster model training with optimized infrastructure", 
            "Custom AI infrastructure tailored to your specific needs"
        ],
        calendar_link: "https://calendly.com/yourname/meeting"  // You'll update this with your real link
    }, 'company_info', userId);

    await settingsManager.updateSetting('response_style', {
        tone: "professional_friendly",
        meeting_pushiness: "soft", 
        technical_depth: "medium",
        followup_frequency: "balanced"
    }, 'response_style', userId);

    await settingsManager.updateSetting('knowledge_base', {
        technical_answers: {
            "how does it work": "Our professional business solutions are tailored to meet your specific operational needs and business objectives.",
            "performance benefits": "Clients typically see improved efficiency and cost optimization through our customized approach and expert support.",
            "integration process": "Integration is seamless - we work with your existing systems and processes to ensure smooth implementation.",
            "scaling capabilities": "Our solutions scale with your business growth, from startup requirements to enterprise-wide implementations."
        },
        pricing_guidance: {
            "cost_model": "We offer performance-per-dollar advantages with transparent pricing based on your specific compute requirements.",
            "roi_message": "Most clients see ROI within 2-3 months through reduced training costs and faster iteration cycles."
        },
        case_studies: {
            "ai_companies": "We've helped AI companies reduce their training costs by 30% while accelerating model development.",
            "enterprise": "Enterprise clients have achieved 40% faster deployment cycles with our dedicated infrastructure."
        }
    }, 'knowledge_base', userId);

    await settingsManager.updateSetting('meeting_triggers', {
        question_threshold: 2,
        positive_sentiment_immediate: true,
        technical_complexity_escalation: true
    }, 'meeting_triggers', userId);

    // Add calendar_id setting
    await settingsManager.updateSetting('calendar_id', 'colton.fidd@gmail.com', 'string', userId);

    // Add missing individual settings that were in the original 16
    await settingsManager.updateSetting('product_name', 'Professional Business Solutions', 'string', userId);
    await settingsManager.updateSetting('timezone', 'America/Los_Angeles', 'string', userId);
    await settingsManager.updateSetting('technical_depth', 'medium', 'string', userId);
    await settingsManager.updateSetting('complex_question_escalation', false, 'boolean', userId);
    await settingsManager.updateSetting('company_name', 'Exabits', 'string', userId);
    await settingsManager.updateSetting('value_propositions', [
        "Cost-effective solutions compared to traditional approaches",
        "Improved efficiency through optimized processes", 
        "Custom solutions tailored to your specific business needs"
    ], 'array', userId);
    await settingsManager.updateSetting('response_tone', 'professional_friendly', 'string', userId);
    await settingsManager.updateSetting('meeting_pushiness', 'medium', 'string', userId);
    await settingsManager.updateSetting('question_threshold', 2, 'number', userId);
    await settingsManager.updateSetting('positive_immediate_booking', false, 'boolean', userId);
    await settingsManager.updateSetting('show_ai_disclaimer', true, 'boolean', userId);

    console.log('✅ All 16 agent settings configured successfully!');
    console.log('🔄 These settings will now be used by the Netlify webhook for AI responses');
    console.log('📝 You can update these settings through the UI later');

} catch (error) {
    console.error('❌ Failed to configure agent settings:', error);
}

process.exit(0);
