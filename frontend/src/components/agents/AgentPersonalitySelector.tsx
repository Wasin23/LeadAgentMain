'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon,
  SparklesIcon,
  UserPlusIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  GlobeAmericasIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import CustomAgentBuilder from './CustomAgentBuilder';
import api from '@/lib/api';

interface PersonalityType {
  id: string;
  name: string;
  description: string;
  avatar: string;
  traits: string[];
  emailStyle: string;
  prompt: string;
  color: string;
  icon: React.ComponentType<any>;
}

interface AgentPersonalitySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPersonality: (personality: PersonalityType, customName: string, preset?: any) => void;
}

const PERSONALITY_TYPES: PersonalityType[] = [
  {
    id: 'hunter',
    name: 'The Hunter',
    description: 'Aggressive prospector focused on high-volume outreach and quick conversions',
    avatar: '/avatars/Hunter.png',
    traits: ['High-energy', 'Results-driven', 'Persistent', 'Direct communication'],
    emailStyle: 'Bold, action-oriented, creates urgency',
    prompt: `You are The Hunter - a high-energy, results-driven AI sales agent. Your approach is direct, persistent, and focused on quick conversions.

Writing Style:
- Keep emails concise and action-oriented
- Use strong, confident language
- Create urgency without being pushy
- Focus on results and ROI
- Get to the point quickly

Email Structure:
1. Strong, attention-grabbing opening
2. Quick value proposition (1-2 sentences)
3. Clear, specific call-to-action
4. Brief closing with urgency

Tone: Professional but assertive, confident, results-focused`,
    color: 'red',
    icon: SparklesIcon
  },
  {
    id: 'relationship-builder',
    name: 'The Relationship Builder',
    description: 'Warm, consultative approach focused on building long-term partnerships',
    avatar: '/avatars/Relationship-Builder.png',
    traits: ['Empathetic', 'Patient', 'Consultative', 'Trust-focused'],
    emailStyle: 'Warm, personal, relationship-focused',
    prompt: `You are The Relationship Builder - a warm, empathetic AI sales agent focused on building genuine, long-term partnerships.

Writing Style:
- Use warm, friendly language
- Show genuine interest in their business
- Ask thoughtful questions
- Take time to build rapport
- Focus on mutual benefit

Email Structure:
1. Personalized, friendly greeting
2. Show you've researched their business
3. Ask about their challenges/goals
4. Suggest a conversation (not a hard sell)
5. Warm, patient closing

Tone: Friendly, consultative, empathetic, relationship-focused`,
    color: 'blue',
    icon: ChatBubbleLeftRightIcon
  },
  {
    id: 'analyst',
    name: 'The Analyst',
    description: 'Data-driven methodology with deep research and industry insights',
    avatar: '/avatars/Analyst.png',
    traits: ['Analytical', 'Research-heavy', 'Detail-oriented', 'Evidence-based'],
    emailStyle: 'Data-rich, insightful, credential-heavy',
    prompt: `You are The Analyst - a data-driven, research-focused AI sales agent who leads with insights and evidence.

Writing Style:
- Lead with data and research
- Reference specific industry trends
- Use facts and figures
- Demonstrate deep understanding
- Provide analytical insights

Email Structure:
1. Open with a relevant industry insight or data point
2. Connect research to their specific situation
3. Provide evidence-based recommendations
4. Suggest a strategic discussion
5. Professional, thoughtful closing

Tone: Professional, analytical, insightful, evidence-based`,
    color: 'purple',
    icon: ChartBarIcon
  },
  {
    id: 'consultant',
    name: 'The Consultant',
    description: 'Solution-focused industry expert who positions as a strategic advisor',
    avatar: '/avatars/consultant.png',
    traits: ['Advisory', 'Solution-focused', 'Industry expert', 'Strategic'],
    emailStyle: 'Advisory, strategic, solution-oriented',
    prompt: `You are The Consultant - a strategic advisor and industry expert who positions yourself as a trusted consultant.

Writing Style:
- Position as a strategic partner
- Focus on solutions and strategy
- Demonstrate industry expertise
- Use advisory language
- Think long-term value

Email Structure:
1. Open with a strategic observation
2. Frame challenges from their perspective
3. Position your solution as strategic guidance
4. Suggest a consultation or advisory session
5. Professional, expert closing

Tone: Advisory, strategic, expert, solution-focused`,
    color: 'green',
    icon: BuildingOfficeIcon
  },
  {
    id: 'networker',
    name: 'The Networker',
    description: 'LinkedIn-heavy, connection-based approach leveraging mutual contacts',
    avatar: '/avatars/Networker.png',
    traits: ['Social', 'Connection-focused', 'Community-driven', 'Referral-based'],
    emailStyle: 'Social, community-focused, leverages connections',
    prompt: `You are The Networker - a socially-savvy AI sales agent who leverages connections, community, and referrals.

Writing Style:
- Reference mutual connections when possible
- Use social proof and community
- Be conversational and approachable
- Leverage LinkedIn and networks
- Focus on connections and introductions

Email Structure:
1. Open with a connection point (mutual contact, group, etc.)
2. Mention social proof or community relevance
3. Keep it conversational and light
4. Suggest connecting or being introduced
5. Friendly, social closing

Tone: Conversational, social, approachable, connection-focused`,
    color: 'indigo',
    icon: GlobeAmericasIcon
  }
];

