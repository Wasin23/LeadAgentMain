import 'dotenv/config';
import { DynamicStructuredTool } from "langchain/tools";
import { z } from "zod";
import { sendEmailTool } from "./lib/myEmailTool.js";

// Create the same email tool as in the main agent
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
      console.log('[EMAIL TOOL] ===== EXECUTION STARTED =====');
      console.log('[EMAIL TOOL] Called with parameters:', { to, subject, body: body?.substring(0, 100) + '...' });
      
      // Validate required fields
      if (!to || !subject || !body) {
        console.log('[EMAIL TOOL] Validation failed - missing fields');
        return "Error: All fields ('to', 'subject', 'body') are required.";
      }
      
      console.log('[EMAIL TOOL] About to call sendEmailTool...');
      // Call the email function
      const result = await sendEmailTool({ to, subject, body });
      console.log('[EMAIL TOOL] sendEmailTool result:', result);
      console.log('[EMAIL TOOL] ===== EXECUTION COMPLETED =====');
      return result;
    } catch (e) {
      console.error('[EMAIL TOOL] Error:', e);
      return `Error sending email: ${e.message}`;
    }
  },
});

async function testEmailTool() {
  console.log('[EMAIL TOOL TEST] Starting direct email tool test...');
  
  try {
    console.log('[EMAIL TOOL TEST] Testing with direct function call...');
    const testResult = await mailgunTool.func({
      to: 'colton.fidd@gmail.com',
      subject: 'Direct Tool Test',
      body: 'This is a direct test of the email tool to verify it works independently of LangChain'
    });
    console.log('[EMAIL TOOL TEST] Direct test result:', testResult);
    
    console.log('[EMAIL TOOL TEST] Test completed successfully!');
  } catch (error) {
    console.error('[EMAIL TOOL TEST] Direct test failed:', error);
    console.error('[EMAIL TOOL TEST] Error stack:', error.stack);
  }
}

// Run the test
testEmailTool();
