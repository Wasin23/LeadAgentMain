import 'dotenv/config';
import { AgentSettingsManager } from './utils/agentSettingsManager.js';

console.log('⚙️ Setting up Agent Configuration System...');

const settingsManager = new AgentSettingsManager();

try {
    await settingsManager.initialize();
    
    // Initialize default settings for Exabits (you can customize these)
    await settingsManager.updateSetting('company_info', {
        name: "Exabits",
        product_name: "AI GPU Compute Solutions",
        value_props: [
            "30% cost reduction compared to general cloud services",
            "40% faster model training with optimized infrastructure", 
            "Custom AI infrastructure tailored to your specific needs"
        ],
        calendar_link: "https://calendly.com/yourname/meeting"  // You'll update this with your real link
    }, 'company_info');

    await settingsManager.updateSetting('response_style', {
        tone: "professional_friendly",
        meeting_pushiness: "soft", 
        technical_depth: "medium",
        followup_frequency: "balanced"
    }, 'response_style');

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
    }, 'knowledge_base');

    await settingsManager.updateSetting('meeting_triggers', {
        question_threshold: 2,
        positive_sentiment_immediate: true,
        technical_complexity_escalation: true
    }, 'meeting_triggers');

    console.log('✅ Default agent settings configured successfully!');
    console.log('🔄 These settings will now be used by the Netlify webhook for AI responses');
    console.log('📝 You can update these settings through the UI later');

} catch (error) {
    console.error('❌ Failed to configure agent settings:', error);
}

process.exit(0);
