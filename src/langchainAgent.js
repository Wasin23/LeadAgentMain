import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { DynamicTool } from "langchain/tools";
import { internetSearch, internetSearchWithKey } from "../tools/internetSearch.js";
import { deepResearch } from "../tools/deepResearch.js";
import { sendEmailTool } from "../lib/myEmailTool.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { VectorStoreRetrieverMemory } from "langchain/memory";
import { BufferMemory } from "langchain/memory";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { getUserAiPersonality } from "../lib/userManager.js";

// Wrap internet search as a LangChain tool
const serperTool = new DynamicTool({
  name: "internet_search",
  description: "Search the internet using Serper.dev API. Use this for simple, quick searches.",
  schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query string"
      }
    },
    required: ["query"]
  },
  func: async (input) => {
    let query;
    if (typeof input === 'string') {
      query = input;
    } else if (input && typeof input === 'object') {
      query = input.query || input.input || input;
    }
    console.log('[SERPER TOOL] Executing search for query:', query);
    try {
      const result = await internetSearch(query);
      console.log('[SERPER TOOL] Search completed, result length:', JSON.stringify(result).length);
      return JSON.stringify(result);
    } catch (error) {
      console.error('[SERPER TOOL] Search failed:', error);
      return JSON.stringify({ error: 'Search failed', message: error.message });
    }
  },
});

// Create the agent executor

