'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  PaperAirplaneIcon, 
  SparklesIcon, 
  UserIcon, 
  CpuChipIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  isLoading?: boolean;
  type?: 'text' | 'system' | 'error';
  thinking?: string; // AI's reasoning process
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hi! I'm your AI assistant specialized in lead research, email automation, and business intelligence. I can help you with lead generation strategies, email campaigns, data analysis, and more. What would you like to explore today?",
      isUser: false,
      timestamp: new Date(),
      type: 'text'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Scroll within the chat container, not the entire page
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    // Only scroll when AI responds (not when user sends)
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage.isUser) {
        scrollToBottom();
      }
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      isUser: true,
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue.trim();
    setInputValue('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      console.log('🚀 [CHAT] Sending message to backend:', currentInput);
      console.log('🚀 [CHAT] API URL:', api.defaults.baseURL);
      
      const response = await api.post('/api/chat', { 
        userInput: currentInput
      });
      
      console.log('✅ [CHAT] Backend response:', response.data);
      setIsTyping(false);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.data.response || response.data.message || 'I apologize, but I encountered an issue processing your request. Please try again.',
        isUser: false,
        timestamp: new Date(),
        type: 'text',
        thinking: response.data.thinking // Include AI reasoning if available
      };
      
      setMessages(prev => [...prev, aiMessage]);
      // Scroll to show AI response
      setTimeout(scrollToBottom, 100);
    } catch (error: any) {
      console.error('❌ [CHAT] Error calling backend:', error);
      console.error('❌ [CHAT] Error response:', error.response?.data);
      console.error('❌ [CHAT] Error status:', error.response?.status);
      console.error('❌ [CHAT] Full error:', error.message);
      
      setIsTyping(false);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Error: ${error.response?.data?.error || error.message || 'Unknown error'}. Status: ${error.response?.status || 'No status'}`,
        isUser: false,
        timestamp: new Date(),
        type: 'error'
      };
      
      setMessages(prev => [...prev, errorMessage]);
      // Scroll to show error message
      setTimeout(scrollToBottom, 100);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const clearChat = async () => {
    try {
      await api.post('/chat/clear', {});
      
      // Reset to initial state
      setMessages([
        {
          id: '1',
          content: "Hi! I'm your AI assistant specialized in lead research, email automation, and business intelligence. I can help you with lead generation strategies, email campaigns, data analysis, and more. What would you like to explore today?",
          isUser: false,
          timestamp: new Date(),
          type: 'text'
        }
      ]);
    } catch (error) {
      console.error('Failed to clear chat:', error);
    }
  };

  const quickActions = [
    { label: "Send a cold email", action: "Help me compose and send a cold email to a specific prospect" },
    { label: "Research company leads", action: "Research potential leads at a company and their contact information" },
    { label: "Email campaign analysis", action: "Analyze my recent email campaigns and provide insights" },
    { label: "Lead generation strategy", action: "Help me develop a lead generation strategy for my business" }
  ];

  return (
    <motion.div 
      className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[700px] overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <SparklesIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">AI Research Assistant</h3>
              <div className="flex items-center text-sm text-gray-500">
                <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                {isTyping ? 'Thinking...' : 'Ready to help'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-400 bg-white px-2 py-1 rounded">
              {messages.length - 1} messages
            </div>
            <button
              onClick={clearChat}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded transition-colors"
              title="Clear chat history"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6 space-y-6">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} gap-3`}
              >
                {!message.isUser && (
                  <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                    {message.type === 'error' ? (
                      <ExclamationCircleIcon className="h-4 w-4 text-white" />
                    ) : (
                      <CpuChipIcon className="h-4 w-4 text-white" />
                    )}
                  </div>
                )}
                
                <div className={`group max-w-[75%] ${message.isUser ? 'order-first' : ''}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl shadow-sm ${
                      message.isUser
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : message.type === 'error'
                        ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-md'
                        : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
                    }`}
                  >
                    {isTyping && message === messages[messages.length - 1] && !message.isUser ? (
                      <div className="flex items-center gap-1">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                          {message.isUser ? (
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          ) : (
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                // Custom styling for markdown elements
                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                                li: ({ children }) => <li className="mb-1">{children}</li>,
                                code: ({ children, className }) => {
                                  const isInline = !className;
                                  return isInline ? (
                                    <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                                  ) : (
                                    <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto my-2">
                                      <code className="text-xs font-mono">{children}</code>
                                    </pre>
                                  );
                                },
                                blockquote: ({ children }) => (
                                  <blockquote className="border-l-4 border-gray-300 pl-4 my-2 italic">{children}</blockquote>
                                ),
                                h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                em: ({ children }) => <em className="italic">{children}</em>,
                                a: ({ children, href }) => (
                                  <a href={href} className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">
                                    {children}
                                  </a>
                                ),
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          )}
                        </div>
                        {message.thinking && (
                          <details className="mt-3 text-xs">
                            <summary className="cursor-pointer text-gray-500 hover:text-gray-700 flex items-center gap-1">
                              <SparklesIcon className="h-3 w-3" />
                              AI Reasoning
                            </summary>
                            <div className="mt-2 p-2 bg-gray-50 rounded text-gray-600 whitespace-pre-wrap">
                              {message.thinking}
                            </div>
                          </details>
                        )}
                      </>
                    )}
                  </div>
                  <div className={`text-xs text-gray-400 mt-1 px-1 flex items-center gap-1 ${
                    message.isUser ? 'justify-end' : 'justify-start'
                  }`}>
                    <ClockIcon className="h-3 w-3" />
                    {formatTime(message.timestamp)}
                    {message.isUser && <CheckCircleIcon className="h-3 w-3 text-blue-400" />}
                  </div>
                </div>

                {message.isUser && (
                  <div className="h-8 w-8 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                    <UserIcon className="h-4 w-4 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 1 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="px-6 pb-6"
          >
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h4>
              <div className="grid grid-cols-1 gap-2">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => setInputValue(action.action)}
                    className="text-left px-3 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 border-t border-gray-200 bg-white">
        <form onSubmit={handleSend} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about lead research, email campaigns, analytics..."
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                disabled={isLoading}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <kbd className="hidden sm:inline-block px-2 py-1 text-xs text-gray-400 bg-gray-100 border border-gray-300 rounded">
                  ⏎
                </kbd>
              </div>
            </div>
            <motion.button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center shadow-sm"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <PaperAirplaneIcon className="h-5 w-5" />
              )}
            </motion.button>
          </div>
          
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center text-sm text-gray-500"
            >
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
              AI is processing your request...
            </motion.div>
          )}
        </form>
      </div>
    </motion.div>
  );
}