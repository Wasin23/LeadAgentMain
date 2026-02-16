'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  PlusIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';

// Complete Industries List
const INDUSTRIES = [
  // Technology
  'Software Development', 'SaaS', 'Cloud Computing', 'Cybersecurity', 'AI/Machine Learning',
  'Data Analytics', 'Mobile Apps', 'Enterprise Software', 'DevOps', 'IoT', 'Blockchain',
  'AR/VR', 'Gaming', 'EdTech', 'FinTech', 'HealthTech', 'PropTech', 'MarTech', 'AgTech',
  'CleanTech', 'Robotics', 'Semiconductors', 'Hardware', 'Networking', 'Telecommunications',
  // Healthcare
  'Hospitals & Health Systems', 'Medical Devices', 'Pharmaceuticals', 'Biotechnology',
  'Telemedicine', 'Mental Health', 'Dental Services', 'Veterinary', 'Medical Software',
  'Clinical Research', 'Health Insurance', 'Medical Equipment', 'Diagnostics',
  // Financial
  'Banking', 'Investment Management', 'Insurance', 'Credit Services', 'Payment Processing',
  'Wealth Management', 'Accounting', 'Tax Services', 'Real Estate Finance', 'Mortgage',
  // Manufacturing
  'Automotive', 'Aerospace & Defense', 'Electronics Manufacturing', 'Chemicals',
  'Food & Beverage', 'Textiles & Apparel', 'Machinery', 'Construction Materials',
  'Consumer Goods', 'Packaging', 'Metals & Mining', 'Oil & Gas', 'Renewable Energy',
  // Retail & E-commerce
  'E-commerce', 'Fashion & Apparel', 'Grocery & Food Retail', 'Electronics Retail',
  'Home & Garden', 'Sporting Goods', 'Luxury Goods', 'Beauty & Cosmetics',
  // Services
  'Consulting', 'Legal Services', 'Marketing & Advertising', 'Public Relations',
  'Architecture', 'Engineering Services', 'Design', 'Event Planning', 'Security Services',
  'Logistics & Supply Chain', 'Transportation', 'Warehousing',
  // Real Estate
  'Commercial Real Estate', 'Residential Real Estate', 'Property Management',
  'Real Estate Investment', 'Construction', 'Interior Design', 'Facilities Management',
  // Hospitality
  'Hotels & Resorts', 'Restaurants & Food Service', 'Travel & Tourism', 'Event Venues',
  'Airlines', 'Vacation Rentals', 'Catering'
];

const JOB_TITLES = [
  // Executive
  'CEO', 'COO', 'CFO', 'CTO', 'CMO', 'CHRO', 'CIO', 'CRO', 'President', 'Founder', 'Co-Founder', 'Managing Director', 'Partner',
  // VP Level
  'VP Sales', 'VP Marketing', 'VP Engineering', 'VP Operations', 'VP Finance', 'VP HR', 'VP Product', 'VP Business Development', 'VP Customer Success',
  // Director
  'Director of Sales', 'Marketing Director', 'Engineering Director', 'Operations Director', 'IT Director', 'HR Director', 'Finance Director', 'Product Director',
  // Manager
  'Sales Manager', 'Marketing Manager', 'Engineering Manager', 'Operations Manager', 'IT Manager', 'HR Manager', 'Product Manager', 'Project Manager',
  // Head of
  'Head of Growth', 'Head of Partnerships', 'Head of Business Development', 'Head of Sales', 'Head of Marketing', 'Head of Engineering',
  // Other
  'Account Executive', 'Business Development Manager', 'Procurement Manager', 'Purchasing Manager', 'General Manager'
];

