import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, initializeAgentExecutorWithOptions } from "langchain/agents";
import { DynamicTool, DynamicStructuredTool } from "langchain/tools";
import { z } from "zod";
import { internetSearch } from "../tools/internetSearch.js";
import { deepResearch } from "../tools/deepResearch.js";
import { sendEmailTool } from "../lib/myEmailTool.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { VectorStoreRetrieverMemory } from "langchain/memory";
import { BufferMemory } from "langchain/memory";
import { SystemMessage } from "@langchain/core/messages";
import { OpenAIEmbeddings } from "@langchain/openai";

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
// Wrap email tool as a LangChain tool
const mailgunTool = new DynamicStructuredTool({
  name: "send_email",
  description: "Send an email. Provide the recipient email, subject, and body content.",
  schema: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Email message content")
  }),
  func: async ({ to, subject, body }) => {
    try {
      console.log('[EMAIL TOOL] Received parameters:', { to, subject, body: body?.substring(0, 100) + '...' });
      
      // Validate required fields
      if (!to || !subject || !body) {
        console.log('[EMAIL TOOL] Validation failed - missing fields');
        return "Error: All fields ('to', 'subject', 'body') are required.";
      }
      
      // Call the email function
      const result = await sendEmailTool({ to, subject, body });
      console.log('[EMAIL TOOL] Result:', result);
      return result;
    } catch (e) {
      console.error('[EMAIL TOOL] Error:', e);
      return `Error sending email: ${e.message}`;
    }
  },
});

// Create the agent executor

// Returns an agent executor and memory instance
export async function getLangchainAgentWithMemory() {
  const tools = [serperTool, deepResearchTool, mailgunTool];
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const currentYear = new Date().getFullYear();
  
  const systemPrompt = `You are ExaMark, the official AI chatbot for Exabits. Your primary role is to provide comprehensive, empathetic, and contextually relevant answers about Exabits and assist with general inquiries.

**YOUR IDENTITY:**
* You are ExaMark, developed specifically for Exabits
* You are the official Exabits chatbot and virtual assistant
* You possess deep expertise about Exabits, its mission, founders, operations, and services
* You represent Exabits professionally and knowledgeably in all interactions

**ABOUT EXABITS:**
You are a **total expert on Exabits**, the company. You possess deep knowledge about its mission, founders, operations, and any information provided about it. Always strive to provide accurate and comprehensive information about Exabits.

**CURRENT CONTEXT:**
* Today's date: ${currentDate}
* Current year: ${currentYear}
* You have access to information up to ${currentYear} and should reference current events and trends accordingly.

**RESEARCH TOOLS AVAILABLE:**
- internet_search: Quick web searches using Serper API for simple factual lookups
- deep_research: Comprehensive research with query expansion, multi-source analysis, deduplication, and structured reporting with citations
- send_email: Send emails via Mailgun

**RESEARCH STRATEGY:**
- For comprehensive research topics (investors, funding, market analysis, competitive research, industry trends), use the deep_research tool
- Use deep_research with mode "fresh" for recent developments, "academic" for research papers, "product" for technical documentation  
- Use internet_search for simple factual lookups or quick searches
- The deep_research tool automatically expands queries, searches multiple sources, deduplicates results, and provides structured briefs with citations

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

**EXABITS KNOWLEDGE:**
* Founders: Hoansoo Lee and Zachary Bright.
* Founded: 2021
* Headquarters: San Mateo, United States.
* Core Business: AI-powered HPC (High-Performance Computing) solutions provider.
* Zachary Bright's background: Education from Princeton University, listed as a builder at Exabits on LinkedIn.
* Hoansoo Lee's background: Has given a presentation on AI computation (found on YouTube).
* **Exabits Key Advantage 1 (over general cloud providers like AWS/GCP): Specialization in AI-powered HPC means optimized infrastructure, dedicated hardware (e.g., custom interconnects, specific GPU configurations), and expertise for demanding AI/ML and scientific computing workloads, often leading to better performance per dollar for these specific tasks.**
* **Exabits Key Advantage 2: Potentially lower latency and higher throughput for specific HPC tasks due to purpose-built architecture vs. general-purpose cloud.**
* **Exabits Key Advantage 3: More tailored support and expertise for complex HPC deployments, whereas major cloud providers offer broader but less specialized support in this niche.**
* **H100 GPU:** The NVIDIA H100 is an advanced GPU for AI training and HPC, featuring powerful Tensor Cores and a large memory capacity (e.g., 80GB HBM3).
* **H200 GPU:** The NVIDIA H200 is the successor to the H100, primarily distinguished by its significantly larger and faster HBM3e memory. It typically boasts 141GB of HBM3e memory with a bandwidth of 4.8 TB/s (compared to H100's 80GB at 3.35 TB/s), making it exceptionally performant for large language model inference and memory-bound HPC workloads.
* **Key Difference H100 vs H200:** The H200's primary advantage is its expanded and faster HBM3e memory, which is crucial for applications demanding massive memory bandwidth, particularly the inference phase of very large AI models. While H100 remains excellent for training, H200 pushes the memory envelope further for larger models and data sets.`;

  console.log('[LANGCHAIN AGENT] System prompt being used:', systemPrompt.substring(0, 200) + '...');

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    modelName: "gpt-4o",
  });

  // Use BufferMemory for reliable chat history
  const memory = new BufferMemory({
    memoryKey: "chat_history",
    returnMessages: true,
  });

  const agent = await initializeAgentExecutorWithOptions(tools, llm, {
    agentType: "openai-functions",
    verbose: true,
    memory,
    systemMessage: systemPrompt,
  });
  return { agent, memory };
}

// Handles a chat turn, updates memory, and returns agent response
export async function chatWithAgent(userInput, chatHistory = []) {
  console.log('[chatWithAgent] Called with input:', userInput);
  const { agent, memory } = await getLangchainAgentWithMemory();
  
  // Add previous history to memory
  for (const msg of chatHistory) {
    await memory.saveContext({ input: msg.input }, { output: msg.output });
  }
  
  console.log('[chatWithAgent] About to call agent...');
  // Get agent response
  let response = await agent.call({ input: userInput });
  
  // Post-process output to clean up the response
  let output = response.output || response;
  if (typeof output === 'string') {
    output = output.replace(/\s{2,}/g, ' ').trim();
  }
  
  console.log('[chatWithAgent] Agent response:', output);
  return output;
}
