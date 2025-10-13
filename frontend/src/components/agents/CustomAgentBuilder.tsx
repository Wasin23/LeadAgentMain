'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon,
  HeartIcon,
  AcademicCapIcon,
  GlobeAmericasIcon,
  UserIcon,
  PaintBrushIcon,
  DocumentTextIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface CustomAgentBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAgent: (personality: any, customName: string) => void;
}

const AVATAR_OPTIONS = [
  '🎯', '🤝', '📊', '💼', '🌐', '⚡', '🔥', '💎', '🚀', '🎨', 
  '🧠', '💡', '🎪', '🎭', '🎨', '🔮', '🌟', '⭐', '✨', '💫'
];

const COLOR_OPTIONS = [
  { name: 'Red', value: 'red', class: 'bg-red-500' },
  { name: 'Blue', value: 'blue', class: 'bg-blue-500' },
  { name: 'Purple', value: 'purple', class: 'bg-purple-500' },
  { name: 'Green', value: 'green', class: 'bg-green-500' },
  { name: 'Indigo', value: 'indigo', class: 'bg-indigo-500' },
  { name: 'Pink', value: 'pink', class: 'bg-pink-500' },
  { name: 'Orange', value: 'orange', class: 'bg-orange-500' },
  { name: 'Teal', value: 'teal', class: 'bg-teal-500' }
];

const TRAIT_SUGGESTIONS = [
  'High-energy', 'Empathetic', 'Analytical', 'Creative', 'Strategic',
  'Persistent', 'Patient', 'Detail-oriented', 'Innovative', 'Collaborative',
  'Results-driven', 'Consultative', 'Data-driven', 'Social', 'Advisory',
  'Direct', 'Warm', 'Professional', 'Friendly', 'Confident'
];

const EMAIL_STYLE_TEMPLATES = [
  { name: 'Professional & Direct', description: 'Clear, business-focused, gets to the point quickly' },
  { name: 'Warm & Personal', description: 'Friendly tone, builds relationships, conversational' },
  { name: 'Data-Driven & Analytical', description: 'Fact-based, includes statistics and insights' },
  { name: 'Creative & Engaging', description: 'Unique approach, storytelling, memorable' },
  { name: 'Consultative & Advisory', description: 'Expert positioning, solution-focused, strategic' }
];