interface AgentSettings {
  specialInstructions: string;
  companyBranding: {
    agentName: string;
    companyName: string;
    agentTitle: string;
    primaryService: string;
    coreOffering: string;
    keyAdvantages: string;
    expertiseArea: string;
    companyWebsite: string;
    companyDescription: string;
  };
  companyCriteria: {
    companySizeMin: number;
    companySizeMax: number;
    companyIndustries: string[];
  };
  contactCriteria: {
    targetPositions: string[];
    seniorityLevel: string;
  };
  geographicSettings: {
    targetLocations: string[];
    excludedLocations: string[];
    leadLimit: number;
    timezone: string;
  };
  researchFocus: {
    focusAreas: string[];
    researchDepth: string;
    includeCompanyNews: boolean;
    includePersonalInfo: boolean;
    includeSocialMedia: boolean;
  };
  emailBuilder: {
    emailTemplate: string;
    customPrompt: string;
    emailResponsePrompt: string;
    tone: string;
    length: string;
    callToAction: string;
    personalization: string;
    ccEmails: string;
    bccEmails: string;
    enableAutoResponse: boolean;
    rebumpIntervalDays: number;
    useCustomSignature: boolean;
    signatureName: string;
    signatureTitle: string;
    useGmail: boolean;
    useOutlook: boolean;
  };
}

const defaultSettings: AgentSettings = {
  specialInstructions: '',
  companyBranding: {
    agentName: '',
    companyName: '',
    agentTitle: '',
    primaryService: '',
    coreOffering: '',
    keyAdvantages: '',
    expertiseArea: '',
    companyWebsite: '',
    companyDescription: ''
  },
  companyCriteria: {
    companySizeMin: 10,
    companySizeMax: 500,
    companyIndustries: []
  },
  contactCriteria: {
    targetPositions: [],
    seniorityLevel: 'senior'
  },
  geographicSettings: {
    targetLocations: ['United States'],
    excludedLocations: [],
    leadLimit: 50,
    timezone: 'America/New_York'
  },
  researchFocus: {
    focusAreas: [],
    researchDepth: 'standard',
    includeCompanyNews: true,
    includePersonalInfo: false,
    includeSocialMedia: false
  },
  emailBuilder: {
    emailTemplate: 'professional',
    customPrompt: '',
    emailResponsePrompt: '',
    tone: 'professional',
    length: 'medium',
    callToAction: 'meeting',
    personalization: 'high',
    ccEmails: '',
    bccEmails: '',
    enableAutoResponse: false,
    rebumpIntervalDays: 3,
    useCustomSignature: false,
    signatureName: '',
    signatureTitle: '',
    useGmail: false,
    useOutlook: false
  }
};

// Collapsible Section Component
function Section({ 
  title, 
  description,
  children, 
  defaultOpen = false,
  badge
}: { 
  title: string; 
  description?: string;
  children: React.ReactNode; 
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="bg-[#0F1E35] border border-[#1B2F52] rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#1B2F52]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description && <p className="text-sm text-gray-400 mt-0.5">{description}</p>}
          </div>
          {badge && (
            <span className="px-2 py-0.5 bg-[#4FD1FF]/20 text-[#4FD1FF] text-xs font-medium rounded-full">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRightIcon className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="px-6 pb-6 pt-2 border-t border-[#1B2F52]">
          {children}
        </div>
      )}
    </div>
  );
}

