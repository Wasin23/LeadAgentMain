'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  BuildingOfficeIcon, 
  CheckCircleIcon,
  CloudArrowUpIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import api from '../lib/api';
import AdminChatbot from './AdminChatbot';
import UserMenu from './UserMenu';

interface CompanyProfile {
  companyName: string;
  industry: string;
  services: string;
  targetMarket: string;
  companySize: string;
  description: string;
  logo: string;
  website: string;
  linkedinProfile: string;
  location: string;
  phone: string;
  email: string;
  tagline: string;
  founded: string;
  employees: string;
  coreOffering: string;
  keyAdvantages: string;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
}

interface CompanyProfileOnboardingProps {
  onComplete: () => void;
}

// Define all questions in order with step groupings
const questions = [
  // Step 1: Basic Info (4 questions)
  { id: 'companyName', question: "What's your company name?", placeholder: 'e.g., Acme Corp', type: 'text', required: true, step: 1 },
  { id: 'tagline', question: "What's your company tagline?", placeholder: 'A brief, memorable phrase', type: 'text', step: 1 },
  { id: 'description', question: "Tell us about your company", placeholder: 'Describe what your company does...', type: 'textarea', step: 1 },
  { id: 'industry', question: "What industry are you in?", placeholder: 'e.g., Technology, Healthcare', type: 'text', required: true, step: 1 },
  
  // Step 2: Contact Info (4 questions)
  { id: 'website', question: "What's your website?", placeholder: 'https://yourcompany.com', type: 'url', step: 2 },
  { id: 'linkedinProfile', question: "LinkedIn profile?", placeholder: 'https://linkedin.com/company/...', type: 'url', step: 2 },
  { id: 'email', question: "Contact email?", placeholder: 'contact@company.com', type: 'email', step: 2 },
  { id: 'phone', question: "Phone number?", placeholder: '+1 (555) 000-0000', type: 'tel', step: 2 },
  
  // Step 3: Company Details (4 questions)
  { id: 'location', question: "Where are you based?", placeholder: 'City, Country', type: 'text', step: 3 },
  { id: 'founded', question: "When was your company founded?", placeholder: '2020', type: 'text', step: 3 },
  { id: 'employees', question: "How many employees?", placeholder: '25', type: 'text', step: 3 },
  { id: 'companySize', question: "Company size range?", placeholder: '', type: 'select', options: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'], step: 3 },
  
  // Step 4: Market & Offering (4 questions)
  { id: 'targetMarket', question: "Who's your target market?", placeholder: 'e.g., B2B SaaS companies', type: 'text', step: 4 },
  { id: 'services', question: "What services or products do you offer?", placeholder: 'Describe your offerings...', type: 'textarea', required: true, step: 4 },
  { id: 'coreOffering', question: "What's your core offering?", placeholder: 'e.g., AI-powered platform', type: 'text', step: 4 },
  { id: 'keyAdvantages', question: "What makes you different?", placeholder: 'Your key advantages', type: 'text', step: 4 },
];

const steps = [
  { number: 1, title: 'Basic Info' },
  { number: 2, title: 'Contact' },
  { number: 3, title: 'Details' },
  { number: 4, title: 'Market' },
];

export default function CompanyProfileOnboarding({ onComplete }: CompanyProfileOnboardingProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [profile, setProfile] = useState<CompanyProfile>({
    companyName: '',
    industry: '',
    services: '',
    targetMarket: '',
    companySize: '',
    description: '',
    logo: '',
    website: '',
    linkedinProfile: '',
    location: '',
    phone: '',
    email: '',
    tagline: '',
    founded: '',
    employees: '',
    coreOffering: '',
    keyAdvantages: '',
    termsAccepted: false
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  // Auto-dismiss notifications after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setNotification({ message, type });
  };

  // Auto-focus input when question changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentQuestionIndex]);

  // Typing animation effect
  const animateTyping = async (text: string, field: string) => {
    setIsAnimating(true);
    let currentText = '';
    for (let i = 0; i < text.length; i++) {
      currentText += text[i];
      setProfile(prev => ({ ...prev, [field]: currentText }));
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    setIsAnimating(false);
  };

  // Animate through all fields when AI extracts data
  const animateThroughFields = async (extractedProfile: Partial<CompanyProfile>) => {
    setShowUploadOptions(false);
    setIsAnimating(true);
    
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const value = extractedProfile[q.id as keyof CompanyProfile];
      
      if (value && typeof value === 'string') {
        setCurrentQuestionIndex(i);
        await new Promise(resolve => setTimeout(resolve, 300));
        await animateTyping(value, q.id);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setIsAnimating(false);
    // Show review screen after animation completes
    setShowReview(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsProcessing(true);

    try {
      let content = '';
      const isImage = file.type.startsWith('image/');
      
      if (isImage) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        content = await base64Promise;
      } else {
        content = await file.text();
      }
      
      const response = await api.post('/api/company-profile/analyze', {
        content: content,
        fileName: file.name,
        isImage: isImage
      });

      if (response.data.success && response.data.profile) {
        await animateThroughFields(response.data.profile);
        showNotification('Document analyzed successfully!', 'success');
      }
    } catch (error: any) {
      console.error('Error analyzing file:', error);
      showNotification('Failed to analyze file. Please fill out the form manually.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWebsiteScrape = async () => {
    if (!websiteUrl.trim()) {
      showNotification('Please enter a website URL', 'error');
      return;
    }

    // Add https:// if no protocol is specified
    let formattedUrl = websiteUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    setIsProcessing(true);
    try {
      const response = await api.post('/api/company-profile/scrape-website', {
        url: formattedUrl
      });

      if (response.data.success && response.data.profile) {
        await animateThroughFields(response.data.profile);
        showNotification('Website scraped successfully!', 'success');
      }
    } catch (error: any) {
      console.error('Error scraping website:', error);
      showNotification('Failed to scrape website. Please fill out the form manually.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNext = () => {
    if (currentQuestion.required && !profile[currentQuestion.id as keyof CompanyProfile]) {
      showNotification(`${currentQuestion.question} is required`, 'error');
      return;
    }
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Show review screen after last question
      setShowReview(true);
    }
  };

  const handleBack = () => {
    if (showUploadOptions) {
      // Can't go back from upload screen
      return;
    }
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else {
      // If at first question, go back to upload options
      setShowUploadOptions(true);
    }
  };

  const handleSave = async () => {
    if (!profile.companyName || !profile.industry || !profile.services) {
      showNotification('Please fill out at least Company Name, Industry, and Services', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await api.post('/api/company-profile/save', {
        profile,
        recommendedPreset: null
      });

      if (response.data.success) {
        showNotification('Profile saved successfully!', 'success');
        setTimeout(() => onComplete(), 1000);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      showNotification('Failed to save profile. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  return (
    <>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        .animate-slide-in { animation: slideInLeft 0.4s ease-out; }
        .animate-pulse { animation: pulse 2s ease-in-out infinite; }
      `}</style>
      
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-8 right-8 z-[9999] px-6 py-4 rounded-2xl shadow-2xl animate-fade-in ${
          notification.type === 'error' ? 'bg-red-500 text-white' :
          notification.type === 'success' ? 'bg-green-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {notification.type === 'error' ? '⚠️' : notification.type === 'success' ? '✓' : 'ℹ️'}
            </span>
            <span className="font-semibold">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-4 text-white/80 hover:text-white">✕</button>
          </div>
        </div>
      )}
      
      {/* Meridian Logo and Title */}
      <div className="fixed top-8 left-8 z-50 flex items-center gap-3">
        <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-lg">
          <defs>
            <linearGradient id="globeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: 'rgb(59, 130, 246)', stopOpacity: 1 }} />
              <stop offset="50%" style={{ stopColor: 'rgb(168, 85, 247)', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: 'rgb(236, 72, 153)', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          
          {/* Globe circle */}
          <circle cx="24" cy="24" r="20" fill="white"/>
          
          {/* Vertical meridian lines */}
          <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="url(#globeGradient)" strokeWidth="1"/>
          <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="url(#globeGradient)" strokeWidth="1"/>
          <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="url(#globeGradient)" strokeWidth="1"/>
          
          {/* Horizontal latitude lines */}
          <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="url(#globeGradient)" strokeWidth="1"/>
          <ellipse cx="24" cy="24" rx="20" ry="16" fill="none" stroke="url(#globeGradient)" strokeWidth="1"/>
          <line x1="4" y1="24" x2="44" y2="24" stroke="url(#globeGradient)" strokeWidth="1"/>
        </svg>
        <h1 className="text-3xl font-bold text-white drop-shadow-lg">Meridian</h1>
      </div>

      {/* User Menu in Top Right */}
      <div className="fixed top-8 right-8 z-50">
        <div className="[&_button]:!bg-white/20 [&_button]:hover:!bg-white/30 [&_button]:!text-white [&_button]:backdrop-blur-sm [&_button]:rounded-xl [&_div>div>div:nth-child(2)_button]:!text-neutral-900 [&_div>div>div:nth-child(2)_button]:hover:!bg-neutral-50 [&_div>div>div:nth-child(3)_button]:!text-red-600 [&_div>div>div:nth-child(3)_button]:hover:!bg-red-50">
          <UserMenu />
        </div>
      </div>
      
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header with big colorful title */}
          <div className="text-center mb-12 animate-fade-in">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <BuildingOfficeIcon className="w-12 h-12 text-purple-600" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">Let's Build Your Profile!</h1>
            <p className="text-xl text-white/90">Tell us about your awesome company</p>
          </div>

          {/* Progress bar - colorful and prominent */}
          <div className="mb-12 bg-white/20 backdrop-blur-lg rounded-3xl p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-center gap-3">
              {steps.map((step, index) => {
                const currentStep = questions[currentQuestionIndex].step;
                const isCompleted = currentStep > step.number;
                const isCurrent = currentStep === step.number;
                
                return (
                  <div key={index} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div 
                        className={`w-16 h-16 rounded-full flex items-center justify-center font-bold transition-all ${
                          isCurrent 
                            ? 'bg-white text-purple-600 scale-110 shadow-lg' 
                            : isCompleted 
                            ? 'bg-green-400 text-white' 
                            : 'bg-white/30 text-white/60'
                        }`}
                      >
                        {isCompleted ? '✓' : step.number}
                      </div>
                      <span className={`text-xs mt-2 font-semibold ${isCurrent || isCompleted ? 'text-white' : 'text-white/60'}`}>
                        {step.title}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div 
                        className={`w-12 h-1 mx-2 rounded transition-all ${
                          isCompleted ? 'bg-green-400' : 'bg-white/30'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upload Options - Show at beginning */}
          {showUploadOptions && currentQuestionIndex === 0 && (
            <div className="mb-12 animate-slide-in">
              <div className="grid grid-cols-2 gap-6">
                {/* Upload Document */}
                <div 
                  className="bg-white rounded-3xl p-8 text-center hover:scale-105 transition-transform cursor-pointer shadow-2xl"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CloudArrowUpIcon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">Upload Document</h3>
                  <p className="text-neutral-600 mb-4">PDF, Word, or Image</p>
                  {uploadedFileName ? (
                    <div className="text-sm text-green-600 font-semibold">✓ {uploadedFileName}</div>
                  ) : (
                    <div className="text-sm text-neutral-400">Click to choose file</div>
                  )}
                  <input ref={fileInputRef} type="file" accept=".pdf,.txt,.doc,.docx,.md,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
                </div>

                {/* Website Scraper */}
                <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <GlobeAltIcon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">Extract from Website</h3>
                  <p className="text-neutral-600 mb-4">Paste your company URL</p>
                  <input 
                    type="url" 
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourcompany.com"
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl text-sm mb-3 text-center focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <button 
                    onClick={handleWebsiteScrape} 
                    disabled={isProcessing}
                    className="w-full px-4 py-3 text-purple-600 font-semibold hover:bg-purple-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded-xl border-2 border-purple-200"
                  >
                    {isProcessing && (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isProcessing ? 'Extracting...' : 'Extract Info →'}
                  </button>
                </div>
              </div>
              
              <div className="text-center mt-8">
                <button 
                  onClick={() => setShowUploadOptions(false)}
                  className="px-8 py-4 text-white font-bold text-lg hover:text-white/80 transition-all"
                >
                  or Fill Out Manually →
                </button>
              </div>
            </div>
          )}

          {/* Review Screen - Show all fields for editing */}
          {showReview && (
            <div className="bg-white rounded-3xl p-10 shadow-2xl animate-slide-in">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                  <CheckCircleIcon className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-4xl font-bold text-neutral-900 mb-2">Review Your Profile</h2>
                <p className="text-lg text-neutral-600">Make any final edits before saving</p>
              </div>

              {/* Warning Message */}
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-6 mb-8">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">⚠️</span>
                  <div>
                    <h3 className="text-lg font-bold text-yellow-900 mb-2">Please Review Carefully!</h3>
                    <p className="text-yellow-800">
                      Double-check all fields below and fill out any that are empty. Some fields may not have been extracted automatically. 
                      Make sure all important information is accurate and complete before saving.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {questions.map((question) => {
                const fieldValue = profile[question.id as keyof CompanyProfile];
                  const isEmpty = !fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '');
                  
                  return (
                    <div key={question.id} className="text-left">
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        {question.question}
                        {question.required && <span className="text-red-500 ml-1">*</span>}
                        {isEmpty && <span className="text-orange-500 ml-2 text-xs">(Empty - Please fill)</span>}
                      </label>
                      {question.type === 'textarea' ? (
                        <textarea
                          value={String(profile[question.id as keyof CompanyProfile] || '')}
                          onChange={(e) => {
                            setProfile({ ...profile, [question.id]: e.target.value });
                            // Auto-resize textarea
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-200 transition-all resize-none overflow-hidden ${
                            isEmpty ? 'border-orange-400 bg-orange-50' : 'border-neutral-200'
                          }`}
                          rows={4}
                          style={{ minHeight: '100px' }}
                        />
                      ) : (
                        <input
                          type={question.type}
                          value={String(profile[question.id as keyof CompanyProfile] || '')}
                          onChange={(e) => setProfile({ ...profile, [question.id]: e.target.value })}
                          className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-200 transition-all ${
                            isEmpty ? 'border-orange-400 bg-orange-50' : 'border-neutral-200'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Terms and Privacy Consent */}
              <div className="mt-8 p-6 bg-neutral-50 rounded-2xl border-2 border-neutral-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profile.termsAccepted || false}
                    onChange={(e) => {
                      setProfile({ 
                        ...profile, 
                        termsAccepted: e.target.checked,
                        termsAcceptedAt: e.target.checked ? new Date().toISOString() : undefined
                      });
                    }}
                    className="mt-1 w-5 h-5 text-purple-600 border-neutral-300 rounded focus:ring-purple-500 focus:ring-2"
                  />
                  <span className="text-sm text-neutral-700">
                    I agree to the{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline font-medium">
                      Terms of Service
                    </a>
                    {' '}and{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline font-medium">
                      Privacy Policy
                    </a>
                    , and I consent to Meridian processing my company data to provide AI-powered lead generation services.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowReview(false)}
                  className="px-8 py-4 text-lg font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-2xl transition-all"
                >
                  ← Back to Questions
                </button>
                <button
                  onClick={handleSave}
                  disabled={isProcessing || !profile.termsAccepted}
                  className="px-10 py-4 text-lg font-bold text-white !bg-gradient-to-r !from-green-500 !via-blue-500 !to-purple-500 rounded-2xl hover:shadow-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isProcessing ? 'Saving...' : 'Save Profile ✓'}
                </button>
              </div>
            </div>
          )}

          {/* Main Question Area - Big and colorful */}
          {!showUploadOptions && !showReview && (
            <div className="bg-white rounded-3xl p-10 shadow-2xl animate-slide-in text-center">
              {/* Question */}
              <div className="mb-8">
                <div className="inline-block px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full text-sm font-semibold mb-4">
                  Question {currentQuestionIndex + 1}
                </div>
                <h2 className="text-4xl font-bold text-neutral-900 mb-2">
                  {currentQuestion.question}
                  {currentQuestion.required && <span className="text-red-500 ml-2">*</span>}
                </h2>
              </div>

              {/* Input - Large and inviting */}
              <div className="mb-10">
                {currentQuestion.type === 'textarea' ? (
                  <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    value={String(profile[currentQuestion.id as keyof CompanyProfile] || '')}
                    onChange={(e) => setProfile({ ...profile, [currentQuestion.id]: e.target.value })}
                    placeholder={currentQuestion.placeholder}
                    disabled={isAnimating}
                    rows={5}
                    className="w-full px-6 py-4 text-xl text-neutral-900 placeholder-neutral-400 border-3 border-neutral-200 rounded-2xl focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-200 transition-all disabled:opacity-50 resize-none text-center"
                  />
                ) : currentQuestion.type === 'select' ? (
                  <select
                    ref={inputRef as React.RefObject<HTMLSelectElement>}
                    value={String(profile[currentQuestion.id as keyof CompanyProfile] || '')}
                    onChange={(e) => setProfile({ ...profile, [currentQuestion.id]: e.target.value })}
                    disabled={isAnimating}
                    className="w-full px-6 py-4 text-xl text-neutral-900 border-3 border-neutral-200 rounded-2xl focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-200 transition-all disabled:opacity-50 text-center"
                  >
                    <option value="">Select an option...</option>
                    {currentQuestion.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type={currentQuestion.type}
                    value={String(profile[currentQuestion.id as keyof CompanyProfile] || '')}
                    onChange={(e) => setProfile({ ...profile, [currentQuestion.id]: e.target.value })}
                    placeholder={currentQuestion.placeholder}
                    disabled={isAnimating}
                    className="w-full px-6 py-4 text-xl text-neutral-900 placeholder-neutral-400 border-3 border-neutral-200 rounded-2xl focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-200 transition-all disabled:opacity-50 text-center"
                  />
                )}
              </div>

              {/* Navigation - Big colorful buttons */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleBack}
                  disabled={isAnimating}
                  className="px-8 py-4 text-lg font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  ← Back
                </button>

                <div className="flex items-center gap-4">
                  {!currentQuestion.required && currentQuestionIndex < questions.length - 1 && (
                    <button
                      onClick={handleSkip}
                      disabled={isAnimating}
                      className="px-8 py-4 text-lg font-bold text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-2xl disabled:opacity-30 transition-all"
                    >
                      Skip for now
                    </button>
                  )}
                  
                  <button
                    onClick={handleNext}
                    disabled={isAnimating || isProcessing}
                    className="px-10 py-4 text-lg font-bold text-white !bg-gradient-to-r !from-blue-500 !via-purple-500 !to-pink-500 rounded-2xl hover:shadow-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {currentQuestionIndex === questions.length - 1 ? (
                      isProcessing ? (
                        <span className="flex items-center gap-2">
                          <div className="animate-pulse">✓</div> Saving...
                        </span>
                      ) : (
                        '✓ Complete Setup'
                      )
                    ) : (
                      'Next Question →'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <AdminChatbot />
    </>
  );
}
