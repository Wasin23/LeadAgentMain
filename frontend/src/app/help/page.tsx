'use client';

import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Edit2, Check, RotateCcw } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function HelpPage() {
  const [showContactForm, setShowContactForm] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your Meridian AI assistant. I can help you understand how to use the platform, manage your agents, and answer questions about outreach campaigns. What would you like to know?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post('/api/help/chat', {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        newMessage: userMessage.content
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditContent(content);
  };

  const handleSaveEdit = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const updatedMessages = [...messages];
    updatedMessages[messageIndex].content = editContent;

    const newMessages = updatedMessages.slice(0, messageIndex + 1);
    setMessages(newMessages);
    setEditingMessageId(null);

    if (updatedMessages[messageIndex].role === 'user') {
      setIsLoading(true);
      try {
        const response = await api.post('/api/help/chat', {
          messages: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
          newMessage: editContent
        });

        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.data.message,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
      } catch (error) {
        console.error('Error regenerating response:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      await api.post('/api/help/contact', formData);
      setSent(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setSent(false), 5000);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="absolute inset-0 flex flex-col px-6 py-6">
        <div className="mb-4 flex-shrink-0">
          <h1 className="text-3xl font-bold text-white mb-2">Help & Support</h1>
          <p className="text-[#8FA6C1] text-base">Ask me anything about Meridian!</p>
        </div>

        {!showContactForm ? (
          /* Chatbot Interface */
          <div className="flex-1 flex flex-col min-h-0 pb-6">
            <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg flex-1 flex flex-col min-h-0 shadow-xl w-full">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg p-4 ${
                        message.role === 'user'
                          ? 'bg-[#4FD1FF] text-[#0A1525]'
                          : 'bg-[#0A1525]/80 text-white border border-[#4FD1FF]/20'
                      }`}
                    >
                      {editingMessageId === message.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full px-2 py-1 bg-[#0A1525]/80 border border-[#4FD1FF]/20 rounded text-white text-sm resize-none"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(message.id)}
                              className="p-1 hover:bg-green-500/20 rounded"
                            >
                              <Check className="w-4 h-4 text-green-400" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1 hover:bg-red-500/20 rounded"
                            >
                              <RotateCcw className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative group">
                          <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                          {message.role === 'user' && (
                            <button
                              onClick={() => handleEdit(message.id, message.content)}
                              className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      <div className={`text-xs mt-1 ${message.role === 'user' ? 'text-[#0A1525]/60' : 'text-[#8FA6C1]/60'}`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[#0A1525]/80 text-white border border-[#4FD1FF]/20 rounded-lg p-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-[#4FD1FF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-[#4FD1FF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-[#4FD1FF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-[#4FD1FF]/20 p-6 flex-shrink-0">
                <div className="flex gap-3">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything..."
                    rows={3}
                    className="flex-1 px-4 py-3 bg-[#0A1525]/80 border border-[#4FD1FF]/20 rounded text-white text-sm resize-none focus:outline-none focus:border-[#4FD1FF]/40"
                  />
                  <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="px-6 py-3 bg-[#4FD1FF] hover:bg-[#4FD1FF]/80 disabled:bg-[#4FD1FF]/40 text-[#0A1525] rounded transition-colors self-end flex items-center justify-center"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setShowContactForm(true)}
                    className="text-sm text-[#4FD1FF] hover:text-[#4FD1FF]/80 underline"
                  >
                    Need more help? Contact us directly
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Contact Form */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Contact Us</h2>
                <button
                  onClick={() => setShowContactForm(false)}
                  className="text-sm text-[#8FA6C1] hover:text-white"
                >
                  ← Back to chat
                </button>
              </div>
            
            {sent && (
              <div className="mb-4 p-3 bg-green-500/20 border border-green-500/40 rounded text-green-400 text-sm">
                Message sent successfully! We'll get back to you soon.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#8FA6C1] mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[#0A1525]/80 border border-[#4FD1FF]/20 rounded text-white text-sm focus:outline-none focus:border-[#4FD1FF]/40"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8FA6C1] mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[#0A1525]/80 border border-[#4FD1FF]/20 rounded text-white text-sm focus:outline-none focus:border-[#4FD1FF]/40"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8FA6C1] mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[#0A1525]/80 border border-[#4FD1FF]/20 rounded text-white text-sm focus:outline-none focus:border-[#4FD1FF]/40"
                  placeholder="How can we help?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8FA6C1] mb-1">
                  Message
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  rows={6}
                  className="w-full px-3 py-2 bg-[#0A1525]/80 border border-[#4FD1FF]/20 rounded text-white text-sm focus:outline-none focus:border-[#4FD1FF]/40 resize-none"
                  placeholder="Tell us more about your question or issue..."
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full px-4 py-2 bg-[#4FD1FF] hover:bg-[#4FD1FF]/80 disabled:bg-[#4FD1FF]/40 text-[#0A1525] font-semibold rounded transition-colors"
              >
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>

          {/* FAQ & Resources */}
          <div className="space-y-6">
            <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Quick Help</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Getting Started</h3>
                  <p className="text-xs text-[#8FA6C1]">
                    Create agents in the Agents tab, configure their personalities, and start building your outreach campaigns.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Managing Agents</h3>
                  <p className="text-xs text-[#8FA6C1]">
                    Each agent can have a unique personality type. Visit the Agents page to create, edit, or delete agents.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Email Operations</h3>
                  <p className="text-xs text-[#8FA6C1]">
                    View queued, sent, and replied emails in the Operations tab. You can edit emails before they are sent.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Analytics</h3>
                  <p className="text-xs text-[#8FA6C1]">
                    Track your outreach performance with detailed analytics on the Dashboard page.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Contact Information</h2>
              <div className="space-y-3 text-sm text-[#8FA6C1]">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>support@meridian.ai</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Response time: 24-48 hours</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </AppLayout>
  );
}
