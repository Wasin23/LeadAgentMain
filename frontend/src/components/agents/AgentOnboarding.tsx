'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon, 
  ArrowRightIcon, 
  CheckIcon,
  SparklesIcon,
  UserPlusIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import UserMenu from '@/components/UserMenu';

interface AgentOnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

type OnboardingStep = 'intro' | 'select-personality' | 'name-agent' | 'choose-preset' | 'name-preset' | 'review' | 'creating';

const PERSONALITY_TYPES = [
  {
    id: 'hunter',
    name: 'The Hunter',
    description: 'Aggressive prospector focused on high-volume outreach and quick conversions',
    avatar: '/avatars/Hunter.png',
    traits: ['High-energy', 'Results-driven', 'Persistent', 'Direct communication'],
    color: 'red'
  },
  {
    id: 'relationship-builder',
    name: 'The Relationship Builder',
    description: 'Warm, consultative approach focused on building long-term partnerships',
    avatar: '/avatars/Relationship-Builder.png',
    traits: ['Empathetic', 'Patient', 'Consultative', 'Trust-focused'],
    color: 'blue'
  },
  {
    id: 'analyst',
    name: 'The Analyst',
    description: 'Data-driven methodology with deep research and industry insights',
    avatar: '/avatars/Analyst.png',
    traits: ['Analytical', 'Research-heavy', 'Detail-oriented', 'Evidence-based'],
    color: 'purple'
  },
  {
    id: 'consultant',
    name: 'The Consultant',
    description: 'Solution-focused industry expert who positions as a strategic advisor',
    avatar: '/avatars/consultant.png',
    traits: ['Advisory', 'Solution-focused', 'Industry expert', 'Strategic'],
    color: 'green'
  },
  {
    id: 'networker',
    name: 'The Networker',
    description: 'LinkedIn-heavy, connection-based approach leveraging mutual contacts',
    avatar: '/avatars/Networker.png',
    traits: ['Social', 'Connection-focused', 'Community-driven', 'Referral-based'],
    color: 'indigo'
  }
];

