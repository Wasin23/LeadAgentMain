import 'dotenv/config';
import { AgentSettingsManager } from './utils/agentSettingsManager.js';

console.log('⚙️ Setting up Agent Configuration System...');

const settingsManager = new AgentSettingsManager();
const userId = '76e84c79-9b13-4c55-be86-d0bd9baa9411'; // Your actual user ID

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
            "how does it work": "Our AI GPU compute infrastructure provides dedicated NVIDIA H100/H200 clusters optimized for machine learning workloads, delivering superior performance-per-dollar compared to general cloud services.",
            "performance benefits": "Clients typically see 30% cost reduction and 40% faster model training through our optimized infrastructure and custom configurations.",
            "integration process": "Integration is seamless - we provide dedicated clusters that work with your existing ML frameworks and tools.",
            "scaling capabilities": "Our infrastructure scales automatically based on your compute demands, from small experiments to enterprise-wide deployments."
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
    await settingsManager.updateSetting('product_name', 'AI-Powered High-Performance Computing Solutions', 'string', userId);
    await settingsManager.updateSetting('timezone', 'America/Los_Angeles', 'string', userId);
    await settingsManager.updateSetting('technical_depth', 'medium', 'string', userId);
    await settingsManager.updateSetting('complex_question_escalation', false, 'boolean', userId);
    await settingsManager.updateSetting('company_name', 'Exabits', 'string', userId);
    await settingsManager.updateSetting('value_propositions', [
        "30% cost reduction compared to general cloud services",
        "40% faster model training with optimized infrastructure", 
        "Custom AI infrastructure tailored to your specific needs"
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