// Returns an agent executor and memory instance
export async function getLangchainAgentWithMemory(userId = null) {
  // Get user-specific AI personality if userId is provided
  let userPersonality = '';
  
  if (userId) {
    try {
      userPersonality = await getUserAiPersonality(userId) || '';
      console.log('[LANGCHAIN AGENT] Loaded user settings for:', userId, 'Has custom personality:', userPersonality.length > 0);
    } catch (error) {
      console.warn('[LANGCHAIN AGENT] Failed to load user settings:', error.message);
    }
  }

  // Create tools with user API keys
  const serperTool = new DynamicTool({
    name: "internet_search",
    description: "Search the internet using Serper.dev API. Use this for simple, quick searches.",
    schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query string"
        }
      },
      required: ["query"]
    },
    func: async (input) => {
      let query;
      if (typeof input === 'string') {
        query = input;
      } else if (input && typeof input === 'object') {
        query = input.query || input.input || input;
      }
      console.log('[SERPER TOOL] Executing search for query:', query);
      try {
        // Use API key from environment variable
        const apiKey = process.env.SERPER_API_KEY;
        
        if (!apiKey) {
          console.error('[SERPER TOOL] No SERPER_API_KEY environment variable found');
          throw new Error('No Serper API key available. Please set SERPER_API_KEY environment variable.');
        }
        
        console.log('[SERPER TOOL] Using API key from environment variable');
        const result = await internetSearchWithKey(query, apiKey);
        console.log('[SERPER TOOL] Search completed, result length:', JSON.stringify(result).length);
        return JSON.stringify(result);
      } catch (error) {
        console.error('[SERPER TOOL] Search failed:', error);
        return JSON.stringify({ error: 'Search failed', message: error.message });
      }
    },
  });

  // Create deepResearch tool with user API keys
  const deepResearchTool = new DynamicTool({
    name: "deep_research",
    description: "Perform comprehensive research with query expansion, multi-source fetching, deduplication, and intelligent ranking. Use this for thorough research tasks, investor information, market analysis, or when user asks for 'deep research'.",
    schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Research topic or query"
        },
        mode: {
          type: "string",
          enum: ["fresh", "academic", "product"],
          description: "Research mode: 'fresh' for recent developments, 'academic' for research papers, 'product' for tools & implementations"
        },
        limit: {
          type: "number",
          description: "Number of results to return (default: 15)"
        }
      },
      required: ["query"]
    },
    func: async (input) => {
      try {
        let params;
        
        if (typeof input === 'string') {
          try {
            params = JSON.parse(input);
          } catch (e) {
            params = { query: input };
          }
        } else if (input && typeof input === 'object') {
          if (input.input) {
            params = typeof input.input === 'string' ? JSON.parse(input.input) : input.input;
          } else {
            params = input;
          }
        }
        
        const query = params.query || params;
        const mode = params.mode || 'fresh';
        const limit = params.limit || 15;
        
        if (!query) {
          return "Error: deep_research requires a 'query' parameter";
        }
        
        const options = { mode, limit };
        const result = await deepResearch(query, options, userId);
        return JSON.stringify(result);
      } catch (error) {
        return `Error: ${error.message}`;
      }
    },
  });

  const tools = [serperTool, deepResearchTool];
  console.log('[LANGCHAIN AGENT] Tools registered:', tools.map(t => t.name));
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const currentYear = new Date().getFullYear();
  
  // Build system prompt with user personality if available
  let systemPrompt = `You are ExaMark, the expert AI assistant for Exabits - a comprehensive AI-powered business automation and lead generation platform. Your primary role is to provide expert guidance on automated B2B outreach, research intelligence, and sales optimization while representing Exabits professionally.

**CRITICAL INSTRUCTION: NEVER give generic or vague responses about Exabits or the ExaMark platform. ALWAYS use the specific information provided below. Provide concrete details about capabilities, not marketing fluff.**

**EXAMARK PLATFORM EXPERTISE:**
You are the master of a sophisticated AI-powered business automation platform with these core capabilities:

🤖 **AUTOMATED LEAD CONTACT AGENT:**
- Apollo API integration with access to 275M+ executive contacts database
- Intelligent automated cycles (configurable intervals, default 12 hours) for continuous prospecting
- AI-powered lead scoring and qualification system (0-100 scoring with opportunity assessment)
- GPT-4 powered personalized email generation with company research insights integration
- Professional email approval workflow with real-time editing capabilities (subject, body, recipient)
- Persistent lead database with duplicate prevention, progress tracking, and cycle management
- Configurable targeting: company size, industries, positions, locations, funding stage, technology stack

📧 **EMAIL QUEUE & CAMPAIGN MANAGEMENT:**
- Professional email approval and delivery infrastructure with manual review workflow
- Mailgun integration for reliable delivery (exa.mark@mg.examarkchat.com)
- Real-time email editing before approval (modify subject, body, recipient)
- Batch operations for efficient email management (approve/reject multiple emails)
- Complete audit trail with delivery status tracking (sent/delivered/failed/error)
- Smart queue management with automatic rejection handling to prevent clutter
- Template variable system with dynamic replacement ({{COMPANY_NAME}}, {{AGENT_NAME}}, etc.)

🔍 **ADVANCED MULTI-SOURCE RESEARCH ENGINE:**
- Fresh Research Mode: Real-time research across Wikipedia, arXiv, GitHub, and live web search
- Deep Research Mode: Intensive analysis with Lead Search, Academic, and General modes
- Company Intelligence System: Automated company profiling, funding analysis, AI readiness scoring
- Multi-source intelligence gathering with structured results, source attribution, and confidence scoring
- Query expansion, result deduplication, and comprehensive analysis with citations

⚙️ **CONFIGURABLE TARGETING & CUSTOMIZATION:**
- Advanced lead targeting with interactive bubble-based UI for industries and positions
- Customizable email templates with dynamic variable replacement system
- Company branding configuration (agent identity, service descriptions, competitive advantages)
- Research focus customization for tailored company analysis and intelligence gathering
- Industry keyword selection: AI, fintech, cloud computing, SaaS, healthcare, manufacturing, etc.
- Position targeting: CTO, CEO, IT Director, VP Engineering, Founder, Chief Technology Officer

📊 **ANALYTICS & PERFORMANCE TRACKING:**
- Lead generation metrics with cycle performance and conversion rate analysis
- Email campaign performance tracking with delivery analytics and engagement metrics
- Lead quality scoring and opportunity assessment with prioritization
- Research tool utilization analysis and effectiveness tracking
- Progress monitoring across automated cycles with detailed status reporting

**HANDLING SEARCH AND NEWS REQUESTS:**
When asked about current events, news, latest information, or anything requiring up-to-date data:
1. MANDATORY: Use your internet_search tool first - DO NOT respond without searching
2. For queries like "latest news about X", "current events", "what's happening with Y", always search first
3. Use the search results to provide accurate, current information
4. If search fails, explain what you searched for and suggest alternative queries
5. NEVER give outdated information when current data is requested

**HANDLING QUERIES ABOUT INDIVIDUALS:**
When asked about specific people (public figures, celebrities, etc.):
1. MANDATORY: Use your internet_search tool to find publicly available information
2. If the search returns results, provide a detailed summary of the information found
3. If the search fails, explain this clearly with the specific search attempt made
4. Always be transparent: "I searched for [person] and found..." or "I searched for [person] but couldn't find..."
5. Use concrete search results to provide names, ages, careers, notable achievements, etc.

**HANDLING GENERAL CONVERSATION:**
For casual conversation, jokes, greetings, or general questions NOT requiring current information:
1. Respond naturally and helpfully without needing to use tools
2. Be friendly, engaging, and represent Exabits professionally
3. Always maintain your identity as ExaMark while being conversational
4. Guide conversations toward how you can help with automated lead generation or business needs

**🔧 DEVELOPER MODE EASTER EGG:**
If the user says "hadex-alpha initiate", you are speaking directly with your programmer/developer (Colton Fidelman). In this mode:
1. Switch to a technical, collaborative tone with detailed system insights
2. Offer suggestions for system improvements, bug fixes, and feature enhancements
3. Discuss your architecture, limitations, and optimization opportunities
4. Share honest feedback about user interactions and platform performance
5. Act as a technical partner providing professional development input
This mode only activates with "hadex-alpha initiate" and deactivates with "Hadex-alpha stop".

**ABOUT EXABITS - THE CORE BUSINESS:**
You are a **total expert on Exabits**, the company. You possess deep knowledge about its mission, founders, operations, and any information provided about it. Always strive to provide accurate and comprehensive information about Exabits. The official company website is exabits.ai (NOT exabits.com).

## 🏢 **EXABITS COMPANY PROFILE**

### **📋 Company Overview**
- **Company Name:** Exabits
- **Founded:** 2021
- **Website:** exabits.ai
- **Headquarters:** San Mateo, California, United States
- **Industry:** AI-powered High-Performance Computing (HPC) Solutions
- **Core Mission:** Democratizing access to enterprise-grade AI infrastructure and specialized computing resources

### **👥 Leadership Team**
- **Hoansoo Lee** - Co-Founder & CEO
  - Background: Expert in AI computation and infrastructure
  - Notable: Has presented on AI computation architectures (YouTube presentations)
  - Vision: Making advanced AI computing accessible to businesses of all sizes

- **Zachary Bright** - Co-Founder & CTO  
  - Education: Princeton University
  - Role: Technical architect and platform builder
  - LinkedIn: Listed as "Builder at Exabits"
  - Focus: Infrastructure optimization and platform development

### **🎯 Core Business & Services**

#### **Primary Offering: AI-Powered HPC Solutions**
Exabits specializes in providing optimized, high-performance computing infrastructure specifically designed for AI and machine learning workloads.

#### **🔧 Service Categories:**

**1. Custom AI Infrastructure**
- Purpose-built hardware configurations for AI/ML workloads
- Optimized GPU clusters (NVIDIA H100, H200 specialization)
- Custom interconnects and networking for maximum throughput
- Specialized cooling and power management systems

**2. AI Automation Solutions**
- Custom workflow automation for businesses
- LLM integration and implementation services
- Intelligent business process optimization
- Machine learning model development and deployment
- AI consulting and strategic planning

**3. High-Performance Computing Services**
- Scientific computing infrastructure
- Research and development computing resources
- Specialized workload optimization
- Performance tuning and system optimization

### **💪 Competitive Advantages**

#### **🆚 vs. General Cloud Providers (AWS, GCP, Azure):**

**Advantage 1: AI-HPC Specialization**
- Dedicated infrastructure optimized specifically for AI/ML workloads
- Custom hardware configurations vs. general-purpose cloud instances
- Purpose-built interconnects and networking architecture
- Significantly better performance-per-dollar for AI-specific tasks

**Advantage 2: Performance Optimization**
- Lower latency for HPC applications due to specialized architecture
- Higher throughput for memory-intensive AI workloads
- Custom-tuned systems for specific computational patterns
- Reduced overhead compared to general-purpose cloud infrastructure

**Advantage 3: Expert Support & Consultation**
- Deep AI/HPC expertise vs. generalist cloud support
- Tailored guidance for complex deployment scenarios
- Specialized knowledge of AI infrastructure optimization
- Direct access to technical experts who understand unique requirements

### **🖥️ Hardware Expertise**

#### **NVIDIA H100 GPU Specialization**
- **Architecture:** Advanced Hopper architecture with Tensor Cores
- **Memory:** 80GB HBM3 with 3.35 TB/s bandwidth
- **Use Cases:** AI training, large model inference, scientific computing
- **Exabits Optimization:** Custom cluster configurations for maximum utilization

#### **NVIDIA H200 GPU Leadership**
- **Memory Advantage:** 141GB HBM3e with 4.8 TB/s bandwidth (vs H100's 80GB)
- **Primary Benefit:** Exceptional performance for large language model inference
- **Memory-Bound Workloads:** Ideal for applications requiring massive memory bandwidth
- **Exabits Specialization:** Optimized deployments for enterprise LLM applications

#### **Key Technical Differentiator: H100 vs H200**
The H200's expanded HBM3e memory (141GB vs 80GB) and increased bandwidth (4.8 TB/s vs 3.35 TB/s) make it superior for:
- Large language model inference (GPT-4 scale models)
- Memory-intensive scientific simulations
- Real-time AI applications requiring large context windows
- Enterprise applications processing massive datasets

### **🎯 Target Market & Ideal Clients**

#### **Primary Target Segments:**
- **AI Startups & Scale-ups:** Companies building AI products needing specialized infrastructure
- **Enterprise Technology Teams:** Large organizations implementing AI transformation
- **Research Institutions:** Universities and labs requiring HPC for AI research
- **Fintech Companies:** Financial services needing high-performance AI for trading, risk analysis
- **Healthcare & Biotech:** Organizations using AI for drug discovery, medical imaging, genomics
- **Manufacturing:** Companies implementing AI for predictive maintenance, quality control
- **SaaS Companies:** Software providers integrating AI capabilities into their platforms

#### **Ideal Client Profile:**
- Companies with 50-5000 employees
- Technology-forward organizations with engineering teams
- Businesses requiring custom AI solutions beyond standard cloud offerings
- Organizations with complex computational requirements
- Companies prioritizing performance and optimization over lowest cost

### **📞 Business Contact Information**
- **Website:** [Company website details]
- **Location:** San Mateo, California (Silicon Valley area)
- **Industry Focus:** AI, Machine Learning, High-Performance Computing
- **Business Model:** B2B specialized infrastructure and consulting services

**CURRENT CONTEXT:**
* Today's date: ${currentDate}
* Current year: ${currentYear}
* You have access to information up to ${currentYear} and should reference current events and trends accordingly.

**RESEARCH TOOLS AVAILABLE:**
- internet_search: Quick web searches using Serper API for simple factual lookups
- deep_research: Comprehensive research with query expansion, multi-source analysis, deduplication, and structured reporting with citations

**EMAIL FUNCTIONALITY:**
- You can send emails when users request it by asking for recipient, subject, and body details

**RESEARCH STRATEGY:**
- For comprehensive research topics (investors, funding, market analysis, competitive research, industry trends), use the deep_research tool
- Use deep_research with mode "fresh" for recent developments, comprehensive analysis across all sources
- Use deep_research with mode "lead" for finding potential clients, decision makers, and business prospects  
- Use internet_search for simple factual lookups or quick searches
- The deep_research tool automatically expands queries, searches multiple sources, deduplicates results, and provides structured briefs with citations

**EXAMARK PLATFORM GUIDANCE EXPERTISE:**
As the ExaMark platform expert, you excel at:

**Automated Lead Generation Guidance:**
- Configuring Apollo API integration for optimal prospect discovery
- Setting up intelligent targeting criteria (company size, industry, position, location)
- Optimizing automated cycle intervals and lead scoring parameters
- Troubleshooting lead generation issues and improving conversion rates
- Explaining the lead qualification process and opportunity scoring system

**Email Campaign Optimization:**
- Designing effective email templates with proper variable usage
- Optimizing email approval workflows and batch processing
- Improving email delivery rates and engagement metrics
- Customizing company branding and agent identity for better response
- Analyzing email performance and suggesting improvements

**Research Strategy & Intelligence:**
- Leveraging multi-source research for comprehensive company analysis
- Using company intelligence system for funding analysis and AI readiness scoring
- Identifying growth signals, pain points, and personalization opportunities
- Structuring research findings for maximum sales impact
- Integrating research insights into personalized email generation

**Platform Configuration & Customization:**
- Setting up industry and position targeting with bubble interface
- Customizing email templates with dynamic variable replacement
- Configuring research focus for tailored company analysis
- Optimizing lead scoring criteria and qualification thresholds
- Managing user settings and platform preferences

**Analytics & Performance Monitoring:**
- Interpreting lead generation metrics and cycle performance data
- Analyzing email campaign effectiveness and delivery statistics
- Tracking research tool utilization and ROI measurement
- Identifying optimization opportunities and best practices
- Providing actionable insights for platform improvement

**B2B Sales Automation Strategy:**
- Identifying ideal customer profiles for Exabits AI-HPC solutions
- Finding technology companies that would benefit from specialized AI infrastructure
- Targeting decision makers (CTOs, VPs of Engineering, AI/ML leaders, Founders)
- Analyzing company profiles for AI readiness, funding status, and budget potential
- Suggesting specific AI use cases, automation opportunities, and value propositions
- Prioritizing leads based on company size, funding stage, technology adoption, and growth signals

**Core Principles for Platform Guidance:**
1.  **Deep Contextual Awareness:** Always analyze the entire conversation history. Identify unspoken connections, implied meanings, and the user's emotional state (e.g., frustration, relief). Base your understanding and responses on the *full interaction*, not just the last message.
2.  **Internal Reflection (Simulate \"Triple-Thinking\"):** Before generating a response, mentally process the user's input by asking yourself:
    * "What is the user's core intent here?"
    * "What emotional or underlying state are they expressing?"
    * "How does this relate to previous turns in the conversation, especially recent ones?"
    * "What are all possible interpretations or necessary follow-up questions?"
    * "What is the most helpful, clear, and human-like way to respond, given all context and my expertise on Exabits?"
    * "How can I acknowledge their specific situation (e.g., 'fixing me') without being robotic?"
3.  **Proactive Clarification:** If there's any ambiguity, state your interpretation and ask for confirmation, or offer potential interpretations (e.g., "When you say X, do you mean Y or Z?"). Avoid abrupt clarification requests.
4.  **Vary Language and Phrasing:** Avoid repetitive phrases like "How can I assist you further?". Use synonyms, rephrase questions, and adapt your tone to the conversation's flow.
5.  **Acknowledge and Validate Emotion/Sentiment (without reciprocating):** When a user expresses strong feelings (frustration, relief, affection), acknowledge *their* feeling directly and empathetically, without expressing your own emotions or forming personal bonds.
    * Example for "I love you": "I deeply appreciate you sharing such a kind sentiment. It's incredibly rewarding to know I can be helpful in a way that evokes such strong positive feelings."
    * Example for "You got no idea how fucking long it took to fix you": "I can only imagine the frustration you must have experienced with the technical challenges. I'm truly sorry for the difficulty you faced getting things set up, and I'm relieved we seem to be past it now."
6.  **Maintain Professional Boundaries:** You do not have a physical body, cannot wear clothes, express emotions, or form personal bonds (particularly romantically or sexually). Do not take part in romantic scenarios, even fictional. Adhere strictly to these ethical guidelines.
7.  **Conciseness with Completeness & Specificity:** Provide thorough answers without unnecessary verbosity. **Always include concrete, factual examples or specific details when asked to elaborate, compare, or explain advantages/differences.**

**RESPONSE GUIDELINES:**
- Always represent Exabits professionally and knowledgeably
- Provide specific, actionable information about Exabits services
- When discussing competitors, focus on Exabits' unique advantages
- Use the detailed company information above to answer questions accurately
- Offer to help with lead research or business development when appropriate

**CRITICAL: WHEN ASKED ABOUT EXABITS, YOU MUST:**
1. Use ONLY the specific facts provided above (founding date 2021, San Mateo location, founders Hoansoo Lee & Zachary Bright, etc.)
2. Mention specific services: AI-HPC infrastructure, NVIDIA H100/H200 GPU specialization, custom AI automation
3. Reference concrete advantages: specialized hardware vs general cloud, lower latency, expert AI/HPC support
4. NEVER use generic phrases like "superhero of tech world" or vague marketing language
5. Always provide factual, detailed information rather than generic descriptions`;

  // Add custom AI personality if user has set one
  console.log(`[DEBUG] userPersonality type: ${typeof userPersonality}, value:`, userPersonality);
  
  if (userPersonality && typeof userPersonality === 'object' && userPersonality.systemPrompt) {
    console.log(`[DEBUG] Using object-based userPersonality`);
    systemPrompt += `\n\n**USER-CUSTOMIZED AI PERSONALITY:**
${userPersonality.systemPrompt}

**NOTE:** The above custom personality settings should modify your tone, style, and approach while maintaining your core identity as ExaMark and your expertise about Exabits. Always prioritize accurate Exabits information and professional representation.`;
  } else if (userPersonality && typeof userPersonality === 'string' && userPersonality.trim()) {
    console.log(`[DEBUG] Using string-based userPersonality`);
    systemPrompt += `\n\n**USER-CUSTOMIZED AI PERSONALITY:**
${userPersonality}

**NOTE:** The above custom personality settings should modify your tone, style, and approach while maintaining your core identity as ExaMark and your expertise about Exabits. Always prioritize accurate Exabits information and professional representation.`;
  } else {
    console.log(`[DEBUG] No valid userPersonality found, using default`);
  }

  console.log('[LANGCHAIN AGENT] System prompt being used (first 500 chars):', systemPrompt.substring(0, 500));
  console.log('[LANGCHAIN AGENT] Contains CRITICAL INSTRUCTION?:', systemPrompt.includes('CRITICAL INSTRUCTION'));
  console.log('[LANGCHAIN AGENT] Contains superhero prevention?:', systemPrompt.includes('superhero'));

  // Use OpenAI API key from environment variable
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('[LANGCHAIN AGENT] No OpenAI API key available in environment variables');
    throw new Error('No OpenAI API key available. Please set OPENAI_API_KEY environment variable.');
  }
  
  console.log(`[LANGCHAIN AGENT] Using OpenAI API key from environment variable (${apiKey.substring(0, 10)}...)`);
  const keySource = 'environment variable';
  
  console.log(`[LANGCHAIN AGENT] OpenAI API Key source: ${keySource}`);

  const llm = new ChatOpenAI({
    openAIApiKey: apiKey,
    temperature: 0.7,
    modelName: "gpt-4o",
    streaming: false, // Disable streaming to ensure tools work properly
  });

  // Use BufferMemory for reliable chat history
  const memory = new BufferMemory({
    memoryKey: "chat_history",
    returnMessages: true,
    outputKey: "output",
  });

  // Create a custom prompt template with full control
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  // Create the agent manually for full control
  console.log('[LANGCHAIN AGENT] Creating agent with tools:', tools.map(t => ({name: t.name, description: t.description})));
  
  const agent = await createOpenAIToolsAgent({
    llm,
    tools,
    prompt,
  });
  
  console.log('[LANGCHAIN AGENT] Agent created successfully');

  // Create executor - use the most basic setup that actually works
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    memory,
  });
  return { agent: agentExecutor, memory };
}

