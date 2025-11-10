'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface AgentSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  compact?: boolean; // Optional compact mode for monitoring page
}

interface ZillizAgentSettings {
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
    excludedCompanies: string[];
    companyKeywords: string[];
  };
  contactCriteria: {
    targetPositions: string[];
    seniorityLevel: string;
    excludedTitles: string[];
    contactKeywords: string[];
  };
  geographicSettings: {
    targetLocations: string[];
    excludedLocations: string[];
    leadLimit: number;
    timezone: string;
  };
  advancedCriteria: {
    fundingStage: string;
    fundingAmount: string;
    growthStage: string;
    technologiesUsed: string[];
    recentNews: boolean;
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
    emailResponsePrompt?: string; // Agent-specific prompt for email responses
    tone: string;
    length: string;
    callToAction: string;
    personalization: string;
    ccEmails?: string; // Comma-separated email addresses
    bccEmails?: string; // Comma-separated BCC email addresses
    enableAutoResponse?: boolean; // Toggle for AI auto-response
    rebumpIntervalDays?: number; // Days to wait before follow-up
  };
}

// Complete Apollo Industries Database (200+ industries)
const APOLLO_INDUSTRIES = {
  technology: [
    'Software Development', 'SaaS', 'Cloud Computing', 'Cybersecurity', 'AI/Machine Learning', 
    'Data Analytics', 'Mobile Apps', 'Enterprise Software', 'DevOps', 'IoT', 'Blockchain', 
    'AR/VR', 'Gaming', 'EdTech', 'FinTech', 'HealthTech', 'PropTech', 'MarTech', 'AgTech',
    'CleanTech', 'Robotics', 'Semiconductors', 'Hardware', 'Networking', 'Telecommunications'
  ],
  healthcare: [
    'Hospitals & Health Systems', 'Medical Devices', 'Pharmaceuticals', 'Biotechnology',
    'Telemedicine', 'Mental Health', 'Dental Services', 'Veterinary', 'Medical Software',
    'Clinical Research', 'Health Insurance', 'Medical Equipment', 'Diagnostics',
    'Therapy Services', 'Home Healthcare', 'Senior Care', 'Wellness & Fitness'
  ],
  financialServices: [
    'Banking', 'Investment Management', 'Insurance', 'FinTech', 'Credit Services',
    'Payment Processing', 'Wealth Management', 'Accounting', 'Tax Services',
    'Real Estate Finance', 'Mortgage', 'Personal Finance', 'Corporate Finance',
    'Risk Management', 'Compliance', 'Trading', 'Cryptocurrency'
  ],
  manufacturing: [
    'Automotive', 'Aerospace & Defense', 'Electronics Manufacturing', 'Chemicals',
    'Food & Beverage', 'Textiles & Apparel', 'Machinery', 'Construction Materials',
    'Medical Device Manufacturing', 'Consumer Goods', 'Packaging', 'Metals & Mining',
    'Oil & Gas', 'Renewable Energy', 'Industrial Equipment', 'Furniture'
  ],
  retail: [
    'E-commerce', 'Fashion & Apparel', 'Grocery & Food Retail', 'Electronics Retail',
    'Home & Garden', 'Sporting Goods', 'Luxury Goods', 'Automotive Retail',
    'Beauty & Cosmetics', 'Jewelry', 'Books & Media', 'Toys & Games', 'Pet Supplies'
  ],
  services: [
    'Consulting', 'Legal Services', 'Marketing & Advertising', 'Public Relations',
    'Architecture', 'Engineering Services', 'Design', 'Event Planning', 'Security Services',
    'Cleaning Services', 'Logistics & Supply Chain', 'Transportation', 'Warehousing'
  ],
  realEstate: [
    'Commercial Real Estate', 'Residential Real Estate', 'Property Management',
    'Real Estate Investment', 'Construction', 'Architecture & Planning',
    'Interior Design', 'Property Development', 'Facilities Management'
  ],
  education: [
    'K-12 Education', 'Higher Education', 'Online Learning', 'Corporate Training',
    'Educational Technology', 'Tutoring', 'Language Learning', 'Vocational Training',
    'Early Childhood Education', 'Special Education', 'Educational Publishing'
  ],
  media: [
    'Broadcasting', 'Publishing', 'Digital Media', 'Advertising', 'Entertainment',
    'Film & Television', 'Music', 'Gaming', 'Social Media', 'Content Creation',
    'Journalism', 'Photography', 'Graphic Design', 'Marketing Agencies'
  ],
  nonprofit: [
    'Charitable Organizations', 'Social Services', 'Environmental', 'Education',
    'Healthcare', 'Religious Organizations', 'Arts & Culture', 'Community Development',
    'International Aid', 'Research Foundations', 'Advocacy Groups'
  ],
  government: [
    'Federal Government', 'State Government', 'Local Government', 'Military',
    'Public Safety', 'Transportation', 'Environmental Agencies', 'Healthcare',
    'Education', 'Social Services', 'Regulatory Bodies'
  ]
};

