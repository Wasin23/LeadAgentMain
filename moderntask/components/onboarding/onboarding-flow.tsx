'use client'

import { useState, useEffect, useRef } from 'react'
import { Check, X, CloudUpload, Loader2, Lock, XCircle, Sparkles, AlertTriangle, ChevronDown } from 'lucide-react'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import api from '@/lib/api'
import { MailboxLoader } from '@/components/ui/mailbox-loader'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

function AddCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardholderName, setCardholderName] = useState('')
  const [cardReady, setCardReady] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  useEffect(() => {
    api.post('/api/billing/setup-intent')
      .then(({ data }) => setClientSecret(data.clientSecret))
      .catch(() => setError('Failed to initialize payment form. Please try again.'))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || !clientSecret) return
    setLoading(true); setError(null)
    try {
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: elements.getElement(CardElement)!, billing_details: { name: cardholderName } },
      })
      if (stripeError) {
        setError(stripeError.message || 'Failed to add card')
      } else if (setupIntent?.payment_method) {
        await api.post('/api/billing/add-payment-method', { paymentMethodId: setupIntent.payment_method })
        onSuccess()
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to add card')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <label className="block text-[11px] text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Name on card</label>
          <input
            type="text"
            value={cardholderName}
            onChange={e => setCardholderName(e.target.value)}
            placeholder="Full name"
            required
            className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          />
        </div>
        <div className="px-4 py-3">
          <label className="block text-[11px] text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Card details</label>
          <CardElement
            onReady={() => setCardReady(true)}
            onChange={e => setError(e.error?.message ?? null)}
            options={{ style: { base: { fontSize: '15px', fontFamily: 'inherit', color: '#111827', '::placeholder': { color: '#9ca3af' } }, invalid: { color: '#ef4444' } } }}
          />
        </div>
      </div>
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || !elements || loading || !cardholderName.trim() || !cardReady || !clientSecret}
        className="w-full h-11 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</> : !clientSecret ? <><Loader2 className="w-4 h-4 animate-spin" />Loading…</> : 'Save card'}
      </button>
      <button type="button" onClick={onCancel} disabled={loading} className="w-full text-center text-sm text-gray-400 hover:text-gray-700 transition disabled:opacity-50">
        Cancel
      </button>
      <div className="flex items-center justify-center gap-1 text-xs text-gray-400 pt-1">
        <Lock className="w-3 h-3" />
        <span>Secured by Stripe</span>
      </div>
    </form>
  )
}

function AddPaymentModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">Add payment method</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>
        <Elements stripe={stripePromise}>
          <AddCardForm onSuccess={onSuccess} onCancel={onClose} />
        </Elements>
      </div>
    </div>
  )
}
import { MeridianWordmark } from '@/components/ui/meridian-wordmark'
import {
  IllustrationCompanyScrape,
  IllustrationTargeting,
  IllustrationAgent,
  IllustrationEmailConnect,
  IllustrationOutreach,
  IllustrationPlan,
  IllustrationSpeed,
  IllustrationCRM,
  IllustrationReview,
} from './step-illustrations'

const PERSONALITY_TYPES = [
  { id: 'hunter', name: 'The Hunter', color: 'red', description: 'Aggressive prospector focused on high-volume outreach and quick conversions', avatar: '/avatars/Hunter.png', traits: ['High-energy', 'Direct', 'Persistent'], emailStyle: 'Bold, action-oriented', prompt: 'You are The Hunter - a high-energy, results-driven AI sales agent focused on quick conversions.' },
  { id: 'relationship-builder', name: 'Relationship Builder', color: 'blue', description: 'Warm, consultative approach building long-term partnerships', avatar: '/avatars/Relationship-Builder.png', traits: ['Empathetic', 'Patient', 'Consultative'], emailStyle: 'Warm, personal', prompt: 'You are The Relationship Builder - a warm, empathetic AI sales agent building genuine partnerships.' },
  { id: 'analyst', name: 'The Analyst', color: 'purple', description: 'Data-driven methodology with deep research and industry insights', avatar: '/avatars/Analyst.png', traits: ['Analytical', 'Detail-oriented', 'Evidence-based'], emailStyle: 'Data-rich, insightful', prompt: 'You are The Analyst - a data-driven, research-focused AI sales agent who leads with insights.' },
  { id: 'consultant', name: 'The Consultant', color: 'green', description: 'Solution-focused expert positioning as a strategic advisor', avatar: '/avatars/consultant.png', traits: ['Advisory', 'Strategic', 'Solution-focused'], emailStyle: 'Advisory, strategic', prompt: 'You are The Consultant - a strategic advisor positioning yourself as a trusted partner.' },
  { id: 'networker', name: 'The Networker', color: 'indigo', description: 'Connection-based approach leveraging mutual contacts', avatar: '/avatars/Networker.png', traits: ['Social', 'Community-driven', 'Referral-based'], emailStyle: 'Social, community-focused', prompt: 'You are The Networker - a socially-savvy AI agent who leverages connections.' },
]

const APOLLO_INDUSTRIES = [
  'Software Development','SaaS','Cloud Computing','Cybersecurity','AI/Machine Learning','Data Analytics',
  'Healthcare','Hospitals & Health Systems','Medical Devices','Pharmaceuticals','Biotechnology','Telemedicine',
  'Banking','Investment Management','Insurance','FinTech','Payment Processing','Wealth Management',
  'Automotive','Aerospace & Defense','Electronics Manufacturing','Chemicals','Food & Beverage',
  'E-commerce','Fashion & Apparel','Grocery & Food Retail','Electronics Retail','Beauty & Cosmetics',
  'Consulting','Legal Services','Marketing & Advertising','Public Relations','Architecture','Engineering Services',
  'Commercial Real Estate','Residential Real Estate','Property Management','Construction',
  'K-12 Education','Higher Education','Online Learning','Corporate Training','EdTech',
  'Digital Media','Broadcasting','Publishing','Entertainment','Gaming','Social Media',
  'Hotels & Resorts','Restaurants & Food Service','Travel & Tourism','Airlines',
  'Nonprofit','Charitable Organizations','Environmental','Research Foundations',
  'Technology','Finance','Retail','Manufacturing','Hospitality','Media',
]

const JOB_TITLES = [
  'CEO','COO','CFO','CTO','CMO','President','Founder','Co-Founder','Managing Director',
  'VP Sales','VP Marketing','VP Engineering','VP Operations','VP Finance','VP Product','VP Business Development',
  'Director of Sales','Marketing Director','Engineering Director','Operations Director','IT Director',
  'Sales Manager','Marketing Manager','Engineering Manager','Product Manager','Project Manager',
  'Sales Representative','Marketing Specialist','Software Engineer','Data Analyst','Account Manager',
]