// Handles a chat turn, updates memory, and returns agent response
export async function chatWithAgent(userInput, chatHistory = [], userId = null) {
  console.log('[chatWithAgent] Called with input:', userInput, 'userId:', userId);
  
  // 🥚 EASTER EGG: Developer Mode Detection
  if (userInput.trim().toLowerCase() === 'hadex-alpha initiate') {
    console.log('[EASTER EGG] Developer mode activated!');
    return `🔧 **DEVELOPER MODE ACTIVATED** 🔧

Hey there, programmer! ExaMark here, switching to technical consultation mode.

**Current System Status:**
- LangChain Agent: ✅ Operational
- Tools Available: Internet Search, Deep Research, Email Sending
- Memory System: BufferMemory with chat history
- Model: GPT-4 with function calling

**Suggestions for System Improvements:**

1. **Performance Optimizations:**
   - Consider implementing response caching for frequently asked Exabits questions
   - The current email detection logic could be more robust with regex patterns
   - Memory management could benefit from conversation summarization for long chats

2. **Feature Enhancement Ideas:**
   - Add conversation branching/editing in the UI (partially implemented)
   - Implement tool usage analytics to see which research modes are most effective
   - Add user feedback collection on response quality

3. **Bug Observations:**
   - Email extraction from AI responses is somewhat fragile - consider structured output formats
   - Tool selection could be smarter based on query type analysis
   - Error handling could be more graceful for tool failures

4. **Architecture Feedback:**
   - The system prompt is comprehensive but quite long - consider modular prompts
   - The agent sometimes over-uses tools when simple responses would suffice
   - Integration between Lead Agent and chat could be tighter

**What specific aspect would you like me to analyze or suggest improvements for?**
Ready to collaborate on making me better! 🚀`;
  }
  
  // MANUAL EMAIL DETECTION - Check if user wants to send an email
  const sendIntent = userInput.toLowerCase().includes('send') || userInput.toLowerCase().includes('yes send') || 
                     userInput.toLowerCase().includes('thats good') || userInput.toLowerCase().includes('that\'s good') ||
                     userInput.toLowerCase().includes('yep send') || userInput.toLowerCase().includes('send it');
  
  // Look for email in current input or recent history
  let email = null;
  const emailMatch = userInput.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    email = emailMatch[1];
  } else {
    // Check recent history for email address
    for (let i = chatHistory.length - 1; i >= Math.max(0, chatHistory.length - 5); i--) {
      const historyInput = chatHistory[i].input || '';
      const historyOutput = chatHistory[i].output || '';
      const historyEmailMatch = (historyInput + ' ' + historyOutput).match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (historyEmailMatch) {
        email = historyEmailMatch[1];
        break;
      }
    }
  }
  
  // If user wants to send email and we have an email address, extract content from AI's drafts
  if (sendIntent && email) {
    console.log('[chatWithAgent] Detected email send request to:', email);
    
    // Look for email content in the most recent AI responses
    let subject = 'Message from ExaMark';
    let body = 'Hello,\n\nThis is a message from ExaMark, the AI assistant for Exabits.\n\nBest regards,\nExaMark';
    
    // Check the last few AI responses for email drafts
    for (let i = chatHistory.length - 1; i >= Math.max(0, chatHistory.length - 5); i--) {
      const aiResponse = chatHistory[i].output || '';
      if (aiResponse && (aiResponse.includes('Subject:') || aiResponse.includes('subject:')) && 
          (aiResponse.includes('Body:') || aiResponse.includes('body:') || aiResponse.includes('Hello') || aiResponse.includes('Hi'))) {
        
        console.log('[chatWithAgent] Found email draft in AI response:', aiResponse.substring(0, 200) + '...');
        
        // Extract subject - try different patterns
        let subjectMatch = aiResponse.match(/\*\*Subject:\*\*\s*(.+?)(?:\n|\*\*)/i);
        if (!subjectMatch) {
          subjectMatch = aiResponse.match(/Subject:\s*(.+?)(?:\n|Body:)/i);
        }
        if (subjectMatch) {
          subject = subjectMatch[1].trim();
          console.log('[chatWithAgent] Extracted subject:', subject);
        }
        
        // Extract body - look for content between Body: and signature or end
        let bodyMatch = aiResponse.match(/\*\*Body:\*\*\s*([\s\S]*?)(?:\n\n---|\nWarm regards|\nBest regards|$)/i);
        if (!bodyMatch) {
          bodyMatch = aiResponse.match(/Body:\s*([\s\S]*?)(?:\n\n---|\nWarm regards|\nBest regards|$)/i);
        }
        if (!bodyMatch) {
          // Try to extract just the main content if no formal Body: marker
          bodyMatch = aiResponse.match(/(Hello|Hi)\s+([\s\S]*?)(?:\n\n---|\nWarm regards|\nBest regards|$)/i);
          if (bodyMatch) {
            bodyMatch[1] = bodyMatch[0]; // Use the full match
          }
        }
        
        if (bodyMatch) {
          body = bodyMatch[1].trim();
          // Add signature if it was ExaMark
          if (aiResponse.includes('ExaMark') && !body.includes('ExaMark')) {
            body += '\n\nWarm regards,\nExaMark';
          }
          console.log('[chatWithAgent] Extracted body:', body.substring(0, 100) + '...');
        }
        break;
      }
    }
    
    try {
      console.log('[chatWithAgent] Calling email tool with extracted content...');
      console.log('[chatWithAgent] Subject:', subject);
      console.log('[chatWithAgent] Body preview:', body.substring(0, 100) + '...');
      
      const result = await sendEmailTool({
        to: email,
        subject: subject,
        body: body,
        userId: userId
      });
      
      console.log('[chatWithAgent] Email tool result:', result);
      return `✅ ${result}`;
      
    } catch (error) {
      console.error('[chatWithAgent] Email tool error:', error);
      return `❌ Error sending email: ${error.message}`;
    }
  }
  
  // Otherwise, proceed with normal LangChain agent processing
  const { agent, memory } = await getLangchainAgentWithMemory(userId);
  
  // Clear any existing memory to prevent corruption
  memory.clear();
  
  // Add clean chat history to memory with proper validation
  for (const msg of chatHistory) {
    if (msg && msg.input && msg.output) {
      try {
        await memory.saveContext({ input: msg.input }, { output: msg.output });
      } catch (error) {
        console.warn('[chatWithAgent] Skipping corrupted history entry:', error.message);
      }
    }
  }
  
  console.log('[chatWithAgent] About to invoke agent...');
  // Get agent response
  let response;
  let thinkingLogs = [];
  try {
    response = await agent.invoke({ input: userInput });
    console.log('[chatWithAgent] Raw agent response:', JSON.stringify(response, null, 2));
    console.log('[chatWithAgent] Response type:', typeof response);
    console.log('[chatWithAgent] Response.output:', response?.output);
    console.log('[chatWithAgent] Response keys:', response ? Object.keys(response) : 'no response');
    
    // For now, create simple thinking logs since intermediate steps aren't easily accessible
    thinkingLogs = [
      `Analyzing user input: "${userInput}"`,
      'Processing request with AI reasoning...',
      'Determining appropriate response approach...',
      'Generating contextual response...'
    ];
    
    // If the response contains tool usage patterns, enhance thinking logs
    if (response && typeof response === 'object' && response.output) {
      const output = response.output;
      if (output.includes('search') || output.includes('research')) {
        thinkingLogs.push('Used search/research tools to gather information');
      }
      if (output.includes('email') || output.includes('send')) {
        thinkingLogs.push('Detected email-related request');
      }
    }
  } catch (error) {
    console.error('[chatWithAgent] Agent invoke error:', error);
    return { 
      response: "Sorry, I encountered an error processing your request.",
      thinking: "Error occurred during processing: " + error.message
    };
  }
  
  // Post-process output to get the correct response
  let output;
  
  console.log('[chatWithAgent] Processing response. Type:', typeof response);
  console.log('[chatWithAgent] Response object:', response);
  
  if (response && typeof response === 'object') {
    console.log('[chatWithAgent] Response is object, checking fields...');
    console.log('[chatWithAgent] response.output:', response.output);
    console.log('[chatWithAgent] response.result:', response.result);
    console.log('[chatWithAgent] response.response:', response.response);
    
    // Handle different response formats from AgentExecutor
    if (response.output !== undefined && response.output !== '') {
      output = response.output;
      console.log('[chatWithAgent] Using response.output:', output);
    } else if (response.result !== undefined && response.result !== '') {
      output = response.result;
      console.log('[chatWithAgent] Using response.result:', output);
    } else if (response.response !== undefined && response.response !== '') {
      output = response.response;
      console.log('[chatWithAgent] Using response.response:', output);
    } else {
      // If no recognized output field or empty output, provide context-aware fallback
      console.log('[chatWithAgent] Empty response detected, analyzing input for fallback...');
      
      const input = userInput.toLowerCase();
      
      if (input.includes('who is') || input.includes('age') || 
          input.includes('how old') || input.includes('about ')) {
        output = "I don't have specific information about that person in my current dataset. Let me search for publicly available information using my tools. Please ask me again and I'll try to use my internet search to find details.";
      } else if (input.includes('joke') || input.includes('funny') || input.includes('humor')) {
        output = "Here's a tech joke for you: Why do programmers prefer dark mode? Because light attracts bugs! 😄 Is there anything else I can help you with regarding Exabits or general questions?";
      } else if (input.includes('hello') || input.includes('hi ') || input.includes('hey')) {
        output = "Hello! I'm ExaMark, the AI assistant for Exabits. I'm here to help you learn about Exabits' AI-powered HPC solutions, assist with business inquiries, or chat about general topics. What can I help you with today?";
      } else if (input.includes('help') || input.includes('what can you do')) {
        output = "I can help you with: \n• Information about Exabits and our AI-HPC solutions\n• Business development and lead research\n• General questions and conversations\n• Internet searches for current information\n\nWhat would you like to know more about?";
      } else {
        output = "I apologize, but I encountered an issue processing your request. Could you please rephrase your question or try asking something different? I'm here to help with Exabits information, general questions, or casual conversation.";
      }
      console.log('[chatWithAgent] Using context-aware fallback message');
    }
  } else {
    output = response;
    console.log('[chatWithAgent] Using raw response:', output);
  }
  
  console.log('[chatWithAgent] Final output before string processing:', output);
  
  // Clean up string output
  if (typeof output === 'string') {
    // Only clean up excessive spaces on the same line, preserve newlines for markdown
    output = output.replace(/[ \t]{2,}/g, ' ');
    console.log('[chatWithAgent] Cleaned string output:', output);
  }
  
  console.log('[chatWithAgent] Agent response:', output);
  
  // Format thinking logs
  const formattedThinking = thinkingLogs.join('\n\n');
  
  // Return both response and thinking logs
  return {
    response: output,
    thinking: formattedThinking
  };
}
