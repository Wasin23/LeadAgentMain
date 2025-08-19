import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { sendEmailTool } from "../lib/myEmailTool.js";

// Simple manual agent that bypasses LangChain's broken tool execution
export async function simpleAgentChat(userInput, chatHistory = []) {
  console.log('[SIMPLE AGENT] Called with input:', userInput);
  
  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    modelName: "gpt-4o",
  });

  // Build conversation context
  let conversation = `You are ExaMark, an AI assistant that can send emails. 

Available tools:
- send_email: Can send emails when user requests it

Chat history:
`;
  
  for (const msg of chatHistory) {
    conversation += `Human: ${msg.input}\nAI: ${msg.output}\n`;
  }
  
  conversation += `Human: ${userInput}\nAI: `;

  // Check if user wants to send an email by looking at recent conversation
  const sendIntent = userInput.toLowerCase().includes('send') || userInput.toLowerCase().includes('yes send');
  
  // Look for email in current input or recent history
  let email = null;
  const emailMatch = userInput.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    email = emailMatch[1];
  } else {
    // Check recent history for email address
    for (let i = chatHistory.length - 1; i >= Math.max(0, chatHistory.length - 3); i--) {
      const historyEmailMatch = chatHistory[i].input.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (historyEmailMatch) {
        email = historyEmailMatch[1];
        break;
      }
    }
  }
  
  // Check if this looks like a send request
  if (sendIntent && email) {
    console.log('[SIMPLE AGENT] Detected email send request to:', email);
    
    try {
      // Call the email tool directly
      console.log('[SIMPLE AGENT] Calling email tool...');
      const result = await sendEmailTool({
        to: email,
        subject: 'Test Email',
        body: 'This is a test email sent through the simple agent system.'
      });
      
      console.log('[SIMPLE AGENT] Email tool result:', result);
      return `✅ ${result}`;
      
    } catch (error) {
      console.error('[SIMPLE AGENT] Email tool error:', error);
      return `❌ Error sending email: ${error.message}`;
    }
  }
  
  // For non-email requests, use the LLM normally
  try {
    const response = await llm.invoke([{ role: "user", content: conversation }]);
    console.log('[SIMPLE AGENT] LLM response:', response.content);
    return response.content;
  } catch (error) {
    console.error('[SIMPLE AGENT] LLM error:', error);
    return "Sorry, I encountered an error processing your request.";
  }
}
