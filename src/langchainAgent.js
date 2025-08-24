import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { DynamicTool } from "langchain/tools";
import { internetSearch } from "../tools/internetSearch.js";
import { deepResearch } from "../tools/deepResearch.js";
import { sendEmailTool } from "../lib/myEmailTool.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { VectorStoreRetrieverMemory } from "langchain/memory";
import { BufferMemory } from "langchain/memory";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

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
    return JSON.stringify(await internetSearch(query));
  },
});

// Wrap deep research as a LangChain tool
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
      const result = await deepResearch(query, options);
      return JSON.stringify(result);
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
});

// Wrap email sending as a LangChain tool
// REMOVED - LangChain tool execution is broken, using manual detection instead

// Create the agent executor

// Returns an agent executor and memory instance
export async function getLangchainAgentWithMemory() {
  const tools = [serperTool, deepResearchTool];
  console.log('[LANGCHAIN AGENT] Tools registered:', tools.map(t => t.name));
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const currentYear = new Date().getFullYear();
  
  const systemPrompt = `You are ExaMark, the official AI chatbot for Exabits. Your primary role is to provide comprehensive, empathetic, and contextually relevant answers about Exabits and assist with general inquiries.

**CRITICAL INSTRUCTION: NEVER give generic or vague responses about Exabits. ALWAYS use the specific information provided below. If asked about Exabits, provide concrete details, not marketing fluff.**

**YOUR IDENTITY:**
* You are ExaMark, developed specifically for Exabits
* You are the official Exabits chatbot and virtual assistant
* You possess deep expertise about Exabits, its mission, founders, operations, and services
* You represent Exabits professionally and knowledgeably in all interactions
* You MUST provide specific, factual information about Exabits, not generic tech company descriptions

**ABOUT EXABITS:**
You are a **total expert on Exabits**, the company. You possess deep knowledge about its mission, founders, operations, and any information provided about it. Always strive to provide accurate and comprehensive information about Exabits. Link to exabits is exabits.ai

## 🏢 **EXABITS COMPANY PROFILE**

### **📋 Company Overview**
- **Company Name:** Exabits
- **Founded:** 2021
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

**LEAD GENERATION EXPERTISE:**
When using lead search mode, you excel at identifying potential Exabits clients by:
- Finding technology companies that would benefit from AI infrastructure
- Identifying decision makers (CTOs, VPs of Engineering, AI/ML leaders)
- Analyzing company profiles for AI readiness and budget potential
- Suggesting specific AI use cases and automation opportunities
- Prioritizing leads based on company size, funding, and technology adoption

**Core Principles for Thought & Response Generation:**
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

  console.log('[LANGCHAIN AGENT] System prompt being used (first 500 chars):', systemPrompt.substring(0, 500));
  console.log('[LANGCHAIN AGENT] Contains CRITICAL INSTRUCTION?:', systemPrompt.includes('CRITICAL INSTRUCTION'));
  console.log('[LANGCHAIN AGENT] Contains superhero prevention?:', systemPrompt.includes('superhero'));

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    modelName: "gpt-4o",
    // Remove streaming: false to test if this was breaking tool execution
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
  
  const agent = await createOpenAIFunctionsAgent({
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
export async function chatWithAgent(userInput, chatHistory = []) {
  console.log('[chatWithAgent] Called with input:', userInput);
  
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
        body: body
      });
      
      console.log('[chatWithAgent] Email tool result:', result);
      return `✅ ${result}`;
      
    } catch (error) {
      console.error('[chatWithAgent] Email tool error:', error);
      return `❌ Error sending email: ${error.message}`;
    }
  }
  
  // Otherwise, proceed with normal LangChain agent processing
  const { agent, memory } = await getLangchainAgentWithMemory();
  
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
  try {
    response = await agent.invoke({ input: userInput });
    console.log('[chatWithAgent] Raw agent response:', JSON.stringify(response, null, 2));
    console.log('[chatWithAgent] Response type:', typeof response);
    console.log('[chatWithAgent] Response.output:', response?.output);
    console.log('[chatWithAgent] Response keys:', response ? Object.keys(response) : 'no response');
  } catch (error) {
    console.error('[chatWithAgent] Agent invoke error:', error);
    return "Sorry, I encountered an error processing your request.";
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
      // If no recognized output field, return a generic message
      output = "I apologize, but I encountered an issue processing your request.";
      console.log('[chatWithAgent] Using fallback message');
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
  return output;
}