// Tag Input Component
function TagInput({
  label,
  tags,
  onAdd,
  onRemove,
  suggestions,
  placeholder,
  helpText
}: {
  label: string;
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  suggestions: string[];
  placeholder: string;
  helpText?: string;
}) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  const filteredSuggestions = suggestions
    .filter(s => s.toLowerCase().includes(search.toLowerCase()) && !tags.includes(s))
    .slice(0, 10);
  
  const handleAdd = (value: string) => {
    if (value.trim() && !tags.includes(value.trim())) {
      onAdd(value.trim());
      setSearch('');
      setShowDropdown(false);
    }
  };
  
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      
      {/* Tags Display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-3 py-1 bg-[#4FD1FF]/20 text-[#4FD1FF] rounded-full text-sm"
            >
              {tag}
              <button onClick={() => onRemove(tag)} className="hover:text-white">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </span>
          ))}
        </div>
      )}
      
      {/* Input with Dropdown */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd(search);
                }
              }}
              placeholder={placeholder}
              className="w-full pl-10 pr-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#4FD1FF] focus:border-transparent"
            />
          </div>
          <button
            onClick={() => handleAdd(search)}
            disabled={!search.trim()}
            className="px-4 py-2.5 bg-[#4FD1FF] text-[#0A1628] rounded-lg font-medium hover:bg-[#6BE3FF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
        
        {/* Dropdown */}
        {showDropdown && filteredSuggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-[#1B2F52] border border-[#2A4472] rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {filteredSuggestions.map(suggestion => (
              <button
                key={suggestion}
                onMouseDown={() => handleAdd(suggestion)}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2A4472] transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
      {helpText && <p className="text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}

// Toggle Component
function Toggle({ 
  label, 
  checked, 
  onChange,
  description 
}: { 
  label: string; 
  checked: boolean; 
  onChange: (checked: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm font-medium text-gray-300">{label}</span>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-[#1B2F52] peer-focus:ring-2 peer-focus:ring-[#4FD1FF] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4FD1FF]"></div>
      </label>
    </div>
  );
}

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
  
  // Presets state
  const [presets, setPresets] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [loadingPresets, setLoadingPresets] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchPresets();
  }, [resolvedParams.agentId]);

  const fetchPresets = async () => {
    try {
      setLoadingPresets(true);
      const response = await api.get('/api/settings/presets');
      setPresets(response.data.presets || []);
    } catch (error) {
      console.error('Error loading presets:', error);
    } finally {
      setLoadingPresets(false);
    }
  };

  const applyPreset = async (preset: any) => {
    setSelectedPreset(preset.id || preset._id);
    
    const updatedSettings: AgentSettings = {
      ...settings,
      specialInstructions: preset.specialInstructions || settings.specialInstructions,
      companyCriteria: {
        ...settings.companyCriteria,
        companySizeMin: preset.companySizeMin || settings.companyCriteria.companySizeMin,
        companySizeMax: preset.companySizeMax || settings.companyCriteria.companySizeMax,
        companyIndustries: preset.targetIndustries || settings.companyCriteria.companyIndustries
      },
      contactCriteria: {
        ...settings.contactCriteria,
        targetPositions: preset.targetPositions || settings.contactCriteria.targetPositions
      },
      geographicSettings: {
        ...settings.geographicSettings,
        leadLimit: preset.leadLimit || settings.geographicSettings.leadLimit
      },
      emailBuilder: {
        ...settings.emailBuilder,
        length: preset.emailLength || settings.emailBuilder.length,
        callToAction: preset.callToAction || settings.emailBuilder.callToAction,
        personalization: preset.personalizationLevel || settings.emailBuilder.personalization,
        ccEmails: preset.ccEmails || settings.emailBuilder.ccEmails,
        bccEmails: preset.bccEmails || settings.emailBuilder.bccEmails,
        rebumpIntervalDays: preset.followupIntervalDays || settings.emailBuilder.rebumpIntervalDays,
        enableAutoResponse: preset.enableAutoResponse !== undefined ? preset.enableAutoResponse : settings.emailBuilder.enableAutoResponse,
        useCustomSignature: preset.useCustomSignature !== undefined ? preset.useCustomSignature : settings.emailBuilder.useCustomSignature,
        signatureName: preset.signatureName || settings.emailBuilder.signatureName,
        signatureTitle: preset.signatureTitle || settings.emailBuilder.signatureTitle
      }
    };
    
    setSettings(updatedSettings);
    setHasUnsavedChanges(true);
  };

  // Track unsaved changes
  useEffect(() => {
    if (lastSavedSettings) {
      const hasChanges = JSON.stringify(settings) !== JSON.stringify(lastSavedSettings);
      setHasUnsavedChanges(hasChanges);
    }
  }, [settings, lastSavedSettings]);

  // Auto-save with debounce
  const autoSave = useCallback(async () => {
    if (!hasUnsavedChanges || isSaving) return;
    
    setSaveStatus('saving');
    try {
      await api.post('/api/lead-agent/settings', {
        ...settings,
        agentId: resolvedParams.agentId
      });
      setLastSavedSettings(settings);
      setSaveStatus('success');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Auto-save failed:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [settings, resolvedParams.agentId, hasUnsavedChanges, isSaving]);

  // Debounced auto-save (3 seconds after last change)
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const timer = setTimeout(autoSave, 3000);
    return () => clearTimeout(timer);
  }, [settings, hasUnsavedChanges, autoSave]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/api/lead-agent/settings?agentId=${resolvedParams.agentId}`);
      
      if (response.data.settings) {
        const apiSettings = response.data.settings;
        const userSettings = apiSettings.userSettings || apiSettings.leadGeneration || apiSettings;
        const emailSettings = apiSettings.emailSettings || apiSettings.emailBuilder || apiSettings;
        
        if (userSettings.agentName || userSettings.companyBranding?.agentName) {
          setAgentName(userSettings.agentName || userSettings.companyBranding?.agentName);
        }
        
        const loadedSettings: AgentSettings = {
          specialInstructions: apiSettings.specialInstructions || userSettings.specialInstructions || '',
          companyBranding: {
            agentName: userSettings.agentName || userSettings.companyBranding?.agentName || '',
            companyName: userSettings.companyName || userSettings.companyBranding?.companyName || '',
            agentTitle: userSettings.agentTitle || userSettings.companyBranding?.agentTitle || '',
            primaryService: userSettings.primaryService || userSettings.companyBranding?.primaryService || '',
            coreOffering: userSettings.coreOffering || userSettings.companyBranding?.coreOffering || '',
            keyAdvantages: userSettings.keyAdvantages || userSettings.companyBranding?.keyAdvantages || '',
            expertiseArea: userSettings.expertiseArea || userSettings.companyBranding?.expertiseArea || '',
            companyWebsite: userSettings.companyWebsite || userSettings.companyBranding?.companyWebsite || '',
            companyDescription: userSettings.companyDescription || userSettings.companyBranding?.companyDescription || ''
          },
          companyCriteria: {
            companySizeMin: userSettings.companySizeMin || userSettings.companyCriteria?.companySizeMin || 10,
            companySizeMax: userSettings.companySizeMax || userSettings.companyCriteria?.companySizeMax || 500,
            companyIndustries: userSettings.companyIndustries || userSettings.companyCriteria?.companyIndustries || []
          },
          contactCriteria: {
            targetPositions: userSettings.targetPositions || userSettings.contactCriteria?.targetPositions || [],
            seniorityLevel: userSettings.seniorityLevel || userSettings.contactCriteria?.seniorityLevel || 'senior'
          },
          geographicSettings: {
            targetLocations: userSettings.targetLocations || userSettings.geographicSettings?.targetLocations || ['United States'],
            excludedLocations: userSettings.excludedLocations || userSettings.geographicSettings?.excludedLocations || [],
            leadLimit: userSettings.leadLimit || userSettings.geographicSettings?.leadLimit || 50,
            timezone: userSettings.timezone || userSettings.geographicSettings?.timezone || 'America/New_York'
          },
          researchFocus: {
            focusAreas: userSettings.focusAreas || userSettings.researchFocus?.focusAreas || [],
            researchDepth: userSettings.researchDepth || userSettings.researchFocus?.researchDepth || 'standard',
            includeCompanyNews: userSettings.includeCompanyNews ?? userSettings.researchFocus?.includeCompanyNews ?? true,
            includePersonalInfo: userSettings.includePersonalInfo ?? userSettings.researchFocus?.includePersonalInfo ?? false,
            includeSocialMedia: userSettings.includeSocialMedia ?? userSettings.researchFocus?.includeSocialMedia ?? false
          },
          emailBuilder: {
            emailTemplate: emailSettings.emailTemplate || emailSettings.emailBuilder?.emailTemplate || 'professional',
            customPrompt: emailSettings.customPrompt || emailSettings.emailBuilder?.customPrompt || '',
            emailResponsePrompt: emailSettings.emailResponsePrompt || emailSettings.emailBuilder?.emailResponsePrompt || '',
            tone: emailSettings.tone || emailSettings.emailBuilder?.tone || 'professional',
            length: emailSettings.length || emailSettings.emailBuilder?.length || 'medium',
            callToAction: emailSettings.callToAction || emailSettings.emailBuilder?.callToAction || 'meeting',
            personalization: emailSettings.personalization || emailSettings.emailBuilder?.personalization || 'high',
            ccEmails: emailSettings.ccEmails || emailSettings.emailBuilder?.ccEmails || '',
            bccEmails: emailSettings.bccEmails || emailSettings.emailBuilder?.bccEmails || '',
            enableAutoResponse: emailSettings.enableAutoResponse ?? emailSettings.emailBuilder?.enableAutoResponse ?? false,
            rebumpIntervalDays: emailSettings.rebumpIntervalDays || emailSettings.emailBuilder?.rebumpIntervalDays || 3,
            useCustomSignature: emailSettings.useCustomSignature ?? emailSettings.emailBuilder?.useCustomSignature ?? false,
            signatureName: emailSettings.signatureName || emailSettings.emailBuilder?.signatureName || '',
            signatureTitle: emailSettings.signatureTitle || emailSettings.emailBuilder?.signatureTitle || '',
            useGmail: emailSettings.useGmail ?? emailSettings.emailBuilder?.useGmail ?? false,
            useOutlook: emailSettings.useOutlook ?? emailSettings.emailBuilder?.useOutlook ?? false
          }
        };
        
        setSettings(loadedSettings);
        setLastSavedSettings(loadedSettings);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      await api.post('/api/lead-agent/settings', {
        ...settings,
        agentId: resolvedParams.agentId
      });
      
      setLastSavedSettings(settings);
      setSaveStatus('success');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper functions to update nested state
  const updateBranding = (field: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      companyBranding: { ...prev.companyBranding, [field]: value }
    }));
  };

  const updateCompany = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      companyCriteria: { ...prev.companyCriteria, [field]: value }
    }));
  };

  const updateContact = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      contactCriteria: { ...prev.contactCriteria, [field]: value }
    }));
  };

  const updateGeo = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      geographicSettings: { ...prev.geographicSettings, [field]: value }
    }));
  };

  const updateResearch = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      researchFocus: { ...prev.researchFocus, [field]: value }
    }));
  };

  const updateEmail = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      emailBuilder: { ...prev.emailBuilder, [field]: value }
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4FD1FF] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1628]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A1628]/95 backdrop-blur-sm border-b border-[#1B2F52]">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-[#1B2F52] rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-gray-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">{agentName} Settings</h1>
                <p className="text-sm text-gray-400">Configure targeting, messaging, and behavior</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Save Status Indicator */}
              <div className="flex items-center gap-2 text-sm">
                {saveStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-[#4FD1FF]">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#4FD1FF]"></div>
                    Saving...
                  </span>
                )}
                {saveStatus === 'success' && (
                  <span className="flex items-center gap-1 text-green-400">
                    <CheckIcon className="w-4 h-4" /> Saved
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="flex items-center gap-1 text-red-400">
                    <ExclamationCircleIcon className="w-4 h-4" /> Save failed
                  </span>
                )}
                {saveStatus === 'idle' && hasUnsavedChanges && (
                  <span className="text-yellow-400">Unsaved changes</span>
                )}
              </div>
              
              <button
                onClick={saveSettings}
                disabled={isSaving || !hasUnsavedChanges}
                className="px-6 py-2 bg-[#4FD1FF] text-[#0A1628] font-semibold rounded-lg hover:bg-[#6BE3FF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        
        {/* Presets Section */}
        {presets.length > 0 && (
          <div className="bg-[#0F1E35] border border-[#1B2F52] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Quick Presets</h3>
                <p className="text-sm text-gray-400">Apply a saved configuration to quickly set up targeting</p>
              </div>
              {loadingPresets && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#4FD1FF]"></div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {presets.map((preset) => (
                <button
                  key={preset.id || preset._id}
                  onClick={() => applyPreset(preset)}
                  className={`text-left p-4 rounded-lg border-2 transition-all ${
                    selectedPreset === (preset.id || preset._id)
                      ? 'border-[#4FD1FF] bg-[#1B2F52] ring-2 ring-[#4FD1FF]/30'
                      : 'border-[#1B2F52] bg-[#0A1628] hover:border-[#3B82F6]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-white">{preset.name}</h4>
                    {selectedPreset === (preset.id || preset._id) && (
                      <div className="w-5 h-5 bg-[#4FD1FF] rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckIcon className="w-3 h-3 text-[#0F1E35]" />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {(preset.targetIndustries || []).slice(0, 2).map((industry: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[10px] font-medium">
                          {industry}
                        </span>
                      ))}
                      {(preset.targetIndustries?.length || 0) > 2 && (
                        <span className="px-2 py-0.5 bg-[#1B2F52] text-gray-400 rounded text-[10px] font-medium">
                          +{preset.targetIndustries.length - 2}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{preset.companySizeMin}-{preset.companySizeMax} emp</span>
                      <span>•</span>
                      <span>{preset.leadLimit} leads/cycle</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* General Instructions - Always Visible */}
        <div className="bg-gradient-to-r from-[#4FD1FF]/10 to-[#3B82F6]/10 border border-[#4FD1FF]/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[#4FD1FF] mb-2">General Instructions</h3>
          <p className="text-sm text-gray-400 mb-4">
            High-level instructions that guide the entire campaign. Be specific about who to target and what pain points to address.
          </p>
          <textarea
            value={settings.specialInstructions}
            onChange={(e) => setSettings(prev => ({ ...prev, specialInstructions: e.target.value }))}
            placeholder="Example: Target CTOs at Series A startups in healthcare tech. Focus on pain points around scaling engineering teams and infrastructure costs. Keep tone professional but friendly."
            className="w-full px-4 py-3 bg-[#0F1E35] border border-[#1B2F52] text-white placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-[#4FD1FF] focus:border-transparent resize-y min-h-[100px]"
            maxLength={1000}
          />
          <div className="text-right text-xs text-gray-500 mt-1">
            {settings.specialInstructions.length}/1000
          </div>
        </div>

        {/* Company Branding */}
        <Section 
          title="Your Company" 
          description="Information about your company for email personalization" 
          defaultOpen={true}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Agent Name</label>
              <input
                type="text"
                value={settings.companyBranding.agentName}
                onChange={(e) => updateBranding('agentName', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                placeholder="Sales Bot"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Company Name</label>
              <input
                type="text"
                value={settings.companyBranding.companyName}
                onChange={(e) => updateBranding('companyName', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                placeholder="Acme Inc"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Agent Title</label>
              <input
                type="text"
                value={settings.companyBranding.agentTitle}
                onChange={(e) => updateBranding('agentTitle', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                placeholder="AI Sales Agent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Website</label>
              <input
                type="text"
                value={settings.companyBranding.companyWebsite}
                onChange={(e) => updateBranding('companyWebsite', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                placeholder="https://acme.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Primary Service</label>
              <input
                type="text"
                value={settings.companyBranding.primaryService}
                onChange={(e) => updateBranding('primaryService', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                placeholder="AI-powered sales automation"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Core Offering</label>
              <input
                type="text"
                value={settings.companyBranding.coreOffering}
                onChange={(e) => updateBranding('coreOffering', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                placeholder="Automated outreach platform"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Key Advantages</label>
              <input
                type="text"
                value={settings.companyBranding.keyAdvantages}
                onChange={(e) => updateBranding('keyAdvantages', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                placeholder="Speed, Accuracy, Cost Savings"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Expertise Area</label>
              <input
                type="text"
                value={settings.companyBranding.expertiseArea}
                onChange={(e) => updateBranding('expertiseArea', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                placeholder="B2B Sales"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Company Description</label>
              <textarea
                value={settings.companyBranding.companyDescription}
                onChange={(e) => updateBranding('companyDescription', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF] resize-y min-h-[80px]"
                placeholder="Brief description of what your company does..."
              />
            </div>
          </div>
        </Section>

        {/* Target Companies */}
        <Section 
          title="Target Companies" 
          description="Define the types of companies to reach out to"
          badge={settings.companyCriteria.companyIndustries.length > 0 ? `${settings.companyCriteria.companyIndustries.length} industries` : undefined}
        >
          <div className="space-y-6">
            <TagInput
              label="Industries"
              tags={settings.companyCriteria.companyIndustries}
              onAdd={(tag) => updateCompany('companyIndustries', [...settings.companyCriteria.companyIndustries, tag])}
              onRemove={(tag) => updateCompany('companyIndustries', settings.companyCriteria.companyIndustries.filter((t: string) => t !== tag))}
              suggestions={INDUSTRIES}
              placeholder="Search or type an industry..."
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Min Company Size (employees)</label>
                <input
                  type="number"
                  value={settings.companyCriteria.companySizeMin}
                  onChange={(e) => updateCompany('companySizeMin', parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Max Company Size (employees)</label>
                <input
                  type="number"
                  value={settings.companyCriteria.companySizeMax}
                  onChange={(e) => updateCompany('companySizeMax', parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Target Contacts */}
        <Section 
          title="Target Contacts" 
          description="Define the job titles and roles to reach"
          badge={settings.contactCriteria.targetPositions.length > 0 ? `${settings.contactCriteria.targetPositions.length} positions` : undefined}
        >
          <div className="space-y-6">
            <TagInput
              label="Job Titles"
              tags={settings.contactCriteria.targetPositions}
              onAdd={(tag) => updateContact('targetPositions', [...settings.contactCriteria.targetPositions, tag])}
              onRemove={(tag) => updateContact('targetPositions', settings.contactCriteria.targetPositions.filter((t: string) => t !== tag))}
              suggestions={JOB_TITLES}
              placeholder="Search or type a job title..."
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Seniority Level</label>
              <select
                value={settings.contactCriteria.seniorityLevel}
                onChange={(e) => updateContact('seniorityLevel', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
              >
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Target Locations</label>
                <input
                  type="text"
                  value={settings.geographicSettings.targetLocations.join(', ')}
                  onChange={(e) => updateGeo('targetLocations', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                  placeholder="United States, Canada"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Excluded Locations</label>
                <input
                  type="text"
                  value={settings.geographicSettings.excludedLocations.join(', ')}
                  onChange={(e) => updateGeo('excludedLocations', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                  placeholder="Alaska, Hawaii"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Daily Lead Limit</label>
                <input
                  type="number"
                  value={settings.geographicSettings.leadLimit}
                  onChange={(e) => updateGeo('leadLimit', parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                  min={1}
                  max={200}
                />
                <p className="text-xs text-gray-500 mt-1">Max leads to contact per cycle</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Timezone</label>
                <select
                  value={settings.geographicSettings.timezone}
                  onChange={(e) => updateGeo('timezone', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                >
                  <option value="America/New_York">Eastern (ET)</option>
                  <option value="America/Chicago">Central (CT)</option>
                  <option value="America/Denver">Mountain (MT)</option>
                  <option value="America/Los_Angeles">Pacific (PT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </div>
        </Section>

        {/* Research Focus */}
        <Section title="Research Focus" description="Configure how leads are researched before outreach">
          <div className="space-y-6">
            <TagInput
              label="Focus Areas"
              tags={settings.researchFocus.focusAreas}
              onAdd={(tag) => updateResearch('focusAreas', [...settings.researchFocus.focusAreas, tag])}
              onRemove={(tag) => updateResearch('focusAreas', settings.researchFocus.focusAreas.filter((t: string) => t !== tag))}
              suggestions={['Pain Points', 'Recent Wins', 'Company Culture', 'Tech Stack', 'Competitors', 'Growth Plans']}
              placeholder="Add research focus areas..."
              helpText="What to prioritize when researching leads"
            />

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Research Depth</label>
              <select
                value={settings.researchFocus.researchDepth}
                onChange={(e) => updateResearch('researchDepth', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
              >
                <option value="minimal">Minimal (faster, less personalized)</option>
                <option value="standard">Standard (balanced)</option>
                <option value="deep">Deep (slower, highly personalized)</option>
              </select>
            </div>

            <div className="space-y-3">
              <Toggle
                label="Include Company News"
                checked={settings.researchFocus.includeCompanyNews}
                onChange={(checked) => updateResearch('includeCompanyNews', checked)}
                description="Research recent company news and announcements"
              />
              <Toggle
                label="Include Personal Info"
                checked={settings.researchFocus.includePersonalInfo}
                onChange={(checked) => updateResearch('includePersonalInfo', checked)}
                description="Research contact's background and interests"
              />
              <Toggle
                label="Include Social Media"
                checked={settings.researchFocus.includeSocialMedia}
                onChange={(checked) => updateResearch('includeSocialMedia', checked)}
                description="Research contact's social media activity"
              />
            </div>
          </div>
        </Section>

        {/* Email Settings */}
        <Section title="Email Settings" description="Configure follow-ups and auto-response">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Auto-Response Prompt</label>
              <textarea
                value={settings.emailBuilder.emailResponsePrompt}
                onChange={(e) => updateEmail('emailResponsePrompt', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF] resize-y min-h-[80px]"
                placeholder="Instructions for AI auto-responses to replies..."
              />
              <p className="text-xs text-gray-500 mt-1">Used when auto-response is enabled</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">CC Emails</label>
                <input
                  type="text"
                  value={settings.emailBuilder.ccEmails}
                  onChange={(e) => updateEmail('ccEmails', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                  placeholder="cc@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">BCC Emails</label>
                <input
                  type="text"
                  value={settings.emailBuilder.bccEmails}
                  onChange={(e) => updateEmail('bccEmails', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                  placeholder="bcc@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Follow-up Interval (days)</label>
                <input
                  type="number"
                  value={settings.emailBuilder.rebumpIntervalDays}
                  onChange={(e) => updateEmail('rebumpIntervalDays', parseInt(e.target.value) || 3)}
                  className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                  min={1}
                  max={30}
                />
                <p className="text-xs text-gray-500 mt-1">Days before sending a follow-up</p>
              </div>
              <div className="pt-6">
                <Toggle
                  label="Enable AI Auto-Response"
                  checked={settings.emailBuilder.enableAutoResponse}
                  onChange={(checked) => updateEmail('enableAutoResponse', checked)}
                  description="Automatically respond to replies with AI"
                />
              </div>
            </div>

            {/* Gmail Sending Toggle */}
            <div className="border-t border-[#1B2F52] pt-4">
              <Toggle
                label="Use Gmail for Sending"
                checked={settings.emailBuilder.useGmail}
                onChange={(checked) => {
                  updateEmail('useGmail', checked);
                  if (checked) updateEmail('useOutlook', false); // Turn off Outlook
                }}
                description="Send emails from your connected Gmail account instead of Mailgun (better deliverability)"
              />
              {settings.emailBuilder.useGmail && (
                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-300">
                    ✓ Emails will be sent from your connected Gmail account
                  </p>
                  <p className="text-xs text-blue-300/70 mt-1">
                    Make sure you've connected your Gmail account in Settings → Email → Gmail Connection
                  </p>
                </div>
              )}
            </div>

            {/* Outlook Sending Toggle */}
            <div className="border-t border-[#1B2F52] pt-4">
              <Toggle
                label="Use Outlook for Sending"
                checked={settings.emailBuilder.useOutlook}
                onChange={(checked) => {
                  updateEmail('useOutlook', checked);
                  if (checked) updateEmail('useGmail', false); // Turn off Gmail
                }}
                description="Send emails from your connected Outlook account instead of Mailgun (better deliverability)"
              />
              {settings.emailBuilder.useOutlook && (
                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-300">
                    ✓ Emails will be sent from your connected Outlook account
                  </p>
                  <p className="text-xs text-blue-300/70 mt-1">
                    Make sure you've connected your Outlook account in Settings → Email → Outlook Connection
                  </p>
                </div>
              )}
            </div>

            {/* Custom Signature */}
            <div className="border-t border-[#1B2F52] pt-4">
              <Toggle
                label="Use Custom Signature"
                checked={settings.emailBuilder.useCustomSignature}
                onChange={(checked) => updateEmail('useCustomSignature', checked)}
                description="Use a custom signature instead of AI-generated"
              />
              
              {settings.emailBuilder.useCustomSignature && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Signature Name</label>
                    <input
                      type="text"
                      value={settings.emailBuilder.signatureName}
                      onChange={(e) => updateEmail('signatureName', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Signature Title</label>
                    <input
                      type="text"
                      value={settings.emailBuilder.signatureTitle}
                      onChange={(e) => updateEmail('signatureTitle', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#1B2F52] border border-[#2A4472] rounded-lg text-white focus:ring-2 focus:ring-[#4FD1FF]"
                      placeholder="Sales Director"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* Bottom Save Button */}
        <div className="flex items-center justify-between pt-4 border-t border-[#1B2F52]">
          <div className="text-sm text-gray-400">
            {hasUnsavedChanges ? 'You have unsaved changes' : 'All changes saved'}
          </div>
          <button
            onClick={saveSettings}
            disabled={isSaving || !hasUnsavedChanges}
            className="px-8 py-3 bg-[#4FD1FF] text-[#0A1628] font-semibold rounded-lg hover:bg-[#6BE3FF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
