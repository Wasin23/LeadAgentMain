'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon, 
  ArrowRightIcon, 
  CheckIcon,
  CheckCircleIcon,
  SparklesIcon,
  UserPlusIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import UserMenu from '@/components/UserMenu';
import PaymentMethodModal from '@/components/PaymentMethodModal';
import { PERSONALITY_TYPES } from './AgentPersonalitySelector';

interface AgentOnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

type OnboardingStep = 'intro' | 'select-personality' | 'name-agent' | 'choose-preset' | 'name-preset' | 'gmail-setup' | 'crm-setup' | 'plan-selection' | 'payment-setup' | 'review' | 'creating';

export default function AgentOnboarding({ onComplete, onSkip }: AgentOnboardingProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('intro');
  const [selectedPersonality, setSelectedPersonality] = useState<any>(null);
  const [agentName, setAgentName] = useState('');
  const [presetName, setPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [useGmail, setUseGmail] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [crmConnected, setCrmConnected] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('free-trial');
  const [paymentAdded, setPaymentAdded] = useState(false);
  const [planPurchased, setPlanPurchased] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creationSuccess, setCreationSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps: OnboardingStep[] = ['intro', 'select-personality', 'name-agent', 'choose-preset', 'name-preset', 'gmail-setup', 'crm-setup', 'plan-selection', 'payment-setup', 'review', 'creating'];
  const currentStepIndex = steps.indexOf(currentStep);

  // Load user's payment status on mount
  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        const response = await api.get('/api/auth/profile');
        if (response.data?.user?.paymentMethodAdded) {
          setPaymentAdded(true);
          console.log('[ONBOARDING] User already has payment method');
        }
      } catch (error) {
        console.error('[ONBOARDING] Failed to check payment status:', error);
      }
    };
    checkPaymentStatus();
  }, []);

  // Load user's default Gmail preference on mount
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const response = await api.get('/api/auth/settings');
        if (response.data?.preferences?.defaultUseGmail) {
          setUseGmail(true);
          console.log('[ONBOARDING] Loaded default Gmail preference: true');
        }
      } catch (error) {
        console.error('[ONBOARDING] Failed to load user preferences:', error);
      }
    };
    loadUserPreferences();
  }, []);

  // Check Gmail connection status on mount
  useEffect(() => {
    const checkGmailStatus = async () => {
      try {
        const response = await api.get('/api/auth/gmail/status');
        if (response.data?.connected) {
          setGmailConnected(true);
          console.log('[ONBOARDING] User already has Gmail connected');
        }
      } catch (error) {
        console.error('[ONBOARDING] Failed to check Gmail status:', error);
      }
    };
    checkGmailStatus();
  }, []);

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
        leadLimit: settings.leadsPerCycle || 10,
        emailLength: settings.emailLength || 'medium',
        callToAction: settings.callToAction || 'schedule-meeting',
        personalizationLevel: settings.personalizationLevel || 'high',
        ccEmails: settings.ccEmails || '',
        bccEmails: settings.bccEmails || '',
        followupIntervalDays: settings.followupIntervalDays || 7,
        enableAutoResponse: settings.enableAutoResponse !== undefined ? settings.enableAutoResponse : true,
        useCustomSignature: false,
        signatureName: '',
        signatureTitle: '',
        specialInstructions: specialInstructions || ''
      });

      if (!presetResponse.data.success) {
        throw new Error('Failed to create preset');
      }

      const createdPreset = presetResponse.data.preset;
      
      // Then create the agent with the preset applied
      const response = await api.post('/api/auth/create-agent', {
        name: agentName,
        type: 'reasoning-lead-agent',
        specialInstructions: specialInstructions,
        // Don't send useGmail - let backend use user's default setting from preferences
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
          leadLimit: createdPreset.leadLimit,
          emailLength: createdPreset.emailLength,
          callToAction: createdPreset.callToAction,
          personalizationLevel: createdPreset.personalizationLevel,
          ccEmails: createdPreset.ccEmails,
          bccEmails: createdPreset.bccEmails,
          followupIntervalDays: createdPreset.followupIntervalDays,
          enableAutoResponse: createdPreset.enableAutoResponse,
          useCustomSignature: createdPreset.useCustomSignature,
          signatureName: createdPreset.signatureName,
          signatureTitle: createdPreset.signatureTitle
        }
      });

      if (response.data.success) {
        // Show success state
        setCreationSuccess(true);
        setIsCreating(false);
        
        // Redirect to dashboard after showing success
        setTimeout(() => {
          window.location.href = '/';
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63]">
      {/* Header with Logo and Skip */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-6 z-10">
        {/* Meridian Logo + Title */}
        <div className="flex items-center gap-3">
          <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-lg">
            <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="16" fill="none" stroke="white" strokeWidth="1.5"/>
            <line x1="4" y1="24" x2="44" y2="24" stroke="white" strokeWidth="1.5"/>
          </svg>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">Meridian</h1>
        </div>

        {/* Skip Button and User Menu */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSkip}
            className="px-6 py-3 bg-[#1B2F52]/90 hover:bg-[#2A4472] text-white border border-[#4FD1FF]/30 rounded-xl font-semibold transition-all backdrop-blur-sm"
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
              specialInstructions={specialInstructions}
              onInstructionsChange={setSpecialInstructions}
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
          {currentStep === 'gmail-setup' && (
            <GmailSetupStep 
              key="gmail-setup"
              useGmail={useGmail}
              gmailConnected={gmailConnected}
              onToggle={async (value) => {
                setUseGmail(value);
                // Save as default preference for future agents
                try {
                  await api.post('/api/auth/settings/preferences', {
                    preferences: { defaultUseGmail: value }
                  });
                  console.log('[ONBOARDING] Default Gmail preference saved:', value);
                } catch (error) {
                  console.error('[ONBOARDING] Failed to save Gmail preference:', error);
                }
              }}
              onConnect={async () => {
                try {
                  // Request OAuth URL from backend first
                  const response = await api.get('/api/auth/gmail/oauth-url');
                  
                  // Open Gmail OAuth in popup
                  const width = 600;
                  const height = 700;
                  const left = window.screen.width / 2 - width / 2;
                  const top = window.screen.height / 2 - height / 2;
                  const popup = window.open(
                    response.data.authUrl,
                    'Gmail Authorization',
                    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
                  );
                  
                  // Check if popup is closed, then verify connection
                  const checkPopup = setInterval(async () => {
                    try {
                      if (popup?.closed) {
                        clearInterval(checkPopup);
                        
                        // Check if Gmail is actually connected
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const statusResponse = await api.get('/api/auth/gmail/status');
                        if (statusResponse.data?.connected) {
                          setGmailConnected(true);
                          console.log('[ONBOARDING] ✅ Gmail connected confirmed by backend');
                        }
                      }
                    } catch (error) {
                      console.error('[ONBOARDING] Error checking Gmail status:', error);
                    }
                  }, 500);
                  
                  // Cleanup after 5 minutes
                  setTimeout(() => clearInterval(checkPopup), 300000);
                } catch (error) {
                  console.error('[ONBOARDING] Error connecting Gmail:', error);
                }
              }}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 'crm-setup' && (
            <CRMSetupStep
              key="crm-setup"
              crmConnected={crmConnected}
              onConnect={async () => {
                // No longer needed - CRM connection is handled within the component
              }}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 'plan-selection' && (
            <PlanSelectionStep
              key="plan-selection"
              selectedPlan={selectedPlan}
              onSelectPlan={setSelectedPlan}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 'payment-setup' && (
            <PaymentSetupStep
              key="payment-setup"
              selectedPlan={selectedPlan}
              paymentAdded={paymentAdded}
              planPurchased={planPurchased}
              onAddPayment={() => {
                // Open payment method modal
                setShowPaymentModal(true);
              }}
              onPurchasePlan={async () => {
                try {
                  // Purchase the selected plan
                  if (selectedPlan !== 'free-trial') {
                    // Navigate to purchase flow
                    setPlanPurchased(true);
                    setPaymentAdded(true);
                  }
                } catch (error) {
                  console.error('Failed to purchase plan:', error);
                }
              }}
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
              instructions={specialInstructions}
              useGmail={useGmail}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 'creating' && (
            <CreatingStep 
              key="creating" 
              name={agentName} 
              isCreating={isCreating}
              success={creationSuccess}
              error={error}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Payment Method Modal */}
      <PaymentMethodModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={async () => {
          console.log('[ONBOARDING] Payment method modal success callback triggered');
          setShowPaymentModal(false);
          
          // Force state update
          setPaymentAdded(true);
          
          // Double-check with backend to ensure it's synced
          try {
            const response = await api.get('/api/auth/profile');
            if (response.data?.user?.paymentMethodAdded) {
              console.log('[ONBOARDING] Payment method confirmed by backend');
              setPaymentAdded(true); // Ensure it's set
            } else {
              console.warn('[ONBOARDING] Backend says payment method not added yet');
            }
          } catch (error) {
            console.error('[ONBOARDING] Failed to verify payment status:', error);
          }
        }}
      />
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
        className="w-32 h-32 bg-gradient-to-br from-[#4FD1FF] to-[#55C7F7] rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[#4FD1FF]/20"
      >
        <UserPlusIcon className="w-16 h-16 text-[#0F1E35]" />
      </motion.div>

      <h1 className="text-5xl font-bold text-white mb-4">Create Your First AI Agent</h1>
      <p className="text-xl text-[#A3B4CC] mb-8">
        Let's build your automated sales assistant together. It only takes a minute!
      </p>

      <div className="bg-[#1B2F52]/60 backdrop-blur-lg border border-[#4FD1FF]/20 rounded-2xl p-8 mb-8 text-left">
        <h3 className="text-xl font-bold text-white mb-4">Your agent will:</h3>
        <ul className="space-y-3 text-[#A3B4CC] text-lg">
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
            <span>Write research reports directly into your CRM</span>
          </li>
          <li className="flex items-start gap-3">
            <ChartBarIcon className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <span>Track responses and book meetings</span>
          </li>
        </ul>
      </div>

      <button
        onClick={onNext}
        className="px-12 py-5 rounded-2xl font-bold text-xl bg-gradient-to-r from-[#4FD1FF] via-[#55C7F7] to-[#6BE3FF] text-[#0F1E35] hover:shadow-2xl hover:shadow-[#4FD1FF]/30 hover:scale-105 transition-all inline-flex items-center gap-3"
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
              className={`relative p-6 rounded-2xl text-center transition-all bg-[#1B2F52]/90 backdrop-blur-md border ${
                isSelected
                  ? 'shadow-2xl shadow-[#4FD1FF]/20 border-[#4FD1FF] ring-2 ring-[#4FD1FF] scale-105'
                  : 'shadow-lg hover:shadow-xl border-[#4FD1FF]/30 hover:border-[#4FD1FF]/60'
              }`}
            >
              {/* Checkmark Badge - Outside Card */}
              {isSelected && (
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-[#4FD1FF] rounded-full flex items-center justify-center shadow-lg shadow-[#4FD1FF]/50 z-10">
                  <CheckIcon className="w-5 h-5 text-[#0F1E35] font-bold" />
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
                isSelected ? 'text-[#4FD1FF]' : 'text-white'
              }`}>
                {personality.name}
              </h3>

              {/* Description */}
              <p className="text-xs mb-3 leading-relaxed text-[#A3B4CC]">
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
          className="px-6 py-3 text-[#A3B4CC] hover:text-white hover:bg-[#2A4472] rounded-xl font-semibold transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!selected}
          className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-[#4FD1FF] via-[#55C7F7] to-[#6BE3FF] text-[#0F1E35] hover:shadow-xl hover:shadow-[#4FD1FF]/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-all"
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
        <p className="text-xl text-[#A3B4CC]">
          Give it a memorable name to identify this campaign
        </p>
      </div>

      <div className="bg-[#1B2F52]/60 backdrop-blur-lg border border-[#4FD1FF]/20 rounded-2xl p-8 mb-8">
        <label className="block text-white font-semibold mb-3 text-lg">
          Agent Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., Enterprise Outreach Agent"
          className="w-full px-6 py-4 rounded-xl text-lg border-2 border-[#4FD1FF]/30 focus:border-[#4FD1FF] focus:ring-2 focus:ring-[#4FD1FF]/20 bg-[#12213B] text-white placeholder-[#8FA6C1]"
          autoFocus
        />
        <p className="text-[#A3B4CC] text-sm mt-3">
          💡 Tip: Use descriptive names like "SMB Campaign" or "Series A Startups"
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 text-[#A3B4CC] hover:text-white hover:bg-[#2A4472] rounded-xl font-semibold transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!name.trim()}
          className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-[#4FD1FF] via-[#55C7F7] to-[#6BE3FF] text-[#0F1E35] hover:shadow-xl hover:shadow-[#4FD1FF]/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-all"
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
        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-[#4FD1FF] to-[#55C7F7] backdrop-blur-lg rounded-full flex items-center justify-center shadow-lg shadow-[#4FD1FF]/20">
          <SparklesIcon className="w-12 h-12 text-[#0F1E35]" />
        </div>
        <h2 className="text-4xl font-bold text-white mb-3">Save Your Settings</h2>
        <p className="text-xl text-[#A3B4CC]">
          Name this preset so you can reuse these settings for future agents
        </p>
      </div>

      <div className="bg-[#1B2F52]/60 backdrop-blur-lg border border-[#4FD1FF]/20 rounded-2xl p-8 mb-8">
        <label className="block text-white font-semibold mb-3 text-lg">
          Preset Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., SaaS Executives, Tech Startups, Enterprise Sales"
          className="w-full px-6 py-4 rounded-xl text-lg border-2 border-[#4FD1FF]/30 focus:border-[#4FD1FF] focus:ring-2 focus:ring-[#4FD1FF]/20 bg-[#12213B] text-white placeholder-[#8FA6C1]"
          autoFocus
        />
        <p className="text-[#A3B4CC] text-sm mt-3">
          💡 Tip: Use descriptive names like "SaaS Executives" or "Healthcare Decision Makers"
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 text-[#A3B4CC] hover:text-white hover:bg-[#2A4472] rounded-xl font-semibold transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!name.trim()}
          className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-[#4FD1FF] via-[#55C7F7] to-[#6BE3FF] text-[#0F1E35] hover:shadow-xl hover:shadow-[#4FD1FF]/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-all"
        >
          Continue <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// Instructions Step - Special Campaign Instructions
function InstructionsStep({ 
  instructions, 
  onChange, 
  agentName,
  onNext, 
  onBack 
}: { 
  instructions: string; 
  onChange: (text: string) => void; 
  agentName: string;
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
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h2 className="text-4xl font-bold text-white mb-3">Campaign Instructions</h2>
        <p className="text-xl text-white/90">
          Give {agentName} special instructions for this campaign (optional)
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
        <label className="block text-white font-semibold mb-3 text-lg">
          Special Instructions
        </label>
        <textarea
          value={instructions}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Example: Focus on companies using AI/ML. Mention our GPU benchmark data. Target CTOs and Engineering VPs first."
          className="w-full h-48 px-6 py-4 rounded-xl text-lg border-2 border-white/20 focus:border-white focus:ring-4 focus:ring-white/20 bg-white/90 text-neutral-900 resize-none"
          maxLength={1000}
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-white/70 text-sm">
            💡 The AI will analyze and convert your instructions into actionable goals
          </p>
          <span className="text-white/70 text-sm">
            {instructions.length}/1000
          </span>
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
          className="px-8 py-3 rounded-xl font-semibold transition-all hover:shadow-xl hover:scale-105 inline-flex items-center gap-2 bg-white"
          style={{ color: 'rgb(147, 51, 234)' }}
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
  specialInstructions,
  onInstructionsChange,
  onNext, 
  onBack 
}: { 
  selected: string; 
  onSelect: (p: string) => void; 
  specialInstructions: string;
  onInstructionsChange: (instructions: string) => void;
  onNext: () => void; 
  onBack: () => void;
}) {
  const [settings, setSettings] = useState<{
    companySizeMin: number;
    companySizeMax: number;
    industries: string[];
    jobTitles: string[];
    leadsPerCycle: number | string;
    emailLength: 'short' | 'medium' | 'long';
    callToAction: 'schedule-meeting' | 'request-demo' | 'learn-more' | 'custom';
    personalizationLevel: 'low' | 'medium' | 'high';
    ccEmails: string;
    bccEmails: string;
    followupIntervalDays: number;
    enableAutoResponse: boolean;
  }>({
    companySizeMin: 50,
    companySizeMax: 500,
    industries: [] as string[],
    jobTitles: [] as string[],
    leadsPerCycle: 10,
    emailLength: 'medium',
    callToAction: 'schedule-meeting',
    personalizationLevel: 'high',
    ccEmails: '',
    bccEmails: '',
    followupIntervalDays: 7,
    enableAutoResponse: true
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
    hospitality: ['Hotels & Resorts', 'Restaurants & Food Service', 'Travel & Tourism', 'Event Venues', 'Casino & Gaming', 'Cruise Lines', 'Airlines', 'Vacation Rentals', 'Catering', 'Property Management Companies', 'Third-Party Hotel Management', 'Independent Hotels', 'Hotel Chains', 'Boutique Hotels', 'Bed & Breakfast', 'Hostels', 'Timeshares', 'Conference Centers', 'Spa & Wellness Resorts', 'Golf Resorts', 'Theme Parks'],
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

  const commonIndustries = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 'Real Estate', 'Education', 'Consulting', 'SaaS', 'E-commerce', 'Hospitality'];
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

      {/* Special Instructions - Top Priority */}
      <div className="bg-blue-500/90 backdrop-blur-lg rounded-2xl p-8 mb-6 border-2 border-blue-300">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-2xl mb-2">General Instructions</h3>
            <p className="text-white/90 text-sm leading-relaxed">
              Give your agent specific campaign instructions. The AI will dynamically determine what actions to take based on these instructions, adapting its research, outreach, and engagement strategy to meet your goals.
            </p>
          </div>
        </div>
        <textarea
          value={specialInstructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder="Example: Target CTOs at Series A startups in healthcare tech. Focus on pain points around scaling engineering teams and infrastructure costs. Keep tone professional but friendly."
          className="w-full px-4 py-3 rounded-lg bg-white text-neutral-900 font-medium placeholder:text-neutral-400 min-h-[120px] resize-y"
          maxLength={1000}
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-white/70 text-sm">
            💡 These instructions guide the entire campaign behavior
          </span>
          <span className="text-white/70 text-sm">
            {specialInstructions.length}/1000
          </span>
        </div>
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
                ~{Math.ceil(((typeof settings.leadsPerCycle === 'number' ? settings.leadsPerCycle : parseInt(settings.leadsPerCycle) || 0) * 2) / 3)} credits per cycle
              </span>
            </div>
            <p className="text-white/70 text-sm mt-2">
              Average: 3 leads per 2 credits • {settings.leadsPerCycle || 0} leads = ~{Math.ceil(((typeof settings.leadsPerCycle === 'number' ? settings.leadsPerCycle : parseInt(settings.leadsPerCycle) || 0) * 2) / 3)} credits
            </p>
          </div>
        </div>

        {/* CC and BCC Emails */}
        <div className="border-t border-white/20 pt-6">
          <h3 className="text-white font-bold text-2xl mb-4">Email Settings</h3>
          <p className="text-white/70 text-sm mb-6">
            Optional CC/BCC recipients for all outgoing emails
          </p>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold mb-2">CC Email Addresses</label>
                <input
                  type="text"
                  value={settings.ccEmails}
                  onChange={(e) => setSettings({ ...settings, ccEmails: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/90 text-neutral-900 font-medium placeholder:text-neutral-500"
                  placeholder="email1@example.com, email2@example.com"
                />
                <p className="text-white/60 text-xs mt-1">Comma-separated email addresses</p>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">BCC Email Addresses</label>
                <input
                  type="text"
                  value={settings.bccEmails}
                  onChange={(e) => setSettings({ ...settings, bccEmails: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/90 text-neutral-900 font-medium placeholder:text-neutral-500"
                  placeholder="email1@example.com, email2@example.com"
                />
                <p className="text-white/60 text-xs mt-1">Hidden from recipients</p>
              </div>
            </div>

            {/* Follow-up Interval */}
            <div>
              <label className="block text-white font-semibold mb-2">Follow-up Interval (Days)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.followupIntervalDays}
                onChange={(e) => setSettings({ ...settings, followupIntervalDays: parseInt(e.target.value) || 7 })}
                className="w-full md:w-48 px-4 py-3 rounded-lg bg-white text-neutral-900 font-medium"
              />
              <p className="text-white/70 text-sm mt-2">
                Days to wait before sending follow-up email
              </p>
            </div>

            {/* Enable Auto-Response */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-white font-semibold text-lg">Enable AI Auto-Response to Emails</label>
                <p className="text-white/70 text-sm mt-1">
                  When enabled, AI will automatically respond to incoming emails from leads
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, enableAutoResponse: !settings.enableAutoResponse })}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                  settings.enableAutoResponse ? 'bg-green-400' : 'bg-neutral-600'
                }`}
                style={{
                  backgroundColor: settings.enableAutoResponse ? '#4ade80' : '#52525b'
                }}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                    settings.enableAutoResponse ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Email Signature Customization */}
            <div className="border-t border-white/20 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="text-white font-semibold text-lg">Use Custom Email Signature</label>
                  <p className="text-white/70 text-sm mt-1">
                    {false 
                      ? 'Emails will be signed with your custom name and title' 
                      : 'Emails will be signed as the AI agent'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {}}
                  className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200`}
                  style={{
                    backgroundColor: '#52525b'
                  }}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                      'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {false && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-white font-semibold mb-2">Your Name</label>
                    <input
                      type="text"
                      value={''}
                      onChange={(e) => {}}
                      className="w-full px-4 py-3 rounded-lg bg-white/90 text-neutral-900 font-medium placeholder:text-neutral-500"
                      placeholder="e.g., John Smith"
                    />
                    <p className="text-white/60 text-xs mt-1">The name that will appear in email signatures</p>
                  </div>

                  <div>
                    <label className="block text-white font-semibold mb-2">Your Title</label>
                    <input
                      type="text"
                      value={''}
                      onChange={(e) => {}}
                      className="w-full px-4 py-3 rounded-lg bg-white/90 text-neutral-900 font-medium placeholder:text-neutral-500"
                      placeholder="e.g., CEO, Sales Director"
                    />
                    <p className="text-white/60 text-xs mt-1">Your title or role in the company</p>
                  </div>
                </div>
              )}
            </div>
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
            // Validate required fields
            const missingFields = [];
            
            if (settings.industries.length === 0) {
              missingFields.push('Target Industries');
            }
            if (settings.jobTitles.length === 0) {
              missingFields.push('Target Positions');
            }
            const leadsNum = typeof settings.leadsPerCycle === 'string' ? parseInt(settings.leadsPerCycle) : settings.leadsPerCycle;
            if (!leadsNum || leadsNum < 1) {
              missingFields.push('Leads Per Cycle');
            }
            if (!settings.companySizeMin || settings.companySizeMin < 1) {
              missingFields.push('Company Size Minimum');
            }
            if (!settings.companySizeMax || settings.companySizeMax < 1) {
              missingFields.push('Company Size Maximum');
            }
            
            if (missingFields.length > 0) {
              alert(`Please fill out the following required fields:\n\n• ${missingFields.join('\n• ')}`);
              return;
            }
            
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
  instructions,
  useGmail,
  onNext, 
  onBack 
}: { 
  personality: any; 
  name: string;
  presetName: string;
  preset: string;
  instructions?: string;
  useGmail?: boolean;
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

      <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl border-2 border-[#4FD1FF]/30">
        <div className="space-y-6">
          <div>
            <p className="text-sm text-[#A3B4CC] mb-2">Agent Name</p>
            <p className="text-2xl font-bold text-white">{name}</p>
          </div>
          
          {instructions && instructions.trim() && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-900 mb-1">General Instructions</p>
                  <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">{instructions}</p>
                </div>
              </div>
            </div>
          )}
          
          <div>
            <p className="text-sm text-[#A3B4CC] mb-2">Personality</p>
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
                <p className="font-bold text-white">{personality?.name}</p>
                <p className="text-sm text-[#A3B4CC]">{personality?.description}</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm text-[#A3B4CC] mb-2">Settings Preset</p>
            <p className="text-lg font-bold text-white mb-2">{presetName}</p>
            {(() => {
              try {
                const settings = JSON.parse(preset);
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[#A3B4CC]">Company Size:</span>
                      <span className="font-semibold text-white">
                        {settings.companySizeMin?.toLocaleString()} - {settings.companySizeMax?.toLocaleString()} employees
                      </span>
                    </div>
                    {settings.industries?.length > 0 && (
                      <div>
                        <span className="text-[#A3B4CC] text-sm">Industries:</span>
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
                        <span className="text-[#A3B4CC] text-sm">Positions:</span>
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
                      <span className="text-[#A3B4CC]">Leads per cycle:</span>
                      <span className="font-semibold text-white">{settings.leadsPerCycle}</span>
                    </div>
                    
                    {/* Email Settings */}
                    {(settings.ccEmails || settings.bccEmails || settings.followupIntervalDays || settings.enableAutoResponse) && (
                      <div className="border-t border-white/10 pt-3 mt-3">
                        <p className="text-sm font-bold text-white mb-2">Email Settings</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-[#A3B4CC]">Follow-up Interval:</span>
                            <span className="font-semibold text-white">{settings.followupIntervalDays || 7} days</span>
                          </div>
                          {(settings.ccEmails || settings.bccEmails) && (
                            <div className="text-xs text-[#A3B4CC] mt-2">
                              {settings.ccEmails && <div>CC: {settings.ccEmails}</div>}
                              {settings.bccEmails && <div>BCC: {settings.bccEmails}</div>}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-[#A3B4CC]">Auto-Response:</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              settings.enableAutoResponse ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/60'
                            }`}>
                              {settings.enableAutoResponse ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              } catch {
                return <p className="text-neutral-900 font-semibold">{preset}</p>;
              }
            })()}
          </div>
          
          <div>
            <p className="text-sm text-[#A3B4CC] mb-2">Email Sending</p>
            <div className="flex items-center gap-2">
              <EnvelopeIcon className="w-5 h-5 text-[#A3B4CC]" />
              <span className="font-semibold text-white">
                {useGmail ? 'Gmail (Primary inbox, better deliverability)' : 'Mailgun (Standard sending)'}
              </span>
              {useGmail && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
                  RECOMMENDED
                </span>
              )}
            </div>
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

// Gmail Setup Step
function GmailSetupStep({
  useGmail,
  gmailConnected,
  onToggle,
  onConnect,
  onNext,
  onBack
}: {
  useGmail: boolean;
  gmailConnected: boolean;
  onToggle: (value: boolean) => void;
  onConnect: () => void;
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
        <h2 className="text-4xl font-bold text-white mb-3">Gmail Integration</h2>
        <p className="text-xl text-white/90">
          Send emails from your Gmail for better deliverability
        </p>
      </div>

      <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl border-2 border-[#4FD1FF]/30">
        <div className="space-y-6">
          <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 border-2 border-[#4FD1FF]/30 hover:border-[#4FD1FF]/60 hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2 flex items-center gap-2 sm:gap-3">
                  <EnvelopeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#4FD1FF]" />
                  Gmail
                  {gmailConnected && (
                    <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
                  )}
                </h3>
                <p className="text-sm sm:text-base text-[#A3B4CC] mb-4">
                  Send emails from your Gmail for better deliverability and reply tracking
                </p>
                <p className="text-xs sm:text-sm text-[#4FD1FF] mb-4">
                  Recommended for best inbox placement and reply accuracy.
                </p>
                <button
                  onClick={() => {
                    onToggle(true);
                    onConnect();
                  }}
                  disabled={gmailConnected}
                  className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-all w-full sm:w-auto ${
                    gmailConnected
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default'
                      : 'bg-gradient-to-r from-[#4FD1FF] to-[#6BE3FF] text-[#0F1E35] hover:shadow-lg hover:shadow-[#4FD1FF]/30 hover:scale-105'
                  }`}
                >
                  {gmailConnected ? 'Connected' : 'Connect Gmail'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 border-2 border-[#4FD1FF]/30 hover:border-[#4FD1FF]/60 hover:scale-[1.02] transition-all duration-300">
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2 flex items-center gap-2 sm:gap-3">
              <PaperAirplaneIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#4FD1FF]" />
              Mailgun (Default)
              {!useGmail && (
                <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
              )}
            </h3>
            <p className="text-sm sm:text-base text-[#A3B4CC] mb-4">
              Use Mailgun for sending. Replies will be tracked via webhooks.
            </p>
            <button
              onClick={() => onToggle(false)}
              disabled={!useGmail}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-all w-full sm:w-auto ${
                !useGmail
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default'
                  : 'bg-gradient-to-r from-[#4FD1FF] to-[#6BE3FF] text-[#0F1E35] hover:shadow-lg hover:shadow-[#4FD1FF]/30 hover:scale-105'
              }`}
            >
              {!useGmail ? 'Selected' : 'Use Mailgun'}
            </button>
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
          className="px-10 py-4 rounded-xl font-bold text-lg transition-all hover:shadow-xl hover:scale-105 inline-flex items-center gap-2 bg-gradient-to-r from-[#4FD1FF] to-[#6BE3FF] text-[#0F1E35]"
        >
          Continue
          <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// CRM Setup Step (using custom API key input)
function CRMSetupStep({
  crmConnected,
  onConnect,
  onNext,
  onBack
}: {
  crmConnected: boolean;
  onConnect: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [selectedCRM, setSelectedCRM] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(crmConnected);

  // CRM configs (all 21 integrations)
  const CRM_CONFIGS = [
    {
      id: 'activecampaign',
      name: 'ActiveCampaign',
      logo: 'https://www.activecampaign.com/favicon.ico',
      fields: [
        { name: 'API URL', key: 'apiUrl', type: 'text', placeholder: 'https://youraccountname.api-us1.com', helpText: 'Found in Settings → Developer' },
        { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your ActiveCampaign API Key' }
      ]
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      logo: 'https://www.hubspot.com/hubfs/HubSpot_Logos/HubSpot-Inversed-Favicon.png',
      fields: [
        { name: 'Private App Access Token', key: 'apiKey', type: 'password', placeholder: 'pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', helpText: 'Create a Private App in Settings → Integrations → Private Apps' }
      ]
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      logo: 'https://c1.sfdcstatic.com/content/dam/web/en_us/www/images/nav/salesforce-cloud-logo-sm.png',
      fields: [
        { name: 'Instance URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourinstance.salesforce.com', helpText: 'Your Salesforce domain' },
        { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Salesforce access token', helpText: 'Create a Connected App or use OAuth' }
      ]
    },
    {
      id: 'pipedrive',
      name: 'Pipedrive',
      logo: 'https://www.pipedrive.com/favicon.ico',
      fields: [
        { name: 'API Token', key: 'apiKey', type: 'password', placeholder: 'Your Pipedrive API token', helpText: 'Found in Settings → Personal preferences → API' }
      ]
    },
    {
      id: 'zoho',
      name: 'Zoho CRM',
      logo: 'https://www.zohowebstatic.com/sites/zweb/images/favicon.ico',
      fields: [
        { name: 'Data Center', key: 'apiUrl', type: 'text', placeholder: 'https://www.zohoapis.com (or .eu, .in, .com.au)', helpText: 'Based on your account region' },
        { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Zoho OAuth access token' }
      ]
    },
    {
      id: 'copper',
      name: 'Copper',
      logo: 'https://www.copper.com/favicon.ico',
      fields: [
        { name: 'User Email', key: 'apiUrl', type: 'text', placeholder: 'your@email.com', helpText: 'Email associated with your Copper account' },
        { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Copper API key', helpText: 'Found in Settings → Integrations → API Keys' }
      ]
    },
    {
      id: 'close',
      name: 'Close',
      logo: 'https://close.com/favicon.ico',
      fields: [
        { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'api_xxxxxxxxxxxxxxxx', helpText: 'Found in Settings → API Keys' }
      ]
    },
    {
      id: 'affinity',
      name: 'Affinity',
      logo: 'https://www.affinity.co/favicon.ico',
      fields: [
        { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Affinity API key', helpText: 'Found in Settings → API' }
      ]
    },
    {
      id: 'capsule',
      name: 'Capsule',
      logo: 'https://capsulecrm.com/favicon.ico',
      fields: [
        { name: 'API Token', key: 'apiKey', type: 'password', placeholder: 'Your Capsule API token', helpText: 'Found in My Preferences → API Authentication Tokens' }
      ]
    },
    {
      id: 'insightly',
      name: 'Insightly',
      logo: 'https://www.insightly.com/favicon.ico',
      fields: [
        { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Insightly API key', helpText: 'Found in User Settings → API' }
      ]
    },
    {
      id: 'keap',
      name: 'Keap (Infusionsoft)',
      logo: 'https://keap.com/favicon.ico',
      fields: [
        { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Keap access token', helpText: 'OAuth access token from Keap Developer Portal' }
      ]
    },
    {
      id: 'dynamics365',
      name: 'Microsoft Dynamics 365',
      logo: 'https://dynamics.microsoft.com/favicon.ico',
      fields: [
        { name: 'Organization URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourorg.crm.dynamics.com', helpText: 'Your Dynamics 365 instance URL' },
        { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Azure AD access token' }
      ]
    },
    {
      id: 'nutshell',
      name: 'Nutshell',
      logo: 'https://www.nutshell.com/favicon.ico',
      fields: [
        { name: 'User Email', key: 'apiUrl', type: 'text', placeholder: 'your@email.com' },
        { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Nutshell API key', helpText: 'Found in Setup → API Keys' }
      ]
    },
    {
      id: 'pipeliner',
      name: 'Pipeliner',
      logo: 'https://www.pipelinersales.com/favicon.ico',
      fields: [
        { name: 'Space ID', key: 'apiUrl', type: 'text', placeholder: 'Your Pipeliner Space ID' },
        { name: 'API Token', key: 'apiKey', type: 'password', placeholder: 'Your Pipeliner API token' }
      ]
    },
    {
      id: 'salesflare',
      name: 'Salesflare',
      logo: 'https://salesflare.com/favicon.ico',
      fields: [
        { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Salesflare API key', helpText: 'Found in Settings → API keys' }
      ]
    },
    {
      id: 'sugarcrm',
      name: 'SugarCRM',
      logo: 'https://www.sugarcrm.com/favicon.ico',
      fields: [
        { name: 'Instance URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourinstance.sugarcrm.com' },
        { name: 'OAuth Token', key: 'apiKey', type: 'password', placeholder: 'Your SugarCRM OAuth token' }
      ]
    },
    {
      id: 'teamleader',
      name: 'Teamleader',
      logo: 'https://www.teamleader.eu/favicon.ico',
      fields: [
        { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Teamleader access token', helpText: 'OAuth token from Teamleader Marketplace' }
      ]
    },
    {
      id: 'teamwork',
      name: 'Teamwork CRM',
      logo: 'https://www.teamwork.com/favicon.ico',
      fields: [
        { name: 'Site URL', key: 'apiUrl', type: 'text', placeholder: 'https://yoursite.teamwork.com' },
        { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Your Teamwork API key' }
      ]
    },
    {
      id: 'vtiger',
      name: 'Vtiger',
      logo: 'https://www.vtiger.com/favicon.ico',
      fields: [
        { name: 'Instance URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourinstance.vtiger.com' },
        { name: 'Access Key', key: 'apiKey', type: 'password', placeholder: 'Your Vtiger access key', helpText: 'Found in My Preferences → Access Key' }
      ]
    },
    {
      id: 'zendesksell',
      name: 'Zendesk Sell',
      logo: 'https://www.zendesk.com/favicon.ico',
      fields: [
        { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Zendesk Sell access token', helpText: 'OAuth token or API token from Settings → OAuth' }
      ]
    },
    {
      id: 'accelo',
      name: 'Accelo',
      logo: 'https://www.accelo.com/favicon.ico',
      fields: [
        { name: 'Deployment URL', key: 'apiUrl', type: 'text', placeholder: 'https://yourcompany.api.accelo.com' },
        { name: 'Access Token', key: 'apiKey', type: 'password', placeholder: 'Your Accelo access token' }
      ]
    }
  ];

  const handleConnect = async () => {
    if (!selectedCRM) return;
    
    const missingFields = selectedCRM.fields.filter((f: any) => !credentials[f.key]?.trim());
    if (missingFields.length > 0) {
      setError(`Please fill in: ${missingFields.map((f: any) => f.name).join(', ')}`);
      return;
    }
    
    setConnecting(true);
    setError(null);
    
    try {
      await api.post('/api/crm/connect-direct', {
        integrationName: selectedCRM.id,
        apiUrl: credentials.apiUrl?.trim() || '',
        apiKey: credentials.apiKey?.trim() || ''
      });
      
      setConnected(true);
      setSelectedCRM(null);
      setCredentials({});
    } catch (error: any) {
      console.error('Error connecting CRM:', error);
      setError(error.response?.data?.error || 'Failed to connect. Please check your credentials.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-2xl"
    >
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-3">Connect Your CRM (Optional)</h2>
        <p className="text-xl text-white/90">
          Auto-sync researched leads to your CRM platform
        </p>
      </div>

      <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl border-2 border-[#4FD1FF]/30">
        <div className="space-y-6">
          <div className="bg-[#0F1E35]/50 border-2 border-[#4FD1FF]/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <svg className="w-8 h-8 text-[#4FD1FF] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <h3 className="font-bold text-white text-lg mb-2">Why connect a CRM?</h3>
                <ul className="space-y-2 text-sm text-[#A3B4CC]">
                  <li>✓ Automatically sync researched leads</li>
                  <li>✓ Keep your CRM up-to-date effortlessly</li>
                  <li>✓ Research summaries attached as notes</li>
                  <li>✓ Works with HubSpot, Salesforce, Pipedrive, Zoho & more</li>
                </ul>
              </div>
            </div>
          </div>

          {!connected && !selectedCRM && (
            <div className="space-y-4">
              <label className="block text-white font-semibold text-sm mb-2">Choose your CRM</label>
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#0F1E35]/50 border-2 border-[#4FD1FF]/30 rounded-xl text-white hover:bg-[#0F1E35]/70 transition-colors"
                >
                  <span className="text-sm">Select a CRM platform...</span>
                  <svg className={`w-5 h-5 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showDropdown && (
                  <div className="absolute z-50 w-full mt-2 bg-white border-2 border-neutral-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {CRM_CONFIGS.map((crm) => (
                      <button
                        key={crm.id}
                        onClick={() => {
                          setSelectedCRM(crm);
                          setShowDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-b-0"
                      >
                        {crm.logo && (
                          <img 
                            src={crm.logo} 
                            alt={crm.name}
                            className="w-6 h-6 rounded object-contain"
                          />
                        )}
                        <span className="text-sm text-neutral-700 font-medium">{crm.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-[#A3B4CC] text-center">
                You can also connect this later from Settings
              </p>
            </div>
          )}

          {!connected && selectedCRM && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#4FD1FF]/30">
                <div className="flex items-center gap-3">
                  {selectedCRM.logo && (
                    <img 
                      src={selectedCRM.logo} 
                      alt={selectedCRM.name}
                      className="w-8 h-8 rounded object-contain"
                    />
                  )}
                  <div>
                    <h4 className="text-sm font-semibold text-white">{selectedCRM.name}</h4>
                    <p className="text-xs text-[#A3B4CC]">Enter your credentials</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedCRM(null);
                    setCredentials({});
                    setError(null);
                  }}
                  className="text-xs text-[#4FD1FF] hover:text-[#6BE3FF] font-medium"
                >
                  Change
                </button>
              </div>

              {selectedCRM.fields.map((field: any) => (
                <div key={field.key}>
                  <label className="block text-xs text-[#A3B4CC] font-medium mb-1">{field.name}</label>
                  <input
                    type={field.type}
                    value={credentials[field.key] || ''}
                    onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-2.5 bg-[#0F1E35]/50 border-2 border-[#4FD1FF]/30 rounded-lg text-white text-sm placeholder-[#A3B4CC]/50 focus:border-[#4FD1FF] focus:ring-2 focus:ring-[#4FD1FF]/20 focus:outline-none"
                  />
                  {field.helpText && (
                    <p className="text-xs text-[#A3B4CC] mt-1">{field.helpText}</p>
                  )}
                </div>
              ))}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50"
              >
                {connecting ? 'Connecting...' : 'Connect CRM'}
              </button>
            </div>
          )}

          {connected && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <CheckIcon className="w-6 h-6 text-green-600" />
                <p className="text-sm text-green-800 font-semibold">
                  CRM connected! Leads will auto-sync after research.
                </p>
              </div>
            </div>
          )}
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
          {connected ? 'Continue' : 'Skip for now'}
          <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// Plan Selection Step
function PlanSelectionStep({
  selectedPlan,
  onSelectPlan,
  onNext,
  onBack
}: {
  selectedPlan: string;
  onSelectPlan: (plan: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const plans = [
    {
      id: 'free-trial',
      name: 'Free Trial',
      price: 0,
      credits: 500,
      description: 'Perfect for trying out Meridian',
      features: [
        '500 free credits ($25 value)',
        'All core features included',
        'No credit card required',
        'Perfect for testing'
      ],
      color: 'green',
      popular: false
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 500,
      credits: 10000,
      description: 'Great for solo entrepreneurs',
      features: [
        '10,000 credits (~15,000 emails)',
        'All features unlocked', 
        'Priority support',
        'Can purchase more credits'
      ],
      color: 'blue',
      popular: false
    },
    {
      id: 'growth',
      name: 'Growth',
      price: 1000,
      credits: 20000,
      description: 'Perfect for growing teams',
      features: [
        '20,000 credits (~30,000 emails)',
        'Everything in Starter',
        'Advanced analytics',
        'Team collaboration'
      ],
      color: 'purple',
      popular: true
    },
    {
      id: 'scale',
      name: 'Scale',
      price: 2500,
      credits: 70000,
      description: 'For high-volume operations',
      features: [
        '70,000 credits + 20,000 bonus',
        'Everything in Growth',
        'Dedicated support',
        'Custom integrations'
      ],
      color: 'orange',
      popular: false
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-6xl"
    >
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-3">Choose Your Plan</h2>
        <p className="text-xl text-white/90">
          Start with free trial or jump right into a paid plan
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {plans.map((plan) => (
          <motion.div
            key={plan.id}
            whileHover={{ scale: 1.02 }}
            className={`relative bg-white rounded-2xl p-6 cursor-pointer transition-all border-4 ${
              selectedPlan === plan.id 
                ? 'border-[#4FD1FF] shadow-2xl shadow-[#4FD1FF]/20' 
                : 'border-white/10 hover:border-[#4FD1FF]/50'
            }`}
            onClick={() => onSelectPlan(plan.id)}
          >
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
              <p className="text-gray-600 mb-4">{plan.description}</p>
              
              <div className="mb-4">
                <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                {plan.price > 0 && <span className="text-gray-600">/one-time</span>}
              </div>
              
              <div className="text-lg font-bold text-[#4FD1FF] mb-4">
                {plan.credits.toLocaleString()} credits
              </div>
              
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {selectedPlan === plan.id && (
                <div className="flex items-center justify-center gap-2 text-[#4FD1FF] font-bold">
                  <CheckIcon className="w-5 h-5" />
                  Selected
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 border-2 border-white/20 text-white rounded-xl hover:bg-white/10 transition-all"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-8 py-3 bg-gradient-to-r from-[#4FD1FF] via-[#55C7F7] to-[#6BE3FF] text-[#0F1E35] rounded-xl font-bold hover:shadow-xl hover:shadow-[#4FD1FF]/30 transition-all inline-flex items-center gap-2"
        >
          Continue with {plans.find(p => p.id === selectedPlan)?.name}
          <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// Payment Setup Step
function PaymentSetupStep({
  selectedPlan,
  paymentAdded,
  planPurchased,
  onAddPayment,
  onPurchasePlan,
  onNext,
  onBack
}: {
  selectedPlan: string;
  paymentAdded: boolean;
  planPurchased: boolean;
  onAddPayment: () => void;
  onPurchasePlan: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  
  const planDetailsMap = {
    'free-trial': { name: 'Free Trial', credits: 500, uiPrice: 0, purchasePrice: 0 },
    'starter': { name: 'Starter', credits: 10000, uiPrice: 500, purchasePrice: 500 },
    'growth': { name: 'Growth', credits: 20000, uiPrice: 1000, purchasePrice: 1000 },
    'scale': { name: 'Scale', credits: 70000, uiPrice: 2500, purchasePrice: 2500 }
  };
  const planDetails = planDetailsMap[selectedPlan as keyof typeof planDetailsMap] || planDetailsMap['free-trial'];

  const handlePurchase = async () => {
    if (selectedPlan === 'free-trial') {
      onNext();
      return;
    }

    setLoading(true);
    setPurchaseError(null);
    try {
      // Use the existing credit purchase system
      const response = await api.post('/api/billing/purchase-credits', {
        tierId: selectedPlan,
        amount: planDetails.purchasePrice,
        credits: planDetails.credits,
      });

      if (response.data.success) {
        onPurchasePlan();
        onNext();
      } else {
        throw new Error(response.data.error || 'Purchase failed');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Purchase failed';
      console.error('Purchase failed:', errorMsg);
      setPurchaseError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-2xl"
    >
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-3">
          {selectedPlan === 'free-trial' ? 'Start Your Free Trial' : 'Complete Your Purchase'}
        </h2>
        <p className="text-xl text-white/90">
          Selected: {planDetails.name} - {planDetails.credits.toLocaleString()} credits
        </p>
      </div>

      <div className="bg-[#1B2F52]/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl border-2 border-[#4FD1FF]/30">
        {selectedPlan === 'free-trial' ? (
          <div className="space-y-6">
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <svg className="w-8 h-8 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0 2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-bold text-green-900 text-lg mb-2">Free Trial Ready!</h3>
                  <p className="text-sm text-green-800 mb-3">
                    Start with 500 free credits ($25 value) to test the platform. Only pay when you're ready to scale.
                  </p>
                  <ul className="space-y-2 text-sm text-green-800">
                    <li>✓ No credit card required</li>
                    <li>✓ Full access to all features</li>
                    <li>✓ Real cost tracking</li>
                    <li>✓ Upgrade anytime</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#0F1E35]/50 border-2 border-[#4FD1FF]/30 rounded-xl p-6">
              <div className="text-center">
                <h3 className="font-bold text-white text-xl mb-2">{planDetails.name} Plan</h3>
                <p className="text-3xl font-bold text-[#4FD1FF] mb-2">${planDetails.uiPrice}</p>
                <p className="text-[#A3B4CC] mb-4">{planDetails.credits.toLocaleString()} credits included</p>
                
                {!paymentAdded && (
                  <div className="space-y-4">
                    <button
                      onClick={onAddPayment}
                      className="w-full px-6 py-3 bg-gradient-to-r from-[#4FD1FF] to-[#6BE3FF] text-[#0F1E35] rounded-xl font-bold hover:shadow-lg hover:shadow-[#4FD1FF]/30 transition-all"
                    >
                      Add Payment Method
                    </button>
                    <p className="text-sm text-[#A3B4CC]">
                      Payment method required before purchasing
                    </p>
                  </div>
                )}

                {paymentAdded && !planPurchased && (
                  <div className="space-y-4">
                    <div className="bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 justify-center">
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                        <p className="text-sm font-semibold">
                          Payment method added
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handlePurchase}
                      disabled={loading}
                      className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        `Purchase ${planDetails.name} - $${planDetails.uiPrice}`
                      )}
                    </button>
                    {purchaseError && (
                      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="text-sm text-red-800 font-semibold">Purchase Failed</p>
                            <p className="text-xs text-red-700 mt-1">{purchaseError}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-blue-600 text-center">
                      One-time purchase • {planDetails.credits.toLocaleString()} credits added immediately
                    </p>
                  </div>
                )}

                {planPurchased && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-3 justify-center">
                      <CheckIcon className="w-6 h-6 text-green-600" />
                      <p className="text-sm text-green-800 font-semibold">
                        Plan purchased successfully! {planDetails.credits.toLocaleString()} credits added.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 border-2 border-white/20 text-white rounded-xl hover:bg-white/10 transition-all"
        >
          Back
        </button>
        <button
          onClick={selectedPlan === 'free-trial' ? onNext : (planPurchased ? onNext : () => {})}
          disabled={selectedPlan !== 'free-trial' && !planPurchased}
          className="px-8 py-3 bg-gradient-to-r from-[#4FD1FF] via-[#55C7F7] to-[#6BE3FF] text-[#0F1E35] rounded-xl font-bold hover:shadow-xl hover:shadow-[#4FD1FF]/30 transition-all inline-flex items-center gap-2 disabled:opacity-50"
        >
          Continue
          <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// Creating Step
function CreatingStep({ name, isCreating, success, error }: { name: string; isCreating: boolean; success: boolean; error: string | null }) {
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

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-xl"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8"
        >
          <CheckIcon className="w-12 h-12 text-white" />
        </motion.div>
        <h2 className="text-4xl font-bold text-white mb-4">
          {name} Created! ✓
        </h2>
        <p className="text-xl text-white/90">
          Redirecting to your dashboard...
        </p>
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
        Creating {name}...
      </h2>
      <p className="text-xl text-white/90">
        Setting up your AI agent. This will only take a moment!
      </p>
    </motion.div>
  );
}
