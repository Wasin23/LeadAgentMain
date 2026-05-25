'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Check, ChevronDown, ChevronRight,
  Search, Mail, X, Plus, AlertCircle, CheckCircle2, Loader2, Lock, Unlock, FlaskConical
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
  agentDecidePositions?: boolean;
  agentDecideIndustries?: boolean;
  qualificationCriteria?: { mustHave: string[]; niceToHave: string[]; disqualifiers: string[]; };
  geographicSettings: { targetLocations: string[]; excludedLocations: string[]; leadLimit: number; timezone: string; };
  concurrencyLevel: number;
  researchFocus: { focusAreas: string[]; researchDepth: string; includeCompanyNews: boolean; includePersonalInfo: boolean; includeSocialMedia: boolean; };
  emailBuilder: {
    emailTemplate: string; customPrompt: string; emailResponsePrompt: string;
    tone: string; length: string; maxWords: number | null; callToAction: string; personalization: string;
    ccEmails: string; bccEmails: string; enableAutoResponse: boolean;
    rebumpIntervalDays: number; useCustomSignature: boolean;
    signatureName: string; signatureTitle: string;
    useGmail: boolean; useOutlook: boolean; useLinkedIn?: boolean;
    templates: Array<{ id: string; name: string; subject: string; body: string }>;
    useTemplates: boolean;
    smartRebump?: boolean;
    rebumpLinkedinScrape?: boolean;
    includeChatLink: boolean;
    chatLinkInstructions: string;
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
  agentDecidePositions: false,
  agentDecideIndustries: false,
  qualificationCriteria: { mustHave: [], niceToHave: [], disqualifiers: [] },
  geographicSettings: { targetLocations: ['United States'], excludedLocations: [], leadLimit: 50, timezone: 'America/New_York' },
  concurrencyLevel: 1,
  researchFocus: { focusAreas: [], researchDepth: 'standard', includeCompanyNews: true, includePersonalInfo: false, includeSocialMedia: false },
  emailBuilder: { emailTemplate: 'professional', customPrompt: '', emailResponsePrompt: '', tone: 'professional', length: 'medium', maxWords: null, callToAction: 'meeting', personalization: 'high', ccEmails: '', bccEmails: '', enableAutoResponse: false, rebumpIntervalDays: 3, useCustomSignature: false, signatureName: '', signatureTitle: '', useGmail: false, useOutlook: false, useLinkedIn: false, templates: [], useTemplates: false, smartRebump: false, rebumpLinkedinScrape: true, includeChatLink: false, chatLinkInstructions: '' }
};

// ─────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────
const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
];

