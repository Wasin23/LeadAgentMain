'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Check, ChevronDown, ChevronRight,
  Search, X, Plus, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';
import api from '@/lib/api';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────
const INDUSTRIES = [
  'Software Development','SaaS','Cloud Computing','Cybersecurity','AI/Machine Learning',
  'Data Analytics','Mobile Apps','Enterprise Software','DevOps','IoT','Blockchain',
  'AR/VR','Gaming','EdTech','FinTech','HealthTech','PropTech','MarTech','AgTech',
  'CleanTech','Robotics','Semiconductors','Hardware','Networking','Telecommunications',
  'Hospitals & Health Systems','Medical Devices','Pharmaceuticals','Biotechnology',
  'Telemedicine','Mental Health','Dental Services','Veterinary','Medical Software',
  'Clinical Research','Health Insurance','Medical Equipment','Diagnostics',
  'Banking','Investment Management','Insurance','Credit Services','Payment Processing',
  'Wealth Management','Accounting','Tax Services','Real Estate Finance','Mortgage',
  'Automotive','Aerospace & Defense','Electronics Manufacturing','Chemicals',
  'Food & Beverage','Textiles & Apparel','Machinery','Construction Materials',
  'Consumer Goods','Packaging','Metals & Mining','Oil & Gas','Renewable Energy',
  'E-commerce','Fashion & Apparel','Grocery & Food Retail','Electronics Retail',
  'Home & Garden','Sporting Goods','Luxury Goods','Beauty & Cosmetics',
  'Consulting','Legal Services','Marketing & Advertising','Public Relations',
  'Architecture','Engineering Services','Design','Event Planning','Security Services',
  'Logistics & Supply Chain','Transportation','Warehousing',
  'Commercial Real Estate','Residential Real Estate','Property Management',
  'Real Estate Investment','Construction','Interior Design','Facilities Management',
  'Hotels & Resorts','Restaurants & Food Service','Travel & Tourism','Event Venues',
  'Airlines','Vacation Rentals','Catering',
];

const JOB_TITLES = [
  'CEO','COO','CFO','CTO','CMO','CHRO','CIO','CRO','President','Founder','Co-Founder',
  'Managing Director','Partner','VP Sales','VP Marketing','VP Engineering','VP Operations',
  'VP Finance','VP HR','VP Product','VP Business Development','VP Customer Success',
  'Director of Sales','Marketing Director','Engineering Director','Operations Director',
  'IT Director','HR Director','Finance Director','Product Director',
  'Sales Manager','Marketing Manager','Engineering Manager','Operations Manager',
  'IT Manager','HR Manager','Product Manager','Project Manager',
  'Head of Growth','Head of Partnerships','Head of Business Development',
  'Head of Sales','Head of Marketing','Head of Engineering',
  'Account Executive','Business Development Manager','Procurement Manager',
  'Purchasing Manager','General Manager',
];

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────
interface AgentSettings {
  specialInstructions: string;
  companyBranding: {
    agentName: string; companyName: string; agentTitle: string;
    primaryService: string; coreOffering: string; keyAdvantages: string;
    expertiseArea: string; companyWebsite: string; companyDescription: string;
  };
  companyCriteria: { companySizeMin: number; companySizeMax: number; companyIndustries: string[]; };
  contactCriteria: { targetPositions: string[]; seniorityLevel: string; };
  geographicSettings: { targetLocations: string[]; excludedLocations: string[]; leadLimit: number; timezone: string; };
  concurrencyLevel: number;
  researchFocus: { focusAreas: string[]; researchDepth: string; includeCompanyNews: boolean; includePersonalInfo: boolean; includeSocialMedia: boolean; };
  emailBuilder: {
    emailTemplate: string; customPrompt: string; emailResponsePrompt: string;
    tone: string; length: string; callToAction: string; personalization: string;
    ccEmails: string; bccEmails: string; enableAutoResponse: boolean;
    rebumpIntervalDays: number; useCustomSignature: boolean;
    signatureName: string; signatureTitle: string;
    useGmail: boolean; useOutlook: boolean;
  };
}