export default function CustomAgentBuilder({ 
  isOpen, 
  onClose, 
  onCreateAgent 
}: CustomAgentBuilderProps) {
  const [step, setStep] = useState(1);
  const [agentData, setAgentData] = useState({
    name: '',
    personalityName: '',
    description: '',
    avatar: '🎯',
    color: 'blue',
    traits: [] as string[],
    emailStyle: '',
    customEmailStyle: '',
    emailPrompt: '',
    communicationApproach: '',
    industryFocus: '',
    targetAudience: ''
  });

  const handleNext = () => {
    if (step < 6) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleTraitToggle = (trait: string) => {
    setAgentData(prev => ({
      ...prev,
      traits: prev.traits.includes(trait) 
        ? prev.traits.filter(t => t !== trait)
        : [...prev.traits, trait].slice(0, 4) // Max 4 traits
    }));
  };

  const generateEmailPrompt = () => {
    const approach = agentData.communicationApproach || 'professional';
    const style = agentData.emailStyle || agentData.customEmailStyle || 'direct';
    const traits = agentData.traits.join(', ');
    const focus = agentData.industryFocus || 'various industries';
    
    return `You are a ${approach} sales professional with a ${style} communication style. Your personality traits include: ${traits}. 
    
You specialize in working with ${focus} and excel at ${agentData.targetAudience || 'building relationships with prospects'}. 

When writing emails:
- Use a ${style} tone that reflects your ${approach} approach
- Incorporate your key traits: ${traits}
- Focus on ${agentData.industryFocus ? `${agentData.industryFocus} industry insights` : 'relevant business insights'}
- Tailor your message to ${agentData.targetAudience || 'the prospect\'s specific needs'}

${agentData.description ? `Remember: ${agentData.description}` : ''}`;
  };

  const handleComplete = () => {
    const customPersonality = {
      id: `custom-${Date.now()}`,
      name: agentData.personalityName || 'Custom Agent',
      description: agentData.description,
      avatar: agentData.avatar,
      traits: agentData.traits,
      emailStyle: agentData.emailStyle || agentData.customEmailStyle,
      prompt: agentData.emailPrompt || generateEmailPrompt(),
      color: agentData.color,
      icon: UserIcon,
      custom: true
    };
    
    onCreateAgent(customPersonality, agentData.name);
    onClose();
    setStep(1);
    setAgentData({
      name: '',
      personalityName: '',
      description: '',
      avatar: '🎯',
      color: 'blue',
      traits: [],
      emailStyle: '',
      customEmailStyle: '',
      emailPrompt: '',
      communicationApproach: '',
      industryFocus: '',
      targetAudience: ''
    });
  };

  const isStepValid = () => {
    switch (step) {
      case 1: return agentData.name.trim() && agentData.personalityName.trim();
      case 2: return agentData.description.trim();
      case 3: return agentData.avatar && agentData.color;
      case 4: return agentData.traits.length > 0;
      case 5: return agentData.emailStyle || agentData.customEmailStyle.trim();
      case 6: return true;
      default: return false;
    }
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
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900">Create Custom Agent</h2>
                <p className="text-neutral-600 mt-1">Step {step} of 6: Design your unique sales personality</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-neutral-500" />
              </button>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4 w-full bg-neutral-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(step / 6) * 100}%` }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            <AnimatePresence mode="wait">
              {/* Step 1: Basic Info */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <UserIcon className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-neutral-900 mb-2">Let's Start With The Basics</h3>
                    <p className="text-neutral-600">Give your agent a name and personality type</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Agent Name
                      </label>
                      <input
                        type="text"
                        value={agentData.name}
                        onChange={(e) => setAgentData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Sarah, Mike, Alexandra..."
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Personality Type Name
                      </label>
                      <input
                        type="text"
                        value={agentData.personalityName}
                        onChange={(e) => setAgentData(prev => ({ ...prev, personalityName: e.target.value }))}
                        placeholder="e.g., The Innovator, The Strategist, The Closer..."
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Description */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <DocumentTextIcon className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-neutral-900 mb-2">Describe Your Agent</h3>
                    <p className="text-neutral-600">What makes this agent unique? What's their approach?</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Personality Description
                    </label>
                    <textarea
                      value={agentData.description}
                      onChange={(e) => setAgentData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe their sales approach, methodology, and what makes them effective..."
                      rows={6}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 3: Visual Identity */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <PaintBrushIcon className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-neutral-900 mb-2">Choose Visual Identity</h3>
                    <p className="text-neutral-600">Pick an avatar and color theme for your agent</p>
                  </div>
                  
                  <div className="space-y-6">
                    {/* Avatar Selection */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-3">Avatar</label>
                      <div className="grid grid-cols-8 gap-2">
                        {AVATAR_OPTIONS.map((avatar) => (
                          <button
                            key={avatar}
                            onClick={() => setAgentData(prev => ({ ...prev, avatar }))}
                            className={`p-3 text-2xl rounded-lg border-2 transition-colors ${
                              agentData.avatar === avatar 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-neutral-200 hover:border-neutral-300'
                            }`}
                          >
                            {avatar}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Color Selection */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-3">Color Theme</label>
                      <div className="grid grid-cols-4 gap-3">
                        {COLOR_OPTIONS.map((color) => (
                          <button
                            key={color.value}
                            onClick={() => setAgentData(prev => ({ ...prev, color: color.value }))}
                            className={`p-3 rounded-lg border-2 transition-colors flex items-center gap-2 ${
                              agentData.color === color.value 
                                ? 'border-neutral-400 bg-neutral-50' 
                                : 'border-neutral-200 hover:border-neutral-300'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full ${color.class}`} />
                            <span className="text-sm font-medium">{color.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Personality Traits */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <SparklesIcon className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-neutral-900 mb-2">Select Personality Traits</h3>
                    <p className="text-neutral-600">Choose up to 4 traits that define your agent (selected: {agentData.traits.length}/4)</p>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {TRAIT_SUGGESTIONS.map((trait) => (
                      <button
                        key={trait}
                        onClick={() => handleTraitToggle(trait)}
                        disabled={!agentData.traits.includes(trait) && agentData.traits.length >= 4}
                        className={`p-3 text-sm rounded-lg border-2 transition-colors text-left ${
                          agentData.traits.includes(trait)
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : agentData.traits.length >= 4
                            ? 'border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        {trait}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 5: Communication Style */}
              {step === 5 && (
                <motion.div
                  key="step5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <ChatBubbleLeftRightIcon className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-neutral-900 mb-2">Email Communication Style</h3>
                    <p className="text-neutral-600">How should your agent write emails?</p>
                  </div>
                  
                  <div className="space-y-4">
                    {EMAIL_STYLE_TEMPLATES.map((style) => (
                      <button
                        key={style.name}
                        onClick={() => setAgentData(prev => ({ ...prev, emailStyle: style.name, customEmailStyle: '' }))}
                        className={`w-full p-4 text-left rounded-lg border-2 transition-colors ${
                          agentData.emailStyle === style.name
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className="font-medium text-neutral-900">{style.name}</div>
                        <div className="text-sm text-neutral-600 mt-1">{style.description}</div>
                      </button>
                    ))}
                    
                    {/* Custom Style Option */}
                    <div className="border-t border-neutral-200 pt-4">
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Or describe your own style:
                      </label>
                      <input
                        type="text"
                        value={agentData.customEmailStyle}
                        onChange={(e) => setAgentData(prev => ({ ...prev, customEmailStyle: e.target.value, emailStyle: '' }))}
                        placeholder="e.g., Humorous and engaging, Technical but accessible..."
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 6: Review */}
              {step === 6 && (
                <motion.div
                  key="step6"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-neutral-900 mb-2">Review Your Agent</h3>
                    <p className="text-neutral-600">Everything looks good? Let's create your agent!</p>
                  </div>
                  
                  {/* Agent Preview */}
                  <div className={`p-6 rounded-xl border-2 ${
                    agentData.color === 'red' ? 'border-red-200 bg-red-50' :
                    agentData.color === 'blue' ? 'border-blue-200 bg-blue-50' :
                    agentData.color === 'purple' ? 'border-purple-200 bg-purple-50' :
                    agentData.color === 'green' ? 'border-green-200 bg-green-50' :
                    agentData.color === 'indigo' ? 'border-indigo-200 bg-indigo-50' :
                    agentData.color === 'pink' ? 'border-pink-200 bg-pink-50' :
                    agentData.color === 'orange' ? 'border-orange-200 bg-orange-50' :
                    'border-teal-200 bg-teal-50'
                  }`}>
                    <div className="text-center mb-4">
                      <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl mb-2 ${
                        agentData.color === 'red' ? 'bg-red-100' :
                        agentData.color === 'blue' ? 'bg-blue-100' :
                        agentData.color === 'purple' ? 'bg-purple-100' :
                        agentData.color === 'green' ? 'bg-green-100' :
                        agentData.color === 'indigo' ? 'bg-indigo-100' :
                        agentData.color === 'pink' ? 'bg-pink-100' :
                        agentData.color === 'orange' ? 'bg-orange-100' :
                        'bg-teal-100'
                      }`}>
                        {agentData.avatar}
                      </div>
                      <h4 className="font-semibold text-neutral-900">{agentData.name}</h4>
                      <p className="text-sm text-neutral-600">{agentData.personalityName}</p>
                    </div>
                    
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium">Description:</span>
                        <p className="text-neutral-600 mt-1">{agentData.description}</p>
                      </div>
                      <div>
                        <span className="font-medium">Traits:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {agentData.traits.map((trait, index) => (
                            <span key={index} className={`px-2 py-1 rounded text-xs ${
                              agentData.color === 'red' ? 'bg-red-100 text-red-700' :
                              agentData.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                              agentData.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                              agentData.color === 'green' ? 'bg-green-100 text-green-700' :
                              agentData.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                              agentData.color === 'pink' ? 'bg-pink-100 text-pink-700' :
                              agentData.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                              'bg-teal-100 text-teal-700'
                            }`}>
                              {trait}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Email Style:</span>
                        <p className="text-neutral-600 mt-1">{agentData.emailStyle || agentData.customEmailStyle}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-neutral-200 bg-neutral-50">
            <div className="flex items-center justify-between">
              <button
                onClick={step === 1 ? onClose : handleBack}
                className="flex items-center gap-2 px-4 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                {step === 1 ? (
                  <>
                    <XMarkIcon className="h-4 w-4" />
                    Cancel
                  </>
                ) : (
                  <>
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back
                  </>
                )}
              </button>
              
              <button
                onClick={step === 6 ? handleComplete : handleNext}
                disabled={!isStepValid()}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {step === 6 ? 'Create Agent' : 'Next'}
                {step < 6 && <ArrowRightIcon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