export default function AgentOnboarding({ onComplete, onSkip }: AgentOnboardingProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('intro');
  const [selectedPersonality, setSelectedPersonality] = useState<any>(null);
  const [agentName, setAgentName] = useState('');
  const [presetName, setPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps: OnboardingStep[] = ['intro', 'select-personality', 'name-agent', 'choose-preset', 'name-preset', 'review', 'creating'];
  const currentStepIndex = steps.indexOf(currentStep);

  const createAgent = async () => {
    setIsCreating(true);
    setError(null);
    
    try {
      // Parse the preset settings
      const settings = JSON.parse(selectedPreset);
      
      // First, create the preset
      const presetResponse = await api.post('/api/settings/presets', {
        name: presetName,
        targetIndustries: settings.industries || [],
        targetPositions: settings.jobTitles || [],
        companySizeMin: settings.companySizeMin || 50,
        companySizeMax: settings.companySizeMax || 500,
        leadLimit: settings.leadsPerCycle || 10
      });

      if (!presetResponse.data.success) {
        throw new Error('Failed to create preset');
      }

      const createdPreset = presetResponse.data.preset;
      
      // Then create the agent with the preset applied
      const response = await api.post('/api/auth/create-agent', {
        name: agentName,
        type: 'reasoning-lead-agent',
        personality: {
          type: selectedPersonality.id,
          name: selectedPersonality.name,
          description: selectedPersonality.description,
          avatar: selectedPersonality.avatar,
          emailPrompt: selectedPersonality.prompt || '',
          emailStyle: selectedPersonality.emailStyle || '',
          traits: selectedPersonality.traits || [],
          color: selectedPersonality.color
        },
        preset: {
          presetId: createdPreset.id,
          name: createdPreset.name,
          targetIndustries: createdPreset.targetIndustries,
          targetPositions: createdPreset.targetPositions,
          companySizeMin: createdPreset.companySizeMin,
          companySizeMax: createdPreset.companySizeMax,
          leadLimit: createdPreset.leadLimit
        }
      });

      if (response.data.success) {
        // Wait a moment to show success, then redirect to dashboard
        setTimeout(() => {
          router.push('/');
        }, 1500);
      } else {
        setError('Failed to create agent. Please try again.');
        setIsCreating(false);
      }
    } catch (err: any) {
      console.error('Error creating agent:', err);
      setError(err.response?.data?.message || 'Failed to create agent. Please try again.');
      setIsCreating(false);
    }
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
      
      // If moving to creating step, actually create the agent
      if (steps[nextIndex] === 'creating') {
        createAgent();
      }
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
      {/* Header with Logo and Skip */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-6 z-10">
        {/* Meridian Logo + Title */}
        <div className="flex items-center gap-3">
          <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-lg">
            <defs>
              <linearGradient id="globeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: 'rgb(59, 130, 246)', stopOpacity: 1 }} />
                <stop offset="50%" style={{ stopColor: 'rgb(168, 85, 247)', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: 'rgb(236, 72, 153)', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            
            {/* Globe circle */}
            <circle cx="24" cy="24" r="20" fill="white"/>
            
            {/* Vertical meridian lines */}
            <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="url(#globeGradient)" strokeWidth="1"/>
            <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="url(#globeGradient)" strokeWidth="1"/>
            <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="url(#globeGradient)" strokeWidth="1"/>
            
            {/* Horizontal latitude lines */}
            <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="url(#globeGradient)" strokeWidth="1"/>
            <ellipse cx="24" cy="24" rx="20" ry="16" fill="none" stroke="url(#globeGradient)" strokeWidth="1"/>
            <line x1="4" y1="24" x2="44" y2="24" stroke="url(#globeGradient)" strokeWidth="1"/>
          </svg>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">Meridian</h1>
        </div>

        {/* Skip Button and User Menu */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSkip}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold transition-all backdrop-blur-sm"
          >
            Skip Tutorial
          </button>
          <div className="[&_button]:!bg-white/20 [&_button]:hover:!bg-white/30 [&_button]:!text-white [&_button]:backdrop-blur-sm [&_button]:rounded-xl [&_div>div>div:nth-child(2)_button]:!text-neutral-900 [&_div>div>div:nth-child(2)_button]:hover:!bg-neutral-50 [&_div>div>div:nth-child(3)_button]:!text-red-600 [&_div>div>div:nth-child(3)_button]:hover:!bg-red-50">
            <UserMenu />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-8 pt-32 pb-12 flex items-center justify-center min-h-[80vh]">
        <AnimatePresence mode="wait">
          {currentStep === 'intro' && (
            <IntroStep key="intro" onNext={nextStep} />
          )}
          {currentStep === 'select-personality' && (
            <SelectPersonalityStep 
              key="personality" 
              personalities={PERSONALITY_TYPES}
              selected={selectedPersonality}
              onSelect={setSelectedPersonality}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 'name-agent' && (
            <NameAgentStep 
              key="name"
              name={agentName}
              onChange={setAgentName}
              personality={selectedPersonality}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 'choose-preset' && (
            <ChoosePresetStep 
              key="preset"
              selected={selectedPreset}
              onSelect={setSelectedPreset}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 'name-preset' && (
            <NamePresetStep 
              key="name-preset"
              name={presetName}
              onChange={setPresetName}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 'review' && (
            <ReviewStep 
              key="review"
              personality={selectedPersonality}
              name={agentName}
              presetName={presetName}
              preset={selectedPreset}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 'creating' && (
            <CreatingStep 
              key="creating" 
              name={agentName} 
              isCreating={isCreating}
              error={error}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Intro Step
function IntroStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="text-center max-w-2xl"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring" }}
        className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl"
      >
        <UserPlusIcon className="w-16 h-16 text-purple-600" />
      </motion.div>

      <h1 className="text-5xl font-bold text-white mb-4">Create Your First AI Agent</h1>
      <p className="text-xl text-white/90 mb-8">
        Let's build your automated sales assistant together. It only takes a minute!
      </p>

      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8 text-left">
        <h3 className="text-xl font-bold text-white mb-4">Your agent will:</h3>
        <ul className="space-y-3 text-white/90 text-lg">
          <li className="flex items-start gap-3">
            <MagnifyingGlassIcon className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <span>Find qualified leads based on your criteria</span>
          </li>
          <li className="flex items-start gap-3">
            <EnvelopeIcon className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <span>Write personalized emails for each contact</span>
          </li>
          <li className="flex items-start gap-3">
            <PaperAirplaneIcon className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <span>Send outreach automatically 24/7</span>
          </li>
          <li className="flex items-start gap-3">
            <ChartBarIcon className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <span>Track responses and book meetings</span>
          </li>
        </ul>
      </div>

      <button
        onClick={onNext}
        className="px-12 py-5 rounded-2xl font-bold text-xl hover:shadow-2xl hover:scale-105 transition-all inline-flex items-center gap-3"
        style={{
          backgroundColor: 'white',
          color: 'rgb(147, 51, 234)'
        }}
      >
        <SparklesIcon className="w-6 h-6" />
        Let's Create Your Agent
        <ArrowRightIcon className="w-6 h-6" />
      </button>
    </motion.div>
  );
}

// Select Personality Step
function SelectPersonalityStep({ 
  personalities, 
  selected, 
  onSelect, 
  onNext, 
  onBack 
}: { 
  personalities: any[]; 
  selected: any; 
  onSelect: (p: any) => void; 
  onNext: () => void; 
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-6xl"
    >
      <div className="text-center mb-12">
        <h2 className="text-5xl font-bold text-white mb-4">Choose a Personality</h2>
        <p className="text-2xl text-white/90">
          This determines your agent's communication style
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-10">
        {personalities.map((personality) => {
          const isSelected = selected?.id === personality.id;
          const colorClasses = {
            red: 'from-red-500 to-red-600',
            blue: 'from-blue-500 to-blue-600',
            purple: 'from-purple-500 to-purple-600',
            green: 'from-green-500 to-green-600',
            indigo: 'from-indigo-500 to-indigo-600'
          };
          
          return (
            <motion.button
              key={personality.id}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(personality)}
              className={`relative p-6 rounded-2xl text-center transition-all ${
                isSelected
                  ? 'shadow-2xl ring-2 ring-green-500 scale-105'
                  : 'shadow-lg hover:shadow-xl'
              }`}
              style={{
                backgroundColor: 'white'
              }}
            >
              {/* Checkmark Badge - Outside Card */}
              {isSelected && (
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-10">
                  <CheckIcon className="w-5 h-5 text-white font-bold" />
                </div>
              )}

              {/* Avatar */}
              <div className="relative mx-auto mb-4">
                <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${colorClasses[personality.color as keyof typeof colorClasses]} p-1 mx-auto ${
                  isSelected ? 'ring-2 ring-green-500 ring-offset-2' : ''
                }`}>
                  <img 
                    src={personality.avatar}
                    alt={personality.name}
                    className="w-full h-full rounded-full object-cover bg-white"
                  />
                </div>
              </div>

              {/* Name */}
              <h3 className={`text-lg font-bold mb-2 ${
                isSelected ? 'text-purple-600' : 'text-neutral-900'
              }`}>
                {personality.name}
              </h3>

              {/* Description */}
              <p className="text-xs mb-3 leading-relaxed text-neutral-700">
                {personality.description}
              </p>

              {/* Traits */}
              <div className="space-y-1">
                {personality.traits.slice(0, 2).map((trait: string, idx: number) => {
                  const gradients = {
                    red: 'linear-gradient(to right, rgb(239, 68, 68), rgb(220, 38, 38))',
                    blue: 'linear-gradient(to right, rgb(59, 130, 246), rgb(37, 99, 235))',
                    purple: 'linear-gradient(to right, rgb(168, 85, 247), rgb(147, 51, 234))',
                    green: 'linear-gradient(to right, rgb(34, 197, 94), rgb(22, 163, 74))',
                    indigo: 'linear-gradient(to right, rgb(99, 102, 241), rgb(79, 70, 229))'
                  };
                  
                  return (
                    <div 
                      key={idx}
                      className="text-[10px] px-2 py-1 rounded-full font-medium"
                      style={{
                        background: gradients[personality.color as keyof typeof gradients],
                        color: 'white'
                      }}
                    >
                      {trait}
                    </div>
                  );
                })}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 text-white hover:bg-white/10 rounded-xl font-semibold transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!selected}
          className="px-8 py-3 rounded-xl font-semibold transition-all hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          style={{
            backgroundColor: !selected ? 'rgba(255, 255, 255, 0.5)' : 'white',
            color: 'rgb(147, 51, 234)'
          }}
        >
          Continue <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// Name Agent Step  
function NameAgentStep({ 
  name, 
  onChange, 
  personality,
  onNext, 
  onBack 
}: { 
  name: string; 
  onChange: (n: string) => void; 
  personality: any;
  onNext: () => void; 
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-2xl"
    >
      <div className="text-center mb-8">
        <div className="w-32 h-32 mx-auto mb-6 relative">
          <div className={`w-full h-full rounded-full bg-gradient-to-br ${
            personality?.color === 'red' ? 'from-red-500 to-red-600' :
            personality?.color === 'blue' ? 'from-blue-500 to-blue-600' :
            personality?.color === 'purple' ? 'from-purple-500 to-purple-600' :
            personality?.color === 'green' ? 'from-green-500 to-green-600' :
            'from-indigo-500 to-indigo-600'
          } p-1.5 shadow-2xl`}>
            <img 
              src={personality?.avatar}
              alt={personality?.name}
              className="w-full h-full rounded-full object-cover bg-white"
            />
          </div>
        </div>
        <h2 className="text-4xl font-bold text-white mb-3">Name Your Agent</h2>
        <p className="text-xl text-white/90">
          Give it a memorable name to identify this campaign
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
        <label className="block text-white font-semibold mb-3 text-lg">
          Agent Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., Enterprise Outreach Agent"
          className="w-full px-6 py-4 rounded-xl text-lg border-2 border-white/20 focus:border-white focus:ring-4 focus:ring-white/20 bg-white/90 text-neutral-900"
          autoFocus
        />
        <p className="text-white/70 text-sm mt-3">
          💡 Tip: Use descriptive names like "SMB Campaign" or "Series A Startups"
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 text-white hover:bg-white/10 rounded-xl font-semibold transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!name.trim()}
          className="px-8 py-3 rounded-xl font-semibold transition-all hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          style={{
            backgroundColor: !name.trim() ? 'rgba(255, 255, 255, 0.5)' : 'white',
            color: 'rgb(147, 51, 234)'
          }}
        >
          Continue <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// Name Preset Step
function NamePresetStep({ 
  name, 
  onChange, 
  onNext, 
  onBack 
}: { 
  name: string; 
  onChange: (n: string) => void; 
  onNext: () => void; 
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-2xl"
    >
      <div className="text-center mb-8">
        <div className="w-24 h-24 mx-auto mb-6 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center">
          <SparklesIcon className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-4xl font-bold text-white mb-3">Save Your Settings</h2>
        <p className="text-xl text-white/90">
          Name this preset so you can reuse these settings for future agents
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
        <label className="block text-white font-semibold mb-3 text-lg">
          Preset Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., SaaS Executives, Tech Startups, Enterprise Sales"
          className="w-full px-6 py-4 rounded-xl text-lg border-2 border-white/20 focus:border-white focus:ring-4 focus:ring-white/20 bg-white/90 text-neutral-900"
          autoFocus
        />
        <p className="text-white/70 text-sm mt-3">
          💡 Tip: Use descriptive names like "SaaS Executives" or "Healthcare Decision Makers"
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 text-white hover:bg-white/10 rounded-xl font-semibold transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!name.trim()}
          className="px-8 py-3 rounded-xl font-semibold transition-all hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          style={{
            backgroundColor: !name.trim() ? 'rgba(255, 255, 255, 0.5)' : 'white',
            color: 'rgb(147, 51, 234)'
          }}
        >
          Continue <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// Choose Preset Step - Settings Builder
function ChoosePresetStep({ 
  selected, 
  onSelect, 
  onNext, 
  onBack 
}: { 
  selected: string; 
  onSelect: (p: string) => void; 
  onNext: () => void; 
  onBack: () => void;
}) {
  const [settings, setSettings] = useState<{
    companySizeMin: number;
    companySizeMax: number;
    industries: string[];
    jobTitles: string[];
    leadsPerCycle: number | string;
  }>({
    companySizeMin: 50,
    companySizeMax: 500,
    industries: [] as string[],
    jobTitles: [] as string[],
    leadsPerCycle: 10
  });

  const [industrySearch, setIndustrySearch] = useState('');
  const [jobTitleSearch, setJobTitleSearch] = useState('');
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [showJobTitleDropdown, setShowJobTitleDropdown] = useState(false);

  // Complete Apollo Industries Database
  const APOLLO_INDUSTRIES = {
    technology: ['Software Development', 'SaaS', 'Cloud Computing', 'Cybersecurity', 'AI/Machine Learning', 'Data Analytics', 'Mobile Apps', 'Enterprise Software', 'DevOps', 'IoT', 'Blockchain', 'AR/VR', 'Gaming', 'EdTech', 'FinTech', 'HealthTech', 'PropTech', 'MarTech', 'AgTech', 'CleanTech', 'Robotics', 'Semiconductors', 'Hardware', 'Networking', 'Telecommunications'],
    healthcare: ['Hospitals & Health Systems', 'Medical Devices', 'Pharmaceuticals', 'Biotechnology', 'Telemedicine', 'Mental Health', 'Dental Services', 'Veterinary', 'Medical Software', 'Clinical Research', 'Health Insurance', 'Medical Equipment', 'Diagnostics', 'Therapy Services', 'Home Healthcare', 'Senior Care', 'Wellness & Fitness'],
    financialServices: ['Banking', 'Investment Management', 'Insurance', 'FinTech', 'Credit Services', 'Payment Processing', 'Wealth Management', 'Accounting', 'Tax Services', 'Real Estate Finance', 'Mortgage', 'Personal Finance', 'Corporate Finance', 'Risk Management', 'Compliance', 'Trading', 'Cryptocurrency'],
    manufacturing: ['Automotive', 'Aerospace & Defense', 'Electronics Manufacturing', 'Chemicals', 'Food & Beverage', 'Textiles & Apparel', 'Machinery', 'Construction Materials', 'Medical Device Manufacturing', 'Consumer Goods', 'Packaging', 'Metals & Mining', 'Oil & Gas', 'Renewable Energy', 'Industrial Equipment', 'Furniture'],
    retail: ['E-commerce', 'Fashion & Apparel', 'Grocery & Food Retail', 'Electronics Retail', 'Home & Garden', 'Sporting Goods', 'Luxury Goods', 'Automotive Retail', 'Beauty & Cosmetics', 'Jewelry', 'Books & Media', 'Toys & Games', 'Pet Supplies'],
    services: ['Consulting', 'Legal Services', 'Marketing & Advertising', 'Public Relations', 'Architecture', 'Engineering Services', 'Design', 'Event Planning', 'Security Services', 'Cleaning Services', 'Logistics & Supply Chain', 'Transportation', 'Warehousing'],
    realEstate: ['Commercial Real Estate', 'Residential Real Estate', 'Property Management', 'Real Estate Investment', 'Construction', 'Architecture & Planning', 'Interior Design', 'Property Development', 'Facilities Management'],
    education: ['K-12 Education', 'Higher Education', 'Online Learning', 'Corporate Training', 'Educational Technology', 'Tutoring', 'Language Learning', 'Vocational Training', 'Early Childhood Education', 'Special Education', 'Educational Publishing'],
    media: ['Broadcasting', 'Publishing', 'Digital Media', 'Advertising', 'Entertainment', 'Film & Television', 'Music', 'Gaming', 'Social Media', 'Content Creation', 'Journalism', 'Photography', 'Graphic Design', 'Marketing Agencies'],
    nonprofit: ['Charitable Organizations', 'Social Services', 'Environmental', 'Education', 'Healthcare', 'Religious Organizations', 'Arts & Culture', 'Community Development', 'International Aid', 'Research Foundations', 'Advocacy Groups'],
    government: ['Federal Government', 'State Government', 'Local Government', 'Military', 'Public Safety', 'Transportation', 'Environmental Agencies', 'Healthcare', 'Education', 'Social Services', 'Regulatory Bodies']
  };

  const JOB_TITLES = {
    executive: ['CEO', 'COO', 'CFO', 'CTO', 'CMO', 'CHRO', 'President', 'Founder', 'Co-Founder', 'Managing Director'],
    vpLevel: ['VP Sales', 'VP Marketing', 'VP Engineering', 'VP Operations', 'VP Finance', 'VP HR', 'VP Product', 'VP Business Development'],
    director: ['Director of Sales', 'Marketing Director', 'Engineering Director', 'Operations Director', 'IT Director', 'HR Director', 'Finance Director'],
    manager: ['Sales Manager', 'Marketing Manager', 'Engineering Manager', 'Operations Manager', 'IT Manager', 'HR Manager', 'Product Manager', 'Project Manager'],
    specialist: ['Sales Representative', 'Marketing Specialist', 'Software Engineer', 'Data Analyst', 'HR Specialist', 'Account Manager', 'Business Analyst']
  };

  const allIndustries = Array.from(new Set(Object.values(APOLLO_INDUSTRIES).flat()));
  const allJobTitles = Array.from(new Set(Object.values(JOB_TITLES).flat()));

  const commonIndustries = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 'Real Estate', 'Education', 'Consulting', 'SaaS', 'E-commerce'];
  const commonTitles = ['CEO', 'CTO', 'VP of Sales', 'Head of Marketing', 'Director of Operations', 'VP of Engineering', 'Chief Revenue Officer', 'Head of Growth'];

  // Filter industries based on search
  const filteredIndustries = industrySearch
    ? allIndustries.filter(industry =>
        industry.toLowerCase().includes(industrySearch.toLowerCase()) &&
        !settings.industries.includes(industry)
      ).slice(0, 50)
    : [];

  // Filter job titles based on search
  const filteredJobTitles = jobTitleSearch
    ? allJobTitles.filter(title =>
        title.toLowerCase().includes(jobTitleSearch.toLowerCase()) &&
        !settings.jobTitles.includes(title)
      ).slice(0, 50)
    : [];

  const addIndustry = (industry: string) => {
    if (industry && !settings.industries.includes(industry)) {
      setSettings({ ...settings, industries: [...settings.industries, industry] });
      setIndustrySearch('');
      setShowIndustryDropdown(false);
    }
  };

  const addJobTitle = (title: string) => {
    if (title && !settings.jobTitles.includes(title)) {
      setSettings({ ...settings, jobTitles: [...settings.jobTitles, title] });
      setJobTitleSearch('');
      setShowJobTitleDropdown(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-4xl"
    >
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-3">Configure Targeting</h2>
        <p className="text-xl text-white/90">
          Define your ideal customer profile
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8 space-y-6">
        {/* Company Size */}
        <div>
          <label className="block text-white font-semibold mb-3 text-lg">Company Size (Employees)</label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={settings.companySizeMin}
              onChange={(e) => setSettings({ ...settings, companySizeMin: parseInt(e.target.value) || 0 })}
              className="w-32 px-4 py-3 rounded-lg bg-white/90 text-neutral-900 font-medium"
              placeholder="Min"
            />
            <span className="text-white font-semibold">to</span>
            <input
              type="number"
              value={settings.companySizeMax}
              onChange={(e) => setSettings({ ...settings, companySizeMax: parseInt(e.target.value) || 0 })}
              className="w-32 px-4 py-3 rounded-lg bg-white/90 text-neutral-900 font-medium"
              placeholder="Max"
            />
          </div>
        </div>

        {/* Industries */}
        <div>
          <label className="block text-white font-semibold mb-3 text-lg">Target Industries</label>
          <div className="relative">
            <input
              type="text"
              value={industrySearch}
              onChange={(e) => {
                setIndustrySearch(e.target.value);
                setShowIndustryDropdown(true);
              }}
              onFocus={() => setShowIndustryDropdown(true)}
              onBlur={() => setTimeout(() => setShowIndustryDropdown(false), 200)}
              placeholder="Search industries... (e.g., Technology, Healthcare, Finance...)"
              className="w-full px-4 py-3 rounded-lg bg-white/90 text-neutral-900 font-medium placeholder:text-neutral-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && industrySearch.trim()) {
                  e.preventDefault();
                  addIndustry(industrySearch.trim());
                }
              }}
            />
            {/* Dropdown with search results */}
            {showIndustryDropdown && filteredIndustries.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredIndustries.map((industry, idx) => (
                  <button
                    key={idx}
                    onClick={() => addIndustry(industry)}
                    className="w-full text-left px-4 py-2 hover:bg-purple-50 transition-colors text-sm text-neutral-900"
                  >
                    {industry}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3 mb-3">
            {commonIndustries.map(industry => (
              <button
                key={industry}
                onClick={() => addIndustry(industry)}
                disabled={settings.industries.includes(industry)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  settings.industries.includes(industry)
                    ? 'bg-purple-500/50 text-white/50 cursor-default'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              >
                {settings.industries.includes(industry) ? '✓ ' : '+ '}{industry}
              </button>
            ))}
          </div>
          {settings.industries.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 p-3 bg-white/5 rounded-lg">
              {settings.industries.map(industry => (
                <span key={industry} className="px-3 py-1.5 rounded-full bg-purple-500 text-white text-sm font-medium inline-flex items-center gap-2">
                  {industry}
                  <button 
                    onClick={() => setSettings({ ...settings, industries: settings.industries.filter(i => i !== industry) })}
                    className="hover:bg-white/20 rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Job Titles / Positions */}
        <div>
          <label className="block text-white font-semibold mb-3 text-lg">Target Positions</label>
          <div className="relative">
            <input
              type="text"
              value={jobTitleSearch}
              onChange={(e) => {
                setJobTitleSearch(e.target.value);
                setShowJobTitleDropdown(true);
              }}
              onFocus={() => setShowJobTitleDropdown(true)}
              onBlur={() => setTimeout(() => setShowJobTitleDropdown(false), 200)}
              placeholder="Search positions... (e.g., CEO, VP of Sales, Director...)"
              className="w-full px-4 py-3 rounded-lg bg-white/90 text-neutral-900 font-medium placeholder:text-neutral-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && jobTitleSearch.trim()) {
                  e.preventDefault();
                  addJobTitle(jobTitleSearch.trim());
                }
              }}
            />
            {/* Dropdown with search results */}
            {showJobTitleDropdown && filteredJobTitles.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredJobTitles.map((title, idx) => (
                  <button
                    key={idx}
                    onClick={() => addJobTitle(title)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors text-sm text-neutral-900"
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3 mb-3">
            {commonTitles.map(title => (
              <button
                key={title}
                onClick={() => addJobTitle(title)}
                disabled={settings.jobTitles.includes(title)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  settings.jobTitles.includes(title)
                    ? 'bg-blue-500 text-white cursor-default'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              >
                {settings.jobTitles.includes(title) ? '✓ ' : '+ '}{title}
              </button>
            ))}
          </div>
          {settings.jobTitles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 p-3 bg-white/5 rounded-lg">
              {settings.jobTitles.map(title => (
                <span key={title} className="px-3 py-1.5 rounded-full bg-blue-500 text-white text-sm font-medium inline-flex items-center gap-2">
                  {title}
                  <button 
                    onClick={() => setSettings({ ...settings, jobTitles: settings.jobTitles.filter(t => t !== title) })}
                    className="hover:bg-white/20 rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Leads Per Cycle */}
        <div>
          <label className="block text-white font-semibold mb-3 text-lg">Leads Per Cycle</label>
          <p className="text-white/70 text-sm mb-4">
            A cycle runs on your set schedule. Your agent will find and research this many new leads each time.
          </p>
          <div className="flex items-center gap-4 mb-3">
            <input
              type="number"
              min="1"
              max="100"
              value={settings.leadsPerCycle}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setSettings({ ...settings, leadsPerCycle: '' as any });
                } else {
                  const num = parseInt(value);
                  if (!isNaN(num) && num >= 1) {
                    setSettings({ ...settings, leadsPerCycle: num });
                  }
                }
              }}
              onBlur={(e) => {
                // Set to minimum value if empty on blur
                if (e.target.value === '' || parseInt(e.target.value) < 1) {
                  setSettings({ ...settings, leadsPerCycle: 1 });
                }
              }}
              className="w-32 px-4 py-3 rounded-lg bg-white text-neutral-900 font-bold text-lg text-center"
              placeholder="20"
            />
            <span className="text-white text-lg">leads per cycle</span>
          </div>
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">Estimated Cost:</span>
              <span className="text-green-400 font-bold text-xl">
                ${((typeof settings.leadsPerCycle === 'number' ? settings.leadsPerCycle : parseInt(settings.leadsPerCycle) || 0) * 0.07).toFixed(2)} per cycle
              </span>
            </div>
            <p className="text-white/70 text-sm mt-2">
              ~$0.07 per lead • {settings.leadsPerCycle || 0} leads = ${((typeof settings.leadsPerCycle === 'number' ? settings.leadsPerCycle : parseInt(settings.leadsPerCycle) || 0) * 0.07).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 text-white hover:bg-white/10 rounded-xl font-semibold transition-all"
        >
          ← Back
        </button>
        <button
          onClick={() => {
            // Ensure leadsPerCycle is a number before saving
            const settingsToSave = {
              ...settings,
              leadsPerCycle: typeof settings.leadsPerCycle === 'string' ? parseInt(settings.leadsPerCycle) || 1 : settings.leadsPerCycle
            };
            onSelect(JSON.stringify(settingsToSave));
            onNext();
          }}
          className="px-8 py-3 rounded-xl font-semibold transition-all hover:shadow-xl hover:scale-105 inline-flex items-center gap-2"
          style={{
            backgroundColor: 'white',
            color: 'rgb(147, 51, 234)'
          }}
        >
          Continue <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// Review Step
function ReviewStep({ 
  personality, 
  name,
  presetName,
  preset, 
  onNext, 
  onBack 
}: { 
  personality: any; 
  name: string;
  presetName: string;
  preset: string; 
  onNext: () => void; 
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-2xl"
    >
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-3">Review Your Agent</h2>
        <p className="text-xl text-white/90">
          Everything look good?
        </p>
      </div>

      <div className="bg-white rounded-3xl p-8 mb-8 shadow-2xl">
        <div className="space-y-6">
          <div>
            <p className="text-sm text-neutral-500 mb-2">Agent Name</p>
            <p className="text-2xl font-bold text-neutral-900">{name}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-500 mb-2">Personality</p>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${
                personality?.color === 'red' ? 'from-red-500 to-red-600' :
                personality?.color === 'blue' ? 'from-blue-500 to-blue-600' :
                personality?.color === 'purple' ? 'from-purple-500 to-purple-600' :
                personality?.color === 'green' ? 'from-green-500 to-green-600' :
                'from-indigo-500 to-indigo-600'
              } p-1`}>
                <img 
                  src={personality?.avatar}
                  alt={personality?.name}
                  className="w-full h-full rounded-full object-cover bg-white"
                />
              </div>
              <div>
                <p className="font-bold text-neutral-900">{personality?.name}</p>
                <p className="text-sm text-neutral-600">{personality?.description}</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm text-neutral-500 mb-2">Settings Preset</p>
            <p className="text-lg font-bold text-neutral-900 mb-2">{presetName}</p>
            {(() => {
              try {
                const settings = JSON.parse(preset);
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-neutral-600">Company Size:</span>
                      <span className="font-semibold text-neutral-900">
                        {settings.companySizeMin?.toLocaleString()} - {settings.companySizeMax?.toLocaleString()} employees
                      </span>
                    </div>
                    {settings.industries?.length > 0 && (
                      <div>
                        <span className="text-neutral-600 text-sm">Industries:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {settings.industries.map((industry: string, idx: number) => (
                            <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                              {industry}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {settings.jobTitles?.length > 0 && (
                      <div>
                        <span className="text-neutral-600 text-sm">Positions:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {settings.jobTitles.map((title: string, idx: number) => (
                            <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                              {title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-neutral-600">Leads per cycle:</span>
                      <span className="font-semibold text-neutral-900">{settings.leadsPerCycle}</span>
                    </div>
                  </div>
                );
              } catch {
                return <p className="text-neutral-900 font-semibold">{preset}</p>;
              }
            })()}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 text-white hover:bg-white/10 rounded-xl font-semibold transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-10 py-4 rounded-xl font-bold text-lg transition-all hover:shadow-xl hover:scale-105 inline-flex items-center gap-2"
          style={{
            backgroundColor: 'white',
            color: 'rgb(147, 51, 234)'
          }}
        >
          <CheckIcon className="w-6 h-6" />
          Create Agent
        </button>
      </div>
    </motion.div>
  );
}

// Creating Step
function CreatingStep({ name, isCreating, error }: { name: string; isCreating: boolean; error: string | null }) {
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-xl"
      >
        <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-8">
          <XMarkIcon className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-4xl font-bold text-white mb-4">Oops! Something went wrong</h2>
        <p className="text-xl text-white/90 mb-8">
          {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3 rounded-xl font-semibold transition-all hover:shadow-xl hover:scale-105"
          style={{
            backgroundColor: 'white',
            color: 'rgb(147, 51, 234)'
          }}
        >
          Try Again
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center max-w-xl"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-24 h-24 border-8 border-white border-t-transparent rounded-full mx-auto mb-8"
      />
      <h2 className="text-4xl font-bold text-white mb-4">
        {isCreating ? `Creating ${name}...` : `${name} Created! ✓`}
      </h2>
      <p className="text-xl text-white/90">
        {isCreating ? 'Setting up your AI agent. This will only take a moment!' : 'Redirecting to your agent dashboard...'}
      </p>
    </motion.div>
  );
}