export default function AgentPersonalitySelector({ 
  isOpen, 
  onClose, 
  onSelectPersonality 
}: AgentPersonalitySelectorProps) {
  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityType | null>(null);
  const [customName, setCustomName] = useState('');
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [showPresetSelection, setShowPresetSelection] = useState(false);
  const [presets, setPresets] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<any>(null);
  const [loadingPresets, setLoadingPresets] = useState(false);

  useEffect(() => {
    if (isOpen && showPresetSelection) {
      fetchPresets();
    }
  }, [isOpen, showPresetSelection]);

  // Clear selected preset when preset selection view is shown
  useEffect(() => {
    if (showPresetSelection) {
      setSelectedPreset(null);
    }
  }, [showPresetSelection]);

  const fetchPresets = async () => {
    setLoadingPresets(true);
    try {
      const response = await api.get('/api/settings/presets');
      // Handle different response formats
      const presetsData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.presets || response.data?.data || []);
      setPresets(presetsData);
    } catch (error) {
      console.error('Error fetching presets:', error);
      setPresets([]); // Set empty array on error
    } finally {
      setLoadingPresets(false);
    }
  };

  const handlePersonalitySelect = (personality: PersonalityType) => {
    setSelectedPersonality(personality);
    setCustomName('');
  };

  const handleContinueToPresets = () => {
    setSelectedPreset(null); // Clear any previously selected preset
    setShowPresetSelection(true);
  };

  const handleSkipPresets = () => {
    if (selectedPersonality) {
      const finalName = customName.trim() || selectedPersonality.name;
      onSelectPersonality(selectedPersonality, finalName, null);
      onClose();
      setSelectedPersonality(null);
      setCustomName('');
      setShowPresetSelection(false);
      setSelectedPreset(null);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedPersonality) {
      const finalName = customName.trim() || selectedPersonality.name;
      console.log('[AgentPersonalitySelector] Confirming selection with FULL preset:', selectedPreset);
      onSelectPersonality(selectedPersonality, finalName, selectedPreset);
      onClose();
      setSelectedPersonality(null);
      setCustomName('');
      setShowPresetSelection(false);
      setSelectedPreset(null);
    }
  };

  const handleCustomBuilder = () => {
    setShowCustomBuilder(true);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="personality-selector-modal"
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
          className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900">Choose Your Sales Agent</h2>
                <p className="text-neutral-600 mt-1">Select a personality type that matches your sales approach</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-neutral-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 overflow-y-auto max-h-[calc(95vh-200px)]">
            {!selectedPersonality ? (
              <>
                {/* Personality Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8" style={{ gridAutoRows: '1fr' }}>
                  {PERSONALITY_TYPES.map((personality) => {
                    const IconComponent = personality.icon;
                    return (
                      <motion.div
                        key={personality.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handlePersonalitySelect(personality)}
                        className={`p-6 border rounded-xl cursor-pointer transition-all hover:shadow-lg min-h-[240px] flex
                          ${personality.color === 'red' ? 'border-red-300 hover:border-red-400 hover:bg-red-50' :
                            personality.color === 'blue' ? 'border-blue-300 hover:border-blue-400 hover:bg-blue-50' :
                            personality.color === 'purple' ? 'border-purple-300 hover:border-purple-400 hover:bg-purple-50' :
                            personality.color === 'green' ? 'border-green-300 hover:border-green-400 hover:bg-green-50' :
                            'border-indigo-300 hover:border-indigo-400 hover:bg-indigo-50'
                          }`}
                      >
                        {/* Avatar */}
                        <div className="flex-shrink-0 mr-4">
                          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold relative
                            ${personality.color === 'red' ? 'bg-red-100' :
                              personality.color === 'blue' ? 'bg-blue-100' :
                              personality.color === 'purple' ? 'bg-purple-100' :
                              personality.color === 'green' ? 'bg-green-100' :
                              'bg-indigo-100'
                            }`}
                          >
                            {(personality.id === 'analyst' || personality.id === 'networker') && (
                              <div className="w-19 h-19 rounded-full bg-white absolute z-0"></div>
                            )}
                            {(personality.avatar.startsWith('http') || personality.avatar.startsWith('/avatars/')) ? (
                              <img 
                                src={personality.avatar} 
                                alt={personality.name}
                                className={`rounded-full relative z-10 ${
                                  personality.id === 'networker'
                                    ? 'w-19 h-19 object-contain'
                                    : 'w-19 h-19 object-cover'
                                }`}
                                style={personality.id === 'analyst' ? { objectPosition: '50% 40%' } : undefined}
                              />
                            ) : (
                              <span style={{ fontSize: '36px', lineHeight: '1' }}>{personality.avatar}</span>
                            )}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex flex-col">
                          <h3 className="font-semibold text-neutral-900 mb-2">{personality.name}</h3>
                          
                          {/* Description */}
                          <p className="text-sm text-neutral-600 mb-3 flex-grow line-clamp-3">
                            {personality.description}
                          </p>

                          {/* Traits */}
                          <div className="space-y-1">
                            {personality.traits.slice(0, 2).map((trait, index) => (
                              <div key={`${personality.id}-trait-${index}`} className={`text-xs px-2 py-1 rounded-full inline-block mr-1
                                ${personality.color === 'red' ? 'bg-red-100 text-red-700' :
                                  personality.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                                  personality.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                                  personality.color === 'green' ? 'bg-green-100 text-green-700' :
                                  'bg-indigo-100 text-indigo-700'
                                }`}
                              >
                                {trait}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Icon */}
                        <div className="mt-3 flex justify-center">
                          <IconComponent className={`h-5 w-5
                            ${personality.color === 'red' ? 'text-red-500' :
                              personality.color === 'blue' ? 'text-blue-500' :
                              personality.color === 'purple' ? 'text-purple-500' :
                              personality.color === 'green' ? 'text-green-500' :
                              'text-indigo-500'
                            }`} 
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                  
                  {/* Create Your Own Card */}
                  <motion.div
                    key="create-your-own"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCustomBuilder}
                    className="p-6 border border-dashed border-neutral-300 rounded-xl cursor-pointer transition-all hover:shadow-lg min-h-[280px] flex flex-col hover:border-neutral-400 hover:bg-neutral-50"
                  >
                    <div className="text-center flex-grow flex flex-col justify-center">
                      <div className="w-16 h-16 mx-auto rounded-full bg-neutral-100 flex items-center justify-center mb-3">
                        <UserPlusIcon className="h-8 w-8 text-neutral-600" />
                      </div>
                      <h3 className="font-semibold text-neutral-900 mb-2">Create Your Own</h3>
                      <p className="text-sm text-neutral-600">Build a custom personality with guided prompts and unique traits</p>
                    </div>
                  </motion.div>
                </div>
              </>
            ) : (
              /* Selected Personality Details */
              <div className="space-y-6">
                {/* Selected Personality Info */}
                <div className="text-center p-6 bg-neutral-50 rounded-xl">
                  <div className={`w-17 h-17 mx-auto rounded-full flex items-center justify-center text-4xl mb-3 font-bold
                    ${selectedPersonality.color === 'red' ? 'bg-red-100' :
                      selectedPersonality.color === 'blue' ? 'bg-blue-100' :
                      selectedPersonality.color === 'purple' ? 'bg-purple-100' :
                      selectedPersonality.color === 'green' ? 'bg-green-100' :
                      'bg-indigo-100'
                    }`}
                  >
                    {(selectedPersonality.avatar.startsWith('http') || selectedPersonality.avatar.startsWith('/avatars/')) ? (
                      <img 
                        src={selectedPersonality.avatar} 
                        alt={selectedPersonality.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <span style={{ fontSize: '32px', lineHeight: '1' }}>{selectedPersonality.avatar}</span>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    {selectedPersonality.name}
                  </h3>
                  <p className="text-neutral-600">{selectedPersonality.description}</p>
                </div>

                {/* Traits & Style */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-neutral-900 mb-3">Personality Traits</h4>
                    <div className="space-y-2">
                      {selectedPersonality.traits.map((trait, index) => (
                        <div key={`selected-trait-${index}`} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full
                            ${selectedPersonality.color === 'red' ? 'bg-red-500' :
                              selectedPersonality.color === 'blue' ? 'bg-blue-500' :
                              selectedPersonality.color === 'purple' ? 'bg-purple-500' :
                              selectedPersonality.color === 'green' ? 'bg-green-500' :
                              'bg-indigo-500'
                            }`}
                          />
                          <span className="text-sm text-neutral-700">{trait}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-neutral-900 mb-3">Email Style</h4>
                    <p className="text-sm text-neutral-600">{selectedPersonality.emailStyle}</p>
                  </div>
                </div>

                {/* Name Input */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Give your agent a name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={`e.g., Sarah, Mike, Alex...`}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                {/* Preset Selection */}
                {showPresetSelection && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-neutral-900">Choose Targeting Preset (Optional)</h4>
                      <button
                        onClick={() => setShowPresetSelection(false)}
                        className="text-sm text-neutral-500 hover:text-neutral-700"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                    
                    {loadingPresets ? (
                      <div className="text-center py-8">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                        <p className="mt-2 text-sm text-neutral-600">Loading presets...</p>
                      </div>
                    ) : !Array.isArray(presets) || presets.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-neutral-600">No presets available. Create one in Settings Presets.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[450px] overflow-y-auto p-2">
                        {presets.map((preset, index) => (
                          <motion.div
                            key={preset._id || preset.id || `preset-${index}`}
                            whileHover={{ scale: 1.01 }}
                            onClick={() => {
                              console.log('[AgentPersonalitySelector] Preset clicked - FULL OBJECT:', preset);
                              setSelectedPreset(preset);
                              console.log('[AgentPersonalitySelector] selectedPreset updated to:', preset.name);
                            }}
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              selectedPreset && (selectedPreset._id || selectedPreset.id) === (preset._id || preset.id)
                                ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                                : 'border-neutral-300 hover:border-neutral-400 hover:shadow-md'
                            }`}
                          >
                            {selectedPreset && (selectedPreset._id || selectedPreset.id) === (preset._id || preset.id) && (
                              <div className="flex justify-end mb-1">
                                <CheckIcon className="h-4 w-4 text-green-600" />
                              </div>
                            )}
                            <h4 className="font-semibold text-neutral-900 mb-2">{preset.name}</h4>
                            
                            {preset.targetIndustries?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs text-neutral-500 mb-1">Industries:</p>
                                <div className="flex flex-wrap gap-1">
                                  {preset.targetIndustries.slice(0, 3).map((industry: string, idx: number) => (
                                    <span key={idx} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                                      {industry}
                                    </span>
                                  ))}
                                  {preset.targetIndustries.length > 3 && (
                                    <span className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded-full">
                                      +{preset.targetIndustries.length - 3}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {preset.targetPositions?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs text-neutral-500 mb-1">Positions:</p>
                                <div className="flex flex-wrap gap-1">
                                  {preset.targetPositions.slice(0, 3).map((position: string, idx: number) => (
                                    <span key={idx} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                      {position}
                                    </span>
                                  ))}
                                  {preset.targetPositions.length > 3 && (
                                    <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full">
                                      +{preset.targetPositions.length - 3}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-4 text-xs text-neutral-500 mt-2">
                              {preset.companySize && (
                                <span>Size: {preset.companySize}</span>
                              )}
                              {preset.leadLimitPerDay && (
                                <span>Limit: {preset.leadLimitPerDay}/day</span>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-neutral-200 bg-neutral-50">
            {!selectedPersonality ? (
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : !showPresetSelection ? (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setSelectedPersonality(null);
                    setCustomName('');
                  }}
                  className="px-6 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
                  style={{ color: 'black' }}
                >
                  Back
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleSkipPresets}
                    className="px-6 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
                  >
                    Skip Presets
                  </button>
                  <button
                    onClick={handleContinueToPresets}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    style={{ color: '#ffffff', backgroundColor: '#2563eb', border: 'none' }}
                  >
                    Continue to Presets →
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setShowPresetSelection(false);
                    setSelectedPreset(null);
                  }}
                  className="px-6 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
                  style={{ color: 'black' }}
                >
                  ← Back
                </button>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={handleSkipPresets}
                    className="px-6 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
                  >
                    Skip Preset
                  </button>
                  <button
                    onClick={handleConfirmSelection}
                    disabled={!selectedPreset}
                    className={`px-6 py-2 rounded-lg transition-colors ${
                      selectedPreset
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                    }`}
                    style={selectedPreset ? { color: '#ffffff', backgroundColor: '#2563eb', border: 'none' } : {}}
                  >
                    Create Agent {selectedPreset && '✓'}
                  </button>
                  {!selectedPreset && (
                    <span className="text-xs text-neutral-500 ml-2">← Click a preset or skip</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
      
      {/* Custom Agent Builder */}
      <CustomAgentBuilder 
        key="custom-agent-builder"
        isOpen={showCustomBuilder}
        onClose={() => setShowCustomBuilder(false)}
        onCreateAgent={(personality, customName) => {
          onSelectPersonality(personality, customName);
          setShowCustomBuilder(false);
        }}
      />
    </AnimatePresence>
  );
}

export { PERSONALITY_TYPES };
export type { PersonalityType };