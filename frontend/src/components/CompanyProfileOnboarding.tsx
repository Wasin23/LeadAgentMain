'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  BuildingOfficeIcon, 
  DocumentTextIcon, 
  SparklesIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  CloudArrowUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import api from '../lib/api';

interface CompanyProfile {
  companyName: string;
  industry: string;
  services: string;
  targetMarket: string;
  companySize: string;
  description: string;
}

interface CompanyProfileOnboardingProps {
  onComplete: () => void;
}

export default function CompanyProfileOnboarding({ onComplete }: CompanyProfileOnboardingProps) {
  const [step, setStep] = useState<'welcome' | 'upload' | 'chat' | 'review' | 'complete'>('welcome');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [recommendedPreset, setRecommendedPreset] = useState<any>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Check scroll position
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
      setShowScrollButton(!isAtBottom);
    };

    chatContainer.addEventListener('scroll', handleScroll);
    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, [step]);

  const scrollToBottom = () => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth'
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsProcessing(true);

    try {
      const text = await file.text();
      setFileContent(text);
      
      // Send to backend for AI analysis
      const response = await api.post('/api/company-profile/analyze', {
        content: text,
        fileName: file.name
      });

      if (response.data.success) {
        setCompanyProfile(response.data.profile);
        setRecommendedPreset(response.data.recommendedPreset);
        setStep('review');
      }
    } catch (error: any) {
      console.error('Error analyzing file:', error);
      const errorMessage = error.response?.data?.error || 'Failed to analyze file. Please try the chat option instead.';
      alert(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!currentMessage.trim()) return;

    const userMessage = currentMessage;
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setCurrentMessage('');
    setIsProcessing(true);

    try {
      const response = await api.post('/api/company-profile/chat', {
        messages: [...chatMessages, { role: 'user', content: userMessage }]
      });

      if (response.data.success) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: response.data.message }]);
        
        // Check if profile is complete
        if (response.data.profileComplete) {
          setCompanyProfile(response.data.profile);
          setRecommendedPreset(response.data.recommendedPreset);
          setStep('review');
        }
      }
    } catch (error) {
      console.error('Error in chat:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!companyProfile) return;

    setIsProcessing(true);
    try {
      const response = await api.post('/api/company-profile/save', {
        profile: companyProfile,
        recommendedPreset
      });

      if (response.data.success) {
        setStep('complete');
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === 'welcome') {
    // Start with chat immediately
    setStep('chat');
    return null;
  }

  if (step === 'upload' || isProcessing) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-neutral-200 border-t-blue-600 mx-auto mb-6"></div>
          <h2 className="text-2xl font-semibold text-neutral-900 mb-2">
            Analyzing your company profile...
          </h2>
          <p className="text-neutral-600">
            Our AI is reading and understanding your document
          </p>
        </div>
      </div>
    );
  }

  if (step === 'chat') {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-neutral-200 px-6 py-4 shadow-sm flex-shrink-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <BuildingOfficeIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900">Company Profile Setup</h2>
                <p className="text-neutral-600 text-xs">AI-powered lead generation</p>
              </div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              style={{ background: 'linear-gradient(to right, #2563eb, #4f46e5)' }}
            >
              <CloudArrowUpIcon className="w-4 h-4" />
              Upload Company Info
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Chat Messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 relative">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Initial AI Message */}
            {chatMessages.length === 0 && (
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <SparklesIcon className="w-6 h-6 text-white" />
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl rounded-tl-none p-4 shadow-sm max-w-2xl">
                  <p className="text-neutral-900 leading-relaxed">
                    Hi! I'm here to help set up your lead agent. 
                    <br/><br/>
                    You can <strong>upload a document</strong> about your company using the button above, or just <strong>tell me about your business</strong> and I'll ask a few questions to understand who your ideal customers are.
                    <br/><br/>
                    Once we're done, I'll create a preset with recommended industries, company sizes, and job titles to target.
                    <br/><br/>
                    <strong>What's your company name and what do you do?</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Chat History */}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                    <SparklesIcon className="w-6 h-6 text-white" />
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="text-white font-semibold text-sm">You</span>
                  </div>
                )}
                <div className={`rounded-2xl p-4 shadow-sm max-w-2xl ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none' 
                    : 'bg-white border border-neutral-200 rounded-tl-none text-neutral-900'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <SparklesIcon className="w-6 h-6 text-white" />
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl rounded-tl-none p-4 shadow-sm">
                  <div className="flex gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Scroll to Bottom Button */}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-6 right-6 w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
            >
              <ChevronDownIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Input */}
        <div className="bg-white/80 backdrop-blur-sm border-t border-neutral-200 p-4 shadow-lg flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isProcessing && handleChatSubmit()}
                placeholder="Type your message here..."
                disabled={isProcessing}
                className="flex-1 px-4 py-3 border-2 border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-neutral-100 disabled:cursor-not-allowed transition-all shadow-sm"
              />
              <button
                onClick={handleChatSubmit}
                disabled={!currentMessage.trim() || isProcessing}
                className="px-6 py-3 text-white rounded-lg transition-all disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg"
                style={{ 
                  background: (!currentMessage.trim() || isProcessing) 
                    ? 'linear-gradient(to right, #60a5fa, #818cf8)' 
                    : 'linear-gradient(to right, #2563eb, #4f46e5)'
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="min-h-screen bg-neutral-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 text-white">
              <h2 className="text-3xl font-bold mb-2">Review Your Company Profile</h2>
              <p className="text-blue-100">Make sure everything looks good before we generate your agent presets</p>
            </div>

            <div className="p-8">
              {/* Company Profile */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-neutral-900 mb-4">Company Information</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-2">Company Name</label>
                    <input
                      type="text"
                      value={companyProfile?.companyName || ''}
                      onChange={(e) => setCompanyProfile(prev => prev ? {...prev, companyName: e.target.value} : null)}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-2">Industry</label>
                    <input
                      type="text"
                      value={companyProfile?.industry || ''}
                      onChange={(e) => setCompanyProfile(prev => prev ? {...prev, industry: e.target.value} : null)}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-600 mb-2">Services</label>
                    <textarea
                      value={companyProfile?.services || ''}
                      onChange={(e) => setCompanyProfile(prev => prev ? {...prev, services: e.target.value} : null)}
                      rows={3}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-2">Target Market</label>
                    <input
                      type="text"
                      value={companyProfile?.targetMarket || ''}
                      onChange={(e) => setCompanyProfile(prev => prev ? {...prev, targetMarket: e.target.value} : null)}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-2">Company Size</label>
                    <select
                      value={companyProfile?.companySize || ''}
                      onChange={(e) => setCompanyProfile(prev => prev ? {...prev, companySize: e.target.value} : null)}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="501+">501+ employees</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Recommended Preset */}
              {recommendedPreset && (
                <div className="mb-8 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <SparklesIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-semibold text-neutral-900 mb-2">AI-Generated Agent Preset</h3>
                      <p className="text-neutral-600 text-sm">Based on your company profile, we recommend these default settings for your lead agents</p>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div className="bg-white rounded-lg p-4">
                      <div className="text-xs font-medium text-neutral-600 mb-2">TARGET INDUSTRIES</div>
                      <div className="flex flex-wrap gap-2">
                        {recommendedPreset.targetIndustries?.map((ind: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {ind}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4">
                      <div className="text-xs font-medium text-neutral-600 mb-2">TARGET POSITIONS</div>
                      <div className="flex flex-wrap gap-2">
                        {recommendedPreset.targetPositions?.map((pos: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                            {pos}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4">
                      <div className="text-xs font-medium text-neutral-600 mb-2">COMPANY SIZE RANGE</div>
                      <div className="text-neutral-900 font-medium">{recommendedPreset.companySizeMin}-{recommendedPreset.companySizeMax} employees</div>
                    </div>
                    <div className="bg-white rounded-lg p-4">
                      <div className="text-xs font-medium text-neutral-600 mb-2">RECOMMENDED LEAD LIMIT</div>
                      <div className="text-neutral-900 font-medium">{recommendedPreset.leadLimit} leads per cycle</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4 justify-end">
                <button
                  onClick={() => setStep('welcome')}
                  className="px-6 py-3 border border-neutral-300 rounded-xl text-neutral-700 hover:bg-neutral-50 transition-colors font-medium"
                >
                  Start Over
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isProcessing}
                  className="px-8 py-3 text-white rounded-xl transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                  style={{ 
                    background: isProcessing 
                      ? 'linear-gradient(to right, #60a5fa, #818cf8)' 
                      : 'linear-gradient(to right, #2563eb, #4f46e5)'
                  }}
                >
                  <CheckCircleIcon className="w-5 h-5" />
                  Save & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-neutral-900 mb-4">
            Profile Created Successfully!
          </h2>
          <p className="text-neutral-600 mb-2">
            Your company profile has been saved and your agent presets are ready.
          </p>
          <p className="text-sm text-neutral-500">
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  return null;
}