function LocationTagInput({ values, onChange, placeholder }: {
  values: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = React.useState('');
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const suggestions = input.trim().length >= 1
    ? US_STATES.filter(s => s.toLowerCase().startsWith(input.toLowerCase()) && !values.includes(s)).slice(0, 6)
    : [];

  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || values.includes(trimmed)) { setInput(''); setShowSuggestions(false); return; }
    onChange([...values, trimmed]);
    setInput('');
    setShowSuggestions(false);
  };

  // Close suggestions on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Show "United States" hint when US state is being targeted outside US filter
  const usCovered = values.includes('United States');

  return (
    <div ref={containerRef} className="relative">
      <div className="rounded-md border border-input bg-background p-2 min-h-[38px] flex flex-wrap gap-1.5 focus-within:ring-1 focus-within:ring-ring">
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5 text-xs font-medium">
            {v}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))} className="hover:text-destructive transition-colors ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[120px] bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          placeholder={values.length === 0 ? placeholder : 'Add location…'}
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); }
            if (e.key === 'Backspace' && !input && values.length) onChange(values.slice(0, -1));
            if (e.key === 'Escape') setShowSuggestions(false);
          }}
          onFocus={() => { if (input.trim()) setShowSuggestions(true); }}
          onBlur={() => { setTimeout(() => { if (input.trim() && !showSuggestions) add(input); }, 150); }}
        />
      </div>

      {/* US state suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {!usCovered && (
            <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">US States</span>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); add('United States'); }}
                className="text-[10px] text-primary hover:underline"
              >+ Add all of United States</button>
            </div>
          )}
          {suggestions.map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={e => { e.preventDefault(); add(s); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
            >{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

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

// ─────────────────────────────────────────────────────
// Template Editor sub-component
// ─────────────────────────────────────────────────────
type EmailTemplate = { id: string; name: string; subject: string; body: string };

const MERGE_TAGS = ['{{firstName}}', '{{lastName}}', '{{company}}', '{{role}}', '{{painPoint}}', '{{recentNews}}', '{{senderName}}'];

function TemplateEditor({ templates, onChange }: {
  templates: EmailTemplate[];
  onChange: (tpls: EmailTemplate[]) => void;
}) {
  const [editing, setEditing] = React.useState<number | null>(null); // null = none, -1 = new
  const [form, setForm] = React.useState({ name: '', subject: '', body: '' });

  const openNew = () => { setForm({ name: '', subject: '', body: '' }); setEditing(-1); };
  const openEdit = (idx: number) => { setForm({ name: templates[idx].name, subject: templates[idx].subject, body: templates[idx].body }); setEditing(idx); };
  const cancel = () => { setEditing(null); setForm({ name: '', subject: '', body: '' }); };

  const save = () => {
    if (!form.name.trim() || !form.body.trim()) return;
    if (editing === -1) {
      onChange([...templates, { id: `tpl_${Date.now()}`, name: form.name.trim(), subject: form.subject.trim(), body: form.body.trim() }]);
    } else if (editing !== null) {
      const next = [...templates];
      next[editing] = { ...next[editing], name: form.name.trim(), subject: form.subject.trim(), body: form.body.trim() };
      onChange(next);
    }
    cancel();
  };

  const remove = (idx: number) => onChange(templates.filter((_, i) => i !== idx));
  const insertTag = (tag: string) => setForm(f => ({ ...f, body: f.body + tag }));

  return (
    <div className="mt-4 space-y-3">
      {templates.length === 0 && editing === null && (
        <p className="text-sm text-muted-foreground">No templates yet. A template lets you write a static email body with merge tags — the agent fills them in using research instead of generating the whole email from scratch.</p>
      )}

      {/* Saved templates list */}
      {templates.map((tpl, idx) => (
        <div key={tpl.id} className="border border-border rounded-lg p-3 space-y-1.5 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{tpl.name}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => openEdit(idx)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Edit</button>
              <button type="button" onClick={() => remove(idx)} className="text-xs text-destructive/70 hover:text-destructive transition-colors">Delete</button>
            </div>
          </div>
          {tpl.subject && <p className="text-xs text-muted-foreground">Subject: <span className="font-mono">{tpl.subject}</span></p>}
          <p className="text-xs text-muted-foreground font-mono line-clamp-2 whitespace-pre-wrap">{tpl.body}</p>
        </div>
      ))}

      {/* Inline add / edit form */}
      {editing !== null && (
        <div className="border border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
          <p className="text-sm font-semibold">{editing === -1 ? 'New Template' : 'Edit Template'}</p>
          <div className="space-y-1.5">
            <Label>Template Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cold Outreach v1" />
          </div>
          <div className="space-y-1.5">
            <Label>Subject Line <span className="text-muted-foreground font-normal">(optional — overrides AI subject)</span></Label>
            <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Quick question for {{firstName}}" />
          </div>
          <div className="space-y-1.5">
            <Label>Email Body</Label>
            <Textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={9}
              className="font-mono text-sm resize-y bg-background"
              placeholder={"Hi {{firstName}},\n\nI noticed {{company}} recently...\n\n{{painPoint}}\n\nWould love to connect.\n\nBest,\n{{senderName}}"}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Merge tags (click to insert — agent fills these in):</p>
            <div className="flex flex-wrap gap-1.5">
              {MERGE_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertTag(tag)}
                  className="text-[11px] font-mono px-2 py-0.5 bg-muted rounded border border-border hover:bg-primary/10 hover:border-primary/30 transition-colors"
                >{tag}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={save} disabled={!form.name.trim() || !form.body.trim()}>Save Template</Button>
            <Button size="sm" variant="outline" onClick={cancel}>Cancel</Button>
          </div>
        </div>
      )}

      {editing === null && (
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Template
        </button>
      )}
    </div>
  );
}

