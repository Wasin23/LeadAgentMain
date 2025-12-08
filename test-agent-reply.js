import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "langchain/tools";
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { z } from "zod";

console.log('🧪 [TEST] Starting AI agent reply test...\n');

// Mock conversation history tool
const getConversationTool = new DynamicStructuredTool({
  name: "get_conversation_history",
  description: "Retrieve past conversation history for this email thread",
  schema: z.object({
    tracking_id: z.string().describe("Tracking ID for this conversation")
  }),
  func: async ({ tracking_id }) => {
    console.log(`\n📖 [TOOL EXECUTED] get_conversation_history called with: ${tracking_id}`);
    return JSON.stringify({
      history: [{
        role: 'assistant',
        content: 'Original outreach email sent',
        timestamp: new Date().toISOString()
      }],
      total_messages: 1
    });
  }
});

// Mock send email tool
const sendEmailTool = new DynamicStructuredTool({
  name: "send_email_reply",
  description: "Send an email reply to the lead",
  schema: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Email body content"),
    tracking_id: z.string().describe("Tracking ID for this conversation")
  }),
  func: async ({ to, subject, body, tracking_id }) => {
    console.log(`\n📧 [TOOL EXECUTED] send_email_reply called!`);
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${body.substring(0, 100)}...`);
    console.log(`   Tracking: ${tracking_id}`);
    return JSON.stringify({ success: true, message: 'Email sent successfully' });
  }
});

const tools = [getConversationTool, sendEmailTool];

// Create agent with same configuration as production
const model = new ChatOpenAI({
  temperature: 0.1,
  modelName: "gpt-4o-mini",
  openAIApiKey: process.env.OPENAI_API_KEY
});

const systemPrompt = `You are The Hunter, an AI email assistant.

CRITICAL PROTOCOL:
1. Use send_email_reply tool to actually send responses
2. Check conversation history first with get_conversation_history
3. Respond directly to the sender

Remember: You must send actual email replies.`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", systemPrompt],
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad")
]);

console.log('🔧 [TEST] Creating agent...');
const agent = await createOpenAIFunctionsAgent({
  llm: model,
  tools,
  prompt
});

console.log('🔧 [TEST] Creating agent executor...');
const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: true,
  maxIterations: 10,
  returnIntermediateSteps: true
});

const testInput = `You received an email:

From: colton.fidd@gmail.com
Subject: Re: Test Email
Message:
This is a test reply!

Tracking ID: test-tracking-123

REQUIRED ACTIONS (you MUST complete all steps):
1. Use get_conversation_history tool with tracking_id: test-tracking-123
2. After reviewing history, you MUST use send_email_reply tool to send your response
3. Do NOT stop after checking history - you MUST send a reply

This is mandatory - complete both steps.`;

console.log('\n📨 [TEST] Sending test input to agent...\n');
console.log('=' .repeat(80));

try {
  const result = await agentExecutor.call({
    input: testInput
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ [TEST] Agent execution completed!');
  console.log('\n📊 [TEST] Results:');
  console.log('Output:', result.output);
  console.log('Intermediate Steps:', result.intermediateSteps?.length || 0);
  
  if (result.intermediateSteps && result.intermediateSteps.length > 0) {
    console.log('\n🔍 [TEST] Steps taken:');
    result.intermediateSteps.forEach((step, i) => {
      console.log(`  ${i + 1}. Tool: ${step.action?.tool || 'unknown'}`);
      console.log(`     Input: ${JSON.stringify(step.action?.toolInput || {})}`);
      console.log(`     Output: ${step.observation?.substring(0, 100) || 'none'}...`);
    });
  } else {
    console.log('\n⚠️  [TEST] WARNING: No intermediate steps! Tools were not executed.');
  }
  
} catch (error) {
  console.error('\n❌ [TEST] Error:', error.message);
  console.error(error.stack);
}

console.log('\n🧪 [TEST] Test complete!\n');
