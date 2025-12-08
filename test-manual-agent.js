import dotenv from 'dotenv';
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "langchain/tools";
import { z } from "zod";

dotenv.config();

console.log('🧪 [TEST] Testing manual AI agent execution...\n');

// Mock conversation history tool
const getConversationTool = new DynamicStructuredTool({
  name: "get_conversation_history",
  description: "Retrieve past conversation history",
  schema: z.object({
    tracking_id: z.string()
  }),
  func: async ({ tracking_id }) => {
    console.log(`📖 [TOOL] get_conversation_history called with: ${tracking_id}`);
    return JSON.stringify({
      history: [
        {role: 'assistant', content: 'Original outreach email', timestamp: new Date().toISOString()}
      ],
      total_messages: 1,
      message: "Found 1 previous message"
    });
  }
});

// Mock send email tool
const sendEmailTool = new DynamicStructuredTool({
  name: "send_email_reply",
  description: "Send an email reply",
  schema: z.object({
    tracking_id: z.string(),
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    in_reply_to: z.string().optional(),
    references: z.string().optional()
  }),
  func: async ({ to, subject, body, tracking_id }) => {
    console.log(`📧 [TOOL] send_email_reply called!`);
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${body.substring(0, 100)}...`);
    return JSON.stringify({ success: true, message: 'Email sent to ' + to });
  }
});

// Run test
(async () => {
  try {
    console.log('🔧 [STEP 1] Getting conversation history...');
    const historyResult = await getConversationTool.func({ tracking_id: 'test-123' });
    const history = JSON.parse(historyResult);
    console.log(`✅ Retrieved ${history.total_messages} messages\n`);
    
    console.log('🤖 [STEP 2] Generating AI response...');
    const model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY
    });
    
    const responsePrompt = `You received an email from colton.fidd@gmail.com:

Subject: Re: Test
Message: Hey, I'm interested! Tell me more.

Conversation history: ${history.message}

Write a brief professional response. Focus on scheduling a meeting.`;

    const llmResponse = await model.invoke([
      { role: "system", content: "You are a helpful sales assistant." },
      { role: "user", content: responsePrompt }
    ]);
    
    const responseBody = llmResponse.content;
    console.log(`✅ Generated response (${responseBody.length} chars)\n`);
    
    console.log('📧 [STEP 3] Sending email...');
    const sendResult = await sendEmailTool.func({
      tracking_id: 'test-123',
      to: 'colton.fidd@gmail.com',
      subject: 'Re: Test',
      body: responseBody,
      in_reply_to: '<test@domain.com>',
      references: '<test@domain.com>'
    });
    
    const sendData = JSON.parse(sendResult);
    console.log(`✅ ${sendData.message}\n`);
    
    console.log('🎉 [TEST] SUCCESS - All steps completed!');
    console.log('   ✓ Got conversation history');
    console.log('   ✓ Generated AI response');
    console.log('   ✓ Sent email reply');
    
  } catch (error) {
    console.error('\n❌ [TEST] Error:', error.message);
    console.error(error.stack);
  }
})();