interface PlanStatusResponse {
  plan?: {
    id?: string;
    name?: string;
    maxAgents?: number;
    maxConcurrency?: number;
  };
}

const defaultSettings: AgentSettings = {
  specialInstructions: '',
  companyBranding: { agentName: '', companyName: '', agentTitle: '', primaryService: '', coreOffering: '', keyAdvantages: '', expertiseArea: '', companyWebsite: '', companyDescription: '' },
  companyCriteria: { companySizeMin: 10, companySizeMax: 500, companyIndustries: [] },
  contactCriteria: { targetPositions: [], seniorityLevel: 'senior' },
  geographicSettings: { targetLocations: ['United States'], excludedLocations: [], leadLimit: 50, timezone: 'America/New_York' },
  concurrencyLevel: 1,
  researchFocus: { focusAreas: [], researchDepth: 'standard', includeCompanyNews: true, includePersonalInfo: false, includeSocialMedia: false },
  emailBuilder: { emailTemplate: 'professional', customPrompt: '', emailResponsePrompt: '', tone: 'professional', length: 'medium', callToAction: 'meeting', personalization: 'high', ccEmails: '', bccEmails: '', enableAutoResponse: false, rebumpIntervalDays: 3, useCustomSignature: false, signatureName: '', signatureTitle: '', useGmail: false, useOutlook: false }
};