const JUNK_KEYWORDS = new Set([
  'any', 'all', 'everyone', 'anyone', 'any role', 'any position', 'any industry',
  'any company', 'all industries', 'all roles', 'any title', 'n/a', 'na', 'none', 'other',
]);

function TagInput({ label, tags, onAdd, onRemove, suggestions = [], placeholder, helpText }: {
  label: string; tags: string[]; onAdd: (tag: string) => void; onRemove: (tag: string) => void;
  suggestions?: string[]; placeholder: string; helpText?: string;
}) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const safeTags = tags ?? [];
  const filtered = suggestions.filter(s => s.toLowerCase().includes(search.toLowerCase()) && !safeTags.includes(s)).slice(0, 10);

  const handleAdd = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || safeTags.includes(trimmed)) return;
    if (JUNK_KEYWORDS.has(trimmed.toLowerCase())) return; // silently ignore junk
    onAdd(trimmed); setSearch(''); setShowDropdown(false);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {safeTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {safeTags.map(tag => (
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
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'research' | 'email' | null>(null);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ subject: string; body: string } | null>(null);
  const [testEmailError, setTestEmailError] = useState<string | null>(null);
  const [swapLog, setSwapLog] = useState<{ removedAt: string; removed: string; added: string[]; reason: string }[]>([]);
  const [criteriaUnlocked, setCriteriaUnlocked] = useState(false);

  const handleResetFromWebsite = async () => {
    if (!resetWebsiteUrl.trim()) return;
    const url = /^https?:\/\//i.test(resetWebsiteUrl.trim()) ? resetWebsiteUrl.trim() : `https://${resetWebsiteUrl.trim()}`;
    setResetScraping(true);
    try {
      const r = await api.post('/api/company-profile/scrape-website', { url });
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
          agentDecidePositions: u.agentDecidePositions ?? false,
          agentDecideIndustries: u.agentDecideIndustries ?? false,
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
            templates: e.templates || e.emailBuilder?.templates || [],
            useTemplates: e.useTemplates ?? e.emailBuilder?.useTemplates ?? false,
            smartRebump: e.smartRebump ?? e.emailBuilder?.smartRebump ?? false,
            rebumpLinkedinScrape: e.rebumpLinkedinScrape ?? e.emailBuilder?.rebumpLinkedinScrape ?? true,
            maxWords: e.maxWords ?? e.emailBuilder?.maxWords ?? null,
            includeChatLink: e.includeChatLink ?? e.emailBuilder?.includeChatLink ?? false,
            chatLinkInstructions: e.chatLinkInstructions || e.emailBuilder?.chatLinkInstructions || '',
          },
        };
        setSettings(loaded);
        setLastSavedSettings(loaded);
        if (Array.isArray(s._industrySwapLog) && s._industrySwapLog.length > 0) {
          setSwapLog(s._industrySwapLog);
        }
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
      emailBuilder: { ...prev.emailBuilder, length: preset.emailLength || prev.emailBuilder.length, callToAction: preset.callToAction || prev.emailBuilder.callToAction, personalization: preset.personalizationLevel || prev.emailBuilder.personalization, ccEmails: preset.ccEmails || prev.emailBuilder.ccEmails, bccEmails: preset.bccEmails || prev.emailBuilder.bccEmails, rebumpIntervalDays: preset.followupIntervalDays || prev.emailBuilder.rebumpIntervalDays, enableAutoResponse: preset.enableAutoResponse !== undefined ? preset.enableAutoResponse : prev.emailBuilder.enableAutoResponse, useCustomSignature: preset.useCustomSignature !== undefined ? preset.useCustomSignature : prev.emailBuilder.useCustomSignature, signatureName: preset.signatureName || prev.emailBuilder.signatureName, signatureTitle: preset.signatureTitle || prev.emailBuilder.signatureTitle, useLinkedIn: preset.useLinkedIn !== undefined ? preset.useLinkedIn : prev.emailBuilder.useLinkedIn },
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

  const runTestEmail = async () => {
    console.log('[TEST EMAIL] button pressed');
    setTestEmailLoading(true);
    setTestEmailResult(null);
    setTestEmailError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const token = localStorage.getItem('authToken');
      console.log('[TEST EMAIL] fetching, token?', !!token);
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          agentId: resolvedParams.agentId,
          emailSettings: { ...settings.emailBuilder, companyBranding: settings.companyBranding },
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTestEmailError(data.error || 'Email generation failed');
      } else {
        setTestEmailResult(data);
      }
    } catch (e: any) {
      console.error('[TEST EMAIL] error:', e?.name, e?.message);
      setTestEmailError(e?.name === 'AbortError' ? 'Timed out — try again' : (e?.message || 'Failed to generate test email'));
    } finally {
      clearTimeout(timeout);
      setTestEmailLoading(false);
    }
  };

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
        <div className={`max-w-4xl mx-auto px-6 space-y-5 ${activeTab === null ? 'flex flex-col items-center justify-center' : 'py-8'}`} style={activeTab === null ? { minHeight: 'calc(100vh - 73px)' } : {}}>

          {/* Presets — only show under Research */}
          {presets.length > 0 && activeTab === 'research' && (
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

          {/* Tab Selector */}
          <div className={`grid grid-cols-2 gap-6 ${activeTab === null ? 'w-full max-w-2xl' : 'w-full'}`}>
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'research' ? null : 'research')}
              className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 text-center transition-all ${activeTab === null ? 'p-16' : 'p-8'} ${activeTab === 'research' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted/40'}`}
            >
              <Search className={activeTab === null ? 'w-10 h-10' : 'w-7 h-7'} />
              <div>
                <p className={`font-semibold ${activeTab === null ? 'text-lg' : 'text-base'}`}>Research</p>
                <p className="text-xs opacity-60 mt-0.5">Targeting &amp; qualification</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'email' ? null : 'email')}
              className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 text-center transition-all ${activeTab === null ? 'p-16' : 'p-8'} ${activeTab === 'email' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted/40'}`}
            >
              <Mail className={activeTab === null ? 'w-10 h-10' : 'w-7 h-7'} />
              <div>
                <p className={`font-semibold ${activeTab === null ? 'text-lg' : 'text-base'}`}>Email Build</p>
                <p className="text-xs opacity-60 mt-0.5">Writing &amp; preview</p>
              </div>
            </button>
          </div>

          {activeTab === 'research' && (<>


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
              {/* Let agent decide toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Let the agent decide</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Agent skips the industry filter and casts a wider net each cycle</p>
                  <p className="text-[10px] text-primary/70 mt-0.5">Use this if your target is &ldquo;any industry&rdquo;</p>
                </div>
                <Switch
                  checked={!!settings.agentDecideIndustries}
                  onCheckedChange={v => setSettings(p => ({ ...p, agentDecideIndustries: v }))}
                />
              </div>

              {!settings.agentDecideIndustries && (
                <>
                  {swapLog.length > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-amber-600">Industries updated by agent</p>
                        <div className="mt-1 space-y-1">
                          {swapLog.map((entry, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              Removed <span className="font-medium text-foreground">&ldquo;{entry.removed}&rdquo;</span>{entry.added.length > 0 && <> → added <span className="font-medium text-foreground">{entry.added.join(', ')}</span></>} &mdash; {entry.reason}
                            </p>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => setSwapLog([])} className="text-muted-foreground hover:text-foreground shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                  <TagInput
                    label="Industries"
                    tags={settings.companyCriteria.companyIndustries}
                    onAdd={t => updateCompany('companyIndustries', [...settings.companyCriteria.companyIndustries, t])}
                    onRemove={t => updateCompany('companyIndustries', settings.companyCriteria.companyIndustries.filter((x: string) => x !== t))}
                    suggestions={INDUSTRIES}
                    placeholder="Search or type an industry…"
                    helpText="Not in the list? Type it and press Enter to add."
                  />
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-semibold">Each industry is paired with each job title below during search.</span> Make sure the combinations make sense — e.g. &ldquo;Real Estate&rdquo; + &ldquo;Investor&rdquo; are almost never real Apollo titles and will return almost nothing. Use titles people actually put on their LinkedIn profiles at those companies.
                  </div>
                </>
              )}
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
              {/* Let agent decide toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Let the agent decide</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Agent rotates through senior decision-maker titles each cycle</p>
                  <p className="text-[10px] text-primary/70 mt-0.5">Use this if your target is &ldquo;any position&rdquo;</p>
                </div>
                <Switch
                  checked={!!settings.agentDecidePositions}
                  onCheckedChange={v => setSettings(p => ({ ...p, agentDecidePositions: v }))}
                />
              </div>

              {!settings.agentDecidePositions && (
                <>
                  <TagInput
                    label="Job Titles"
                    tags={settings.contactCriteria.targetPositions}
                    onAdd={t => updateContact('targetPositions', [...settings.contactCriteria.targetPositions, t])}
                    onRemove={t => updateContact('targetPositions', settings.contactCriteria.targetPositions.filter((x: string) => x !== t))}
                    suggestions={JOB_TITLES}
                    placeholder="Search or type a job title…"
                    helpText="Not in the list? Type it and press Enter to add."
                  />
                </>
              )}
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

          {/* Qualification Criteria */}
          <Section title="Qualification Criteria" description="Advanced: controls how the agent scores and filters leads.">
            <div className="mb-3 flex items-start justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <div className="flex items-start gap-2">
                <span className="mt-0.5">⚠️</span>
                <span>These criteria are <strong>auto-generated</strong> from your campaign instructions. Editing them overrides what the agent decides on its own. Wrong values will break who the agent is allowed to find.</span>
              </div>
              <button
                type="button"
                onClick={() => setCriteriaUnlocked(v => !v)}
                className={`ml-3 shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  criteriaUnlocked ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-white border border-amber-400 text-amber-700 hover:bg-amber-100'
                }`}
              >
                {criteriaUnlocked ? <><Unlock className="inline w-3 h-3 mr-1" />Lock</> : <><Lock className="inline w-3 h-3 mr-1" />Unlock to edit</>}
              </button>
            </div>
            <div className={`grid grid-cols-1 gap-4 mt-2 transition-opacity ${criteriaUnlocked ? 'opacity-100' : 'opacity-40 pointer-events-none select-none'}`}>
              <TagInput
                label="Must Have (all required)"
                tags={settings.qualificationCriteria?.mustHave ?? []}
                onAdd={v => setSettings(p => ({ ...p, qualificationCriteria: { ...p.qualificationCriteria!, mustHave: [...(p.qualificationCriteria?.mustHave ?? []), v] } }))}
                onRemove={v => setSettings(p => ({ ...p, qualificationCriteria: { ...p.qualificationCriteria!, mustHave: (p.qualificationCriteria?.mustHave ?? []).filter(x => x !== v) } }))}
                placeholder="e.g. owns real estate"
                helpText="Lead must match ALL of these to qualify"
              />
              <TagInput
                label="Nice to Have (bonus points)"
                tags={settings.qualificationCriteria?.niceToHave ?? []}
                onAdd={v => setSettings(p => ({ ...p, qualificationCriteria: { ...p.qualificationCriteria!, niceToHave: [...(p.qualificationCriteria?.niceToHave ?? []), v] } }))}
                onRemove={v => setSettings(p => ({ ...p, qualificationCriteria: { ...p.qualificationCriteria!, niceToHave: (p.qualificationCriteria?.niceToHave ?? []).filter(x => x !== v) } }))}
                placeholder="e.g. recently raised funding"
                helpText="Boosts score but not required"
              />
              <TagInput
                label="Disqualifiers (instant reject)"
                tags={settings.qualificationCriteria?.disqualifiers ?? []}
                onAdd={v => setSettings(p => ({ ...p, qualificationCriteria: { ...p.qualificationCriteria!, disqualifiers: [...(p.qualificationCriteria?.disqualifiers ?? []), v] } }))}
                onRemove={v => setSettings(p => ({ ...p, qualificationCriteria: { ...p.qualificationCriteria!, disqualifiers: (p.qualificationCriteria?.disqualifiers ?? []).filter(x => x !== v) } }))}
                placeholder="e.g. government agency"
                helpText="Any match here = immediate reject"
              />
              {((settings.qualificationCriteria?.mustHave?.length ?? 0) > 0 || (settings.qualificationCriteria?.disqualifiers?.length ?? 0) > 0) && (
                <button
                  type="button"
                  className="text-xs text-gray-400 underline hover:text-gray-600 self-start"
                  onClick={() => setSettings(p => ({ ...p, qualificationCriteria: { mustHave: [], niceToHave: [], disqualifiers: [] } }))}
                >
                  Reset to auto-generated
                </button>
              )}
            </div>
          </Section>

          {/* Geographic & Limits */}
          <Section title="Geographic & Limits" description="Set location targeting and daily limits">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-1.5">
                <Label>Target Locations</Label>
                <LocationTagInput
                  values={settings.geographicSettings.targetLocations}
                  onChange={v => updateGeo('targetLocations', v)}
                  placeholder="e.g. United States"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Excluded Locations</Label>
                <LocationTagInput
                  values={settings.geographicSettings.excludedLocations}
                  onChange={v => updateGeo('excludedLocations', v)}
                  placeholder="e.g. Alaska"
                />
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

          </>)}

          {activeTab === 'email' && (<>

          {/* Email Templates */}
          <Section
            title="Email Templates"
            description="Pre-written email bodies the agent uses instead of generating from scratch"
            badge={settings.emailBuilder.useTemplates ? (settings.emailBuilder.templates?.length ? `${settings.emailBuilder.templates.length} active` : 'on — no templates') : (settings.emailBuilder.templates?.length ? `${settings.emailBuilder.templates.length} saved (off)` : undefined)}
          >
            <div className="mt-4 space-y-4">
              <ToggleRow
                label="Use templates instead of AI generation"
                checked={!!settings.emailBuilder.useTemplates}
                onChange={v => updateEmail('useTemplates', v)}
                description="When on, the agent fills your template bodies instead of writing emails from scratch. Writing Rules are ignored in template mode."
              />
              <TemplateEditor
                templates={settings.emailBuilder.templates || []}
                onChange={tpls => updateEmail('templates', tpls)}
              />
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
                    <p className="text-xs text-blue-500/70 mt-1">Make sure Gmail is connected in Settings → Outreach → Gmail Connection</p>
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
                    <p className="text-xs text-blue-500/70 mt-1">Make sure Outlook is connected in Settings → Outreach → Outlook Connection</p>
                  </div>
                )}
              </div>

              {/* LinkedIn */}
              <div className="border-t border-border pt-4 space-y-3">
                <ToggleRow
                  label="Enable LinkedIn Outreach"
                  checked={!!settings.emailBuilder.useLinkedIn}
                  onChange={v => updateEmail('useLinkedIn', v)}
                  description="Allow this agent to send InMail or connection requests to highly qualified leads via LinkedIn"
                />
                {settings.emailBuilder.useLinkedIn && (
                  <div className="p-3 bg-[#0A66C2]/10 border border-[#0A66C2]/20 rounded-lg">
                    <p className="text-sm font-medium" style={{ color: '#0A66C2' }}>✓ LinkedIn outreach enabled for this agent</p>
                    <p className="text-xs mt-1" style={{ color: '#0A66C2', opacity: 0.7 }}>Make sure LinkedIn is connected in Settings → Outreach → Connect LinkedIn</p>
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

              {/* Chat Link */}
              <div className="border-t border-border pt-4 space-y-3">
                <ToggleRow
                  label="Include Chat Link"
                  checked={settings.emailBuilder.includeChatLink}
                  onChange={v => updateEmail('includeChatLink', v)}
                  description="Inserts a personalised chat link into the email so leads can start a live conversation"
                />
                {settings.emailBuilder.includeChatLink && (
                  <div className="space-y-1.5">
                    <Label>How should the agent use it?</Label>
                    <Textarea
                      value={settings.emailBuilder.chatLinkInstructions}
                      onChange={e => updateEmail('chatLinkInstructions', e.target.value)}
                      rows={3}
                      className="resize-y bg-background text-sm"
                      placeholder={`e.g. Add a P.S. at the end: "If you'd rather just chat now — [CHAT_LINK]"`}
                      maxLength={300}
                    />
                    <p className="text-xs text-muted-foreground">Use <code className="bg-muted px-1 rounded">[CHAT_LINK]</code> to mark where the link goes. The agent will follow your instructions and substitute the real link on send.</p>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* Email Designer */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border" style={{ minHeight: '580px' }}>

              {/* Left: Controls */}
              <div className="p-6 space-y-5 overflow-y-auto">

                {/* Length */}
                <div>
                  <Label className="mb-2 block">Email Length</Label>
                  <div className="flex gap-2">
                  {([
                    { val: 'short',  label: 'Short',  range: '~60 words' },
                    { val: 'medium', label: 'Medium', range: '80–120 words' },
                    { val: 'long',   label: 'Long',   range: '150–200 words' },
                  ] as const).map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => updateEmail('length', opt.val)}
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors flex flex-col items-center gap-0.5 ${
                        settings.emailBuilder.length === opt.val
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className={`text-[10px] font-normal ${settings.emailBuilder.length === opt.val ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>{opt.range}</span>
                    </button>
                  ))}
                </div>
                </div>

                {/* Tone */}
                <div className="space-y-1.5">
                  <Label>Tone</Label>
                  <select
                    value={settings.emailBuilder.tone}
                    onChange={e => updateEmail('tone', e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="casual">Casual</option>
                    <option value="formal">Formal</option>
                    <option value="conversational">Conversational</option>
                  </select>
                </div>

                {/* CTA */}
                <div className="space-y-1.5">
                  <Label>Call to Action</Label>
                  <select
                    value={settings.emailBuilder.callToAction}
                    onChange={e => updateEmail('callToAction', e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="meeting">Book a meeting</option>
                    <option value="call">Schedule a call</option>
                    <option value="demo">Request a demo</option>
                    <option value="reply">Simply reply</option>
                    <option value="learn_more">Learn more</option>
                  </select>
                </div>

                {/* Personalization */}
                <div>
                  <Label className="mb-2 block">Personalization</Label>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => updateEmail('personalization', p)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                          settings.emailBuilder.personalization === p
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Extra Instructions */}
                <div className="space-y-1.5">
                  <Label>Extra Instructions</Label>
                  <Textarea
                    value={settings.emailBuilder.customPrompt}
                    onChange={e => updateEmail('customPrompt', e.target.value)}
                    rows={4}
                    className="resize-y bg-background text-sm"
                    placeholder="e.g. Always open with a specific observation about the company. Never use the word 'synergy'. End with a single low-friction ask."
                    maxLength={500}
                  />
                  <p className="text-right text-xs text-muted-foreground">{settings.emailBuilder.customPrompt.length}/500</p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={runTestEmail}
                    disabled={testEmailLoading}
                    className="flex items-center gap-2 text-sm font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    <FlaskConical className="w-4 h-4" />
                    {testEmailLoading ? 'Generating…' : 'Generate Preview'}
                  </button>
                  <span className="text-xs text-muted-foreground">· save first for accurate results</span>
                </div>
              </div>

              {/* Right: Preview */}
              <div className="p-6 flex flex-col">
                {testEmailLoading && (
                  <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating…
                  </div>
                )}
                {testEmailError && !testEmailLoading && (
                  <p className="text-sm text-destructive">{testEmailError}</p>
                )}
                {!testEmailResult && !testEmailLoading && !testEmailError && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                    <Mail className="w-8 h-8 text-muted-foreground/20" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">No preview yet</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">Click Generate Preview to see a sample email</p>
                    </div>
                  </div>
                )}
                {testEmailResult && !testEmailLoading && (
                  <div className="flex flex-col h-full">
                    <div className="space-y-3 flex-1 overflow-y-auto">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Subject</p>
                        <p className="text-sm font-medium">{testEmailResult.subject}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Body</p>
                        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed bg-muted/40 rounded-lg px-4 py-3">{testEmailResult.body}</pre>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground">{testEmailResult.body.split(/\s+/).filter(Boolean).length} words</p>
                      <button type="button" onClick={runTestEmail} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <FlaskConical className="w-3 h-3" /> Regenerate
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          </>)}

          {/* Bottom Save */}
          {activeTab !== null && (
            <div className="flex items-center justify-between pt-4 border-t border-border pb-8">
              <p className="text-sm text-muted-foreground">{hasUnsavedChanges ? 'You have unsaved changes' : 'All changes saved'}</p>
              <Button size="lg" disabled={isSaving || !hasUnsavedChanges} onClick={saveSettings}>
                {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save All Changes'}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
