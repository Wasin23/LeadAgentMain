'use client'

import { useState, useEffect } from 'react'
import { Lightbulb, Check, Plus, AlertTriangle, AlertCircle, Reply, Eye, Calendar, XCircle, Mail, MessageSquare, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import GlobeBackground from '@/components/onboarding/globe-background'

// Personality types data
const PERSONALITY_TYPES = [
  {
    id: 'hunter', name: 'The Hunter', color: 'red',
    description: 'Aggressive prospector focused on high-volume outreach and quick conversions',
    avatar: '/avatars/Hunter.png',
    traits: ['High-energy', 'Results-driven', 'Persistent', 'Direct'],
    emailStyle: 'Bold, action-oriented, creates urgency',
    prompt: 'You are The Hunter - a high-energy, results-driven AI sales agent focused on quick conversions.'
  },
  {
    id: 'relationship-builder', name: 'The Relationship Builder', color: 'blue',
    description: 'Warm, consultative approach focused on building long-term partnerships',
    avatar: '/avatars/Relationship-Builder.png',
    traits: ['Empathetic', 'Patient', 'Consultative', 'Trust-focused'],
    emailStyle: 'Warm, personal, relationship-focused',
    prompt: 'You are The Relationship Builder - a warm, empathetic AI sales agent building genuine partnerships.'
  },
  {
    id: 'analyst', name: 'The Analyst', color: 'purple',
    description: 'Data-driven methodology with deep research and industry insights',
    avatar: '/avatars/Analyst.png',
    traits: ['Analytical', 'Research-heavy', 'Detail-oriented', 'Evidence-based'],
    emailStyle: 'Data-rich, insightful, credential-heavy',
    prompt: 'You are The Analyst - a data-driven, research-focused AI sales agent who leads with insights.'
  },
  {
    id: 'consultant', name: 'The Consultant', color: 'green',
    description: 'Solution-focused industry expert who positions as a strategic advisor',
    avatar: '/avatars/consultant.png',
    traits: ['Advisory', 'Solution-focused', 'Industry expert', 'Strategic'],
    emailStyle: 'Advisory, strategic, solution-oriented',
    prompt: 'You are The Consultant - a strategic advisor and industry expert positioning yourself as a trusted partner.'
  },
  {
    id: 'networker', name: 'The Networker', color: 'indigo',
    description: 'LinkedIn-heavy, connection-based approach leveraging mutual contacts',
    avatar: '/avatars/Networker.png',
    traits: ['Social', 'Connection-focused', 'Community-driven', 'Referral-based'],
    emailStyle: 'Social, community-focused, leverages connections',
    prompt: 'You are The Networker - a socially-savvy AI agent who leverages connections and community.'
  }
]

const colorGrad: Record<string, string> = {
  red: 'from-red-500 to-red-600',
  blue: 'from-blue-500 to-blue-600',
  purple: 'from-purple-500 to-purple-600',
  green: 'from-green-500 to-green-600',
  indigo: 'from-indigo-500 to-indigo-600'
}

const CRM_CONFIGS = [
  { id: 'hubspot', name: 'HubSpot', fields: [{ name: 'Private App Access Token', key: 'apiKey', type: 'password', placeholder: 'pat-na1-...', helpText: 'Create a Private App in Settings → Integrations' }] },
  { id: 'salesforce', name: 'Salesforce', fields: [{ name: 'Instance URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourinstance.salesforce.com' }, { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Salesforce access token' }] },
  { id: 'pipedrive', name: 'Pipedrive', fields: [{ name: 'API Token', key: 'apiKey', type: 'password', placeholder: 'Your Pipedrive API token', helpText: 'Settings → Personal preferences → API' }] },
  { id: 'zoho', name: 'Zoho CRM', fields: [{ name: 'Data Center', key: 'apiUrl', type: 'text', placeholder: 'https://www.zohoapis.com' }, { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Zoho OAuth access token' }] },
  { id: 'activecampaign', name: 'ActiveCampaign', fields: [{ name: 'API URL', key: 'apiUrl', type: 'text', placeholder: 'https://youraccount.api-us1.com', helpText: 'Settings → Developer' }, { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your ActiveCampaign API Key' }] },
  { id: 'close', name: 'Close', fields: [{ name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'api_...', helpText: 'Settings → API Keys' }] },
  { id: 'copper', name: 'Copper', fields: [{ name: 'User Email', key: 'apiUrl', type: 'text', placeholder: 'your@email.com' }, { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Copper API key', helpText: 'Settings → Integrations → API Keys' }] },
  { id: 'dynamics365', name: 'Microsoft Dynamics 365', fields: [{ name: 'Organization URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourorg.crm.dynamics.com' }, { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Azure AD access token' }] },
  { id: 'nutshell', name: 'Nutshell', fields: [{ name: 'User Email', key: 'apiUrl', type: 'text', placeholder: 'your@email.com' }, { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Nutshell API key' }] },
  { id: 'insightly', name: 'Insightly', fields: [{ name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Insightly API key', helpText: 'User Settings → API' }] },
  { id: 'capsule', name: 'Capsule', fields: [{ name: 'API Token', key: 'apiKey', type: 'password', placeholder: 'Your Capsule API token', helpText: 'My Preferences → API Authentication Tokens' }] },
  { id: 'zendesksell', name: 'Zendesk Sell', fields: [{ name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Zendesk Sell access token' }] },
]

const APOLLO_INDUSTRIES = [
  'Software Development', 'SaaS', 'Cloud Computing', 'Cybersecurity', 'AI/Machine Learning', 'Data Analytics',
  'Healthcare', 'Hospitals & Health Systems', 'Medical Devices', 'Pharmaceuticals', 'Biotechnology', 'Telemedicine',
  'Banking', 'Investment Management', 'Insurance', 'FinTech', 'Payment Processing', 'Wealth Management',
  'Automotive', 'Aerospace & Defense', 'Electronics Manufacturing', 'Chemicals', 'Food & Beverage',
  'E-commerce', 'Fashion & Apparel', 'Grocery & Food Retail', 'Electronics Retail', 'Beauty & Cosmetics',
  'Consulting', 'Legal Services', 'Marketing & Advertising', 'Public Relations', 'Architecture', 'Engineering Services',
  'Commercial Real Estate', 'Residential Real Estate', 'Property Management', 'Construction',
  'K-12 Education', 'Higher Education', 'Online Learning', 'Corporate Training', 'EdTech',
  'Digital Media', 'Broadcasting', 'Publishing', 'Entertainment', 'Gaming', 'Social Media',
  'Hotels & Resorts', 'Restaurants & Food Service', 'Travel & Tourism', 'Airlines',
  'Nonprofit', 'Charitable Organizations', 'Environmental', 'Research Foundations',
  'Technology', 'Finance', 'Retail', 'Manufacturing', 'Hospitality', 'Media'
]

const JOB_TITLES = [
  'CEO', 'COO', 'CFO', 'CTO', 'CMO', 'President', 'Founder', 'Co-Founder', 'Managing Director',
  'VP Sales', 'VP Marketing', 'VP Engineering', 'VP Operations', 'VP Finance', 'VP Product', 'VP Business Development',
  'Director of Sales', 'Marketing Director', 'Engineering Director', 'Operations Director', 'IT Director',
  'Sales Manager', 'Marketing Manager', 'Engineering Manager', 'Product Manager', 'Project Manager',
  'Sales Representative', 'Marketing Specialist', 'Software Engineer', 'Data Analyst', 'Account Manager'
]

const INTRO_SLIDES = [
  {
    eyebrow: 'Step 1 of 4',
    title: 'You build it once. It runs forever.',
    avatars: PERSONALITY_TYPES.slice(0, 3),
    items: [
      'Pick a personality - The Hunter, The Analyst, whatever fits your style',
      'Tell it who to target: industry, company size, job title, location',
      'Connect your Gmail or Outlook - emails come from you, not a tool',
    ],
  },
  {
    eyebrow: 'Step 2 of 4',
    title: 'It finds leads and writes each email from scratch.',
    avatars: [PERSONALITY_TYPES[2], PERSONALITY_TYPES[3], PERSONALITY_TYPES[0]],
    items: [
      'Pulls leads from Apollo that match your exact target audience',
      'Reads each company\'s website, recent news, and LinkedIn before writing',
      'Writes a unique email for every lead - not a template with a name swapped in',
    ],
  },
  {
    eyebrow: 'Step 3 of 4',
    title: 'Emails go out from your real inbox.',
    avatars: [PERSONALITY_TYPES[1], PERSONALITY_TYPES[4], PERSONALITY_TYPES[2]],
    items: [
      'Sent from your actual Gmail or Outlook - your name, your domain',
      'Sending is spread across your schedule window so it looks natural',
      'If no reply after a few days, a follow-up sends automatically',
    ],
  },
  {
    eyebrow: 'Step 4 of 4',
    title: 'You see exactly who opens, clicks, and replies.',
    avatars: [PERSONALITY_TYPES[0], PERSONALITY_TYPES[3], PERSONALITY_TYPES[1]],
    items: [
      'Every email is tracked - you see opens and link clicks in real time',
      'When someone replies, it gets flagged so nothing slips through',
      'Hot leads bubble up automatically so you know who to follow up with',
    ],
  },
] as const

type Step = 'intro' | 'personality' | 'name-agent' | 'plan' | 'configure' | 'name-preset' | 'email-setup' | 'linkedin-setup' | 'notifications' | 'crm-setup' | 'payment' | 'review' | 'creating'

interface Props {
  onComplete: () => void
  onSkip: () => void
}

export default function AgentSetup({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState<Step>('intro')
  const [showIntroSlideshow, setShowIntroSlideshow] = useState(false)
  const [introSlide, setIntroSlide] = useState(0)
  const [personality, setPersonality] = useState<typeof PERSONALITY_TYPES[0] | null>(null)
  const [agentName, setAgentName] = useState('')
  const [presetName, setPresetName] = useState('')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [settings, setSettings] = useState({
    companySizeMin: 50, companySizeMax: 500,
    industries: [] as string[], jobTitles: [] as string[],
    leadsPerCycle: 10, emailLength: 'medium', callToAction: 'schedule-meeting',
    personalizationLevel: 'high', ccEmails: '', bccEmails: '',
    followupIntervalDays: 7, enableAutoResponse: true, concurrencyLevel: 1,
    useCustomSignature: true, signatureName: '', signatureTitle: '',
    useTemplate: false, templateBody: '', templateSubject: ''
  })
  const [presetJson, setPresetJson] = useState('')
  const [useGmail, setUseGmail] = useState(false)
  const [useOutlook, setUseOutlook] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [linkedinConnected, setLinkedinConnected] = useState(false)
  const [linkedinConnecting, setLinkedinConnecting] = useState(false)
  const [crmConnected, setCrmConnected] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('free-trial')
  const [paymentAdded, setPaymentAdded] = useState(false)
  const [planPurchased, setPlanPurchased] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [returnToReview, setReturnToReview] = useState(false)

  // Notification preferences
  const [notifEmailEnabled, setNotifEmailEnabled] = useState(true)
  const [notifSmsEnabled, setNotifSmsEnabled] = useState(false)

  // Industry search state
  const [industrySearch, setIndustrySearch] = useState('')
  const [jobSearch, setJobSearch] = useState('')

  // CRM state
  const [selectedCrm, setSelectedCrm] = useState<typeof CRM_CONFIGS[0] | null>(null)
  const [crmCreds, setCrmCreds] = useState<Record<string, string>>({})
  const [crmConnecting, setCrmConnecting] = useState(false)
  const [crmError, setCrmError] = useState<string | null>(null)
  const [showCrmDropdown, setShowCrmDropdown] = useState(false)

  const steps: Step[] = ['intro', 'personality', 'name-agent', 'plan', 'configure', 'name-preset', 'email-setup', 'linkedin-setup', 'notifications', 'crm-setup', 'payment', 'review', 'creating']
  const stepIdx = steps.indexOf(step)
  const totalSteps = steps.length - 2 // exclude creating

  useEffect(() => {
    api.get('/api/auth/gmail/status').then(r => { if (r.data?.connected) setGmailConnected(true) }).catch(() => {})
    api.get('/api/auth/outlook/status').then(r => { if (r.data?.connected) setOutlookConnected(true) }).catch(() => {})
    api.get('/api/auth/linkedin/status').then(r => { if (r.data?.connected) setLinkedinConnected(true) }).catch(() => {})
    api.get('/api/auth/profile').then(r => { if (r.data?.user?.paymentMethodAdded) setPaymentAdded(true) }).catch(() => {})
    api.get('/api/auth/settings').then(r => {
      if (r.data?.preferences?.defaultUseGmail) setUseGmail(true)
      if (r.data?.preferences?.defaultUseOutlook) setUseOutlook(true)
    }).catch(() => {})
  }, [])

  const [autofilling, setAutofilling] = useState(false)
  const handleAutofill = async () => {
    setAutofilling(true)
    try {
      const r = await api.post('/api/company-profile/autofill-targeting')
      const a = r.data.autofill
      if (a.generalInstructions) setSpecialInstructions(a.generalInstructions)
      setSettings(s => ({
        ...s,
        companySizeMin: a.companySizeMin ?? s.companySizeMin,
        companySizeMax: a.companySizeMax ?? s.companySizeMax,
        industries: a.industries?.length ? a.industries : s.industries,
        jobTitles: a.jobTitles?.length ? a.jobTitles : s.jobTitles,
      }))
    } catch {
      alert('Could not autofill - make sure your Company Profile is filled out in Settings.')
    } finally {
      setAutofilling(false)
    }
  }

  const next = () => {
    if (returnToReview) {
      setReturnToReview(false)
      setStep('review')
      return
    }
    const ni = stepIdx + 1
    if (ni < steps.length) {
      const nextStep = steps[ni]
      setStep(nextStep)
      if (nextStep === 'creating') createAgent()
    }
  }
  const back = () => {
    if (returnToReview) {
      setReturnToReview(false)
      setStep('review')
      return
    }
    const pi = stepIdx - 1
    if (pi >= 0) {
      const previousStep = steps[pi]
      setStep(previousStep)
      if (previousStep === 'intro') {
        setShowIntroSlideshow(false)
        setIntroSlide(0)
      }
    }
  }
  const editStep = (s: Step) => {
    setReturnToReview(true)
    setStep(s)
  }

  const createAgent = async () => {
    setIsCreating(true)
    setCreateError(null)
    try {
      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(presetJson) } catch { parsed = settings }

      const presetRes = await api.post('/api/settings/presets', {
        name: presetName,
        targetIndustries: settings.industries,
        targetPositions: settings.jobTitles,
        companySizeMin: settings.companySizeMin,
        companySizeMax: settings.companySizeMax,
        leadLimit: settings.leadsPerCycle,
        emailLength: settings.emailLength,
        callToAction: settings.callToAction,
        personalizationLevel: settings.personalizationLevel,
        ccEmails: settings.ccEmails,
        bccEmails: settings.bccEmails,
        followupIntervalDays: settings.followupIntervalDays,
        enableAutoResponse: settings.enableAutoResponse,
        useCustomSignature: settings.useCustomSignature,
        signatureName: settings.signatureName,
        signatureTitle: settings.signatureTitle,
        templates: settings.useTemplate && settings.templateBody.trim()
          ? [{ id: `tpl_${Date.now()}`, name: 'Default', subject: settings.templateSubject.trim(), body: settings.templateBody.trim() }]
          : [],
        useTemplates: !!(settings.useTemplate && settings.templateBody.trim()),
        specialInstructions
      })
      if (!presetRes.data.success) throw new Error('Failed to create preset')

      const cp = presetRes.data.preset
      const agentRes = await api.post('/api/auth/create-agent', {
        name: agentName,
        type: 'reasoning-lead-agent',
        specialInstructions,
        useGmail,
        useOutlook,
        concurrencyLevel: settings.concurrencyLevel,
        personality: {
          type: personality?.id, name: personality?.name, description: personality?.description,
          avatar: personality?.avatar, emailPrompt: personality?.prompt,
          emailStyle: personality?.emailStyle, traits: personality?.traits, color: personality?.color
        },
        preset: {
          presetId: cp.id, name: cp.name,
          targetIndustries: cp.targetIndustries, targetPositions: cp.targetPositions,
          companySizeMin: cp.companySizeMin, companySizeMax: cp.companySizeMax,
          leadLimit: cp.leadLimit, emailLength: cp.emailLength,
          callToAction: cp.callToAction, personalizationLevel: cp.personalizationLevel,
          ccEmails: cp.ccEmails, bccEmails: cp.bccEmails,
          followupIntervalDays: cp.followupIntervalDays, enableAutoResponse: cp.enableAutoResponse,
          useCustomSignature: cp.useCustomSignature, signatureName: cp.signatureName, signatureTitle: cp.signatureTitle,
          templates: cp.templates || [],
          useTemplates: cp.useTemplates ?? false
        }
      })
      if (agentRes.data.success) {
        // Save notification preferences
        await api.put('/api/settings/notifications', { emailEnabled: notifEmailEnabled, smsEnabled: notifSmsEnabled }).catch(() => {})
        setCreateSuccess(true)
        setIsCreating(false)
        setTimeout(onComplete, 1500)
      } else {
        throw new Error('Failed to create agent')
      }
    } catch (err: any) {
      setCreateError(err.response?.data?.message || err.message || 'Failed to create agent')
      setIsCreating(false)
    }
  }

  const connectCrm = async () => {
    if (!selectedCrm) return
    const missing = selectedCrm.fields.filter(f => !crmCreds[f.key]?.trim())
    if (missing.length) { setCrmError(`Please fill in: ${missing.map(f => f.name).join(', ')}`); return }
    setCrmConnecting(true); setCrmError(null)
    try {
      await api.post('/api/crm/connect-direct', {
        integrationName: selectedCrm.id,
        apiUrl: crmCreds.apiUrl?.trim() || '',
        apiKey: crmCreds.apiKey?.trim() || ''
      })
      setCrmConnected(true); setSelectedCrm(null); setCrmCreds({})
    } catch (e: any) {
      setCrmError(e.response?.data?.error || 'Failed to connect. Please check your credentials.')
    } finally {
      setCrmConnecting(false)
    }
  }

  const connectGmail = async () => {
    try {
      const r = await api.get('/api/auth/gmail/oauth-url')
      const w = window.open(r.data.authUrl, 'Gmail OAuth', 'width=600,height=700')
      const check = setInterval(async () => {
        if (w?.closed) {
          clearInterval(check)
          await new Promise(res => setTimeout(res, 1000))
          api.get('/api/auth/gmail/status').then(sr => { if (sr.data?.connected) setGmailConnected(true) }).catch(() => {})
        }
      }, 500)
    } catch { }
  }

  const connectOutlook = async () => {
    try {
      setUseOutlook(true); setUseGmail(false)
      await api.post('/api/auth/settings/preferences', { preferences: { defaultUseOutlook: true, defaultUseGmail: false } }).catch(() => {})
      const r = await api.get('/api/auth/outlook/oauth-url')
      const w = window.open(r.data.authUrl, 'Outlook OAuth', 'width=600,height=700')
      const check = setInterval(async () => {
        if (w?.closed) {
          clearInterval(check)
          await new Promise(res => setTimeout(res, 1000))
          api.get('/api/auth/outlook/status').then(sr => { if (sr.data?.connected) setOutlookConnected(true) }).catch(() => {})
        }
      }, 500)
    } catch { }
  }

  const connectLinkedIn = async () => {
    try {
      setLinkedinConnecting(true)
      const r = await api.get('/api/auth/linkedin/oauth-url')
      const w = window.open(r.data.authUrl, 'LinkedIn OAuth', 'width=600,height=700')
      const onMsg = (e: MessageEvent) => {
        if (e.data?.type === 'LINKEDIN_CONNECTED') {
          setLinkedinConnected(true)
          window.removeEventListener('message', onMsg)
          setLinkedinConnecting(false)
        }
      }
      window.addEventListener('message', onMsg)
      const check = setInterval(() => {
        if (w?.closed) { clearInterval(check); window.removeEventListener('message', onMsg); setLinkedinConnecting(false) }
      }, 500)
    } catch { setLinkedinConnecting(false) }
  }

  const filteredIndustries = industrySearch
    ? APOLLO_INDUSTRIES.filter(i => i.toLowerCase().includes(industrySearch.toLowerCase()) && !settings.industries.includes(i)).slice(0, 20)
    : []
  const filteredJobs = jobSearch
    ? JOB_TITLES.filter(t => t.toLowerCase().includes(jobSearch.toLowerCase()) && !settings.jobTitles.includes(t)).slice(0, 20)
    : []

  const addIndustry = (i: string) => { if (!settings.industries.includes(i)) { setSettings(s => ({ ...s, industries: [...s.industries, i] })); setIndustrySearch('') } }
  const addJob = (t: string) => { if (!settings.jobTitles.includes(t)) { setSettings(s => ({ ...s, jobTitles: [...s.jobTitles, t] })); setJobSearch('') } }

  const plans = [
    { id: 'free-trial', name: 'Free Trial', price: 0, credits: 250, maxAgents: 1, maxConcurrency: 3, description: 'Perfect for trying out Meridian', features: ['250 free credits', '1 agent included', 'Up to 3x speed for testing', 'No credit card required'] },
    { id: 'basic', name: 'Basic', price: 100, credits: 1200, maxAgents: 3, maxConcurrency: 5, description: 'Get started with outreach on a budget', features: ['1,200 credits', 'Up to 3 agents', 'Up to 5x speed', 'All core features unlocked'] },
    { id: 'starter', name: 'Starter', price: 500, credits: 13000, maxAgents: 5, maxConcurrency: 10, description: 'Great for solo entrepreneurs', features: ['13,000 credits', 'Up to 5 agents', 'Up to 10x speed', 'All core features unlocked'] },
    { id: 'professional', name: 'Professional', price: 1000, credits: 30000, maxAgents: 10, maxConcurrency: 20, description: 'Perfect for growing teams', features: ['30,000 credits', 'Up to 10 agents', 'Up to 20x speed', 'Best fit for active outreach teams'], popular: true },
    { id: 'enterprise', name: 'Enterprise', price: 2500, credits: 70000, maxAgents: 30, maxConcurrency: 30, description: 'For high-volume operations', features: ['70,000 credits', 'Up to 30 agents', 'Up to 30x speed', 'Best for multi-agent teams'] },
  ]

  const planDetails = plans.find(p => p.id === selectedPlan) || plans[0]
  const highestPlanLimits = plans[plans.length - 1]
  const currentIntroSlide = INTRO_SLIDES[introSlide]

  useEffect(() => {
    setSettings(current => {
      if (current.concurrencyLevel <= planDetails.maxConcurrency) return current
      return { ...current, concurrencyLevel: planDetails.maxConcurrency }
    })
  }, [planDetails.maxConcurrency])

  // Shared nav bar at top  
  const progressPct = step === 'creating' ? 100 : Math.round((stepIdx / (totalSteps)) * 100)

  return (
    <div className="relative min-h-screen overflow-y-auto">
      <GlobeBackground />
      {/* Top bar */}
      <div className="relative z-10 sticky top-0 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 48 48">
              <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="white" strokeWidth="1.5"/>
              <line x1="4" y1="24" x2="44" y2="24" stroke="white" strokeWidth="1.5"/>
            </svg>
            <span className="text-white font-bold text-lg">Create Your Agent</span>
          </div>
          <button onClick={onSkip} className="px-4 py-2 text-sm text-white font-bold border border-white/40 rounded-lg hover:bg-white/10 transition-all">
            Skip Tutorial
          </button>
        </div>
        {step !== 'creating' && (
          <div className="h-0.5 bg-white/20">
            <div className="h-full bg-white transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10 [&:has(.plan-step-breakout)]:max-w-none [&:has(.plan-step-breakout)]:px-8">

        {/* INTRO */}
        {step === 'intro' && (
          <div className={showIntroSlideshow ? 'max-w-7xl mx-auto' : 'text-center max-w-2xl mx-auto'}>
            {!showIntroSlideshow ? (
              <>
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/30">
                  <svg className="w-11 h-11 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h1 className="text-4xl font-bold text-white mb-4">Create Your First AI Agent</h1>
                <p className="text-xl text-white/70 mb-8">Your agent will automatically find leads, write personalized emails, and track responses for you.</p>
                <div className="bg-white/10 border border-white/20 rounded-2xl p-6 mb-8 text-left space-y-3">
                  {[
                    {
                      text: 'Find qualified leads based on your criteria',
                      icon: (
                        <svg className="h-5 w-5 text-blue-100" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="8.5" cy="8.5" r="4.75" />
                          <path strokeLinecap="round" d="M12 12l4.25 4.25" />
                        </svg>
                      )
                    },
                    {
                      text: 'Write personalized emails for each contact',
                      icon: (
                        <svg className="h-5 w-5 text-blue-100" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="2.75" y="4.25" width="14.5" height="11.5" rx="2" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.25L10 10.25l5.5-4" />
                        </svg>
                      )
                    },
                    {
                      text: 'Research and write reports into your CRM',
                      icon: (
                        <svg className="h-5 w-5 text-blue-100" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 3.5h6l3 3V16a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 015 16V5A1.5 1.5 0 016.5 3.5z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75V6.5h2.75" />
                          <path strokeLinecap="round" d="M7.5 10h5M7.5 13h5" />
                        </svg>
                      )
                    },
                    {
                      text: 'Track responses and book meetings',
                      icon: (
                        <svg className="h-5 w-5 text-blue-100" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="3" y="4.5" width="14" height="12" rx="2" />
                          <path strokeLinecap="round" d="M6.5 2.75v3.5M13.5 2.75v3.5M3 8h14" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 11l1.5 1.5L12.5 9.5" />
                        </svg>
                      )
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-white/80">
                      <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                        {item.icon}
                      </span>
                      <span className="pt-2">{item.text}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setShowIntroSlideshow(true); setIntroSlide(0) }} className="px-10 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-white/20 hover:scale-105 transition-all">
                  Next →
                </button>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/30">
                    <svg className="w-11 h-11 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h1 className="text-5xl font-bold text-white mb-4">Create Your First AI Agent</h1>
                  <p className="text-2xl text-white/70">Here&apos;s how your agent works before you start configuring it.</p>
                </div>
                <div className="bg-white/10 border border-white/20 rounded-[2rem] p-5 md:p-6 mb-8 text-left shadow-2xl shadow-blue-900/15">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100/80">{currentIntroSlide.eyebrow}</p>
                  <h3 className="text-3xl md:text-4xl font-bold text-white mt-2">{currentIntroSlide.title}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {INTRO_SLIDES.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setIntroSlide(index)}
                      className={`h-2.5 rounded-full transition-all ${index === introSlide ? 'w-7 bg-white' : 'w-2.5 bg-white/35 hover:bg-white/55'}`}
                      aria-label={`Go to intro slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/20 bg-white/95 p-5 md:p-6 text-gray-900">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex -space-x-2">
                    {currentIntroSlide.avatars.slice(0, 3).map((avatar) => (
                      <div key={avatar.id} className={`w-10 h-10 rounded-full bg-gradient-to-br ${colorGrad[avatar.color]} p-0.5 border-2 border-white`}>
                        <img src={avatar.avatar} alt={avatar.name} className="w-full h-full rounded-full object-cover bg-white" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(avatar.name)}&background=3b82f6&color=ffffff` }} />
                      </div>
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">{currentIntroSlide.eyebrow}</span>
                </div>
                <div className="space-y-2.5">
                  {currentIntroSlide.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">{i + 1}</span>
                      <span className="text-sm leading-relaxed text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (introSlide === 0) {
                    setShowIntroSlideshow(false)
                    return
                  }
                  setIntroSlide(current => Math.max(0, current - 1))
                }}
                className="px-6 py-3 rounded-xl font-semibold text-white/90 border border-white/25 hover:bg-white/10 transition-all"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (introSlide < INTRO_SLIDES.length - 1) {
                    setIntroSlide(current => current + 1)
                    return
                  }
                  next()
                }}
                className="px-10 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-white/20 hover:scale-105 transition-all"
              >
                {introSlide < INTRO_SLIDES.length - 1 ? 'Next →' : 'Next: Start Your Agent →'}
              </button>
            </div>
            </>
            )}
          </div>
        )}

        {/* PERSONALITY */}
        {step === 'personality' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-white mb-3">Choose a Personality</h2>
              <p className="text-xl text-white/70">This determines your agent's communication style</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              {PERSONALITY_TYPES.map(p => {
                const sel = personality?.id === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setPersonality(p)}
                    className={`relative p-5 rounded-2xl text-center transition-all bg-white/95 border shadow-sm ${
                      sel
                        ? 'border-blue-500 ring-2 ring-blue-500 scale-105 shadow-xl'
                        : 'border-gray-200 hover:border-blue-300 hover:scale-105 hover:shadow-md'
                    }`}
                  >
                    {sel && (
                      <div className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center z-10">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${colorGrad[p.color]} p-1 mx-auto mb-3`}>
                      <img src={p.avatar} alt={p.name} className="w-full h-full rounded-full object-cover bg-white" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=3b82f6&color=ffffff` }} />
                    </div>
                    <h3 className={`text-sm font-bold mb-1 ${sel ? 'text-blue-600' : 'text-gray-900'}`}>{p.name}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{p.description.slice(0, 60)}...</p>
                    <div className="mt-2 space-y-1">
                      {p.traits.slice(0, 2).map((t, i) => (
                        <div key={i} className={`text-[10px] px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${colorGrad[p.color]}`}>{t}</div>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="flex justify-between">
              <button onClick={back} className="px-6 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-semibold transition-all">← Back</button>
              <button onClick={next} disabled={!personality} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* NAME AGENT */}
        {step === 'name-agent' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              {personality && (
                <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${colorGrad[personality.color]} p-1.5 mx-auto mb-5 shadow-2xl`}>
                  <img src={personality.avatar} alt={personality.name} className="w-full h-full rounded-full object-cover bg-white" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(personality.name)}&background=3b82f6&color=ffffff` }} />
                </div>
              )}
              <h2 className="text-4xl font-bold text-white mb-2">Name Your Agent</h2>
              <p className="text-xl text-white/70">Give it a memorable name to identify this campaign</p>
            </div>
            <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-7 mb-7 shadow-lg">
              <label className="block text-gray-700 font-semibold mb-2">Agent Name</label>
              <input
                type="text" autoFocus value={agentName} onChange={e => setAgentName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && agentName.trim()) next() }}
                placeholder="e.g., Enterprise Outreach Agent"
                className="w-full px-5 py-4 rounded-xl text-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 bg-gray-50 text-gray-900 placeholder-gray-400 outline-none transition-all"
              />
              <p className="text-gray-500 text-sm mt-2 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 shrink-0" /> Tip: Use descriptive names like "SMB Campaign" or "Series A Startups"</p>
            </div>
            <div className="flex justify-between">
              <button onClick={back} className="px-6 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-semibold transition-all">← Back</button>
              <button onClick={next} disabled={!agentName.trim()} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* CONFIGURE / CHOOSE PRESET */}
        {step === 'configure' && (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-7">
              <h2 className="text-4xl font-bold text-white mb-2">Configure Targeting</h2>
              <p className="text-xl text-white/70">Define your ideal customer profile</p>
            </div>

            {/* General Instructions */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 mb-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-gray-900 font-bold text-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  Campaign Instructions
                </h3>
                <button
                  type="button"
                  onClick={handleAutofill}
                  disabled={autofilling}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-all disabled:opacity-50"
                >
                  {autofilling ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  )}
                  {autofilling ? 'Filling...' : 'Autofill from company profile'}
                </button>
              </div>
              <p className="text-gray-500 text-sm mb-3">Give your agent specific guidance. The AI adapts its research, outreach, and engagement based on these instructions.</p>
              <textarea
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="Example: Target CTOs at Series A startups in healthcare tech. Focus on pain points around scaling engineering teams."
                className="w-full px-4 py-3 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 min-h-[100px] resize-y text-sm transition-all"
                maxLength={1000}
              />
              <div className="flex justify-end mt-1.5">
                <span className="text-gray-400 text-xs">{specialInstructions.length}/1000</span>
              </div>
            </div>

            <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-6 space-y-6 shadow-sm">
              {/* Company Size */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Company Size (Employees)</label>
                <div className="flex items-center gap-3">
                  <input type="number" value={settings.companySizeMin} onChange={e => setSettings(s => ({ ...s, companySizeMin: parseInt(e.target.value) || 0 }))} className="w-28 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-all" placeholder="Min" />
                  <span className="text-gray-500 font-medium">to</span>
                  <input type="number" value={settings.companySizeMax} onChange={e => setSettings(s => ({ ...s, companySizeMax: parseInt(e.target.value) || 0 }))} className="w-28 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-all" placeholder="Max" />
                </div>
              </div>

              {/* Industries */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Target Industries</label>
                <div className="relative">
                  <input
                    type="text" value={industrySearch}
                    onChange={e => setIndustrySearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && industrySearch.trim()) { addIndustry(industrySearch.trim()) } }}
                    placeholder="Search or type an industry..."
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-all text-sm"
                  />
                  {filteredIndustries.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl max-h-52 overflow-y-auto">
                      {filteredIndustries.map((ind, i) => (
                        <button key={i} onClick={() => addIndustry(ind)} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 hover:text-gray-900 transition-colors border-b border-gray-100 last:border-b-0">{ind}</button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">Not in the list? Type it and press Enter to add.</p>
                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                  {['Technology', 'Healthcare', 'Finance', 'Retail', 'SaaS', 'E-commerce', 'Consulting'].map(ind => (
                    <button key={ind} onClick={() => addIndustry(ind)} disabled={settings.industries.includes(ind)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1 ${settings.industries.includes(ind) ? 'bg-purple-100 text-purple-400 cursor-default' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                      {settings.industries.includes(ind) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}{ind}
                    </button>
                  ))}
                </div>
                {settings.industries.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {settings.industries.map(ind => (
                      <span key={ind} className="px-3 py-1 rounded-full bg-purple-500 text-white text-xs font-medium flex items-center gap-1.5">
                        {ind}
                        <button onClick={() => setSettings(s => ({ ...s, industries: s.industries.filter(i => i !== ind) }))} className="hover:bg-white/20 rounded-full w-4 h-4 flex items-center justify-center">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Job Titles */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Target Positions</label>
                <div className="relative">
                  <input
                    type="text" value={jobSearch}
                    onChange={e => setJobSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && jobSearch.trim()) addJob(jobSearch.trim()) }}
                    placeholder="Search or type a job title..."
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-all text-sm"
                  />
                  {filteredJobs.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl max-h-52 overflow-y-auto">
                      {filteredJobs.map((j, i) => (
                        <button key={i} onClick={() => addJob(j)} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 hover:text-gray-900 transition-colors border-b border-gray-100 last:border-b-0">{j}</button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">Not in the list? Type it and press Enter to add.</p>
                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                  {['CEO', 'CTO', 'VP of Sales', 'Head of Marketing', 'Director of Operations'].map(t => (
                    <button key={t} onClick={() => addJob(t)} disabled={settings.jobTitles.includes(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1 ${settings.jobTitles.includes(t) ? 'bg-blue-100 text-blue-400 cursor-default' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                      {settings.jobTitles.includes(t) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}{t}
                    </button>
                  ))}
                </div>
                {settings.jobTitles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {settings.jobTitles.map(t => (
                      <span key={t} className="px-3 py-1 rounded-full bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5">
                        {t}
                        <button onClick={() => setSettings(s => ({ ...s, jobTitles: s.jobTitles.filter(j => j !== t) }))} className="hover:bg-white/20 rounded-full w-4 h-4 flex items-center justify-center">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Leads Per Cycle */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Leads Per Cycle</label>
                <p className="text-gray-500 text-xs mb-3">Your agent will find and research this many new leads each run.</p>
                <div className="flex items-center gap-4">
                  <input type="number" min="1" max="100" value={settings.leadsPerCycle} onChange={e => setSettings(s => ({ ...s, leadsPerCycle: parseInt(e.target.value) || 1 }))} className="w-24 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 font-bold text-center focus:border-blue-400 focus:outline-none transition-all" />
                  <span className="text-gray-700">leads per cycle</span>
                </div>
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                  <span className="text-gray-700 text-sm">Estimated: ~<span className="text-green-600 font-bold">{Math.ceil(settings.leadsPerCycle * 2 / 3)}</span> credits per cycle</span>
                </div>
              </div>

              {/* Research Speed */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Research Speed</label>
                <p className="text-gray-500 text-xs mb-3">Number of leads researched in parallel per cycle. Higher = faster but uses more API credits at once.</p>
                <div className="flex items-center gap-4">
                  <input
                    type="range" min={1} max={planDetails.maxConcurrency} step={1}
                    value={settings.concurrencyLevel}
                    onChange={e => setSettings(s => ({ ...s, concurrencyLevel: parseInt(e.target.value) }))}
                    className="flex-1 accent-blue-500"
                  />
                  <span className="w-24 text-center font-bold text-gray-900 text-sm">
                    {settings.concurrencyLevel === 1 ? '1 (default)' : `${settings.concurrencyLevel} workers`}
                  </span>
                </div>
                {planDetails.maxConcurrency < highestPlanLimits.maxConcurrency && (
                  <div className="mt-3 rounded-lg border border-dashed border-blue-200 bg-white/70 px-3 py-2">
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      {plans
                        .filter(plan => plan.maxConcurrency > planDetails.maxConcurrency)
                        .map(plan => (
                          <span key={plan.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 border border-blue-100">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 0v2m-6 6h12a2 2 0 002-2v-3a6 6 0 10-12 0v3a2 2 0 002 2z" /></svg>
                            Upgrade to {plan.name} for {plan.maxConcurrency}x
                          </span>
                        ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-700">
                  ~<span className="text-blue-600 font-bold">{settings.concurrencyLevel}×</span> faster research
                  {settings.concurrencyLevel > 3 && <span className="ml-2 text-red-600 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> High API usage</span>}
                </div>
                <p className="mt-2 text-xs text-gray-500">Current plan cap: {planDetails.maxConcurrency}x concurrency. Upgrade to unlock up to {highestPlanLimits.maxConcurrency}x concurrency.</p>
                <p className="mt-1 text-xs text-gray-500">Current plan also includes up to {planDetails.maxAgents} agent{planDetails.maxAgents === 1 ? '' : 's'}. Higher tiers go up to {highestPlanLimits.maxAgents} agents.</p>
              </div>

              {/* Email Settings */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-gray-800 font-bold text-lg mb-4">Email Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-semibold text-sm mb-1">CC Email Addresses</label>
                    <input type="text" value={settings.ccEmails} onChange={e => setSettings(s => ({ ...s, ccEmails: e.target.value }))} placeholder="email@example.com, ..." className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-all text-sm" />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold text-sm mb-1">BCC Email Addresses</label>
                    <input type="text" value={settings.bccEmails} onChange={e => setSettings(s => ({ ...s, bccEmails: e.target.value }))} placeholder="email@example.com, ..." className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-all text-sm" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-gray-700 font-semibold text-sm mb-1">Follow-up Interval (Days)</label>
                  <input type="number" min="1" max="30" value={settings.followupIntervalDays} onChange={e => setSettings(s => ({ ...s, followupIntervalDays: parseInt(e.target.value) || 7 }))} className="w-32 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 focus:border-blue-400 focus:outline-none transition-all text-sm" />
                </div>
                <div className="mt-5 rounded-xl bg-blue-50 border border-blue-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-gray-900 font-semibold text-sm">Auto-sign emails <span className="ml-1.5 text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Recommended</span></p>
                      <p className="text-gray-500 text-xs mt-0.5">Adds your name and title to every outreach email for a professional, personal touch.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, useCustomSignature: !s.useCustomSignature }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${settings.useCustomSignature ? 'bg-blue-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${settings.useCustomSignature ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {settings.useCustomSignature && (
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="block text-gray-700 font-semibold text-xs mb-1">Your Name</label>
                        <input
                          type="text"
                          value={settings.signatureName ?? ''}
                          onChange={e => setSettings(s => ({ ...s, signatureName: e.target.value }))}
                          placeholder="John Smith"
                          className="w-full px-3 py-2 rounded-lg bg-white border border-blue-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-all text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-semibold text-xs mb-1">Your Title</label>
                        <input
                          type="text"
                          value={settings.signatureTitle ?? ''}
                          onChange={e => setSettings(s => ({ ...s, signatureTitle: e.target.value }))}
                          placeholder="VP of Sales"
                          className="w-full px-3 py-2 rounded-lg bg-white border border-blue-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Email Template */}
                <div className="mt-5 rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-gray-900 font-semibold text-sm">Start with a template <span className="ml-1.5 text-xs font-normal text-gray-500">optional</span></p>
                      <p className="text-gray-500 text-xs mt-0.5">Write a static email body using merge tags. The agent fills them in using research instead of generating the whole email.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, useTemplate: !s.useTemplate }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${settings.useTemplate ? 'bg-blue-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${settings.useTemplate ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {settings.useTemplate && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="block text-gray-700 font-semibold text-xs mb-1">Subject Line <span className="font-normal text-gray-400">(optional)</span></label>
                        <input type="text" value={settings.templateSubject} onChange={e => setSettings(s => ({ ...s, templateSubject: e.target.value }))} placeholder="Quick question for {{firstName}}" className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-semibold text-xs mb-1">Email Body</label>
                        <textarea rows={7} value={settings.templateBody} onChange={e => setSettings(s => ({ ...s, templateBody: e.target.value }))} placeholder={`Hi {{firstName}},\n\nI noticed {{company}} recently...\n\n{{painPoint}}\n\nBest,\n{{senderName}}`} className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-all text-sm font-mono resize-y" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium mb-1.5">Merge tags (click to insert):</p>
                        <div className="flex flex-wrap gap-1.5">
                          {['{{firstName}}', '{{lastName}}', '{{company}}', '{{role}}', '{{painPoint}}', '{{recentNews}}', '{{senderName}}'].map(tag => (
                            <button key={tag} type="button" onClick={() => setSettings(s => ({ ...s, templateBody: s.templateBody + tag }))} className="text-[11px] font-mono px-2 py-0.5 bg-gray-100 rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors text-gray-700">{tag}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={back} className="px-6 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-semibold transition-all">← Back</button>
              <button
                onClick={() => {
                  const missing = []
                  if (!settings.industries.length) missing.push('Target Industries')
                  if (!settings.jobTitles.length) missing.push('Target Positions')
                  if (!settings.leadsPerCycle) missing.push('Leads Per Cycle')
                  if (missing.length) { alert(`Please fill in:\n• ${missing.join('\n• ')}`); return }
                  setPresetJson(JSON.stringify(settings))
                  next()
                }}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold hover:shadow-xl hover:scale-105 transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* NAME PRESET */}
        {step === 'name-preset' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/20">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              </div>
              <h2 className="text-4xl font-bold text-white mb-2">Save Your Settings</h2>
              <p className="text-xl text-white/70">Name this preset so you can reuse these settings for future agents</p>
            </div>
            <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-7 mb-7 shadow-lg">
              <label className="block text-gray-700 font-semibold mb-2">Preset Name</label>
              <input
                type="text" autoFocus value={presetName} onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && presetName.trim()) next() }}
                placeholder="e.g., SaaS Executives, Tech Startups"
                className="w-full px-5 py-4 rounded-xl text-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 bg-gray-50 text-gray-900 placeholder-gray-400 outline-none transition-all"
              />
              <p className="text-gray-500 text-sm mt-2 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 shrink-0" /> Tip: Use descriptive names like "Healthcare Decision Makers" or "SaaS CTOs"</p>
            </div>
            <div className="flex justify-between">
              <button onClick={back} className="px-6 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-semibold transition-all">← Back</button>
              <button onClick={next} disabled={!presetName.trim()} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* EMAIL SETUP */}
        {step === 'email-setup' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-7">
              <h2 className="text-4xl font-bold text-white mb-2">Email Integration</h2>
              <p className="text-xl text-white/70">Choose how your agent sends emails</p>
            </div>
            <div className="space-y-4 mb-7">
              {/* Gmail */}
              <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-6 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#4285F4" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#34A853" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      Gmail
                      {gmailConnected && useGmail && <span className="text-xs text-green-400 font-semibold bg-green-500/20 px-2 py-0.5 rounded">ACTIVE</span>}
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">Send from your Gmail inbox for better deliverability and reply tracking. <span className="text-blue-600">Recommended.</span></p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setUseGmail(true); setUseOutlook(false); if (!gmailConnected) connectGmail() }}
                        disabled={gmailConnected && useGmail}
                        className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${gmailConnected ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:scale-105'}`}
                      >
                        {gmailConnected ? (useGmail ? <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Selected</span> : 'Connected') : 'Connect Gmail'}
                      </button>
                      {gmailConnected && !useGmail && (
                        <button onClick={() => { setUseGmail(true); setUseOutlook(false) }} className="px-4 py-2 text-sm rounded-lg bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all">Set as Default</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Outlook */}
              <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-6 shadow-sm transition-all hover:shadow-md">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#0078D4" d="M2 12a2 2 0 012-2h40a2 2 0 012 2v24a2 2 0 01-2 2H4a2 2 0 01-2-2V12z"/><path fill="#FFF" d="M24 17c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>
                    Outlook
                    {outlookConnected && useOutlook && <span className="text-xs text-green-400 font-semibold bg-green-500/20 px-2 py-0.5 rounded">ACTIVE</span>}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3">Send from your Outlook/Office 365 account.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (!outlookConnected) connectOutlook(); else { setUseOutlook(true); setUseGmail(false) } }}
                      disabled={outlookConnected && useOutlook}
                      className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${outlookConnected ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:scale-105'}`}
                    >
                      {outlookConnected ? (useOutlook ? <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Selected</span> : 'Connected') : 'Connect Outlook'}
                    </button>
                    {outlookConnected && !useOutlook && (
                      <button onClick={() => { setUseOutlook(true); setUseGmail(false) }} className="px-4 py-2 text-sm rounded-lg bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all">Set as Default</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Mailgun */}
              <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                  Mailgun (Default)
                  {!useGmail && !useOutlook && <span className="text-xs text-green-400 font-semibold bg-green-500/20 px-2 py-0.5 rounded">ACTIVE</span>}
                </h3>
                <p className="text-sm text-gray-500 mb-3">Use Mailgun for sending. Replies tracked via webhooks.</p>
                <button
                  onClick={() => { setUseGmail(false); setUseOutlook(false) }}
                  disabled={!useGmail && !useOutlook}
                  className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${!useGmail && !useOutlook ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default' : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:scale-105'}`}
                >
                  {!useGmail && !useOutlook ? <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Selected</span> : 'Use Mailgun'}
                </button>
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={back} className="px-6 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-semibold transition-all">← Back</button>
              <button onClick={next} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all">Continue →</button>
            </div>
          </div>
        )}

        {/* LINKEDIN SETUP */}
        {step === 'linkedin-setup' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-7">
              <h2 className="text-4xl font-bold text-white mb-2">LinkedIn Outreach</h2>
              <p className="text-xl text-white/70">Connect LinkedIn to reach highly qualified leads on a second channel</p>
            </div>
            <div className="space-y-4 mb-7">
              <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-6 shadow-sm transition-all hover:shadow-md">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="4" fill="#0A66C2"/>
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z" fill="white"/>
                  </svg>
                  LinkedIn
                  {linkedinConnected && <span className="text-xs text-green-400 font-semibold bg-green-500/20 px-2 py-0.5 rounded">CONNECTED</span>}
                </h3>
                <p className="text-sm text-gray-500 mb-3">When a lead is graded as highly qualified, your agent will also send them an InMail or connection request - in addition to email.</p>
                <button
                  onClick={() => { if (!linkedinConnected) connectLinkedIn() }}
                  disabled={linkedinConnected || linkedinConnecting}
                  className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${linkedinConnected ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default' : 'bg-gradient-to-r from-[#0A66C2] to-[#0077B5] text-white hover:scale-105'}`}
                >
                  {linkedinConnecting ? 'Connecting…' : linkedinConnected ? <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Connected</span> : 'Connect LinkedIn'}
                </button>
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={back} className="px-6 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-semibold transition-all">← Back</button>
              <button onClick={next} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all">
                {linkedinConnected ? 'Continue →' : 'Skip for now →'}
              </button>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS */}
        {step === 'notifications' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-7">
              <h2 className="text-4xl font-bold text-white mb-2">Notification Preferences</h2>
              <p className="text-xl text-white/70">Choose how you want to be alerted about agent activity</p>
            </div>
            <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm space-y-5">
              {/* What you'll be notified about */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">You'll receive alerts for:</p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { icon: Reply, label: 'Replies', desc: 'When a lead replies to one of your emails' },
                    { icon: Eye, label: 'Email Opens', desc: 'When a lead opens an email you sent' },
                    { icon: Calendar, label: 'Meetings Booked', desc: 'When a calendar event is confirmed' },
                    { icon: XCircle, label: 'Failed Sends', desc: 'When an email bounces or fails to deliver' },
                    { icon: AlertCircle, label: 'Agent Issues', desc: 'When your agent encounters an error or warning' },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                      <item.icon className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-4">
                {/* Email notifications */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Email Notifications</p>
                    <p className="text-xs text-gray-500">Receive alerts in your inbox</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifEmailEnabled(v => !v)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${notifEmailEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${notifEmailEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* SMS notifications */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">SMS Notifications</p>
                    <p className="text-xs text-gray-500">Text alerts for replies and meetings</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifSmsEnabled(v => !v)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${notifSmsEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${notifSmsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <p className="text-xs text-gray-400">You can change these anytime in Settings → Notifications.</p>
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={back} className="px-6 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-semibold transition-all">← Back</button>
              <button onClick={next} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* CRM SETUP */}
        {step === 'crm-setup' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-7">
              <h2 className="text-4xl font-bold text-white mb-2">Connect Your CRM</h2>
              <p className="text-xl text-white/70">Auto-sync researched leads to your CRM (optional)</p>
            </div>
            <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-5 mb-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-blue-200 shadow-sm">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M7 4v6m10-6v6M5 11h14a1 1 0 011 1v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a1 1 0 011-1z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">CRM Auditor mode</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      You can convert your agent into a CRM Auditor here. Instead of searching Apollo for new leads, it reads through your CRM contacts, researches each one, builds personalized emails, and submits research reports back onto each record.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 mt-4">
                  {[
                    { step: '1', title: 'Pull CRM contacts', detail: 'Use the people already sitting in HubSpot, Salesforce, Pipedrive, or another CRM.' },
                    { step: '2', title: 'Research every contact', detail: 'The agent enriches each record and prepares a short research brief.' },
                    { step: '3', title: 'Draft outreach', detail: 'It writes personalized emails for those contacts instead of starting from a cold list.' },
                    { step: '4', title: 'Sync reports back', detail: 'Research notes and activity can be pushed back into the CRM for your team.' },
                  ].map((item) => (
                    <div key={item.step} className="rounded-xl border border-blue-100 bg-white px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{item.step}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-5">
                <h3 className="font-bold text-gray-900 mb-2">Why connect a CRM?</h3>
                <ul className="space-y-1.5 text-sm text-gray-600">
                  {['Automatically sync researched leads', 'Keep your CRM up-to-date effortlessly', 'Research summaries attached as notes', 'Works with HubSpot, Salesforce, Pipedrive, Zoho & more'].map((f, i) => <li key={i} className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 shrink-0" /> {f}</li>)}
                </ul>
              </div>

              {!crmConnected && !selectedCrm && (
                <div>
                  <label className="block text-gray-600 font-medium text-sm mb-2">Choose your CRM</label>
                  <div className="relative">
                    <button onClick={() => setShowCrmDropdown(!showCrmDropdown)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors text-sm">
                      <span>Select a CRM platform...</span>
                      <svg className={`w-4 h-4 transition-transform ${showCrmDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {showCrmDropdown && (
                      <div className="absolute z-50 w-full mt-2 bg-white border border-neutral-200 rounded-xl shadow-2xl max-h-52 overflow-y-auto">
                        {CRM_CONFIGS.map(crm => (
                          <button key={crm.id} onClick={() => { setSelectedCrm(crm); setShowCrmDropdown(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 border-b border-neutral-100 last:border-b-0 text-sm text-neutral-700 font-medium">
                            {crm.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">You can also connect this later from Settings</p>
                </div>
              )}

              {!crmConnected && selectedCrm && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{selectedCrm.name}</h4>
                      <p className="text-xs text-gray-500">Enter your credentials</p>
                    </div>
                    <button onClick={() => { setSelectedCrm(null); setCrmCreds({}); setCrmError(null) }} className="text-xs text-blue-500 hover:text-blue-700">Change</button>
                  </div>
                  {selectedCrm.fields.map(f => (
                    <div key={f.key}>
                      <label className="block text-xs text-gray-600 font-medium mb-1">{f.name}</label>
                      <input type={f.type} value={crmCreds[f.key] || ''} onChange={e => setCrmCreds(c => ({ ...c, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:border-blue-400 outline-none transition-all" />
                      {(f as any).helpText && <p className="text-xs text-gray-400 mt-1">{(f as any).helpText}</p>}
                    </div>
                  ))}
                  {crmError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{crmError}</div>}
                  <button onClick={connectCrm} disabled={crmConnecting} className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold hover:shadow-xl hover:scale-105 disabled:opacity-50 transition-all">
                    {crmConnecting ? 'Connecting...' : 'Connect CRM'}
                  </button>
                </div>
              )}

              {crmConnected && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm text-green-800 font-semibold">CRM connected! Leads will auto-sync after research.</p>
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <button onClick={back} className="px-6 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-semibold transition-all">← Back</button>
              <button onClick={next} className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold hover:shadow-xl hover:scale-105 transition-all">
                {crmConnected ? 'Continue →' : 'Skip for now →'}
              </button>
            </div>
          </div>
        )}

        {/* PLAN */}
        {step === 'plan' && (
          <div className="plan-step-breakout max-w-6xl mx-auto w-full">
            <div className="text-center mb-7">
              <h2 className="text-4xl font-bold text-white mb-2">Choose Your Plan</h2>
              <p className="text-xl text-white/70">Start with a free trial or jump right into a paid plan</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
              {plans.map(plan => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative bg-white rounded-2xl p-6 cursor-pointer border-4 transition-all hover:scale-102 ${selectedPlan === plan.id ? 'border-blue-500 shadow-2xl shadow-blue-500/20' : 'border-transparent hover:border-blue-300'}`}
                >
                  {(plan as any).popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">POPULAR</div>
                  )}
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                    <p className="text-gray-500 text-sm mb-3">{plan.description}</p>
                    <div className="mb-3">
                      <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                      {plan.price > 0 && <span className="text-gray-500 text-sm">/one-time</span>}
                    </div>
                    <div className="text-base font-bold text-blue-500 mb-4">{plan.credits.toLocaleString()} credits</div>
                    <ul className="space-y-1.5 text-sm text-gray-600 mb-4 text-left">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    {selectedPlan === plan.id && (
                      <div className="flex items-center justify-center gap-1.5 text-blue-600 font-bold text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        Selected
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
              <p className="text-sm font-semibold text-gray-900">{planDetails.name} includes up to {planDetails.maxAgents} agent{planDetails.maxAgents === 1 ? '' : 's'} and {planDetails.maxConcurrency}x research concurrency.</p>
              <p className="text-sm text-gray-500 mt-1">Higher tiers unlock up to {highestPlanLimits.maxAgents} agents and {highestPlanLimits.maxConcurrency}x concurrency.</p>
              {planDetails.maxAgents < highestPlanLimits.maxAgents && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                  {plans
                    .filter(plan => plan.maxAgents > planDetails.maxAgents)
                    .map(plan => (
                      <span key={`${plan.id}-agents`} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 border border-blue-100">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5V9H2v11h5m10 0v-2a4 4 0 00-4-4H11a4 4 0 00-4 4v2m10 0H7m10 0a2 2 0 002-2v-3m-12 5a2 2 0 01-2-2v-3m12-4a2 2 0 10-4 0 2 2 0 004 0zm-8 0a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        Upgrade to {plan.name} for {plan.maxAgents} agents
                      </span>
                    ))}
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <button onClick={back} className="px-6 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-semibold transition-all">← Back</button>
              <button onClick={next} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold hover:shadow-xl hover:scale-105 transition-all">
                Continue with {planDetails.name} →
              </button>
            </div>
          </div>
        )}

        {/* PAYMENT */}
        {step === 'payment' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-7">
              <h2 className="text-4xl font-bold text-white mb-2">{selectedPlan === 'free-trial' ? 'Start Your Free Trial' : 'Complete Purchase'}</h2>
              <p className="text-xl text-white/70">Selected: {planDetails.name} - {planDetails.credits.toLocaleString()} credits</p>
            </div>
            <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-7 mb-6 shadow-sm">
              {selectedPlan === 'free-trial' ? (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
                  <h3 className="font-bold text-green-900 text-lg mb-2 flex items-center gap-1.5"><CheckCircle2 className="w-5 h-5" /> Free Trial Ready!</h3>
                  <p className="text-sm text-green-800 mb-3">Start with 250 free credits. No credit card required.</p>
                  <ul className="space-y-1 text-sm text-green-800">
                    {['No credit card required', '1 agent included', 'Up to 5x concurrency for testing', 'Upgrade anytime'].map((f, i) => <li key={i} className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 shrink-0" /> {f}</li>)}
                  </ul>
                  <p className="mt-3 text-xs text-green-700">Paid plans unlock up to {highestPlanLimits.maxAgents} agents and {highestPlanLimits.maxConcurrency}x concurrency.</p>
                </div>
              ) : (
                <div className="text-center">
                  <h3 className="font-bold text-gray-900 text-xl mb-1">{planDetails.name} Plan</h3>
                  <p className="text-3xl font-bold text-blue-600 mb-1">${planDetails.price}</p>
                  <p className="text-gray-500 text-sm mb-5">{planDetails.credits.toLocaleString()} credits</p>
                  <p className="text-sm text-gray-600 mb-5">Includes up to {planDetails.maxAgents} agent{planDetails.maxAgents === 1 ? '' : 's'} and {planDetails.maxConcurrency}x concurrency.</p>
                  {!paymentAdded && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500">A payment method is required before purchasing. Add one in the Billing settings, then return here.</p>
                      <button onClick={() => window.open('/settings?tab=billing', '_blank')} className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold hover:shadow-lg transition-all">
                        Add Payment Method
                      </button>
                    </div>
                  )}
                  {paymentAdded && !planPurchased && (
                    <div className="space-y-3">
                      <div className="bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg p-3 flex items-center justify-center gap-2 mb-3">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Payment method added
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const r = await api.post('/api/plans/upgrade', { planType: selectedPlan })
                            if (r.data.success) { setPlanPurchased(true) }
                          } catch { }
                        }}
                        className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-xl hover:scale-105 transition-all"
                      >
                        Purchase {planDetails.name} - ${planDetails.price}
                      </button>
                    </div>
                  )}
                  {planPurchased && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3 justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <p className="text-sm text-green-800 font-semibold">Plan purchased! {planDetails.credits.toLocaleString()} credits added.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <button onClick={back} className="px-6 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-semibold transition-all">← Back</button>
              <button
                onClick={next}
                disabled={selectedPlan !== 'free-trial' && !planPurchased}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* REVIEW */}
        {step === 'review' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-7">
              <h2 className="text-4xl font-bold text-white mb-2">Review Your Agent</h2>
              <p className="text-xl text-white/70">Everything look good?</p>
            </div>
            <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm space-y-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Agent Name</p>
                  <p className="text-2xl font-bold text-gray-900">{agentName}</p>
                </div>
                <button onClick={() => editStep('name-agent')} className="shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors">Edit</button>
              </div>
              {specialInstructions.trim() && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-blue-900 mb-1">General Instructions</p>
                    <p className="text-xs text-blue-800">{specialInstructions}</p>
                  </div>
                  <button onClick={() => editStep('configure')} className="shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors">Edit</button>
                </div>
              )}
              {personality && (
                <div className="flex items-start justify-between gap-2">
                  <div>
                  <p className="text-sm text-gray-500 mb-1">Personality</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${colorGrad[personality.color]} p-0.5`}>
                      <img src={personality.avatar} alt={personality.name} className="w-full h-full rounded-full object-cover bg-white" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(personality.name)}&background=3b82f6&color=ffffff` }} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{personality.name}</p>
                      <p className="text-xs text-gray-500">{personality.emailStyle}</p>
                    </div>
                  </div>
                  </div>
                  <button onClick={() => editStep('personality')} className="shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors">Edit</button>
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">Settings Preset</p>
                <p className="text-lg font-bold text-gray-900">{presetName}</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Company Size:</span>
                    <span className="text-gray-900 font-medium">{settings.companySizeMin.toLocaleString()} – {settings.companySizeMax.toLocaleString()} employees</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Leads/cycle:</span>
                    <span className="text-gray-900 font-medium">{settings.leadsPerCycle}</span>
                  </div>
                  {settings.industries.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {settings.industries.slice(0, 5).map(i => <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">{i}</span>)}
                    </div>
                  )}
                  {settings.jobTitles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {settings.jobTitles.slice(0, 5).map(t => <span key={t} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{t}</span>)}
                    </div>
                  )}
                </div>
                </div>
                <button onClick={() => editStep('configure')} className="shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors">Edit</button>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div>
                <p className="text-sm text-gray-500 mb-1">Email Sending</p>
                <p className="font-semibold text-gray-900 inline-flex items-center gap-1.5">
                  <Mail className="w-4 h-4 shrink-0" /> {useGmail ? 'Gmail (Primary inbox)' : useOutlook ? 'Outlook/Office 365' : 'Mailgun (Standard)'}
                </p>
                {linkedinConnected && <p className="text-sm text-[#0A66C2] font-medium mt-0.5">+ LinkedIn outreach enabled</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => editStep('email-setup')} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors">Email</button>
                  <button onClick={() => editStep('linkedin-setup')} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors">LinkedIn</button>
                </div>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notifications</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${notifEmailEnabled ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                      <Mail className="w-3 h-3" /> Email {notifEmailEnabled ? 'on' : 'off'}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${notifSmsEnabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      <MessageSquare className="w-3 h-3" /> SMS {notifSmsEnabled ? 'on' : 'off'}
                    </span>
                  </div>
                </div>
                <button onClick={() => editStep('notifications')} className="shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors">Edit</button>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">Plan</p>
                <p className="font-semibold text-gray-900">{planDetails.name} - {planDetails.credits.toLocaleString()} credits</p>
                <p className="text-xs text-gray-500 mt-1">Up to {planDetails.maxAgents} agent{planDetails.maxAgents === 1 ? '' : 's'} · Up to {planDetails.maxConcurrency}x concurrency</p>
                <p className="text-xs text-gray-500 mt-1">Higher tiers unlock up to {highestPlanLimits.maxAgents} agents and {highestPlanLimits.maxConcurrency}x concurrency.</p>
                {planDetails.maxAgents < highestPlanLimits.maxAgents && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                    {plans
                      .filter(plan => plan.maxAgents > planDetails.maxAgents)
                      .map(plan => (
                        <span key={`${plan.id}-review-agents`} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 border border-blue-100">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5V9H2v11h5m10 0v-2a4 4 0 00-4-4H11a4 4 0 00-4 4v2m10 0H7m10 0a2 2 0 002-2v-3m-12 5a2 2 0 01-2-2v-3m12-4a2 2 0 10-4 0 2 2 0 004 0zm-8 0a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          Upgrade to {plan.name} for {plan.maxAgents} agents
                        </span>
                      ))}
                  </div>
                )}
                </div>
                <button onClick={() => editStep('plan')} className="shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors">Edit</button>
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={back} className="px-6 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-semibold transition-all">← Back</button>
              <button onClick={next} className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Create Agent
              </button>
            </div>
          </div>
        )}

        {/* CREATING */}
        {step === 'creating' && (
          <div className="text-center max-w-xl mx-auto py-8">
            {createError ? (
              <>
                <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <h2 className="text-4xl font-bold text-white mb-4">Something went wrong</h2>
                <p className="text-xl text-white/80 mb-6">{createError}</p>
                <button onClick={() => window.location.reload()} className="px-8 py-3 bg-white text-purple-700 rounded-xl font-bold hover:scale-105 transition-all">Try Again</button>
              </>
            ) : createSuccess ? (
              <>
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="text-4xl font-bold text-white mb-4">{agentName} Created!</h2>
                <p className="text-xl text-white/80">Redirecting to your dashboard...</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 border-8 border-blue-500 border-t-transparent rounded-full mx-auto mb-6 animate-spin" />
                <h2 className="text-4xl font-bold text-white mb-4">Creating {agentName}...</h2>
                <p className="text-xl text-white/80">Setting up your AI agent. This will only take a moment!</p>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