// ─────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────
function Section({ title, description, children, defaultOpen = false, badge }: {
  title: string; description?: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="text-left">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="px-6 pb-6 pt-2 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

function TagInput({ label, tags, onAdd, onRemove, suggestions, placeholder, helpText }: {
  label: string; tags: string[]; onAdd: (tag: string) => void; onRemove: (tag: string) => void;
  suggestions: string[]; placeholder: string; helpText?: string;
}) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const filtered = suggestions.filter(s => s.toLowerCase().includes(search.toLowerCase()) && !tags.includes(s)).slice(0, 10);

  const handleAdd = (value: string) => {
    if (value.trim() && !tags.includes(value.trim())) { onAdd(value.trim()); setSearch(''); setShowDropdown(false); }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs">
              {tag}
              <button onClick={() => onRemove(tag)} className="hover:text-destructive ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(search); } }}
              placeholder={placeholder}
            />
          </div>
          <Button type="button" variant="outline" size="icon" disabled={!search.trim()} onClick={() => handleAdd(search)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {showDropdown && filtered.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {filtered.map(s => (
              <button key={s} onMouseDown={() => handleAdd(s)} className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors">{s}</button>
            ))}
          </div>
        )}
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

function ToggleRow({ label, checked, onChange, description }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <Label className="font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────
export default function AgentSettingsPage({ params }: { params: Promise<{ agentId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [settings, setSettings] = useState<AgentSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [agentName, setAgentName] = useState('Agent');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedSettings, setLastSavedSettings] = useState<AgentSettings | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatusResponse | null>(null);
  const [presets, setPresets] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [resetWebsiteUrl, setResetWebsiteUrl] = useState('');
  const [resetScraping, setResetScraping] = useState(false);
  const [showResetWebsite, setShowResetWebsite] = useState(false);

  const handleResetFromWebsite = async () => {
    if (!resetWebsiteUrl.trim()) return;
    setResetScraping(true);
    try {
      const r = await api.post('/api/company-profile/scrape-website', { url: resetWebsiteUrl.trim() });
      const p = r.data?.profile;
      if (p) {
        await api.post('/api/company-profile/save', { profile: p, recommendedPreset: r.data?.recommendedPreset || null });
        setSettings(prev => ({
          ...prev,
          companyBranding: {
            ...prev.companyBranding,
            companyName: p.companyName || prev.companyBranding.companyName,
            companyWebsite: p.website || prev.companyBranding.companyWebsite,
            companyDescription: p.description || prev.companyBranding.companyDescription,
            primaryService: p.services || prev.companyBranding.primaryService,
            coreOffering: p.coreOffering || prev.companyBranding.coreOffering,
            keyAdvantages: p.keyAdvantages || prev.companyBranding.keyAdvantages,
          },
        }));
        setShowResetWebsite(false);
        setResetWebsiteUrl('');
      }
    } catch {
      alert('Failed to scrape website. Check the URL and try again.');
    } finally {
      setResetScraping(false);
    }
  };

  const handleAutofill = async () => {
    setAutofilling(true);
    try {
      const r = await api.post('/api/company-profile/autofill-targeting');
      const a = r.data.autofill;
      setSettings(prev => ({
        ...prev,
        specialInstructions: a.generalInstructions || prev.specialInstructions,
        companyCriteria: {
          ...prev.companyCriteria,
          companySizeMin: a.companySizeMin ?? prev.companyCriteria.companySizeMin,
          companySizeMax: a.companySizeMax ?? prev.companyCriteria.companySizeMax,
          companyIndustries: a.industries?.length ? a.industries : prev.companyCriteria.companyIndustries,
        },
        contactCriteria: {
          ...prev.contactCriteria,
          targetPositions: a.jobTitles?.length ? a.jobTitles : prev.contactCriteria.targetPositions,
        },
      }));
    } catch {
      alert('Could not autofill — make sure your Company Profile is filled out in Settings.');
    } finally {
      setAutofilling(false);
    }
  };

  // ── fetch ──
  useEffect(() => {
    fetchSettings();
    fetchPresets();
  }, [resolvedParams.agentId]);

  const fetchPresets = async () => {
    try {
      setLoadingPresets(true);
      const res = await api.get('/api/settings/presets');
      setPresets(res.data.presets || []);
    } catch { /* ignore */ } finally { setLoadingPresets(false); }
  };

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const [res, planRes] = await Promise.all([
        api.get(`/api/lead-agent/settings?agentId=${resolvedParams.agentId}`),
        api.get('/api/plans/status').catch(() => null),
      ]);
      if (planRes?.data?.success) {
        setPlanStatus(planRes.data);
      }
      if (res.data.settings) {
        const s = res.data.settings;
        const u = s.userSettings || s.leadGeneration || s;
        const e = s.emailSettings || s.emailBuilder || s;
        if (u.agentName || u.companyBranding?.agentName) setAgentName(u.agentName || u.companyBranding?.agentName);

        const loaded: AgentSettings = {
          specialInstructions: (typeof s.specialInstructions === 'string' ? s.specialInstructions : '') || (typeof u.specialInstructions === 'string' ? u.specialInstructions : '') || '',
          companyBranding: {
            agentName: u.agentName || u.companyBranding?.agentName || '',
            companyName: u.companyName || u.companyBranding?.companyName || '',
            agentTitle: u.agentTitle || u.companyBranding?.agentTitle || '',
            primaryService: u.primaryService || u.companyBranding?.primaryService || '',
            coreOffering: u.coreOffering || u.companyBranding?.coreOffering || '',
            keyAdvantages: u.keyAdvantages || u.companyBranding?.keyAdvantages || '',
            expertiseArea: u.expertiseArea || u.companyBranding?.expertiseArea || '',
            companyWebsite: u.companyWebsite || u.companyBranding?.companyWebsite || '',
            companyDescription: u.companyDescription || u.companyBranding?.companyDescription || '',
          },
          companyCriteria: {
            companySizeMin: u.companySizeMin || u.companyCriteria?.companySizeMin || 10,
            companySizeMax: u.companySizeMax || u.companyCriteria?.companySizeMax || 500,
            companyIndustries: u.companyIndustries || u.companyCriteria?.companyIndustries || [],
          },
          contactCriteria: {
            targetPositions: u.targetPositions || u.contactCriteria?.targetPositions || [],
            seniorityLevel: u.seniorityLevel || u.contactCriteria?.seniorityLevel || 'senior',
          },
          geographicSettings: {
            targetLocations: u.targetLocations || u.geographicSettings?.targetLocations || ['United States'],
            excludedLocations: u.excludedLocations || u.geographicSettings?.excludedLocations || [],
            leadLimit: u.leadLimit || u.geographicSettings?.leadLimit || 50,
            timezone: u.timezone || u.geographicSettings?.timezone || 'America/New_York',
          },
          concurrencyLevel: u.concurrencyLevel ?? 1,
          researchFocus: {
            focusAreas: u.focusAreas || u.researchFocus?.focusAreas || [],
            researchDepth: u.researchDepth || u.researchFocus?.researchDepth || 'standard',
            includeCompanyNews: u.includeCompanyNews ?? u.researchFocus?.includeCompanyNews ?? true,
            includePersonalInfo: u.includePersonalInfo ?? u.researchFocus?.includePersonalInfo ?? false,
            includeSocialMedia: u.includeSocialMedia ?? u.researchFocus?.includeSocialMedia ?? false,
          },
          emailBuilder: {
            emailTemplate: e.emailTemplate || e.emailBuilder?.emailTemplate || 'professional',
            customPrompt: e.customPrompt || e.emailBuilder?.customPrompt || '',
            emailResponsePrompt: e.emailResponsePrompt || e.emailBuilder?.emailResponsePrompt || '',
            tone: e.tone || e.emailBuilder?.tone || 'professional',
            length: e.length || e.emailBuilder?.length || 'medium',
            callToAction: e.callToAction || e.emailBuilder?.callToAction || 'meeting',
            personalization: e.personalization || e.emailBuilder?.personalization || 'high',
            ccEmails: e.ccEmails || e.emailBuilder?.ccEmails || '',
            bccEmails: e.bccEmails || e.emailBuilder?.bccEmails || '',
            enableAutoResponse: e.enableAutoResponse ?? e.emailBuilder?.enableAutoResponse ?? false,
            rebumpIntervalDays: e.rebumpIntervalDays || e.emailBuilder?.rebumpIntervalDays || 3,
            useCustomSignature: e.useCustomSignature ?? e.emailBuilder?.useCustomSignature ?? false,
            signatureName: e.signatureName || e.emailBuilder?.signatureName || '',
            signatureTitle: e.signatureTitle || e.emailBuilder?.signatureTitle || '',
            useGmail: e.useGmail ?? e.emailBuilder?.useGmail ?? false,
            useOutlook: e.useOutlook ?? e.emailBuilder?.useOutlook ?? false,
          },
        };
        setSettings(loaded);
        setLastSavedSettings(loaded);
      }
    } catch { /* ignore */ } finally { setIsLoading(false); }
  };

  // ── track changes ──
  useEffect(() => {
    if (lastSavedSettings) setHasUnsavedChanges(JSON.stringify(settings) !== JSON.stringify(lastSavedSettings));
  }, [settings, lastSavedSettings]);

  useEffect(() => {
    const allowedConcurrency = planStatus?.plan?.maxConcurrency;
    if (!allowedConcurrency) return;

    setSettings(prev => {
      if ((prev.concurrencyLevel ?? 1) <= allowedConcurrency) return prev;
      return { ...prev, concurrencyLevel: allowedConcurrency };
    });
  }, [planStatus?.plan?.maxConcurrency]);

  // ── auto-save ──
  const autoSave = useCallback(async () => {
    if (!hasUnsavedChanges || isSaving) return;
    setSaveStatus('saving');
    try {
      await api.post('/api/lead-agent/settings', { ...settings, agentId: resolvedParams.agentId });
      setLastSavedSettings(settings);
      setSaveStatus('success');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 3000); }
  }, [settings, resolvedParams.agentId, hasUnsavedChanges, isSaving]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const t = setTimeout(autoSave, 3000);
    return () => clearTimeout(t);
  }, [settings, hasUnsavedChanges, autoSave]);

  // ── manual save ──
  const saveSettings = async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      await api.post('/api/lead-agent/settings', { ...settings, agentId: resolvedParams.agentId });
      setLastSavedSettings(settings);
      setSaveStatus('success');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 3000); }
    finally { setIsSaving(false); }
  };

  // ── preset apply ──
  const applyPreset = (preset: any) => {
    setSelectedPreset(preset.id || preset._id);
    setSettings(prev => ({
      ...prev,
      specialInstructions: (typeof preset.specialInstructions === 'string' ? preset.specialInstructions : '') || prev.specialInstructions,
      companyCriteria: { ...prev.companyCriteria, companySizeMin: preset.companySizeMin || prev.companyCriteria.companySizeMin, companySizeMax: preset.companySizeMax || prev.companyCriteria.companySizeMax, companyIndustries: preset.targetIndustries || prev.companyCriteria.companyIndustries },
      contactCriteria: { ...prev.contactCriteria, targetPositions: preset.targetPositions || prev.contactCriteria.targetPositions },
      geographicSettings: { ...prev.geographicSettings, leadLimit: preset.leadLimit || prev.geographicSettings.leadLimit },
      emailBuilder: { ...prev.emailBuilder, length: preset.emailLength || prev.emailBuilder.length, callToAction: preset.callToAction || prev.emailBuilder.callToAction, personalization: preset.personalizationLevel || prev.emailBuilder.personalization, ccEmails: preset.ccEmails || prev.emailBuilder.ccEmails, bccEmails: preset.bccEmails || prev.emailBuilder.bccEmails, rebumpIntervalDays: preset.followupIntervalDays || prev.emailBuilder.rebumpIntervalDays, enableAutoResponse: preset.enableAutoResponse !== undefined ? preset.enableAutoResponse : prev.emailBuilder.enableAutoResponse, useCustomSignature: preset.useCustomSignature !== undefined ? preset.useCustomSignature : prev.emailBuilder.useCustomSignature, signatureName: preset.signatureName || prev.emailBuilder.signatureName, signatureTitle: preset.signatureTitle || prev.emailBuilder.signatureTitle },
    }));
    setHasUnsavedChanges(true);
  };

  // ── helpers ──
  const updateBranding = (f: string, v: string) => setSettings(p => ({ ...p, companyBranding: { ...p.companyBranding, [f]: v } }));
  const updateCompany = (f: string, v: any) => setSettings(p => ({ ...p, companyCriteria: { ...p.companyCriteria, [f]: v } }));
  const updateContact = (f: string, v: any) => setSettings(p => ({ ...p, contactCriteria: { ...p.contactCriteria, [f]: v } }));
  const updateGeo = (f: string, v: any) => setSettings(p => ({ ...p, geographicSettings: { ...p.geographicSettings, [f]: v } }));
  const updateResearch = (f: string, v: any) => setSettings(p => ({ ...p, researchFocus: { ...p.researchFocus, [f]: v } }));
  const updateEmail = (f: string, v: any) => setSettings(p => ({ ...p, emailBuilder: { ...p.emailBuilder, [f]: v } }));
  const maxConcurrency = planStatus?.plan?.maxConcurrency || 1;
  const maxAgents = planStatus?.plan?.maxAgents || 1;
  const currentPlanName = planStatus?.plan?.name || 'Your plan';

  // ─────────────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 lg:ml-64 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading settings…</p>
          </div>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:ml-64">

        {/* Sticky header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-foreground">{agentName} — Settings</h1>
                <p className="text-sm text-muted-foreground">Configure targeting, messaging & behaviour</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm">
                {saveStatus === 'saving' && <span className="flex items-center gap-1.5 text-primary"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span>}
                {saveStatus === 'success' && <span className="flex items-center gap-1.5 text-green-600"><CheckCircle2 className="h-4 w-4" />Saved</span>}
                {saveStatus === 'error' && <span className="flex items-center gap-1.5 text-destructive"><AlertCircle className="h-4 w-4" />Save failed</span>}
                {saveStatus === 'idle' && hasUnsavedChanges && <span className="text-yellow-500">Unsaved changes</span>}
              </div>
              <Button disabled={isSaving || !hasUnsavedChanges} onClick={saveSettings}>
                {isSaving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : 'Save'}
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">

          {/* Presets */}
          {presets.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Quick Presets</h3>
                  <p className="text-sm text-muted-foreground">Apply a saved configuration to quickly set up targeting</p>
                </div>
                {loadingPresets && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {presets.map(preset => (
                  <button key={preset.id || preset._id} onClick={() => applyPreset(preset)}
                    className={cn('text-left p-4 rounded-lg border-2 transition-all',
                      selectedPreset === (preset.id || preset._id) ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-background hover:border-primary/40')}>
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-semibold text-foreground">{preset.name}</h4>
                      {selectedPreset === (preset.id || preset._id) && <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-primary-foreground" /></div>}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(preset.targetIndustries || []).slice(0, 2).map((ind: string, i: number) => <span key={i} className="px-2 py-0.5 bg-purple-500/10 text-purple-500 border border-purple-500/20 rounded text-[10px] font-medium">{ind}</span>)}
                      {(preset.targetIndustries?.length || 0) > 2 && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-medium">+{preset.targetIndustries.length - 2}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{preset.companySizeMin}–{preset.companySizeMax} employees · {preset.leadLimit} leads/cycle</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* General Instructions */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-primary">General Instructions</h3>
              <button
                type="button"
                onClick={handleAutofill}
                disabled={autofilling}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all disabled:opacity-50"
              >
                {autofilling ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                )}
                {autofilling ? 'Filling...' : 'Autofill from company profile'}
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">High-level instructions that guide the entire campaign. Be specific about who to target and what pain points to address.</p>
            <Textarea
              value={settings.specialInstructions}
              onChange={e => setSettings(p => ({ ...p, specialInstructions: e.target.value }))}
              placeholder="Example: Target CTOs at Series A startups in healthcare tech. Focus on pain points around scaling engineering teams and infrastructure costs."
              className="min-h-[100px] resize-y bg-background"
              maxLength={1000}
            />
            <p className="text-right text-xs text-muted-foreground mt-1">{settings.specialInstructions.length}/1000</p>
          </div>

          {/* Company Branding */}
          <Section title="Your Company" description="Information about your company for email personalization" defaultOpen={true}>
            {/* Reset from website */}
            <div className="mt-4 mb-3">
              {!showResetWebsite ? (
                <button
                  type="button"
                  onClick={() => setShowResetWebsite(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-muted bg-muted/40 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Reset from website
                </button>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/20">
                  <Input
                    value={resetWebsiteUrl}
                    onChange={e => setResetWebsiteUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleResetFromWebsite(); }}
                    placeholder="https://yourcompany.com"
                    className="flex-1 text-sm h-8"
                    autoFocus
                    disabled={resetScraping}
                  />
                  <Button
                    size="sm"
                    onClick={handleResetFromWebsite}
                    disabled={resetScraping || !resetWebsiteUrl.trim()}
                    className="gap-1.5 h-8 px-3 text-xs flex-shrink-0"
                  >
                    {resetScraping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                    {resetScraping ? 'Scanning…' : 'Go'}
                  </Button>
                  <button type="button" onClick={() => { setShowResetWebsite(false); setResetWebsiteUrl(''); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0" disabled={resetScraping}>Cancel</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                ['agentName', 'Agent Name', 'Sales Bot'],
                ['companyName', 'Company Name', 'Acme Inc'],
                ['agentTitle', 'Agent Title', 'AI Sales Agent'],
                ['companyWebsite', 'Website', 'https://acme.com'],
                ['primaryService', 'Primary Service', 'AI-powered sales automation'],
                ['coreOffering', 'Core Offering', 'Automated outreach platform'],
                ['keyAdvantages', 'Key Advantages', 'Speed, Accuracy, Cost Savings'],
                ['expertiseArea', 'Expertise Area', 'B2B Sales'],
              ] as [string, string, string][]).map(([field, label, placeholder]) => (
                <div key={field} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input value={(settings.companyBranding as any)[field]} onChange={e => updateBranding(field, e.target.value)} placeholder={placeholder} />
                </div>
              ))}
              <div className="md:col-span-2 space-y-1.5">
                <Label>Company Description</Label>
                <Textarea value={settings.companyBranding.companyDescription} onChange={e => updateBranding('companyDescription', e.target.value)} placeholder="Brief description of what your company does…" className="resize-y min-h-[80px]" />
              </div>
            </div>
          </Section>

          {/* Target Companies */}
          <Section title="Target Companies" description="Define the types of companies to reach out to" badge={settings.companyCriteria.companyIndustries.length > 0 ? `${settings.companyCriteria.companyIndustries.length} industries` : undefined}>
            <div className="space-y-5 mt-4">
              <TagInput
                label="Industries"
                tags={settings.companyCriteria.companyIndustries}
                onAdd={t => updateCompany('companyIndustries', [...settings.companyCriteria.companyIndustries, t])}
                onRemove={t => updateCompany('companyIndustries', settings.companyCriteria.companyIndustries.filter((x: string) => x !== t))}
                suggestions={INDUSTRIES}
                placeholder="Search or type an industry…"
                helpText="Not in the list? Type it and press Enter to add."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Min Company Size (employees)</Label>
                  <Input type="number" value={settings.companyCriteria.companySizeMin} onChange={e => updateCompany('companySizeMin', parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Company Size (employees)</Label>
                  <Input type="number" value={settings.companyCriteria.companySizeMax} onChange={e => updateCompany('companySizeMax', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          </Section>

          {/* Target Contacts */}
          <Section title="Target Contacts" description="Define the job titles and roles to reach" badge={settings.contactCriteria.targetPositions.length > 0 ? `${settings.contactCriteria.targetPositions.length} positions` : undefined}>
            <div className="space-y-5 mt-4">
              <TagInput
                label="Job Titles"
                tags={settings.contactCriteria.targetPositions}
                onAdd={t => updateContact('targetPositions', [...settings.contactCriteria.targetPositions, t])}
                onRemove={t => updateContact('targetPositions', settings.contactCriteria.targetPositions.filter((x: string) => x !== t))}
                suggestions={JOB_TITLES}
                placeholder="Search or type a job title…"
                helpText="Not in the list? Type it and press Enter to add."
              />
              <div className="space-y-1.5">
                <Label>Seniority Level</Label>
                <select value={settings.contactCriteria.seniorityLevel} onChange={e => updateContact('seniorityLevel', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="any">Any Level</option>
                  <option value="entry">Entry Level</option>
                  <option value="mid">Mid Level</option>
                  <option value="senior">Senior Level</option>
                  <option value="executive">Executive / C-Suite</option>
                </select>
              </div>
            </div>
          </Section>

          {/* Geographic & Limits */}
          <Section title="Geographic & Limits" description="Set location targeting and daily limits">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-1.5">
                <Label>Target Locations</Label>
                <Input value={settings.geographicSettings.targetLocations.join(', ')} onChange={e => updateGeo('targetLocations', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="United States, Canada" />
                <p className="text-xs text-muted-foreground">Comma-separated list</p>
              </div>
              <div className="space-y-1.5">
                <Label>Excluded Locations</Label>
                <Input value={settings.geographicSettings.excludedLocations.join(', ')} onChange={e => updateGeo('excludedLocations', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="Alaska, Hawaii" />
                <p className="text-xs text-muted-foreground">Comma-separated list</p>
              </div>
              <div className="space-y-1.5">
                <Label>Daily Lead Limit</Label>
                <Input type="number" min={1} max={200} value={settings.geographicSettings.leadLimit} onChange={e => updateGeo('leadLimit', parseInt(e.target.value) || 0)} />
                <p className="text-xs text-muted-foreground">Max leads to contact per cycle</p>
              </div>
              <div className="space-y-1.5">
                <Label>Research Speed (Concurrency)</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={1} max={maxConcurrency} step={1}
                    value={settings.concurrencyLevel ?? 1}
                    onChange={e => setSettings(prev => ({ ...prev, concurrencyLevel: Math.min(maxConcurrency, parseInt(e.target.value) || 1) }))}
                    className="flex-1 accent-primary"
                  />
                  <span className="w-16 text-sm font-semibold text-center tabular-nums">
                    {(settings.concurrencyLevel ?? 1) === 1 ? '1 (default)' : `${settings.concurrencyLevel} workers`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Parallel research workers per cycle. Higher = faster but uses more API credits simultaneously. {currentPlanName} allows up to {maxConcurrency}x concurrency.
                </p>
                <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Current plan limits</p>
                      <p className="text-xs text-muted-foreground">This plan includes up to {maxAgents} agent{maxAgents === 1 ? '' : 's'} and {maxConcurrency}x concurrency.</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => router.push('/settings?tab=billing&upgrade=plans')}>
                      Upgrade Plan
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="rounded-md border border-border bg-background px-3 py-2">Free Trial: 1 agent · 3x speed</div>
                    <div className="rounded-md border border-border bg-background px-3 py-2">Basic: 3 agents · 5x speed</div>
                    <div className="rounded-md border border-border bg-background px-3 py-2">Starter: 5 agents · 10x speed</div>
                    <div className="rounded-md border border-border bg-background px-3 py-2">Professional: 10 agents · 20x speed</div>
                    <div className="rounded-md border border-border bg-background px-3 py-2">Enterprise: 30 agents · 30x speed</div>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <select value={settings.geographicSettings.timezone} onChange={e => updateGeo('timezone', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="America/New_York">Eastern (ET)</option>
                  <option value="America/Chicago">Central (CT)</option>
                  <option value="America/Denver">Mountain (MT)</option>
                  <option value="America/Los_Angeles">Pacific (PT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </Section>

          {/* Email Settings */}
          <Section title="Email Settings" description="Configure follow-ups and sending">
            <div className="space-y-5 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>CC Emails</Label>
                  <Input value={settings.emailBuilder.ccEmails} onChange={e => updateEmail('ccEmails', e.target.value)} placeholder="cc@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>BCC Emails</Label>
                  <Input value={settings.emailBuilder.bccEmails} onChange={e => updateEmail('bccEmails', e.target.value)} placeholder="bcc@example.com" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Follow-up Interval (days)</Label>
                <Input type="number" min={1} max={30} value={settings.emailBuilder.rebumpIntervalDays} onChange={e => updateEmail('rebumpIntervalDays', parseInt(e.target.value) || 3)} />
                <p className="text-xs text-muted-foreground">Days before sending a follow-up</p>
              </div>

              {/* Gmail */}
              <div className="border-t border-border pt-4 space-y-3">
                <ToggleRow
                  label="Use Gmail for Sending"
                  checked={settings.emailBuilder.useGmail}
                  onChange={v => { updateEmail('useGmail', v); if (v) updateEmail('useOutlook', false); }}
                  description="Send from your connected Gmail account instead of Mailgun (better deliverability)"
                />
                {settings.emailBuilder.useGmail && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-blue-500 font-medium">✓ Emails will be sent from your connected Gmail account</p>
                    <p className="text-xs text-blue-500/70 mt-1">Make sure Gmail is connected in Settings → Email → Gmail Connection</p>
                  </div>
                )}
              </div>

              {/* Outlook */}
              <div className="border-t border-border pt-4 space-y-3">
                <ToggleRow
                  label="Use Outlook for Sending"
                  checked={settings.emailBuilder.useOutlook}
                  onChange={v => { updateEmail('useOutlook', v); if (v) updateEmail('useGmail', false); }}
                  description="Send from your connected Outlook account instead of Mailgun (better deliverability)"
                />
                {settings.emailBuilder.useOutlook && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-blue-500 font-medium">✓ Emails will be sent from your connected Outlook account</p>
                    <p className="text-xs text-blue-500/70 mt-1">Make sure Outlook is connected in Settings → Email → Outlook Connection</p>
                  </div>
                )}
              </div>

              {/* Custom Signature */}
              <div className="border-t border-border pt-4 space-y-4">
                <ToggleRow label="Use Custom Signature" checked={settings.emailBuilder.useCustomSignature} onChange={v => updateEmail('useCustomSignature', v)} description="Use a custom signature instead of AI-generated" />
                {settings.emailBuilder.useCustomSignature && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Signature Name</Label>
                      <Input value={settings.emailBuilder.signatureName} onChange={e => updateEmail('signatureName', e.target.value)} placeholder="John Smith" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Signature Title</Label>
                      <Input value={settings.emailBuilder.signatureTitle} onChange={e => updateEmail('signatureTitle', e.target.value)} placeholder="Sales Director" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* Bottom Save */}
          <div className="flex items-center justify-between pt-4 border-t border-border pb-8">
            <p className="text-sm text-muted-foreground">{hasUnsavedChanges ? 'You have unsaved changes' : 'All changes saved'}</p>
            <Button size="lg" disabled={isSaving || !hasUnsavedChanges} onClick={saveSettings}>
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save All Changes'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