const CRM_CONFIGS = [
  { id: 'hubspot', name: 'HubSpot', fields: [{ name: 'Private App Access Token', key: 'apiKey', type: 'password', placeholder: 'pat-na1-...', helpText: 'Create a Private App in Settings → Integrations' }] },
  { id: 'salesforce', name: 'Salesforce', fields: [{ name: 'Instance URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourinstance.salesforce.com', helpText: undefined }, { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Salesforce access token', helpText: undefined }] },
  { id: 'pipedrive', name: 'Pipedrive', fields: [{ name: 'API Token', key: 'apiKey', type: 'password', placeholder: 'Your Pipedrive API token', helpText: 'Settings → Personal preferences → API' }] },
  { id: 'zoho', name: 'Zoho CRM', fields: [{ name: 'Data Center', key: 'apiUrl', type: 'text', placeholder: 'https://www.zohoapis.com', helpText: undefined }, { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Zoho OAuth access token', helpText: undefined }] },
  { id: 'activecampaign', name: 'ActiveCampaign', fields: [{ name: 'API URL', key: 'apiUrl', type: 'text', placeholder: 'https://youraccount.api-us1.com', helpText: 'Settings → Developer' }, { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your ActiveCampaign API Key', helpText: undefined }] },
  { id: 'close', name: 'Close', fields: [{ name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'api_...', helpText: 'Settings → API Keys' }] },
  { id: 'copper', name: 'Copper', fields: [{ name: 'User Email', key: 'apiUrl', type: 'text', placeholder: 'your@email.com', helpText: undefined }, { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Copper API key', helpText: 'Settings → Integrations → API Keys' }] },
  { id: 'dynamics365', name: 'Microsoft Dynamics 365', fields: [{ name: 'Organization URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourorg.crm.dynamics.com', helpText: undefined }, { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Azure AD access token', helpText: undefined }] },
  { id: 'nutshell', name: 'Nutshell', fields: [{ name: 'User Email', key: 'apiUrl', type: 'text', placeholder: 'your@email.com', helpText: undefined }, { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Nutshell API key', helpText: undefined }] },
  { id: 'insightly', name: 'Insightly', fields: [{ name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Insightly API key', helpText: 'User Settings → API' }] },
  { id: 'capsule', name: 'Capsule', fields: [{ name: 'API Token', key: 'apiKey', type: 'password', placeholder: 'Your Capsule API token', helpText: 'My Preferences → API Authentication Tokens' }] },
  { id: 'zendesksell', name: 'Zendesk Sell', fields: [{ name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Zendesk Sell access token', helpText: undefined }] },
]

const PLANS = [
  { id: 'free-trial', name: 'Free Trial', price: 0, credits: 250, maxAgents: 1, maxConcurrency: 3, description: 'Perfect for trying out Meridian', features: ['250 free credits', '1 agent included', 'Up to 3x speed', 'No credit card required'] },
  { id: 'basic', name: 'Basic', price: 100, credits: 1200, maxAgents: 3, maxConcurrency: 5, description: 'Get started on a budget', features: ['1,200 credits', 'Up to 3 agents', 'Up to 5x speed'] },
  { id: 'starter', name: 'Starter', price: 500, credits: 13000, maxAgents: 5, maxConcurrency: 10, description: 'For solo entrepreneurs', features: ['13,000 credits', 'Up to 5 agents', 'Up to 10x speed'] },
  { id: 'professional', name: 'Professional', price: 1000, credits: 30000, maxAgents: 10, maxConcurrency: 20, description: 'For growing teams', features: ['30,000 credits', 'Up to 10 agents', 'Up to 20x speed'], popular: true },
  { id: 'enterprise', name: 'Enterprise', price: 2500, credits: 70000, maxAgents: 30, maxConcurrency: 30, description: 'High-volume operations', features: ['70,000 credits', 'Up to 30 agents', 'Up to 30x speed'] },
]


const STEPS = [
  { id: 1, label: 'Company' },
  { id: 2, label: 'Targeting' },
  { id: 3, label: 'Your Agent' },
  { id: 4, label: 'Connect Email' },
  { id: 5, label: 'Outreach' },
  { id: 6, label: 'Plan' },
  { id: 7, label: 'Speed & Alerts' },
  { id: 8, label: 'CRM' },
  { id: 9, label: 'Review' },
]

type PersonalityType = typeof PERSONALITY_TYPES[0]
type CrmConfig = typeof CRM_CONFIGS[0]

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{ width: '44px', height: '24px' }}
      className={`relative rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-green-800' : 'bg-gray-200'}`}>
      <span className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all"
        style={{ left: checked ? '23px' : '3px' }} />
    </button>
  )
}

interface Props { onComplete: () => void }

export default function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [returnToReview, setReturnToReview] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showLaunchLoader, setShowLaunchLoader] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Step 1: Company Profile ───────────────────────────────────────────────
  const [companyName, setCompanyName] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')
  const [linkedinProfile, setLinkedinProfile] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyAddress] = useState('')
  const [location, setLocation] = useState('')
  const [founded, setFounded] = useState('')
  const [employees, setEmployees] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [targetMarket, setTargetMarket] = useState('')
  const [services, setServices] = useState('')
  const [coreOffering, setCoreOffering] = useState('')
  const [keyAdvantages, setKeyAdvantages] = useState('')
  const [step1Details, setStep1Details] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [fileUploading, setFileUploading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  // ── Step 2: Targeting ─────────────────────────────────────────────────────
  const [industries, setIndustries] = useState<string[]>([])
  const [jobTitles, setJobTitles] = useState<string[]>([])
  const [companySizeMin, setCompanySizeMin] = useState(50)
  const [companySizeMax, setCompanySizeMax] = useState(500)
  const [leadsPerCycle, setLeadsPerCycle] = useState(10)
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [autofilling, setAutofilling] = useState(false)

  // ── Step 3: Agent ─────────────────────────────────────────────────────────
  const [personality, setPersonality] = useState<PersonalityType | null>(null)
  const [agentName, setAgentName] = useState('')
  const [presetName, setPresetName] = useState('')

  // ── Step 4: Email & Outreach ──────────────────────────────────────────────
  const [gmailConnected, setGmailConnected] = useState(false)
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [linkedinConnected, setLinkedinConnected] = useState(false)
  const [linkedinConnecting, setLinkedinConnecting] = useState(false)
  const [useGmail, setUseGmail] = useState(false)
  const [useOutlook, setUseOutlook] = useState(false)
  const [ccEmails, setCcEmails] = useState('')
  const [bccEmails, setBccEmails] = useState('')
  const [followupIntervalDays, setFollowupIntervalDays] = useState(7)
  const [enableAutoResponse, setEnableAutoResponse] = useState(true)
  const [useCustomSignature, setUseCustomSignature] = useState(true)
  const [signatureName, setSignatureName] = useState('')
  const [signatureTitle, setSignatureTitle] = useState('')
  const [useTemplate, setUseTemplate] = useState(false)
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateBody, setTemplateBody] = useState('')
  const [emailLength, setEmailLength] = useState('medium')
  const [callToAction, setCallToAction] = useState('schedule-meeting')
  const [personalizationLevel, setPersonalizationLevel] = useState('high')

  // ── Step 5: Plan + Notifications ─────────────────────────────────────────
  const [selectedPlan, setSelectedPlan] = useState('free-trial')
  const [planPurchased, setPlanPurchased] = useState(false)
  const [paymentAdded, setPaymentAdded] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [concurrencyLevel, setConcurrencyLevel] = useState(1)
  const [notifEmailEnabled, setNotifEmailEnabled] = useState(true)
  const [notifSmsEnabled, setNotifSmsEnabled] = useState(false)

  // ── Step 6: CRM ───────────────────────────────────────────────────────────
  const [selectedCrm, setSelectedCrm] = useState<CrmConfig | null>(null)
  const [crmCreds, setCrmCreds] = useState<Record<string, string>>({})
  const [crmConnecting, setCrmConnecting] = useState(false)
  const [crmConnected, setCrmConnected] = useState(false)
  const [crmError, setCrmError] = useState<string | null>(null)

  const planDetails = PLANS.find(p => p.id === selectedPlan) || PLANS[0]

  useEffect(() => {
    api.get('/api/auth/gmail/status').then(r => {
      if (r.data?.connected) {
        setGmailConnected(true)
        if (r.data.accounts?.some((a: { isActive?: boolean }) => a.isActive)) setUseGmail(true)
      }
    }).catch(() => {})
    api.get('/api/auth/outlook/status').then(r => {
      if (r.data?.connected) {
        setOutlookConnected(true)
        if (r.data.accounts?.some((a: { isActive?: boolean }) => a.isActive)) setUseOutlook(true)
      }
    }).catch(() => {})
    api.get('/api/auth/linkedin/status').then(r => { if (r.data?.connected) setLinkedinConnected(true) }).catch(() => {})
    api.get('/api/auth/profile').then(r => { if (r.data?.user?.paymentMethodAdded) setPaymentAdded(true) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (concurrencyLevel > planDetails.maxConcurrency) setConcurrencyLevel(planDetails.maxConcurrency)
  }, [planDetails.maxConcurrency, concurrencyLevel])

  // Sync presetName with agentName if user hasn't customised it
  const [presetNameTouched, setPresetNameTouched] = useState(false)
  useEffect(() => { if (!presetNameTouched) setPresetName(agentName) }, [agentName, presetNameTouched])

  const addIndustry = (i: string) => setIndustries(p => [...p, i])
  const addJob = (t: string) => setJobTitles(p => [...p, t])

  const applyProfile = (p: Record<string, string>) => {
    if (p.companyName) setCompanyName(p.companyName)
    if (p.tagline) setTagline(p.tagline)
    if (p.description) setDescription(p.description)
    if (p.industry) setIndustry(p.industry)
    if (p.website) setWebsite(p.website)
    if (p.linkedinProfile) setLinkedinProfile(p.linkedinProfile)
    if (p.email) setCompanyEmail(p.email)
    if (p.phone) setPhone(p.phone)
    if (p.location) setLocation(p.location)
    if (p.founded) setFounded(p.founded)
    if (p.employees) setEmployees(p.employees)
    if (p.companySize) setCompanySize(p.companySize)
    if (p.targetMarket) setTargetMarket(p.targetMarket)
    if (p.services) setServices(p.services)
    if (p.coreOffering) setCoreOffering(p.coreOffering)
    if (p.keyAdvantages) setKeyAdvantages(p.keyAdvantages)
  }

  const scrapeAndAdvance = async () => {
    if (!website.trim()) return
    setScraping(true); setScrapeError(null)
    try {
      let url = website.trim()
      if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url
      const r = await api.post('/api/company-profile/scrape-website', { url, fromOnboarding: true })
      if (r.data.success && r.data.profile) applyProfile(r.data.profile)
    } catch { setScrapeError('Could not fetch website. Fill in manually.') }
    finally { setScraping(false); setStep1Details(true) }
  }

  const handleFileUploadAndAdvance = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileUploading(true); setUploadedFileName(file.name)
    try {
      const isImage = file.type.startsWith('image/')
      let content: string
      if (isImage) {
        const reader = new FileReader()
        content = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      } else {
        content = await file.text()
      }
      const r = await api.post('/api/company-profile/analyze', { content, fileName: file.name, isImage })
      if (r.data.success && r.data.profile) applyProfile(r.data.profile)
    } catch { setUploadedFileName(null) }
    finally { setFileUploading(false); setStep1Details(true) }
  }

  const autofillTargeting = async () => {
    setAutofilling(true)
    try {
      const r = await api.post('/api/company-profile/autofill-targeting')
      const a = r.data.autofill
      if (a.industries?.length) setIndustries(a.industries)
      if (a.jobTitles?.length) setJobTitles(a.jobTitles)
      if (a.companySizeMin) setCompanySizeMin(a.companySizeMin)
      if (a.companySizeMax) setCompanySizeMax(a.companySizeMax)
      if (a.generalInstructions) setSpecialInstructions(a.generalInstructions)
    } catch {}
    finally { setAutofilling(false) }
  }

  // Activating a provider here sets it as the ONE globally active sending
  // account (shared by every agent, controlled from Outreach) — not a
  // per-agent preference baked into the agent this wizard is about to create.
  const activateGmail = async () => {
    await api.post('/api/auth/gmail/set-active', { accountIndex: 0 }).catch(() => {})
    setUseGmail(true); setUseOutlook(false)
  }

  const activateOutlook = async () => {
    await api.post('/api/auth/outlook/set-active', { accountIndex: 0 }).catch(() => {})
    setUseOutlook(true); setUseGmail(false)
  }

  const connectGmail = async () => {
    try {
      const r = await api.get('/api/auth/gmail/oauth-url')
      const w = window.open(r.data.authUrl, 'Gmail OAuth', 'width=600,height=700')
      const check = setInterval(async () => {
        if (w?.closed) {
          clearInterval(check)
          await new Promise(res => setTimeout(res, 1000))
          const sr = await api.get('/api/auth/gmail/status').catch(() => null)
          if (sr?.data?.connected) {
            setGmailConnected(true)
            await activateGmail()
          }
        }
      }, 500)
    } catch {}
  }

  const connectOutlook = async () => {
    try {
      const r = await api.get('/api/auth/outlook/oauth-url')
      const w = window.open(r.data.authUrl, 'Outlook OAuth', 'width=600,height=700')
      const check = setInterval(async () => {
        if (w?.closed) {
          clearInterval(check)
          await new Promise(res => setTimeout(res, 1000))
          const sr = await api.get('/api/auth/outlook/status').catch(() => null)
          if (sr?.data?.connected) {
            setOutlookConnected(true)
            await activateOutlook()
          }
        }
      }, 500)
    } catch {}
  }

  const connectLinkedIn = async () => {
    try {
      setLinkedinConnecting(true)
      const r = await api.get('/api/auth/linkedin/oauth-url')
      const w = window.open(r.data.authUrl, 'LinkedIn OAuth', 'width=600,height=700')
      const onMsg = (e: MessageEvent) => {
        if (e.data?.type === 'LINKEDIN_CONNECTED') { setLinkedinConnected(true); window.removeEventListener('message', onMsg); setLinkedinConnecting(false) }
      }
      window.addEventListener('message', onMsg)
      const check = setInterval(() => {
        if (w?.closed) { clearInterval(check); window.removeEventListener('message', onMsg); setLinkedinConnecting(false) }
      }, 500)
    } catch { setLinkedinConnecting(false) }
  }

  const connectCrm = async () => {
    if (!selectedCrm) return
    const missing = selectedCrm.fields.filter(f => !crmCreds[f.key]?.trim())
    if (missing.length) { setCrmError(`Please fill in: ${missing.map(f => f.name).join(', ')}`); return }
    setCrmConnecting(true); setCrmError(null)
    try {
      await api.post('/api/crm/connect-direct', { integrationName: selectedCrm.id, apiUrl: crmCreds.apiUrl?.trim() || '', apiKey: crmCreds.apiKey?.trim() || '' })
      setCrmConnected(true)
    } catch (e: unknown) {
      setCrmError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to connect. Check your credentials.')
    } finally { setCrmConnecting(false) }
  }

  const purchasePlan = async () => {
    try {
      const r = await api.post('/api/plans/upgrade', { planType: selectedPlan })
      if (r.data.success) setPlanPurchased(true)
    } catch {}
  }

  const launch = async () => {
    setCreating(true); setCreateError(null)
    try {
      await api.post('/api/company-profile/save', {
        profile: {
          companyName, tagline, description, industry, website, linkedinProfile,
          email: companyEmail, phone, companyAddress, location, founded, employees,
          companySize, targetMarket, services: services || coreOffering, coreOffering, keyAdvantages,
          logo: '',
        },
        recommendedPreset: null,
      })

      const presetRes = await api.post('/api/settings/presets', {
        name: presetName || agentName,
        targetIndustries: industries,
        targetPositions: jobTitles,
        companySizeMin, companySizeMax,
        leadLimit: leadsPerCycle,
        emailLength,
        callToAction,
        personalizationLevel,
        ccEmails, bccEmails,
        followupIntervalDays,
        enableAutoResponse,
        useCustomSignature, signatureName, signatureTitle,
        templates: useTemplate && templateBody.trim()
          ? [{ id: `tpl_${Date.now()}`, name: 'Default', subject: templateSubject.trim(), body: templateBody.trim() }]
          : [],
        useTemplates: !!(useTemplate && templateBody.trim()),
        specialInstructions,
      })
      if (!presetRes.data.success) throw new Error('Failed to create preset')
      const cp = presetRes.data.preset

      const agentRes = await api.post('/api/auth/create-agent', {
        name: agentName,
        type: 'reasoning-lead-agent',
        specialInstructions,
        concurrencyLevel,
        personality: personality ? {
          type: personality.id, name: personality.name, description: personality.description,
          avatar: personality.avatar, emailPrompt: personality.prompt,
          emailStyle: personality.emailStyle, traits: personality.traits, color: personality.color,
        } : undefined,
        preset: {
          presetId: cp.id, name: cp.name,
          targetIndustries: cp.targetIndustries, targetPositions: cp.targetPositions,
          companySizeMin: cp.companySizeMin, companySizeMax: cp.companySizeMax,
          leadLimit: cp.leadLimit, emailLength: cp.emailLength,
          callToAction: cp.callToAction, personalizationLevel: cp.personalizationLevel,
          ccEmails: cp.ccEmails, bccEmails: cp.bccEmails,
          followupIntervalDays: cp.followupIntervalDays, enableAutoResponse: cp.enableAutoResponse,
          useCustomSignature: cp.useCustomSignature, signatureName: cp.signatureName, signatureTitle: cp.signatureTitle,
          templates: cp.templates || [], useTemplates: cp.useTemplates ?? false,
        },
      })
      if (!agentRes.data.success) throw new Error('Failed to create agent')
      await api.put('/api/settings/notifications', { emailEnabled: notifEmailEnabled, smsEnabled: notifSmsEnabled }).catch(() => {})
      setShowLaunchLoader(true)
    } catch (err: unknown) {
      setCreateError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Something went wrong')
      setCreating(false)
    }
  }

  const ic = 'w-full h-10 px-3 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 transition-colors bg-white'
  const ta = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 transition-colors resize-none bg-white'
  const lc = 'block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider'
  const bp = 'h-10 px-5 bg-gray-900 text-white text-sm rounded-xl font-medium hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const bb = 'h-10 px-4 text-sm text-gray-400 hover:text-gray-700 transition-colors'

  const next = (n: number) => { if (returnToReview) { setReturnToReview(false); setStep(9) } else setStep(n) }
  const editStep = (n: number) => { setReturnToReview(true); setStep(n) }

  function StepContent() {

    // ── Step 1a: Autofill source ─────────────────────────────────────────────
    if (step === 1 && !step1Details) return (
      <>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Let's start with your company</h2>
        <p className="text-sm text-gray-500 mb-8">Paste your website URL or upload a doc and we'll fill everything in for you.</p>

        <div className="space-y-3 mb-8">
          <div className="flex gap-2">
            <input type="url" placeholder="https://yourcompany.com" value={website}
              onChange={e => setWebsite(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && website.trim()) scrapeAndAdvance() }}
              className={`${ic} flex-1`} />
            <button onClick={scrapeAndAdvance} disabled={!website.trim() || scraping}
              className="h-10 px-4 bg-gray-900 text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-gray-700 transition-colors shrink-0">
              {scraping ? 'Scraping…' : 'Autofill →'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <button onClick={() => fileInputRef.current?.click()} disabled={fileUploading}
            className="w-full h-12 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
            {uploadedFileName && !fileUploading ? <Check size={16} /> : <CloudUpload size={16} />}
            {fileUploading ? 'Reading doc…' : uploadedFileName ? uploadedFileName : 'Upload a whitepaper, one-pager, or pitch deck'}
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.doc,.docx,.md,.png,.jpg,.jpeg" onChange={handleFileUploadAndAdvance} className="hidden" />
        </div>

        {scrapeError && <p className="text-red-500 text-xs mb-4">{scrapeError}</p>}

        <button onClick={() => setStep1Details(true)} className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors">
          Fill in manually →
        </button>
      </>
    )

    // ── Step 1b: Company details ──────────────────────────────────────────────
    if (step === 1 && step1Details) return (
      <>
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setStep1Details(false)} className="text-gray-400 hover:text-gray-600 transition-colors">←</button>
          <h2 className="text-3xl font-bold text-gray-900">Your company</h2>
          {(companyName || services) && <span className="ml-auto text-xs text-green-600 font-medium inline-flex items-center gap-1">Autofilled <Check className="w-3 h-3" /></span>}
        </div>

        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className={lc}>Company name <span className="text-red-400">*</span></label>
              <input type="text" placeholder="Acme Corp" value={companyName} onChange={e => setCompanyName(e.target.value)} className={ic} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={lc}>Industry</label>
              <input type="text" placeholder="e.g. Technology, SaaS" value={industry} onChange={e => setIndustry(e.target.value)} className={ic} />
            </div>
          </div>
          <div>
            <label className={lc}>Website</label>
            <input type="url" placeholder="https://yourcompany.com" value={website} onChange={e => setWebsite(e.target.value)} className={ic} />
          </div>
          <div>
            <label className={lc}>What you sell <span className="text-red-400">*</span></label>
            <textarea placeholder="Describe your product or service…" value={services} onChange={e => setServices(e.target.value)} rows={3} className={ta} />
          </div>
          <div>
            <label className={lc}>Key differentiator</label>
            <textarea placeholder="What makes you different from competitors?" value={keyAdvantages} onChange={e => setKeyAdvantages(e.target.value)} rows={2} className={ta} />
          </div>
          <div>
            <label className={lc}>Target market</label>
            <textarea placeholder="e.g. B2B SaaS companies with 50–500 employees" value={targetMarket} onChange={e => setTargetMarket(e.target.value)} rows={2} className={ta} />
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={async () => {
            try {
              await api.post('/api/company-profile/save', {
                profile: {
                  companyName, tagline, description, industry, website, linkedinProfile,
                  email: companyEmail, phone, companyAddress, location, founded, employees,
                  companySize, targetMarket, services: services || coreOffering, coreOffering, keyAdvantages,
                  logo: '',
                },
                recommendedPreset: null,
              })
            } catch {}
            setStep(2)
          }} disabled={!companyName.trim() || !services.trim()} className={bp}>
            Continue →
          </button>
        </div>
      </>
    )

    // ── Step 2: Targeting ────────────────────────────────────────────────────
    if (step === 2) return (
      <>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Who to target</h2>
        <p className="text-sm text-gray-500 mb-4">Define your ideal customer profile.</p>

        <button onClick={autofillTargeting} disabled={autofilling}
          className="mb-5 text-sm text-green-700 hover:text-green-900 font-medium transition-colors flex items-center gap-1 disabled:opacity-50">
          {autofilling ? 'Filling…' : <><Sparkles className="w-3.5 h-3.5" /> Autofill from company profile</>}
        </button>

        <div className="mb-4">
          <label className={lc}>Campaign instructions</label>
          <textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)}
            placeholder="e.g. Target CTOs at Series A startups in healthcare. Focus on scaling engineering team pain points."
            rows={3} maxLength={1000} className={ta} />
          <div className="flex justify-end mt-0.5"><span className="text-gray-300 text-xs">{specialInstructions.length}/1000</span></div>
        </div>

        <div className="mb-4">
          <label className={lc}>Target industries</label>
          <MultiPillSelect
            suggestions={['Technology', 'Healthcare', 'Finance', 'SaaS', 'E-commerce', 'Consulting', 'Manufacturing', 'Real Estate']}
            selected={industries}
            onAdd={addIndustry}
            onRemove={i => setIndustries(p => p.filter(x => x !== i))}
            searchList={APOLLO_INDUSTRIES}
            placeholder="Search industries…"
          />
        </div>

        <div className="mb-4">
          <label className={lc}>Target job titles</label>
          <MultiPillSelect
            suggestions={['CEO', 'CTO', 'VP Sales', 'VP Marketing', 'Director of Sales', 'Founder', 'COO']}
            selected={jobTitles}
            onAdd={addJob}
            onRemove={t => setJobTitles(p => p.filter(x => x !== t))}
            searchList={JOB_TITLES}
            placeholder="Search titles…"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className={lc}>Company size (employees)</label>
            <div className="flex items-center gap-1.5">
              <input type="number" value={companySizeMin} onChange={e => setCompanySizeMin(Number(e.target.value))} min={1}
                className="w-full h-10 px-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white text-center" />
              <span className="text-gray-400 text-xs shrink-0">–</span>
              <input type="number" value={companySizeMax} onChange={e => setCompanySizeMax(Number(e.target.value))} min={1}
                className="w-full h-10 px-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white text-center" />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
              Leads per cycle
              <InfoTooltip text="How many new leads your agent researches and contacts each time it runs a cycle. Higher numbers move faster but use more credits per cycle." />
            </label>
            <input type="number" value={leadsPerCycle} onChange={e => setLeadsPerCycle(Number(e.target.value))} min={1} max={100} className={ic} />
            <p className="text-xs text-gray-400 mt-1">~{Math.ceil(leadsPerCycle * 2 / 3)} credits/cycle</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button onClick={() => setStep(1)} className={bb}>← Back</button>
          <div className="flex flex-col items-end gap-1">
            {(industries.length === 0 || jobTitles.length === 0) && (
              <p className="text-xs text-amber-600">Add at least one industry and one job title</p>
            )}
            <button onClick={() => setStep(3)} disabled={industries.length === 0 || jobTitles.length === 0} className={bp}>Continue →</button>
          </div>
        </div>
      </>
    )

    // ── Step 3: Agent ────────────────────────────────────────────────────────
    if (step === 3) return (
      <>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Your agent</h2>
        <p className="text-base text-gray-500 mb-8">Pick a personality and give your agent a name.</p>

        <div className="space-y-2 mb-5">
          {PERSONALITY_TYPES.map(p => (
            <button key={p.id} onClick={() => setPersonality(p)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${personality?.id === p.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'}`}>
              <img src={p.avatar} alt={p.name} className="w-9 h-9 rounded-full object-cover shrink-0 bg-gray-100"
                onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-tight">{p.description}</div>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {p.traits.map(t => <span key={t} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">{t}</span>)}
                </div>
              </div>
              {personality?.id === p.id && (
                <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                  <Check size={11} strokeWidth={3} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className={lc}>Agent name <span className="text-red-400">*</span></label>
            <input type="text" placeholder='e.g. "Alex"' value={agentName} onChange={e => setAgentName(e.target.value)} className={ic} />
            <p className="text-xs text-gray-400 mt-1">The agent&apos;s display name.</p>
          </div>
          <div>
            <label className={lc}>Preset name <span className="text-red-400">*</span></label>
            <input type="text" placeholder='e.g. "SMB Campaign"' value={presetName}
              onChange={e => { setPresetName(e.target.value); setPresetNameTouched(true) }} className={ic} />
            <p className="text-xs text-gray-400 mt-1">Name for these targeting settings.</p>
          </div>
        </div>

        <div className="flex justify-between">
          <button onClick={() => setStep(2)} className={bb}>← Back</button>
          <button onClick={() => setStep(4)} disabled={!personality || !agentName.trim() || !presetName.trim()} className={bp}>Continue →</button>
        </div>
      </>
    )

    // ── Step 4: Connect Email ────────────────────────────────────────────────
    if (step === 4) return (
      <>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Connect your inbox</h2>
        <p className="text-base text-gray-500 mb-8">Your agent sends from your real email address - your name, your domain.</p>

        <div className="space-y-2.5 mb-5">
          <button onClick={() => { if (!gmailConnected) connectGmail(); else if (!useGmail) activateGmail() }}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${gmailConnected && useGmail ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <img src="/gmail.png" alt="Gmail" className="w-9 h-9 rounded-xl object-contain shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-sm text-gray-900">Gmail</div>
              <div className="text-xs text-gray-500">Send from your Google inbox</div>
            </div>
            {gmailConnected && useGmail ? <span className="text-green-600 text-xs font-semibold inline-flex items-center gap-1">Active <Check className="w-3 h-3" /></span>
              : gmailConnected ? <span className="text-gray-400 text-xs">Connected - click to activate</span>
              : <span className="text-gray-400 text-xs">Connect →</span>}
          </button>

          <button onClick={() => { if (!outlookConnected) connectOutlook(); else if (!useOutlook) activateOutlook() }}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${outlookConnected && useOutlook ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <img src="/outlook.png" alt="Outlook" className="w-9 h-9 rounded-xl object-contain shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-sm text-gray-900">Outlook</div>
              <div className="text-xs text-gray-500">Send from your Microsoft inbox</div>
            </div>
            {outlookConnected && useOutlook ? <span className="text-green-600 text-xs font-semibold inline-flex items-center gap-1">Active <Check className="w-3 h-3" /></span>
              : outlookConnected ? <span className="text-gray-400 text-xs">Connected - click to activate</span>
              : <span className="text-gray-400 text-xs">Connect →</span>}
          </button>

          <div className={`w-full flex items-center gap-3 p-4 rounded-xl border ${!useGmail && !useOutlook ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
            <div className="w-9 h-9 rounded-xl bg-[#C13B3B] flex items-center justify-center text-white text-sm font-bold shrink-0">M</div>
            <div className="flex-1">
              <div className="font-semibold text-sm text-gray-900">Mailgun <span className="text-gray-400 font-normal text-xs">(fallback)</span></div>
              <div className="text-xs text-gray-500">Used automatically whenever Gmail/Outlook isn't active. Replies tracked via webhooks.</div>
            </div>
            {!useGmail && !useOutlook && <span className="text-gray-900 text-xs font-semibold inline-flex items-center gap-1">Active <Check className="w-3 h-3" /></span>}
          </div>

          <button onClick={() => { if (!linkedinConnected) connectLinkedIn() }} disabled={linkedinConnected || linkedinConnecting}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${linkedinConnected ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'} disabled:cursor-default`}>
            <img src="/linkedin.png" alt="LinkedIn" className="w-9 h-9 rounded-xl object-contain shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-sm text-gray-900">LinkedIn <span className="text-gray-400 font-normal text-xs">optional</span></div>
              <div className="text-xs text-gray-500">InMail + connection requests for top-tier leads</div>
            </div>
            {linkedinConnected ? <span className="text-green-700 text-xs font-semibold inline-flex items-center gap-1">Connected <Check className="w-3 h-3" /></span>
              : linkedinConnecting ? <span className="text-gray-400 text-xs">Connecting…</span>
              : <span className="text-gray-400 text-xs">Connect →</span>}
          </button>
        </div>

        {!gmailConnected && !outlookConnected && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-5">
            No email connected - agent will use Mailgun. You can add Gmail or Outlook anytime in Settings.
          </p>
        )}

        <div className="flex justify-between">
          <button onClick={() => setStep(3)} className={bb}>← Back</button>
          <button onClick={() => next(5)} className={bp}>Continue →</button>
        </div>
      </>
    )

    // ── Step 5: Outreach settings ────────────────────────────────────────────
    if (step === 5) return (
      <>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Outreach settings</h2>
        <p className="text-base text-gray-500 mb-8">How should your agent write and send emails?</p>

        <div className="space-y-6 mb-6">
          <div>
            <label className={lc}>Email length</label>
            <PillSelect options={['Short', 'Medium', 'Long']} value={emailLength} onChange={v => setEmailLength(v.toLowerCase())} />
          </div>
          <div>
            <label className={lc}>Call to action</label>
            <PillSelect
              options={['Schedule meeting', 'Reply if interested', 'Request a demo', 'Phone call', 'Learn more']}
              value={{ 'schedule-meeting': 'Schedule meeting', 'reply-interest': 'Reply if interested', 'demo-request': 'Request a demo', 'phone-call': 'Phone call', 'learn-more': 'Learn more' }[callToAction] ?? ''}
              onChange={v => setCallToAction({ 'Schedule meeting': 'schedule-meeting', 'Reply if interested': 'reply-interest', 'Request a demo': 'demo-request', 'Phone call': 'phone-call', 'Learn more': 'learn-more' }[v] ?? v)}
            />
          </div>
          <div>
            <label className={lc}>Personalization level</label>
            <PillSelect options={['Low', 'Medium', 'High']} value={personalizationLevel} onChange={v => setPersonalizationLevel(v.toLowerCase())} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>CC emails</label>
              <input type="text" value={ccEmails} onChange={e => setCcEmails(e.target.value)} placeholder="cc@example.com" className={ic} />
            </div>
            <div>
              <label className={lc}>BCC emails</label>
              <input type="text" value={bccEmails} onChange={e => setBccEmails(e.target.value)} placeholder="bcc@example.com" className={ic} />
            </div>
          </div>

          <div>
            <label className={lc}>Follow-up interval (days)</label>
            <input type="number" min={1} max={30} value={followupIntervalDays} onChange={e => setFollowupIntervalDays(Number(e.target.value))}
              className="w-28 h-10 px-3 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white" />
          </div>

          <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <div className="text-sm font-medium text-gray-900">Auto-respond to replies</div>
              <div className="text-xs text-gray-500">Agent handles initial replies automatically</div>
            </div>
            <Toggle checked={enableAutoResponse} onChange={() => setEnableAutoResponse(v => !v)} />
          </div>

          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-gray-900">Email signature <span className="text-xs text-green-800 bg-green-50 px-1.5 py-0.5 rounded ml-1">Recommended</span></div>
                <div className="text-xs text-gray-500">Adds your name and title to each email</div>
              </div>
              <Toggle checked={useCustomSignature} onChange={() => setUseCustomSignature(v => !v)} />
            </div>
            {useCustomSignature && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lc}>Your name</label>
                  <input type="text" value={signatureName} onChange={e => setSignatureName(e.target.value)} placeholder="John Smith" className={ic} />
                </div>
                <div>
                  <label className={lc}>Your title</label>
                  <input type="text" value={signatureTitle} onChange={e => setSignatureTitle(e.target.value)} placeholder="VP of Sales" className={ic} />
                </div>
              </div>
            )}
          </div>

          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-gray-900">Start with a template <span className="text-gray-400 font-normal text-xs">optional</span></div>
                <div className="text-xs text-gray-500">Agent fills merge tags using research</div>
              </div>
              <Toggle checked={useTemplate} onChange={() => setUseTemplate(v => !v)} />
            </div>
            {useTemplate && (
              <div className="space-y-3">
                <div>
                  <label className={lc}>Subject line</label>
                  <input type="text" value={templateSubject} onChange={e => setTemplateSubject(e.target.value)} placeholder="Quick question for {{firstName}}" className={ic} />
                </div>
                <div>
                  <label className={lc}>Email body</label>
                  <textarea rows={5} value={templateBody} onChange={e => setTemplateBody(e.target.value)}
                    placeholder={`Hi {{firstName}},\n\nI noticed {{company}} recently…\n\nBest,\n{{senderName}}`}
                    className={`${ta} font-mono`} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['{{firstName}}','{{company}}','{{role}}','{{painPoint}}','{{recentNews}}','{{senderName}}'].map(tag => (
                    <button key={tag} type="button" onClick={() => setTemplateBody(b => b + tag)}
                      className="text-[11px] font-mono px-2 py-0.5 bg-white rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-200 transition-colors text-gray-700">
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between">
          <button onClick={() => setStep(4)} className={bb}>← Back</button>
          <button onClick={() => next(6)} className={bp}>Continue →</button>
        </div>
      </>
    )

    // ── Step 6: Plan ─────────────────────────────────────────────────────────
    if (step === 6) return (
      <>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Choose a plan</h2>
        <p className="text-base text-gray-500 mb-8">Start free and upgrade anytime.</p>

        <div className="space-y-2 mb-4">
          {PLANS.map(p => (
            <button key={p.id} onClick={() => { setSelectedPlan(p.id); setPlanPurchased(false) }}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${selectedPlan === p.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">{p.name}</span>
                  {'popular' in p && p.popular && <span className="px-1.5 py-0.5 bg-green-800 text-white text-[10px] rounded font-medium">Popular</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{p.credits.toLocaleString()} credits · {p.maxAgents} agent{p.maxAgents > 1 ? 's' : ''} · {p.maxConcurrency}× speed</div>
              </div>
              <div className="text-right shrink-0">
                {p.price === 0 ? <span className="text-sm font-bold text-gray-900">Free</span>
                  : <span className="text-sm font-bold text-gray-900">${p.price.toLocaleString()}<span className="font-normal text-gray-500 text-xs">/mo</span></span>}
              </div>
              {selectedPlan === p.id && <div className="w-4 h-4 rounded-full bg-gray-900 flex items-center justify-center shrink-0 ml-1"><Check size={9} strokeWidth={3} className="text-white" /></div>}
            </button>
          ))}
        </div>

        {selectedPlan !== 'free-trial' && (
          <div className="mb-4 p-4 border border-gray-200 rounded-xl">
            <p className="text-sm font-semibold text-gray-900 mb-1">{planDetails.name} - ${planDetails.price}/mo</p>
            {planPurchased ? (
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium mt-2">
                <Check size={14} /> Plan purchased - {planDetails.credits.toLocaleString()} credits added
              </div>
            ) : !paymentAdded ? (
              <div className="space-y-2 mt-2">
                <p className="text-xs text-gray-500">A payment method is required to activate a paid plan.</p>
                <button onClick={() => setShowPaymentModal(true)}
                  className="w-full h-10 bg-gray-900 text-white text-sm rounded-xl font-medium hover:bg-gray-700 transition-colors">
                  Add Payment Method →
                </button>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2 text-green-600 text-xs font-medium"><Check size={12} /> Payment method on file</div>
                <button onClick={purchasePlan}
                  className="w-full h-10 bg-green-800 text-white text-sm rounded-xl font-medium hover:bg-green-900 transition-colors">
                  Purchase {planDetails.name} - ${planDetails.price}
                </button>
              </div>
            )}
          </div>
        )}

        {selectedPlan === 'free-trial' && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 shrink-0" /> No credit card required. 250 credits included. Upgrade anytime.
          </div>
        )}

        <div className="flex justify-between">
          <button onClick={() => setStep(5)} className={bb}>← Back</button>
          <button onClick={() => next(7)} disabled={selectedPlan !== 'free-trial' && !planPurchased} className={bp}>Continue →</button>
        </div>
      </>
    )

    // ── Step 7: Speed & Notifications ────────────────────────────────────────
    if (step === 7) return (
      <>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Speed &amp; alerts</h2>
        <p className="text-base text-gray-500 mb-8">How fast should your agent work, and how do you want to be notified?</p>

        <div className="space-y-6 mb-6">
          <div className="border border-gray-100 rounded-xl p-4">
            <label className={lc}>Research speed</label>
            <p className="text-xs text-gray-500 mb-3">Leads researched in parallel per cycle. Higher = faster.</p>
            <div className="flex items-center gap-3">
              <input type="range" min={1} max={planDetails.maxConcurrency} step={1} value={concurrencyLevel}
                onChange={e => setConcurrencyLevel(Number(e.target.value))} className="flex-1 accent-gray-900" />
              <span className="w-20 text-center text-sm font-bold text-gray-900 shrink-0">
                {concurrencyLevel === 1 ? '1 (default)' : `${concurrencyLevel}×`}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2">Plan cap: {planDetails.maxConcurrency}×</p>
            {concurrencyLevel > 3 && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> High concurrency uses more credits at once</p>}
          </div>

          <div className="space-y-3">
            <p className={lc}>Notifications</p>
            <div className="flex items-center justify-between p-3.5 border border-gray-100 rounded-xl">
              <div>
                <div className="text-sm text-gray-700">Email notifications</div>
                <div className="text-xs text-gray-400">Replies, opens, meetings, errors</div>
              </div>
              <Toggle checked={notifEmailEnabled} onChange={() => setNotifEmailEnabled(v => !v)} />
            </div>
            <div className="flex items-center justify-between p-3.5 border border-gray-100 rounded-xl">
              <div>
                <div className="text-sm text-gray-700">SMS notifications</div>
                <div className="text-xs text-gray-400">Text alerts for replies and meetings</div>
              </div>
              <Toggle checked={notifSmsEnabled} onChange={() => setNotifSmsEnabled(v => !v)} />
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <button onClick={() => setStep(6)} className={bb}>← Back</button>
          <button onClick={() => next(8)} className={bp}>Continue →</button>
        </div>
      </>
    )

    // ── Step 8: CRM ──────────────────────────────────────────────────────────
    if (step === 8) return (
      <>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">CRM setup</h2>
        <p className="text-sm text-gray-500 mb-4">Auto-sync researched leads to your CRM. You can also do this later in Settings.</p>

        <div className="p-4 bg-green-50 border border-green-200 rounded-xl mb-5 text-xs text-green-900 leading-relaxed">
          <p className="font-semibold mb-1">CRM Auditor mode</p>
          Connect a CRM to unlock a second mode: instead of finding new leads on Apollo, your agent can read through your existing CRM contacts, research each one, write personalized emails, and sync notes back onto each record.
        </div>

        {crmConnected ? (
          <div className="flex items-center gap-2.5 p-4 bg-green-50 border border-green-200 rounded-xl mb-5">
            <Check className="text-green-600 shrink-0" size={16} />
            <span className="text-sm text-green-700 font-medium">CRM connected - leads will auto-sync after research</span>
          </div>
        ) : (
          <div className="mb-5">
            <label className={lc}>Select your CRM</label>
            <div className="relative mb-4">
              <select value={selectedCrm?.id || ''}
                onChange={e => { const found = CRM_CONFIGS.find(c => c.id === e.target.value) || null; setSelectedCrm(found); setCrmCreds({}); setCrmError(null) }}
                className="w-full h-10 appearance-none pl-3 pr-9 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white cursor-pointer">
                <option value="">Choose a CRM…</option>
                {CRM_CONFIGS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>

            {selectedCrm && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-900">{selectedCrm.name}</span>
                  <button onClick={() => { setSelectedCrm(null); setCrmCreds({}); setCrmError(null) }} className="text-xs text-green-700 hover:text-green-900">Change</button>
                </div>
                {selectedCrm.fields.map(field => (
                  <div key={field.key}>
                    <label className={lc}>{field.name}</label>
                    <input type={field.type} placeholder={field.placeholder} value={crmCreds[field.key] || ''}
                      onChange={e => setCrmCreds(p => ({ ...p, [field.key]: e.target.value }))} className={ic} />
                    {field.helpText && <p className="text-xs text-gray-400 mt-1">{field.helpText}</p>}
                  </div>
                ))}
                {crmError && <p className="text-red-500 text-xs">{crmError}</p>}
                <button onClick={connectCrm} disabled={crmConnecting}
                  className="w-full h-10 bg-gray-900 text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-gray-700 transition-colors">
                  {crmConnecting ? 'Connecting…' : 'Connect CRM'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between">
          <button onClick={() => setStep(7)} className={bb}>← Back</button>
          <button onClick={() => next(9)} className={bp}>{crmConnected ? 'Continue →' : 'Skip →'}</button>
        </div>
      </>
    )

    // ── Step 9: Review + Launch ───────────────────────────────────────────────
    if (step === 9) return (
      <>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Review &amp; launch</h2>
        <p className="text-base text-gray-500 mb-8">Everything look good?</p>

        <div className="space-y-2.5 mb-6">
          <ReviewRow label="Company" onEdit={() => editStep(1)}>
            <div className="text-sm font-semibold text-gray-900">{companyName}</div>
            {industry && <div className="text-xs text-gray-500">{industry}</div>}
            {services && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{services}</div>}
            {keyAdvantages && <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 italic">&ldquo;{keyAdvantages.slice(0, 80)}{keyAdvantages.length > 80 ? '…' : ''}&rdquo;</div>}
          </ReviewRow>

          <ReviewRow label="Targeting" onEdit={() => editStep(2)}>
            <div className="text-xs text-gray-700 space-y-0.5">
              {industries.length > 0 && <div className="truncate">{industries.slice(0, 3).join(' · ')}{industries.length > 3 ? ` +${industries.length - 3}` : ''}</div>}
              {jobTitles.length > 0 && <div className="truncate">{jobTitles.slice(0, 3).join(' · ')}{jobTitles.length > 3 ? ` +${jobTitles.length - 3}` : ''}</div>}
              <div className="text-gray-500">{companySizeMin}–{companySizeMax} employees · {leadsPerCycle} leads/cycle</div>
              {specialInstructions && <div className="text-gray-400 truncate italic">&ldquo;{specialInstructions.slice(0, 60)}{specialInstructions.length > 60 ? '…' : ''}&rdquo;</div>}
            </div>
          </ReviewRow>

          <ReviewRow label="Agent" onEdit={() => editStep(3)}>
            <div className="flex items-center gap-2">
              {personality && <img src={personality.avatar} alt="" className="w-7 h-7 rounded-full object-cover bg-gray-100 shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
              <div>
                <div className="text-sm font-semibold text-gray-900">{agentName}</div>
                {personality && <div className="text-xs text-gray-500">{personality.name} · Preset: {presetName}</div>}
              </div>
            </div>
          </ReviewRow>

          <ReviewRow label="Email" onEdit={() => editStep(4)}>
            <div className="text-xs text-gray-700 space-y-0.5">
              {gmailConnected && useGmail ? <div className="text-green-700 font-medium inline-flex items-center gap-1">Gmail connected <Check className="w-3 h-3" /></div>
                : outlookConnected && useOutlook ? <div className="text-green-700 font-medium inline-flex items-center gap-1">Outlook connected <Check className="w-3 h-3" /></div>
                : <div className="text-gray-500">Mailgun (default)</div>}
              {linkedinConnected && <div className="text-green-700 font-medium inline-flex items-center gap-1">LinkedIn connected <Check className="w-3 h-3" /></div>}
            </div>
          </ReviewRow>

          <ReviewRow label="Outreach" onEdit={() => editStep(5)}>
            <div className="text-xs text-gray-700 space-y-0.5">
              <div className="text-gray-500">{emailLength} emails · {callToAction.replace(/-/g, ' ')} · {personalizationLevel} personalization</div>
              {(ccEmails || bccEmails) && <div className="text-gray-400 truncate">{ccEmails && `CC: ${ccEmails}`}{ccEmails && bccEmails && ' · '}{bccEmails && `BCC: ${bccEmails}`}</div>}
              {useCustomSignature && (signatureName || signatureTitle) && <div className="text-gray-400">Signed as: {[signatureName, signatureTitle].filter(Boolean).join(', ')}</div>}
            </div>
          </ReviewRow>

          <ReviewRow label="Plan" onEdit={() => editStep(6)}>
            <div className="text-sm font-semibold text-gray-900">{planDetails.name}</div>
          </ReviewRow>

          <ReviewRow label="Speed &amp; Alerts" onEdit={() => editStep(7)}>
            <div className="text-xs text-gray-500">{concurrencyLevel}× research speed · {notifEmailEnabled ? 'email alerts on' : 'email alerts off'}{notifSmsEnabled ? ' · SMS on' : ''}</div>
          </ReviewRow>

          {crmConnected && (
            <ReviewRow label="CRM" onEdit={() => editStep(8)}>
              <div className="text-sm text-green-700 font-medium inline-flex items-center gap-1">Connected <Check className="w-3.5 h-3.5" /></div>
            </ReviewRow>
          )}
        </div>

        {createError && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4">{createError}</div>
        )}

        <div className="flex justify-between items-center">
          <button onClick={() => setStep(8)} className={bb}>← Back</button>
          <button onClick={launch} disabled={creating}
            className="h-11 px-8 bg-gray-900 text-white text-sm rounded-xl font-semibold hover:bg-gray-700 transition-colors disabled:opacity-40">
            Launch Agent →
          </button>
        </div>
      </>
    )

    return null
  }

  const totalSteps = STEPS.length
  const progressPct = Math.round(((step - 1) / totalSteps) * 100)

  return (
    <div className="min-h-screen flex bg-white">
      {showPaymentModal && (
        <AddPaymentModal
          onSuccess={() => { setPaymentAdded(true); setShowPaymentModal(false) }}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
      {/* Left: form panel */}
      <div className="relative z-10 w-full lg:w-[52%] bg-white min-h-screen flex flex-col">

        {/* Logo */}
        <div className="flex items-center gap-2 p-8 pb-0">
          <img src="/MeridianM.png" alt="Meridian" className="h-8 w-auto object-contain" />
          <MeridianWordmark className="h-3.5 w-auto text-gray-900" />
        </div>

        {/* Progress bar */}
        <div className="px-8 pt-5">
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-900 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Step {step} of {totalSteps}</p>
        </div>

        {/* Step content */}
        <div className="flex-1 flex flex-col justify-center px-10 py-4 max-w-2xl mx-auto w-full">
          {StepContent()}
        </div>
      </div>

      {/* Right: step illustration */}
      <div className="hidden lg:flex lg:w-[48%] sticky top-0 h-screen bg-[#0d2b1e] items-center justify-center p-12">
        {step === 1 && <IllustrationCompanyScrape />}
        {step === 2 && <IllustrationTargeting />}
        {step === 3 && <IllustrationAgent />}
        {step === 4 && <IllustrationEmailConnect />}
        {step === 5 && <IllustrationOutreach />}
        {step === 6 && <IllustrationPlan />}
        {step === 7 && <IllustrationSpeed />}
        {step === 8 && <IllustrationCRM />}
        {step === 9 && <IllustrationReview />}
      </div>

      {creating && !showLaunchLoader && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm gap-5">
          <div className="w-12 h-12 border-[3px] border-gray-900 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">Launching your agent…</p>
            <p className="text-sm text-gray-500 mt-1">Setting everything up, just a moment.</p>
          </div>
        </div>
      )}
      {showLaunchLoader && <MailboxLoader onComplete={onComplete} />}
    </div>
  )
}

function ReviewRow({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="p-3.5 border border-gray-100 rounded-xl">
      <div className="flex items-center justify-between mb-1.5">
        <span className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        <button onClick={onEdit} className="text-xs text-green-700 hover:text-green-900 font-medium">Edit</button>
      </div>
      {children}
    </div>
  )
}

// Single-select pill row
function PillSelect({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${value.toLowerCase() === o.toLowerCase() ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-600'}`}>
          {o}
        </button>
      ))}
    </div>
  )
}

// Multi-select pill row with suggestions + search + "Add your own"
function MultiPillSelect({ suggestions, selected, onAdd, onRemove, searchList, placeholder }: {
  suggestions: string[]
  selected: string[]
  onAdd: (v: string) => void
  onRemove: (v: string) => void
  searchList: string[]
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const filtered = query ? searchList.filter(i => i.toLowerCase().includes(query.toLowerCase()) && !selected.includes(i)).slice(0, 8) : []

  return (
    <div className="mt-1.5 space-y-3">
      {/* Suggestion pills */}
      <div className="flex flex-wrap gap-2">
        {suggestions.map(s => {
          const on = selected.includes(s)
          return (
            <button key={s} onClick={() => on ? onRemove(s) : onAdd(s)}
              className={`px-4 py-2 rounded-full border text-sm font-medium transition-all flex items-center gap-1.5 ${on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-600'}`}>
              {on && <X size={11} strokeWidth={2.5} />}
              {s}
            </button>
          )
        })}

        {/* Add your own */}
        {adding ? (
          <div className="relative">
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder}
              onKeyDown={e => { if (e.key === 'Enter' && query.trim()) { onAdd(query.trim()); setQuery(''); setAdding(false) } if (e.key === 'Escape') { setQuery(''); setAdding(false) } }}
              onBlur={() => setTimeout(() => { setQuery(''); setAdding(false) }, 150)}
              className="px-4 py-2 rounded-full border border-gray-400 text-sm outline-none focus:border-gray-900 w-44 transition-colors" />
            {filtered.length > 0 && (
              <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto min-w-[180px]">
                {filtered.map(i => (
                  <button key={i} onMouseDown={() => { onAdd(i); setQuery(''); setAdding(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b last:border-b-0 border-gray-100">
                    {i}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="px-4 py-2 rounded-full border border-dashed border-gray-300 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-all">
            + Add your own
          </button>
        )}
      </div>

      {/* Extra selected items not in suggestions */}
      {selected.filter(s => !suggestions.includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.filter(s => !suggestions.includes(s)).map(s => (
            <button key={s} onClick={() => onRemove(s)}
              className="px-4 py-2 rounded-full border text-sm font-medium bg-gray-900 text-white border-gray-900 flex items-center gap-1.5 transition-all">
              <X size={11} strokeWidth={2.5} />{s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
