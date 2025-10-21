import { NextRequest, NextResponse } from 'next/server';
import { chatWithAgent } from '../../../../../src/langchainAgent.js';

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Convert history to the format expected by chatWithAgent
    const chatHistory = history?.map((msg: any) => ({
      input: msg.role === 'user' ? msg.content : '',
      output: msg.role === 'assistant' ? msg.content : ''
    })).filter((item: any) => item.input || item.output) || [];

    // Call the extended langchainAgent with admin tools
    // Pass null for userId to use default admin context
    const result = await chatWithAgent(message, chatHistory, null);

    // Handle both string and object responses
    let response: string;
    let thinking = '';
    
    if (typeof result === 'object' && result !== null) {
      response = (result as any).response || (result as any).output || 'No response generated';
      thinking = (result as any).thinking || '';
    } else {
      response = String(result) || 'No response generated';
    }

    return NextResponse.json({
      response,
      thinking,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Admin Chat API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
