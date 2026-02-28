'use client'

import { useState, useRef, useEffect } from 'react'
import api from '@/lib/api'

interface CompanyProfile {
  companyName: string
  industry: string
  services: string
  targetMarket: string
  companySize: string
  description: string
  logo: string
  website: string
  linkedinProfile: string
  location: string
  phone: string
  email: string
  tagline: string
  founded: string
  employees: string
  coreOffering: string
  keyAdvantages: string
  termsAccepted?: boolean
  termsAcceptedAt?: string
}

interface Props {
  onComplete: () => void
}

const questions = [
  // Step 1: Basic Info
  { id: 'companyName', question: "What's your company name?", placeholder: 'e.g., Acme Corp', type: 'text', required: true, step: 1 },
  { id: 'tagline', question: "What's your company tagline?", placeholder: 'A brief, memorable phrase', type: 'text', step: 1 },
  { id: 'description', question: 'Tell us about your company', placeholder: 'Describe what your company does...', type: 'textarea', step: 1 },
  { id: 'industry', question: 'What industry are you in?', placeholder: 'e.g., Technology, Healthcare', type: 'text', required: true, step: 1 },
  // Step 2: Contact Info
  { id: 'website', question: "What's your website?", placeholder: 'https://yourcompany.com', type: 'url', step: 2 },
  { id: 'linkedinProfile', question: 'LinkedIn profile?', placeholder: 'https://linkedin.com/company/...', type: 'url', step: 2 },
  { id: 'email', question: 'Contact email?', placeholder: 'contact@company.com', type: 'email', step: 2 },
  { id: 'phone', question: 'Phone number?', placeholder: '+1 (555) 000-0000', type: 'tel', step: 2 },
  { id: 'companyAddress', question: 'Company address?', placeholder: '123 Main St, City, State ZIP', type: 'text', step: 2 },
  // Step 3: Company Details
  { id: 'location', question: 'Where are you based?', placeholder: 'City, Country', type: 'text', step: 3 },
  { id: 'founded', question: 'When was your company founded?', placeholder: '2020', type: 'text', step: 3 },
  { id: 'employees', question: 'How many employees?', placeholder: '25', type: 'text', step: 3 },
  { id: 'companySize', question: 'Company size range?', placeholder: '', type: 'select', options: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'], step: 3 },
  // Step 4: Market & Offering
  { id: 'targetMarket', question: "Who's your target market?", placeholder: 'e.g., B2B SaaS companies', type: 'textarea', step: 4 },
  { id: 'services', question: 'What services or products do you offer?', placeholder: 'Describe your offerings...', type: 'textarea', required: true, step: 4 },
  { id: 'coreOffering', question: "What's your core offering?", placeholder: 'e.g., AI-powered platform', type: 'textarea', step: 4 },
  { id: 'keyAdvantages', question: 'What makes you different?', placeholder: 'Your key advantages', type: 'textarea', step: 4 },
]

const steps = [
  { number: 1, title: 'Basic Info' },
  { number: 2, title: 'Contact' },
  { number: 3, title: 'Details' },
  { number: 4, title: 'Market' },
]

export default function CompanyProfileOnboarding({ onComplete }: Props) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isAnimating, setIsAnimating] = useState(false)
  const [showUploadOptions, setShowUploadOptions] = useState(true)
  const [showReview, setShowReview] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null)
  const [profile, setProfile] = useState<CompanyProfile>({
    companyName: '', industry: '', services: '', targetMarket: '', companySize: '',
    description: '', logo: '', website: '', linkedinProfile: '', location: '',
    phone: '', email: '', tagline: '', founded: '', employees: '',
    coreOffering: '', keyAdvantages: '', termsAccepted: false,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null)

  const currentQuestion = questions[currentQuestionIndex]

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toast])

  useEffect(() => {
    inputRef.current?.focus()
  }, [currentQuestionIndex])

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => setToast({ message, type })

  const animateTyping = async (text: string, field: string) => {
    setIsAnimating(true)
    let current = ''
    for (let i = 0; i < text.length; i++) {
      current += text[i]
      setProfile(prev => ({ ...prev, [field]: current }))
      await new Promise(r => setTimeout(r, 20))
    }
    setIsAnimating(false)
  }

  const animateThroughFields = async (extracted: Partial<CompanyProfile>) => {
    setShowUploadOptions(false)
    setIsAnimating(true)
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const value = extracted[q.id as keyof CompanyProfile]
      if (value && typeof value === 'string') {
        setCurrentQuestionIndex(i)
        await new Promise(r => setTimeout(r, 300))
        await animateTyping(value, q.id)
        await new Promise(r => setTimeout(r, 500))
      }
    }
    setIsAnimating(false)
    setShowReview(true)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFileName(file.name)
    setIsProcessing(true)
    try {
      let content = ''
      const isImage = file.type.startsWith('image/')
      if (isImage) {
        const reader = new FileReader()
        const base64 = await new Promise<string>((res, rej) => {
          reader.onload = () => res(reader.result as string)
          reader.onerror = rej
          reader.readAsDataURL(file)
        })
        content = base64
      } else {
        content = await file.text()
      }
      const r = await api.post('/api/company-profile/analyze', { content, fileName: file.name, isImage })
      if (r.data.success && r.data.profile) {
        await animateThroughFields(r.data.profile)
        showToast('Document analyzed successfully!', 'success')
      }
    } catch {
      showToast('Failed to analyze file. Please fill manually.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleWebsiteScrape = async () => {
    if (!websiteUrl.trim()) { showToast('Please enter a website URL', 'error'); return }
    let url = websiteUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url
    setIsProcessing(true)
    try {
      const r = await api.post('/api/company-profile/scrape-website', { url })
      if (r.data.success && r.data.profile) {
        await animateThroughFields(r.data.profile)
        showToast('Website scraped successfully!', 'success')
      }
    } catch {
      showToast('Failed to scrape website. Please fill manually.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleNext = () => {
    if (currentQuestion.required && !profile[currentQuestion.id as keyof CompanyProfile]) {
      showToast(`${currentQuestion.question} is required`, 'error')
      return
    }
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(i => i + 1)
    } else {
      setShowReview(true)
    }
  }

  const handleBack = () => {
    if (showUploadOptions) return
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(i => i - 1)
    } else {
      setShowUploadOptions(true)
    }
  }

  const handleSave = async () => {
    if (!profile.companyName || !profile.industry || !profile.services) {
      showToast('Please fill out at least Company Name, Industry, and Services', 'error')
      return
    }
    setIsProcessing(true)
    try {
      const r = await api.post('/api/company-profile/save', { profile, recommendedPreset: null })
      if (r.data.success) {
        showToast('Profile saved!', 'success')
        setTimeout(onComplete, 1000)
      }
    } catch {
      showToast('Failed to save. Please try again.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63] p-6 relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-white font-semibold transition-all ${
          toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
        }`}>
          <span>{toast.type === 'error' ? '⚠️' : toast.type === 'success' ? '✓' : 'ℹ️'}</span>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 pt-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[#4FD1FF] to-[#55C7F7] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-[#4FD1FF]/20">
            <svg className="w-9 h-9 text-[#0F1E35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Build Your Company Profile</h1>
          <p className="text-lg text-[#A3B4CC]">Tell us about your company so your AI agent can represent you perfectly</p>
        </div>

        {/* Step Progress */}
        <div className="mb-8 bg-[#1B2F52]/60 rounded-2xl p-5 border border-[#4FD1FF]/20">
          <div className="flex items-center justify-center gap-3">
            {steps.map((step, i) => {
              const cur = questions[currentQuestionIndex].step
              const done = cur > step.number
              const active = cur === step.number
              return (
                <div key={i} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                      active ? 'bg-[#4FD1FF] text-[#0F1E35] scale-110 shadow-lg shadow-[#4FD1FF]/40' :
                      done ? 'bg-[#4FD1FF]/60 text-white' : 'bg-[#2A4472] text-[#8FA6C1]'
                    }`}>
                      {done ? '✓' : step.number}
                    </div>
                    <span className={`text-xs mt-1.5 font-semibold ${active || done ? 'text-white' : 'text-[#8FA6C1]'}`}>{step.title}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-10 h-0.5 mx-2 rounded transition-all ${done ? 'bg-[#4FD1FF]' : 'bg-[#2A4472]'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Upload Options */}
        {showUploadOptions && currentQuestionIndex === 0 && !showReview && (
          <div className="mb-8 animate-fade-in">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-5 items-stretch">
              <div
                className="bg-[#1B2F52]/90 border border-[#4FD1FF]/30 rounded-2xl p-7 text-center hover:scale-105 hover:shadow-lg hover:shadow-[#4FD1FF]/20 transition-all cursor-pointer shadow-xl flex flex-col justify-between"
                onClick={() => fileInputRef.current?.click()}
              >
                <div>
                  <div className="w-14 h-14 bg-gradient-to-br from-[#4FD1FF] to-[#55C7F7] rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <svg className="w-8 h-8 text-[#0F1E35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Upload Document</h3>
                  <p className="text-sm text-[#A3B4CC] mb-3">Whitepaper, Pitch Deck, or Company Overview</p>
                </div>
                {uploadedFileName
                  ? <div className="text-sm text-[#4FD1FF] font-semibold">✓ {uploadedFileName}</div>
                  : <div className="text-xs text-[#8FA6C1]">Click to choose file</div>
                }
                <input ref={fileInputRef} type="file" accept=".pdf,.txt,.doc,.docx,.md,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
              </div>

              <div className="text-white/50 font-semibold text-sm flex items-center px-3">OR</div>

              <div className="bg-[#1B2F52]/90 border border-[#4FD1FF]/30 rounded-2xl p-7 shadow-xl text-center flex flex-col justify-between">
                <div>
                  <div className="w-14 h-14 bg-gradient-to-br from-[#4FD1FF] to-[#6BE3FF] rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <svg className="w-8 h-8 text-[#0F1E35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Extract from Website</h3>
                  <p className="text-sm text-[#A3B4CC] mb-3">Paste your company URL</p>
                </div>
                <div>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={e => setWebsiteUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && websiteUrl && !isProcessing) handleWebsiteScrape() }}
                    placeholder="https://yourcompany.com"
                    className="w-full px-4 py-2.5 bg-[#12213B] border-2 border-[#4FD1FF]/30 text-white placeholder-[#8FA6C1] rounded-lg text-sm mb-3 focus:outline-none focus:border-[#4FD1FF] transition-all text-center"
                  />
                  <button
                    onClick={handleWebsiteScrape}
                    disabled={isProcessing}
                    className="w-full px-4 py-2.5 bg-[#4FD1FF]/10 text-[#4FD1FF] font-semibold hover:bg-[#4FD1FF]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded-lg border-2 border-[#4FD1FF]/40"
                  >
                    {isProcessing && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                    {isProcessing ? 'Extracting...' : 'Extract Info →'}
                  </button>
                </div>
              </div>
            </div>
            <div className="text-center mt-6">
              <button onClick={() => setShowUploadOptions(false)} className="px-8 py-3 text-white font-semibold text-base hover:text-[#4FD1FF] transition-all">
                or Fill Out Manually →
              </button>
            </div>
          </div>
        )}

        {/* Review Screen */}
        {showReview && (
          <div className="bg-[#1B2F52]/90 border border-[#4FD1FF]/30 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-7">
              <div className="w-16 h-16 bg-gradient-to-br from-[#4FD1FF] to-[#55C7F7] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-9 h-9 text-[#0F1E35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-1">Review Your Profile</h2>
              <p className="text-[#A3B4CC]">Make any final edits before saving</p>
            </div>

            <div className="bg-[#4FD1FF]/10 border border-[#4FD1FF]/30 rounded-xl p-5 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="text-base font-bold text-[#4FD1FF] mb-1">Please Review Carefully</h3>
                  <p className="text-sm text-[#A3B4CC]">Double-check all fields and fill any that are empty. Make sure all information is accurate before saving.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              {questions.map(q => {
                const val = profile[q.id as keyof CompanyProfile]
                const empty = !val || (typeof val === 'string' && val.trim() === '')
                return (
                  <div key={q.id}>
                    <label className="block text-sm font-semibold text-white mb-1.5">
                      {q.question}
                      {q.required && <span className="text-[#4FD1FF] ml-1">*</span>}
                      {empty && <span className="text-[#4FD1FF]/80 ml-2 text-xs">(Empty)</span>}
                    </label>
                    {q.type === 'textarea' ? (
                      <textarea
                        value={String(profile[q.id as keyof CompanyProfile] || '')}
                        onChange={e => setProfile({ ...profile, [q.id]: e.target.value })}
                        className={`w-full px-3 py-2.5 bg-[#12213B] text-white placeholder-[#8FA6C1] border-2 rounded-xl focus:outline-none focus:border-[#4FD1FF] transition-all resize-none text-sm ${empty ? 'border-[#4FD1FF]/60' : 'border-[#4FD1FF]/20'}`}
                        rows={3}
                      />
                    ) : q.type === 'select' ? (
                      <select
                        value={String(profile[q.id as keyof CompanyProfile] || '')}
                        onChange={e => setProfile({ ...profile, [q.id]: e.target.value })}
                        className={`w-full px-3 py-2.5 bg-[#12213B] text-white border-2 rounded-xl focus:outline-none focus:border-[#4FD1FF] transition-all text-sm ${empty ? 'border-[#4FD1FF]/60' : 'border-[#4FD1FF]/20'}`}
                      >
                        <option value="">Select...</option>
                        {q.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={q.type}
                        value={String(profile[q.id as keyof CompanyProfile] || '')}
                        onChange={e => setProfile({ ...profile, [q.id]: e.target.value })}
                        className={`w-full px-3 py-2.5 bg-[#12213B] text-white border-2 rounded-xl focus:outline-none focus:border-[#4FD1FF] transition-all text-sm ${empty ? 'border-[#4FD1FF]/60' : 'border-[#4FD1FF]/20'}`}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Terms */}
            <div className="p-5 bg-[#12213B]/60 rounded-xl border border-[#4FD1FF]/20 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.termsAccepted || false}
                  onChange={e => setProfile({ ...profile, termsAccepted: e.target.checked, termsAcceptedAt: e.target.checked ? new Date().toISOString() : undefined })}
                  className="mt-0.5 w-4 h-4 rounded accent-[#4FD1FF]"
                />
                <span className="text-sm text-[#A3B4CC]">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" className="text-[#4FD1FF] hover:underline font-medium">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy" target="_blank" className="text-[#4FD1FF] hover:underline font-medium">Privacy Policy</a>
                  , and consent to Meridian processing my company data.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setShowReview(false)} className="px-6 py-3 text-[#A3B4CC] hover:text-white hover:bg-[#2A4472] rounded-xl font-semibold transition-all">
                ← Back to Questions
              </button>
              <button
                onClick={handleSave}
                disabled={isProcessing || !profile.termsAccepted}
                className="px-8 py-3.5 text-base font-bold text-[#0F1E35] bg-gradient-to-r from-[#4FD1FF] via-[#55C7F7] to-[#6BE3FF] rounded-xl hover:shadow-xl hover:shadow-[#4FD1FF]/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isProcessing ? 'Saving...' : 'Save Profile ✓'}
              </button>
            </div>
          </div>
        )}

        {/* Question Form */}
        {!showUploadOptions && !showReview && (
          <div className="bg-[#1B2F52]/90 border border-[#4FD1FF]/30 rounded-2xl p-8 shadow-2xl text-center">
            <div className="mb-7">
              <div className="inline-block px-3 py-1.5 bg-gradient-to-r from-[#4FD1FF] to-[#55C7F7] text-[#0F1E35] rounded-full text-xs font-bold mb-3">
                Question {currentQuestionIndex + 1} of {questions.length}
              </div>
              <h2 className="text-3xl font-bold text-white">
                {currentQuestion.question}
                {currentQuestion.required && <span className="text-[#4FD1FF] ml-2">*</span>}
              </h2>
            </div>

            <div className="mb-8">
              {currentQuestion.type === 'textarea' ? (
                <textarea
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  value={String(profile[currentQuestion.id as keyof CompanyProfile] || '')}
                  onChange={e => setProfile({ ...profile, [currentQuestion.id]: e.target.value })}
                  placeholder={currentQuestion.placeholder}
                  disabled={isAnimating}
                  rows={5}
                  className="w-full px-5 py-4 text-lg text-white placeholder-[#8FA6C1] bg-[#12213B] border-2 border-[#4FD1FF]/20 rounded-xl focus:border-[#4FD1FF] focus:outline-none focus:ring-2 focus:ring-[#4FD1FF]/20 transition-all disabled:opacity-50 resize-none text-center"
                />
              ) : currentQuestion.type === 'select' ? (
                <select
                  ref={inputRef as React.RefObject<HTMLSelectElement>}
                  value={String(profile[currentQuestion.id as keyof CompanyProfile] || '')}
                  onChange={e => setProfile({ ...profile, [currentQuestion.id]: e.target.value })}
                  disabled={isAnimating}
                  className="w-full px-5 py-4 text-lg text-white bg-[#12213B] border-2 border-[#4FD1FF]/20 rounded-xl focus:border-[#4FD1FF] focus:outline-none transition-all disabled:opacity-50"
                >
                  <option value="">Select an option...</option>
                  {currentQuestion.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type={currentQuestion.type}
                  value={String(profile[currentQuestion.id as keyof CompanyProfile] || '')}
                  onChange={e => setProfile({ ...profile, [currentQuestion.id]: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter' && !isAnimating) handleNext() }}
                  placeholder={currentQuestion.placeholder}
                  disabled={isAnimating}
                  className="w-full px-5 py-4 text-lg text-white placeholder-[#8FA6C1] bg-[#12213B] border-2 border-[#4FD1FF]/20 rounded-xl focus:border-[#4FD1FF] focus:outline-none focus:ring-2 focus:ring-[#4FD1FF]/20 transition-all disabled:opacity-50 text-center"
                />
              )}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={handleBack} disabled={isAnimating} className="px-6 py-3 text-[#A3B4CC] hover:text-white hover:bg-[#2A4472] rounded-xl font-semibold disabled:opacity-30 transition-all">
                ← Back
              </button>
              <div className="flex items-center gap-3">
                {!currentQuestion.required && currentQuestionIndex < questions.length - 1 && (
                  <button onClick={() => setCurrentQuestionIndex(i => i + 1)} disabled={isAnimating} className="px-6 py-3 text-[#8FA6C1] hover:text-[#A3B4CC] hover:bg-[#2A4472] rounded-xl font-semibold disabled:opacity-30 transition-all">
                    Skip
                  </button>
                )}
                <button
                  onClick={handleNext}
                  disabled={isAnimating || isProcessing}
                  className="px-8 py-3.5 font-bold text-[#0F1E35] bg-gradient-to-r from-[#4FD1FF] via-[#55C7F7] to-[#6BE3FF] rounded-xl hover:shadow-xl hover:shadow-[#4FD1FF]/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {currentQuestionIndex === questions.length - 1 ? '✓ Review & Save' : 'Next →'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