// Common job titles across all industries
const JOB_TITLES = {
  executive: ['CEO', 'COO', 'CFO', 'CTO', 'CMO', 'CHRO', 'President', 'Founder', 'Co-Founder', 'Managing Director'],
  vpLevel: ['VP Sales', 'VP Marketing', 'VP Engineering', 'VP Operations', 'VP Finance', 'VP HR', 'VP Product', 'VP Business Development'],
  director: ['Director of Sales', 'Marketing Director', 'Engineering Director', 'Operations Director', 'IT Director', 'HR Director', 'Finance Director'],
  manager: ['Sales Manager', 'Marketing Manager', 'Engineering Manager', 'Operations Manager', 'IT Manager', 'HR Manager', 'Product Manager', 'Project Manager'],
  specialist: ['Sales Representative', 'Marketing Specialist', 'Software Engineer', 'Data Analyst', 'HR Specialist', 'Account Manager', 'Business Analyst']
};

export default function AgentSettingsModal({ isOpen, onClose, agentId, compact = false }: AgentSettingsProps) {
  const [settings, setSettings] = useState<ZillizAgentSettings>({
    companyBranding: {
      agentName: 'AI Lead Agent',
      companyName: 'Your Company',
      agentTitle: 'AI Assistant',
      primaryService: 'Business Solutions',
      coreOffering: 'Professional Services',
      keyAdvantages: 'Quality, Innovation, Reliability',
      expertiseArea: 'Business Development',
      companyWebsite: '',
      companyDescription: ''
    },
    companyCriteria: {
      companySizeMin: 50,
      companySizeMax: 500,
      companyIndustries: [],
      excludedCompanies: [],
      companyKeywords: []
    },
    contactCriteria: {
      targetPositions: [],
      seniorityLevel: 'senior',
      excludedTitles: [],
      contactKeywords: []
    },
    geographicSettings: {
      targetLocations: ['United States'],
      excludedLocations: [],
      leadLimit: 50,
      timezone: 'UTC'
    },
    advancedCriteria: {
      fundingStage: 'any',
      fundingAmount: '',
      growthStage: 'any',
      technologiesUsed: [],
      recentNews: false
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
      tone: 'professional',
      length: 'medium',
      callToAction: 'meeting',
      personalization: 'high'
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  
  // Search states for industries and job titles
  const [industrySearch, setIndustrySearch] = useState('');
  const [jobTitleSearch, setJobTitleSearch] = useState('');
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [showJobTitleDropdown, setShowJobTitleDropdown] = useState(false);

  // Get all industries in a flat array for searching (remove duplicates)
  const allIndustries = Array.from(new Set(Object.values(APOLLO_INDUSTRIES).flat()));
  const allJobTitles = Array.from(new Set(Object.values(JOB_TITLES).flat()));

  // Filter industries based on search
  const filteredIndustries = allIndustries.filter(industry =>
    industry.toLowerCase().includes(industrySearch.toLowerCase())
  ).slice(0, 50); // Limit to 50 for performance

  // Filter job titles based on search
  const filteredJobTitles = allJobTitles.filter(title =>
    title.toLowerCase().includes(jobTitleSearch.toLowerCase())
  ).slice(0, 50); // Limit to 50 for performance

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      fetchCompanyProfile(); // Also fetch company profile for simple mode
    }
  }, [isOpen, agentId]);

  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [recommendedPreset, setRecommendedPreset] = useState<any>(null);

  const fetchCompanyProfile = async () => {
    try {
      const response = await api.get('/api/company-profile/profile');
      if (response.data.success) {
        setCompanyProfile(response.data.profile);
        setRecommendedPreset(response.data.recommendedPreset);
        console.log('📋 [SETTINGS] Loaded company profile preset:', response.data.recommendedPreset);
      }
    } catch (error) {
      console.warn('No company profile found, using manual settings');
    }
  };

  // Apply recommended preset when switching to simple mode
  useEffect(() => {
    if (!isAdvancedMode && recommendedPreset && settings) {
      console.log('🎯 [SIMPLE MODE] Applying recommended preset');
      setSettings(prev => ({
        ...prev,
        companyCriteria: {
          ...prev.companyCriteria,
          companyIndustries: recommendedPreset.targetIndustries || prev.companyCriteria.companyIndustries,
          companySizeMin: recommendedPreset.companySizeMin || prev.companyCriteria.companySizeMin,
          companySizeMax: recommendedPreset.companySizeMax || prev.companyCriteria.companySizeMax,
        },
        contactCriteria: {
          ...prev.contactCriteria,
          targetPositions: recommendedPreset.targetPositions || prev.contactCriteria.targetPositions,
        },
        geographicSettings: {
          ...prev.geographicSettings,
          leadLimit: recommendedPreset.leadLimit || prev.geographicSettings.leadLimit,
        }
      }));
    }
  }, [isAdvancedMode, recommendedPreset]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/api/lead-agent/settings?agentId=${agentId}`);
      if (response.data.settings) {
        // Merge API data with default structure to prevent undefined errors
        setSettings(prevSettings => {
          const apiSettings = response.data.settings;
          console.log('🔍 [FRONTEND] Raw API settings:', JSON.stringify(apiSettings, null, 2));
          
          // The API returns userSettings and emailSettings, so we need to extract from those
          const userSettings = apiSettings.userSettings || apiSettings.leadGeneration || {};
          const emailSettings = apiSettings.emailSettings || apiSettings.emailBuilder || {};
          
          console.log('🔍 [FRONTEND] Extracted userSettings:', JSON.stringify(userSettings, null, 2));
          console.log('🔍 [FRONTEND] Extracted emailSettings:', JSON.stringify(emailSettings, null, 2));
          
          return {
            companyBranding: {
              ...prevSettings.companyBranding,
              ...userSettings.companyBranding,
              // Map flat properties if they exist
              agentName: userSettings.agentName || userSettings.companyBranding?.agentName || prevSettings.companyBranding.agentName,
              companyName: userSettings.companyName || userSettings.companyBranding?.companyName || prevSettings.companyBranding.companyName,
              primaryService: userSettings.primaryService || userSettings.companyBranding?.primaryService || prevSettings.companyBranding.primaryService,
              coreOffering: userSettings.coreOffering || userSettings.companyBranding?.coreOffering || prevSettings.companyBranding.coreOffering,
              keyAdvantages: userSettings.keyAdvantages || userSettings.companyBranding?.keyAdvantages || prevSettings.companyBranding.keyAdvantages,
              expertiseArea: userSettings.expertiseArea || userSettings.companyBranding?.expertiseArea || prevSettings.companyBranding.expertiseArea
            },
            companyCriteria: {
              ...prevSettings.companyCriteria,
              ...userSettings.companyCriteria,
              // Map flat properties if they exist
              companySizeMin: userSettings.companySizeMin || userSettings.companyCriteria?.companySizeMin || prevSettings.companyCriteria.companySizeMin,
              companySizeMax: userSettings.companySizeMax || userSettings.companyCriteria?.companySizeMax || prevSettings.companyCriteria.companySizeMax,
              companyIndustries: userSettings.companyIndustries || userSettings.companyCriteria?.companyIndustries || prevSettings.companyCriteria.companyIndustries,
              companyKeywords: userSettings.companyKeywords || userSettings.companyCriteria?.companyKeywords || prevSettings.companyCriteria.companyKeywords
            },
            contactCriteria: {
              ...prevSettings.contactCriteria,
              ...userSettings.contactCriteria,
              // Map flat properties if they exist
              targetPositions: userSettings.targetPositions || userSettings.contactCriteria?.targetPositions || prevSettings.contactCriteria.targetPositions,
              seniorityLevel: userSettings.seniorityLevel || userSettings.contactCriteria?.seniorityLevel || prevSettings.contactCriteria.seniorityLevel
            },
            geographicSettings: {
              ...prevSettings.geographicSettings,
              ...userSettings.geographicSettings,
              // Map flat properties if they exist
              targetLocations: userSettings.targetLocations || userSettings.geographicSettings?.targetLocations || prevSettings.geographicSettings.targetLocations,
              leadLimit: userSettings.leadLimit || userSettings.geographicSettings?.leadLimit || prevSettings.geographicSettings.leadLimit
            },
            advancedCriteria: {
              ...prevSettings.advancedCriteria,
              ...userSettings.advancedCriteria
            },
            researchFocus: {
              ...prevSettings.researchFocus,
              ...userSettings.researchFocus,
              // Map flat properties if they exist
              focusAreas: userSettings.focusAreas || userSettings.researchFocus?.focusAreas || prevSettings.researchFocus.focusAreas,
              researchDepth: userSettings.researchDepth || userSettings.researchFocus?.researchDepth || prevSettings.researchFocus.researchDepth
            },
            emailBuilder: {
              ...prevSettings.emailBuilder,
              ...emailSettings,
              ...emailSettings.emailBuilder,
              // If there's a personality emailPrompt and no customPrompt yet, use the personality's prompt
              customPrompt: emailSettings.customPrompt || 
                            emailSettings.emailBuilder?.customPrompt || 
                            apiSettings.personality?.emailPrompt || 
                            prevSettings.emailBuilder.customPrompt
            }
          };
        });
      }
    } catch (error) {
      console.error('Failed to fetch agent settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      setSaveStatus('idle');
      
      await api.post('/api/lead-agent/settings', {
        ...settings,
        agentId: agentId
      });
      
      setSaveStatus('success');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Failed to save agent settings:', error);
      setSaveStatus('error');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const addToArray = (section: keyof ZillizAgentSettings, field: string, value: string) => {
    if (!value.trim()) return;
    
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: [...(prev[section] as any)[field], value.trim()]
      }
    }));
  };

  const removeFromArray = (section: keyof ZillizAgentSettings, field: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: (prev[section] as any)[field].filter((item: string) => item !== value)
      }
    }));
  };

  const updateField = (section: keyof ZillizAgentSettings, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`bg-white rounded-xl shadow-xl w-full overflow-hidden flex flex-col ${
            compact ? 'max-w-7xl max-h-[75vh]' : 'max-w-7xl max-h-[98vh]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Lead Agent Settings</h3>
              <p className="text-sm text-gray-500 mt-1">Configure your AI reasoning lead generation agent</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Advanced Mode Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Simple</span>
                <button
                  onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isAdvancedMode ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isAdvancedMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-gray-900">Advanced</span>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Mode Explanation Banner */}
          {!isAdvancedMode && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900">Simple Mode</h4>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Using recommended settings based on your company profile. Switch to Advanced mode for full customization.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : !settings || !settings.companyBranding ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">Loading settings...</div>
              </div>
            ) : (
              <div className="space-y-8">
                
                {/* Company Branding */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Company Branding</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Agent Name</label>
                      <input
                        type="text"
                        value={settings.companyBranding?.agentName || ''}
                        onChange={(e) => updateField('companyBranding', 'agentName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., ActionBot"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                      <input
                        type="text"
                        value={settings.companyBranding?.companyName || ''}
                        onChange={(e) => updateField('companyBranding', 'companyName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., ActionTrac"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Agent Title</label>
                      <input
                        type="text"
                        value={settings.companyBranding?.agentTitle || ''}
                        onChange={(e) => updateField('companyBranding', 'agentTitle', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., AI Assistant"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company Website</label>
                      <input
                        type="url"
                        value={settings.companyBranding?.companyWebsite || ''}
                        onChange={(e) => updateField('companyBranding', 'companyWebsite', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://yourcompany.com"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Primary Service</label>
                      <textarea
                        value={settings.companyBranding?.primaryService || ''}
                        onChange={(e) => updateField('companyBranding', 'primaryService', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Describe your primary service offering..."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Core Offering</label>
                      <textarea
                        value={settings.companyBranding?.coreOffering || ''}
                        onChange={(e) => updateField('companyBranding', 'coreOffering', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Detailed description of your core offering..."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Key Advantages</label>
                      <textarea
                        value={settings.companyBranding?.keyAdvantages || ''}
                        onChange={(e) => updateField('companyBranding', 'keyAdvantages', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Your competitive advantages..."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Expertise Area</label>
                      <textarea
                        value={settings.companyBranding?.expertiseArea || ''}
                        onChange={(e) => updateField('companyBranding', 'expertiseArea', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Your areas of expertise..."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company Description</label>
                      <textarea
                        value={settings.companyBranding?.companyDescription || ''}
                        onChange={(e) => updateField('companyBranding', 'companyDescription', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Overall company description..."
                      />
                    </div>
                  </div>
                </div>

                {/* Company Criteria */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Company Targeting</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Company Size Range
                        {!isAdvancedMode && <span className="ml-2 text-xs text-blue-600">(From company profile)</span>}
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          value={settings.companyCriteria?.companySizeMin ?? 50}
                          onChange={(e) => updateField('companyCriteria', 'companySizeMin', e.target.value === '' ? '' : parseInt(e.target.value))}
                          disabled={!isAdvancedMode}
                          className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!isAdvancedMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                          placeholder="Min"
                        />
                        <span className="text-gray-500">to</span>
                        <input
                          type="number"
                          value={settings.companyCriteria?.companySizeMax ?? 500}
                          onChange={(e) => updateField('companyCriteria', 'companySizeMax', e.target.value === '' ? '' : parseInt(e.target.value))}
                          disabled={!isAdvancedMode}
                          className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!isAdvancedMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                          placeholder="Max"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lead Limit
                        {!isAdvancedMode && <span className="ml-2 text-xs text-blue-600">(From company profile)</span>}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settings.geographicSettings?.leadLimit ?? 50}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            updateField('geographicSettings', 'leadLimit', '');
                          } else {
                            const numValue = parseInt(value);
                            if (!isNaN(numValue) && numValue >= 0) {
                              updateField('geographicSettings', 'leadLimit', numValue);
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          // Prevent minus key and mouse wheel scrolling
                          if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                            e.preventDefault();
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()} // Blur to prevent scroll changing value
                        disabled={!isAdvancedMode}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!isAdvancedMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                        placeholder="e.g., 50"
                      />
                    </div>
                  </div>

                  {/* Industries with Search */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Industries
                      {!isAdvancedMode && <span className="ml-2 text-xs text-blue-600">(From company profile)</span>}
                    </label>
                    <div className="relative">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="relative flex-1">
                          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            value={industrySearch}
                            onChange={(e) => setIndustrySearch(e.target.value)}
                            onFocus={() => setShowIndustryDropdown(true)}
                            disabled={!isAdvancedMode}
                            className={`w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!isAdvancedMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                            placeholder="Search industries... (e.g., Healthcare, Technology, Finance)"
                          />
                        </div>
                      </div>

                      {/* Industry Dropdown */}
                      {showIndustryDropdown && isAdvancedMode && (
                        <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredIndustries.map((industry, index) => (
                            <button
                              key={`${industry}-${index}`}
                              onClick={() => {
                                if (!settings.companyCriteria?.companyIndustries?.includes(industry)) {
                                  addToArray('companyCriteria', 'companyIndustries', industry);
                                }
                                setIndustrySearch('');
                                setShowIndustryDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between"
                            >
                              <span>{industry}</span>
                              {!settings.companyCriteria?.companyIndustries?.includes(industry) && (
                                <PlusIcon className="h-4 w-4 text-blue-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Selected Industries */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {settings.companyCriteria?.companyIndustries?.map((industry) => (
                          <span
                            key={industry}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                          >
                            {industry}
                            {isAdvancedMode && (
                              <button
                                onClick={() => removeFromArray('companyCriteria', 'companyIndustries', industry)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <XCircleIcon className="h-4 w-4" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Criteria */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Contact Targeting</h4>
                  
                  {/* Job Titles with Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Job Titles
                      {!isAdvancedMode && <span className="ml-2 text-xs text-blue-600">(From company profile)</span>}
                    </label>
                    <div className="relative">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="relative flex-1">
                          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            value={jobTitleSearch}
                            onChange={(e) => setJobTitleSearch(e.target.value)}
                            onFocus={() => setShowJobTitleDropdown(true)}
                            disabled={!isAdvancedMode}
                            className={`w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!isAdvancedMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                            placeholder="Search job titles... (e.g., CEO, CTO, Marketing Director)"
                          />
                        </div>
                      </div>

                      {/* Job Title Dropdown */}
                      {showJobTitleDropdown && isAdvancedMode && (
                        <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredJobTitles.map((title, index) => (
                            <button
                              key={`${title}-${index}`}
                              onClick={() => {
                                if (!settings.contactCriteria?.targetPositions?.includes(title)) {
                                  addToArray('contactCriteria', 'targetPositions', title);
                                }
                                setJobTitleSearch('');
                                setShowJobTitleDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between"
                            >
                              <span>{title}</span>
                              {!settings.contactCriteria?.targetPositions?.includes(title) && (
                                <PlusIcon className="h-4 w-4 text-blue-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Selected Job Titles */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {settings.contactCriteria?.targetPositions?.map((title) => (
                          <span
                            key={title}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
                          >
                            {title}
                            {isAdvancedMode && (
                              <button
                                onClick={() => removeFromArray('contactCriteria', 'targetPositions', title)}
                                className="text-green-600 hover:text-green-800"
                              >
                                <XCircleIcon className="h-4 w-4" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email Builder */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Email Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Template</label>
                      <select
                        value={settings.emailBuilder?.emailTemplate || 'professional'}
                        onChange={(e) => updateField('emailBuilder', 'emailTemplate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="professional">Professional</option>
                        <option value="casual">Casual</option>
                        <option value="direct">Direct</option>
                        <option value="consultative">Consultative</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                      <select
                        value={settings.emailBuilder?.tone || 'professional'}
                        onChange={(e) => updateField('emailBuilder', 'tone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="authoritative">Authoritative</option>
                        <option value="conversational">Conversational</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Advanced Criteria */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Advanced Criteria</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Funding Stage</label>
                      <select
                        value={settings.advancedCriteria?.fundingStage || 'any'}
                        onChange={(e) => updateField('advancedCriteria', 'fundingStage', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="any">Any Stage</option>
                        <option value="pre-seed">Pre-Seed</option>
                        <option value="seed">Seed</option>
                        <option value="series-a">Series A</option>
                        <option value="series-b">Series B</option>
                        <option value="series-c">Series C+</option>
                        <option value="established">Established</option>
                        <option value="ipo">Public (IPO)</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Growth Stage</label>
                      <select
                        value={settings.advancedCriteria?.growthStage || 'any'}
                        onChange={(e) => updateField('advancedCriteria', 'growthStage', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="any">Any Stage</option>
                        <option value="startup">Startup</option>
                        <option value="scale-up">Scale-up</option>
                        <option value="enterprise">Enterprise</option>
                        <option value="fortune-500">Fortune 500</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Recent News Filter</label>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.advancedCriteria?.recentNews || false}
                          onChange={(e) => updateField('advancedCriteria', 'recentNews', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Only target companies with recent news/activity</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Geographic Settings */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Geographic Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                      <select
                        value={settings.geographicSettings?.timezone || 'UTC'}
                        onChange={(e) => updateField('geographicSettings', 'timezone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Research Focus */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Research Focus</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Focus Areas</label>
                      <textarea
                        value={settings.researchFocus?.focusAreas?.join('\n') || ''}
                        onChange={(e) => updateField('researchFocus', 'focusAreas', e.target.value.split('\n').filter(line => line.trim()))}
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter focus areas, one per line...&#10;- Employee communication challenges&#10;- HR technology adoption&#10;- ADP integration opportunities"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Research Depth</label>
                        <select
                          value={settings.researchFocus?.researchDepth || 'standard'}
                          onChange={(e) => updateField('researchFocus', 'researchDepth', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="basic">Basic</option>
                          <option value="standard">Standard</option>
                          <option value="deep">Deep</option>
                        </select>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.researchFocus?.includeCompanyNews || false}
                            onChange={(e) => updateField('researchFocus', 'includeCompanyNews', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">Include Company News</span>
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.researchFocus?.includePersonalInfo || false}
                            onChange={(e) => updateField('researchFocus', 'includePersonalInfo', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">Include Personal Info</span>
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.researchFocus?.includeSocialMedia || false}
                            onChange={(e) => updateField('researchFocus', 'includeSocialMedia', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">Include Social Media</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Email Builder */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Enhanced Email Builder</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Custom Email Prompt</label>
                      <textarea
                        value={settings.emailBuilder?.customPrompt || ''}
                        onChange={(e) => updateField('emailBuilder', 'customPrompt', e.target.value)}
                        rows={12}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        placeholder="Enter custom email generation prompt..."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Used for generating initial outbound emails
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Response Prompt</label>
                      <textarea
                        value={settings.emailBuilder?.emailResponsePrompt || ''}
                        onChange={(e) => updateField('emailBuilder', 'emailResponsePrompt', e.target.value)}
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        placeholder="Enter prompt for how the AI should respond to incoming email replies..."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Guides how this agent responds to incoming email replies - specific to this agent's personality
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Length</label>
                        <select
                          value={settings.emailBuilder?.length || 'medium'}
                          onChange={(e) => updateField('emailBuilder', 'length', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="short">Short</option>
                          <option value="medium">Medium</option>
                          <option value="long">Long</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Call to Action</label>
                        <select
                          value={settings.emailBuilder?.callToAction || 'meeting'}
                          onChange={(e) => updateField('emailBuilder', 'callToAction', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="meeting">Schedule Meeting</option>
                          <option value="call">Phone Call</option>
                          <option value="demo">Request Demo</option>
                          <option value="info">More Information</option>
                          <option value="trial">Free Trial</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Personalization Level</label>
                        <select
                          value={settings.emailBuilder?.personalization || 'high'}
                          onChange={(e) => updateField('emailBuilder', 'personalization', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>

                    {/* New Fields: CC, BCC, Auto-Response, Rebump */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          CC Email Addresses
                        </label>
                        <input
                          type="text"
                          value={settings.emailBuilder?.ccEmails || ''}
                          onChange={(e) => updateField('emailBuilder', 'ccEmails', e.target.value)}
                          placeholder="email1@example.com, email2@example.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Comma-separated email addresses to CC on all emails</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          BCC Email Addresses
                        </label>
                        <input
                          type="text"
                          value={settings.emailBuilder?.bccEmails || ''}
                          onChange={(e) => updateField('emailBuilder', 'bccEmails', e.target.value)}
                          placeholder="email1@example.com, email2@example.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Comma-separated email addresses to BCC on all emails (hidden from recipients)</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Follow-up Interval (Days)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={settings.emailBuilder?.rebumpIntervalDays || 3}
                          onChange={(e) => updateField('emailBuilder', 'rebumpIntervalDays', parseInt(e.target.value) || 3)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Days to wait before sending follow-up email</p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.emailBuilder?.enableAutoResponse !== false}
                          onChange={(e) => updateField('emailBuilder', 'enableAutoResponse', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Enable AI Auto-Response to Emails
                        </span>
                      </label>
                      <p className="text-xs text-gray-500 ml-6 mt-1">
                        When enabled, AI will automatically respond to incoming emails from leads
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              {saveStatus === 'success' && (
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircleIcon className="h-5 w-5" />
                  <span className="text-sm">Settings saved successfully!</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center space-x-2 text-red-600">
                  <ExclamationTriangleIcon className="h-5 w-5" />
                  <span className="text-sm">Failed to save settings</span>
                </div>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-6 py-3 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors font-semibold border-2 border-gray-300"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={saveSettings}
                disabled={isSaving}
                className="px-6 py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg"
                style={{
                  background: '#3b82f6 !important',
                  color: '#ffffff !important',
                  fontWeight: '600 !important',
                  border: '2px solid #3b82f6 !important'
                }}
              >
                Save Settings
              </motion.button>
            </div>
          </div>

          {/* Click outside to close dropdowns */}
          {(showIndustryDropdown || showJobTitleDropdown) && (
            <div
              className="fixed inset-0 z-5"
              onClick={() => {
                setShowIndustryDropdown(false);
                setShowJobTitleDropdown(false);
              }}
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}