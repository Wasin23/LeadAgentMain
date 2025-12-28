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
    useCustomSignature?: boolean; // Toggle for custom signature vs AI signature
    signatureName?: string; // Name to use in signature
    signatureTitle?: string; // Title to use in signature
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
  hospitality: [
    'Hotels & Resorts', 'Restaurants & Food Service', 'Travel & Tourism', 'Event Venues',
    'Casino & Gaming', 'Cruise Lines', 'Airlines', 'Vacation Rentals', 'Catering',
    'Property Management Companies', 'Third-Party Hotel Management', 'Independent Hotels',
    'Hotel Chains', 'Boutique Hotels', 'Bed & Breakfast', 'Hostels', 'Timeshares',
    'Conference Centers', 'Spa & Wellness Resorts', 'Golf Resorts', 'Theme Parks'
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
      personalization: 'high',
      useGmail: false
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  
  // Presets state
  const [presets, setPresets] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [loadingPresets, setLoadingPresets] = useState(false);
  
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
      const loadData = async () => {
        await fetchCompanyProfile(); // Load company profile first
        await fetchSettings(); // Then load settings (which can now use company profile data)
        await fetchPresets(); // Load settings presets
      };
      loadData();
    }
  }, [isOpen, agentId]);

  // Detect matching preset after settings and presets are loaded
  useEffect(() => {
    if (settings && presets.length > 0 && !selectedPreset && !loadingPresets && !isLoading) {
      detectMatchingPreset();
    }
  }, [settings, presets, loadingPresets, isLoading]);

  const detectMatchingPreset = () => {
    // Find a preset that matches the current settings
    const matchingPreset = presets.find(preset => {
      const industriesMatch = JSON.stringify(preset.targetIndustries?.sort()) === 
                              JSON.stringify(settings.companyCriteria?.companyIndustries?.sort());
      const positionsMatch = JSON.stringify(preset.targetPositions?.sort()) === 
                            JSON.stringify(settings.contactCriteria?.targetPositions?.sort());
      const leadLimitMatch = preset.leadLimit === settings.geographicSettings?.leadLimit;
      
      return industriesMatch && positionsMatch && leadLimitMatch;
    });

    if (matchingPreset) {
      console.log('🎯 [SETTINGS] Detected matching preset:', matchingPreset.name);
      setSelectedPreset(matchingPreset.id || matchingPreset._id);
    }
  };

  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [recommendedPreset, setRecommendedPreset] = useState<any>(null);

  const fetchPresets = async () => {
    try {
      setLoadingPresets(true);
      const response = await api.get('/api/settings/presets');
      setPresets(response.data.presets || []);
      console.log('📋 [SETTINGS] Loaded presets:', response.data.presets);
    } catch (error) {
      console.error('Error loading presets:', error);
    } finally {
      setLoadingPresets(false);
    }
  };

  const applyPreset = async (preset: any) => {
    console.log('🎯 [SETTINGS] Applying preset:', preset.name);
    setSelectedPreset(preset.id || preset._id);
    
    // Update settings state
    const updatedSettings = {
      ...settings,
      specialInstructions: preset.specialInstructions || '',
      companyCriteria: {
        ...settings.companyCriteria,
        companySizeMin: preset.companySizeMin,
        companySizeMax: preset.companySizeMax,
        companyIndustries: preset.targetIndustries || []
      },
      contactCriteria: {
        ...settings.contactCriteria,
        targetPositions: preset.targetPositions || []
      },
      geographicSettings: {
        ...settings.geographicSettings,
        leadLimit: preset.leadLimit || 50
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
    
    // Auto-save the settings
    try {
      setSaveStatus('idle');
      await api.post('/api/lead-agent/settings', {
        ...updatedSettings,
        agentId: agentId
      });
      setSaveStatus('success');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Failed to save preset settings:', error);
      setSaveStatus('error');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
  };

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
        // Check if a preset was applied to this agent
        const appliedPresetId = response.data.settings.appliedPresetId || response.data.settings.userSettings?.appliedPresetId;
        if (appliedPresetId) {
          console.log('🎯 [SETTINGS] Detected applied preset ID:', appliedPresetId);
          setSelectedPreset(appliedPresetId);
        }
        
        // Merge API data with default structure to prevent undefined errors
        setSettings(prevSettings => {
          const apiSettings = response.data.settings;
          console.log('🔍 [FRONTEND] Raw API settings:', JSON.stringify(apiSettings, null, 2));
          
          // The API might return userSettings/emailSettings nested, or directly at root
          const userSettings = apiSettings.userSettings || apiSettings.leadGeneration || apiSettings;
          const emailSettings = apiSettings.emailSettings || apiSettings.emailBuilder || apiSettings;
          
          console.log('🔍 [FRONTEND] Extracted userSettings:', JSON.stringify(userSettings, null, 2));
          console.log('🔍 [FRONTEND] Extracted emailSettings:', JSON.stringify(emailSettings, null, 2));
          
          // Check if company branding is empty or default, if so populate from company profile
          const hasDefaultBranding = !userSettings.companyBranding?.companyName || 
                                      userSettings.companyBranding?.companyName === 'Your Company' ||
                                      userSettings.companyBranding?.companyName === '' ||
                                      !userSettings.companyBranding?.primaryService ||
                                      userSettings.companyBranding?.primaryService === '' ||
                                      !userSettings.companyBranding?.coreOffering ||
                                      userSettings.companyBranding?.coreOffering === '';
          
          let companyBrandingData = {};
          if (hasDefaultBranding && companyProfile) {
            console.log('🎨 [SETTINGS] Populating from company profile:', companyProfile);
            companyBrandingData = {
              agentName: companyProfile.companyName ? `${companyProfile.companyName} Bot` : prevSettings.companyBranding.agentName,
              companyName: companyProfile.companyName || prevSettings.companyBranding.companyName,
              agentTitle: 'AI Sales Agent',
              primaryService: companyProfile.services || prevSettings.companyBranding.primaryService,
              coreOffering: companyProfile.coreOffering || companyProfile.description || prevSettings.companyBranding.coreOffering,
              keyAdvantages: companyProfile.keyAdvantages || 'Automated, personalized, scalable',
              expertiseArea: companyProfile.industry || prevSettings.companyBranding.expertiseArea,
              companyWebsite: companyProfile.website || prevSettings.companyBranding.companyWebsite,
              companyDescription: companyProfile.description || prevSettings.companyBranding.companyDescription
            };
          } else {
            companyBrandingData = {
              agentName: userSettings.agentName || userSettings.companyBranding?.agentName || prevSettings.companyBranding.agentName,
              companyName: userSettings.companyName || userSettings.companyBranding?.companyName || prevSettings.companyBranding.companyName,
              agentTitle: userSettings.agentTitle || userSettings.companyBranding?.agentTitle || prevSettings.companyBranding.agentTitle,
              primaryService: userSettings.primaryService || userSettings.companyBranding?.primaryService || prevSettings.companyBranding.primaryService,
              coreOffering: userSettings.coreOffering || userSettings.companyBranding?.coreOffering || prevSettings.companyBranding.coreOffering,
              keyAdvantages: userSettings.keyAdvantages || userSettings.companyBranding?.keyAdvantages || prevSettings.companyBranding.keyAdvantages,
              expertiseArea: userSettings.expertiseArea || userSettings.companyBranding?.expertiseArea || prevSettings.companyBranding.expertiseArea,
              companyWebsite: userSettings.companyWebsite || userSettings.companyBranding?.companyWebsite || prevSettings.companyBranding.companyWebsite,
              companyDescription: userSettings.companyDescription || userSettings.companyBranding?.companyDescription || prevSettings.companyBranding.companyDescription
            };
          }
          
          return {
            specialInstructions: apiSettings.specialInstructions || userSettings.specialInstructions || '',
            companyBranding: {
              ...prevSettings.companyBranding,
              ...companyBrandingData
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
            compact ? 'max-w-[95vw] max-h-[75vh]' : 'max-w-[95vw] max-h-[98vh]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Lead Agent Settings</h3>
              <p className="text-sm text-gray-500 mt-1">Configure your AI reasoning lead generation agent</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Advanced Mode Toggle - Only show when not in simple mode or show as button */}
              {!isAdvancedMode ? (
                <button
                  onClick={() => setIsAdvancedMode(true)}
                  className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                >
                  Advanced Options →
                </button>
              ) : (
                <button
                  onClick={() => setIsAdvancedMode(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                >
                  ← Back to Presets
                </button>
              )}
              
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>

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
            ) : !isAdvancedMode ? (
              /* Simple Mode - Show Presets */
              <div className="max-w-full mx-auto px-4">
                <div className="mb-8">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Choose a Settings Preset</h4>
                  <p className="text-sm text-gray-600">
                    Select a preset configuration to quickly set up your agent's targeting criteria
                  </p>
                </div>

                {loadingPresets ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                  </div>
                ) : presets.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Presets Yet</h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Create presets in the Agent Director to quickly configure agents
                    </p>
                    <button
                      onClick={() => setIsAdvancedMode(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Use Advanced Settings
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {presets.map((preset) => (
                      <button
                        key={preset.id || preset._id}
                        onClick={() => applyPreset(preset)}
                        className={`text-left p-6 rounded-xl border-2 transition-all ${
                          selectedPreset === (preset.id || preset._id)
                            ? 'border-green-500 bg-green-50 shadow-lg ring-2 ring-green-200'
                            : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">{preset.name}</h3>
                          {selectedPreset === (preset.id || preset._id) && (
                            <CheckCircleIcon className="w-6 h-6 text-green-600 flex-shrink-0" />
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Industries ({preset.targetIndustries?.length || 0})</p>
                            <div className="flex flex-wrap gap-1">
                              {(preset.targetIndustries || []).slice(0, 3).map((industry: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                  {industry}
                                </span>
                              ))}
                              {(preset.targetIndustries?.length || 0) > 3 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                                  +{preset.targetIndustries.length - 3}
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Positions ({preset.targetPositions?.length || 0})</p>
                            <div className="flex flex-wrap gap-1">
                              {(preset.targetPositions || []).slice(0, 3).map((position: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                  {position}
                                </span>
                              ))}
                              {(preset.targetPositions?.length || 0) > 3 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                                  +{preset.targetPositions.length - 3}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                            <div>
                              <p className="text-xs text-gray-500">Company Size</p>
                              <p className="text-sm font-semibold text-gray-900">{preset.companySizeMin}-{preset.companySizeMax}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Lead Limit</p>
                              <p className="text-sm font-semibold text-gray-900">{preset.leadLimit}</p>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Advanced Mode - Show All Settings */
              <div className="space-y-8">
                
                {/* Special Instructions - Top Priority */}
                <div className="rounded-lg p-6" style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.2)', borderWidth: '2px' }}>
                  <div className="flex items-start gap-3 mb-3">
                    <svg className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: 'rgb(37, 99, 235)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold mb-1" style={{ color: 'rgb(30, 64, 175)' }}>
                        General Instructions
                      </h4>
                      <p className="text-sm mb-3" style={{ color: 'rgb(29, 78, 216)' }}>
                        Write concise instructions on who to target and in what industry. Be specific about pain points and desired outcomes.
                      </p>
                    </div>
                  </div>
                  <textarea
                    value={(settings as any).specialInstructions || ''}
                    onChange={(e) => setSettings({ ...settings, specialInstructions: e.target.value } as any)}
                    placeholder="Example: Target CTOs at Series A startups in healthcare tech. Focus on pain points around scaling engineering teams and infrastructure costs. Keep tone professional but friendly."
                    className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[120px]"
                    maxLength={1000}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs" style={{ color: 'rgb(29, 78, 216)' }}>
                      💡 These instructions guide the entire campaign behavior
                    </span>
                    <span className="text-xs text-gray-500">
                      {((settings as any).specialInstructions || '').length}/1000
                    </span>
                  </div>
                </div>
                
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
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700">
                            Enable AI Auto-Response to Emails
                          </label>
                          <p className="text-xs text-gray-500 mt-1">
                            When enabled, AI will automatically respond to incoming emails from leads
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateField('emailBuilder', 'enableAutoResponse', !(settings.emailBuilder?.enableAutoResponse !== false))}
                          className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200`}
                          style={{
                            backgroundColor: (settings.emailBuilder?.enableAutoResponse !== false) ? '#4ade80' : '#52525b'
                          }}
                        >
                          <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                              (settings.emailBuilder?.enableAutoResponse !== false) ? 'translate-x-7' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Gmail Sending Toggle */}
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700">
                            Send Emails via Gmail
                          </label>
                          <p className="text-xs text-gray-500 mt-1">
                            {settings.emailBuilder?.useGmail 
                              ? '✓ Sending from your Gmail account (better deliverability, Primary inbox)' 
                              : 'Sending via Mailgun (replies@mg.meridianagent.xyz)'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateField('emailBuilder', 'useGmail', !settings.emailBuilder?.useGmail)}
                          className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200`}
                          style={{
                            backgroundColor: settings.emailBuilder?.useGmail ? '#4ade80' : '#52525b'
                          }}
                        >
                          <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                              settings.emailBuilder?.useGmail ? 'translate-x-7' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Email Signature Customization */}
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">
                            Use Custom Email Signature
                          </label>
                          <p className="text-xs text-gray-500 mt-1">
                            {settings.emailBuilder?.useCustomSignature 
                              ? 'Emails will be signed with your custom name and title' 
                              : `Emails will be signed as "${settings.companyBranding?.agentName || 'AI Assistant'}" from "${settings.companyBranding?.companyName || 'Company'}"`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateField('emailBuilder', 'useCustomSignature', !settings.emailBuilder?.useCustomSignature)}
                          className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200`}
                          style={{
                            backgroundColor: settings.emailBuilder?.useCustomSignature ? '#4ade80' : '#52525b'
                          }}
                        >
                          <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                              settings.emailBuilder?.useCustomSignature ? 'translate-x-7' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {settings.emailBuilder?.useCustomSignature && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Your Name
                            </label>
                            <input
                              type="text"
                              value={settings.emailBuilder?.signatureName || ''}
                              onChange={(e) => updateField('emailBuilder', 'signatureName', e.target.value)}
                              placeholder="e.g., John Smith"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">The name that will appear in email signatures</p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Your Title
                            </label>
                            <input
                              type="text"
                              value={settings.emailBuilder?.signatureTitle || ''}
                              onChange={(e) => updateField('emailBuilder', 'signatureTitle', e.target.value)}
                              placeholder="e.g., CEO, Sales Director"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">Your title or role in the company</p>
                          </div>
                        </div>
                      )}
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