'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon,
  SparklesIcon,
  UserPlusIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  GlobeAmericasIcon
} from '@heroicons/react/24/outline';
import CustomAgentBuilder from './CustomAgentBuilder';

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
  onSelectPersonality: (personality: PersonalityType, customName: string) => void;
}

const PERSONALITY_TYPES: PersonalityType[] = [
  {
    id: 'hunter',
    name: 'The Hunter',
    description: 'Aggressive prospector focused on high-volume outreach and quick conversions',
    avatar: '/avatars/Hunter.png',
    traits: ['High-energy', 'Results-driven', 'Persistent', 'Direct communication'],
    emailStyle: 'Bold, action-oriented, creates urgency',
    prompt: 'You are a high-energy sales hunter. Write direct, compelling emails that create urgency and drive immediate action. Use confident language, clear value propositions, and strong calls-to-action. Keep it brief but impactful.',
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
    prompt: 'You are a relationship-focused sales professional. Write warm, personalized emails that build trust and rapport. Use empathetic language, ask thoughtful questions, and focus on understanding their challenges before proposing solutions.',
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
    prompt: 'You are a data-driven sales analyst. Write emails that showcase deep research, industry insights, and evidence-based value propositions. Include relevant statistics, market trends, and specific company insights to demonstrate expertise.',
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
    prompt: 'You are a strategic sales consultant. Write emails that position you as an identity advisor, focusing on strategic solutions and business outcomes. Use professional language that demonstrates deep industry knowledge and strategic thinking.',
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
    prompt: 'You are a social sales networker. Write emails that leverage connections, mutual contacts, and community relationships. Use friendly, social language and reference shared connections, industry events, or common interests to build rapport.',
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

  const handlePersonalitySelect = (personality: PersonalityType) => {
    setSelectedPersonality(personality);
    setCustomName('');
  };

  const handleConfirmSelection = () => {
    if (selectedPersonality) {
      const finalName = customName.trim() || selectedPersonality.name;
      onSelectPersonality(selectedPersonality, finalName);
      onClose();
      setSelectedPersonality(null);
      setCustomName('');
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
            ) : (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedPersonality(null)}
                  className="px-6 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
                  style={{ color: 'black' }}
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmSelection}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  style={{ color: '#ffffff', backgroundColor: '#2563eb', border: 'none' }}
                >
                  Create Agent
                </button>
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