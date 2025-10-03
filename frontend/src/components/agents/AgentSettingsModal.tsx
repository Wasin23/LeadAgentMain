'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface AgentSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
}

interface AgentSettings {
  interval: number;
  maxEmailsPerCycle: number;
  targetIndustries: string[];
  excludeCompanies: string[];
  emailTemplate: string;
  useAI: boolean;
  leadSources: {
    linkedin: boolean;
    apollo: boolean;
    hunter: boolean;
  };
  filters: {
    minCompanySize: number;
    maxCompanySize: number;
    jobTitles: string[];
    locations: string[];
  };
}

export default function AgentSettingsModal({ isOpen, onClose, agentId }: AgentSettingsProps) {
  const [settings, setSettings] = useState<AgentSettings>({
    interval: 720, // 12 hours in minutes
    maxEmailsPerCycle: 50,
    targetIndustries: ['Technology', 'Software', 'SaaS'],
    excludeCompanies: [],
    emailTemplate: '',
    useAI: true,
    leadSources: {
      linkedin: true,
      apollo: false,
      hunter: false
    },
    filters: {
      minCompanySize: 10,
      maxCompanySize: 1000,
      jobTitles: ['CEO', 'CTO', 'Founder', 'VP Engineering'],
      locations: ['United States', 'Canada']
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);

  // Industry options for the multi-select
  const industryOptions = [
    'Technology', 'Software', 'SaaS', 'E-commerce', 'Healthcare', 
    'Finance', 'Marketing', 'Education', 'Manufacturing', 'Retail',
    'Real Estate', 'Consulting', 'Media', 'Non-profit', 'Government'
  ];

  const jobTitleOptions = [
    'CEO', 'CTO', 'CIO', 'Founder', 'Co-Founder', 'VP Engineering',
    'VP Technology', 'Director of Engineering', 'Head of Engineering',
    'Technical Lead', 'Engineering Manager', 'Software Architect',
    'DevOps Manager', 'IT Director', 'Chief Architect'
  ];

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen, agentId]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/lead-agent/settings');
      if (response.data) {
        setSettings(prev => ({ ...prev, ...response.data }));
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
      
      await api.post('/api/lead-agent/settings', settings);
      
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

  const handleArrayAdd = (field: keyof AgentSettings, value: string) => {
    const currentArray = settings[field] as string[];
    if (!currentArray.includes(value) && value.trim()) {
      setSettings(prev => ({
        ...prev,
        [field]: [...currentArray, value.trim()]
      }));
    }
  };

  const handleArrayRemove = (field: keyof AgentSettings, value: string) => {
    const currentArray = settings[field] as string[];
    setSettings(prev => ({
      ...prev,
      [field]: currentArray.filter(item => item !== value)
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
          className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Agent Settings</h3>
              <p className="text-sm text-gray-500 mt-1">Configure your lead generation agent parameters</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[calc(90vh-140px)] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Basic Settings */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Basic Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cycle Interval (minutes)
                      </label>
                      <input
                        type="number"
                        value={settings.interval}
                        onChange={(e) => setSettings(prev => ({ ...prev, interval: parseInt(e.target.value) || 720 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="60"
                        max="10080"
                      />
                      <p className="text-xs text-gray-500 mt-1">Time between agent cycles (60-10080 minutes)</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Emails per Cycle
                      </label>
                      <input
                        type="number"
                        value={settings.maxEmailsPerCycle}
                        onChange={(e) => setSettings(prev => ({ ...prev, maxEmailsPerCycle: parseInt(e.target.value) || 50 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                        max="1000"
                      />
                      <p className="text-xs text-gray-500 mt-1">Maximum emails to send per cycle</p>
                    </div>
                  </div>
                </div>

                {/* Target Industries */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Target Industries</h4>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {settings.targetIndustries.map((industry) => (
                        <span
                          key={industry}
                          className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                        >
                          {industry}
                          <button
                            onClick={() => handleArrayRemove('targetIndustries', industry)}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleArrayAdd('targetIndustries', e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Add an industry...</option>
                      {industryOptions.filter(option => !settings.targetIndustries.includes(option)).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Job Title Filters */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Target Job Titles</h4>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {settings.filters.jobTitles.map((title) => (
                        <span
                          key={title}
                          className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
                        >
                          {title}
                          <button
                            onClick={() => {
                              setSettings(prev => ({
                                ...prev,
                                filters: {
                                  ...prev.filters,
                                  jobTitles: prev.filters.jobTitles.filter(t => t !== title)
                                }
                              }));
                            }}
                            className="ml-2 text-green-600 hover:text-green-800"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <select
                      onChange={(e) => {
                        if (e.target.value && !settings.filters.jobTitles.includes(e.target.value)) {
                          setSettings(prev => ({
                            ...prev,
                            filters: {
                              ...prev.filters,
                              jobTitles: [...prev.filters.jobTitles, e.target.value]
                            }
                          }));
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Add a job title...</option>
                      {jobTitleOptions.filter(option => !settings.filters.jobTitles.includes(option)).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Company Size Filters */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Company Size Filter</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Company Size
                      </label>
                      <input
                        type="number"
                        value={settings.filters.minCompanySize}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          filters: { ...prev.filters, minCompanySize: parseInt(e.target.value) || 1 }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Company Size
                      </label>
                      <input
                        type="number"
                        value={settings.filters.maxCompanySize}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          filters: { ...prev.filters, maxCompanySize: parseInt(e.target.value) || 10000 }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                  </div>
                </div>

                {/* Lead Sources */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Lead Sources</h4>
                  <div className="space-y-3">
                    {Object.entries(settings.leadSources).map(([source, enabled]) => (
                      <label key={source} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            leadSources: { ...prev.leadSources, [source]: e.target.checked }
                          }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-3 text-sm font-medium text-gray-700 capitalize">
                          {source}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* AI Settings */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">AI Configuration</h4>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.useAI}
                      onChange={(e) => setSettings(prev => ({ ...prev, useAI: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      Enable AI-powered personalization
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">Use AI to personalize email content based on prospect data</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center">
              {saveStatus === 'success' && (
                <div className="flex items-center text-green-600">
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  <span className="text-sm">Settings saved successfully</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center text-red-600">
                  <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                  <span className="text-sm">Failed to save settings</span>
                </div>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={saveSettings}
                disabled={isSaving}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                    Save to Zilliz
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};