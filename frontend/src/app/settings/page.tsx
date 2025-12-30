'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircleIcon,
  CreditCardIcon,
  EnvelopeIcon,
  CalendarIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  ClockIcon,
  LinkIcon,
  ArrowLeftIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline';
import BillingContent from '@/components/BillingContent';
import PaymentHistory from '@/components/PaymentHistory';
import RateLimitSettings from '@/components/agents/RateLimitSettings';
import SettingsContent from '@/components/SettingsContent';
import CompanyProfileModal from '@/components/CompanyProfileModal';
import KeywordMemoryPanel from '@/components/agents/KeywordMemoryPanel';

type SettingSection = 
  | 'profile' 
  | 'company' 
  | 'payment-methods' 
  | 'budget' 
  | 'payment-history'
  | 'gmail'
  | 'email-preferences'
  | 'google-calendar'
  | 'calendly'
  | 'privacy'
  | 'memory';

interface SettingCategory {
  id: string;
  label: string;
  icon: any;
  sections: {
    id: SettingSection;
    label: string;
    icon: any;
  }[];
}

export default function SettingsPage() {
  const router = useRouter();
  const [expandedCategory, setExpandedCategory] = useState<string>('account');
  const [selectedSection, setSelectedSection] = useState<SettingSection>('profile');
  const [showCompanyProfileModal, setShowCompanyProfileModal] = useState(false);

  const categories: SettingCategory[] = [
    {
      id: 'account',
      label: 'Account',
      icon: UserCircleIcon,
      sections: [
        { id: 'profile', label: 'Profile', icon: UserCircleIcon },
        { id: 'company', label: 'Company Profile', icon: BuildingOfficeIcon }
      ]
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: CreditCardIcon,
      sections: [
        { id: 'payment-methods', label: 'Payment Methods', icon: CreditCardIcon },
        { id: 'budget', label: 'Budget & Limits', icon: CurrencyDollarIcon },
        { id: 'payment-history', label: 'Payment History', icon: ClockIcon }
      ]
    },
    {
      id: 'email',
      label: 'Email',
      icon: EnvelopeIcon,
      sections: [
        { id: 'gmail', label: 'Gmail Connection', icon: EnvelopeIcon },
        { id: 'email-preferences', label: 'Email Preferences', icon: EnvelopeIcon }
      ]
    },
    {
      id: 'memory',
      label: 'Memory',
      icon: BookOpenIcon,
      sections: [
        { id: 'memory', label: 'Keyword Memory', icon: BookOpenIcon }
      ]
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: CalendarIcon,
      sections: [
        { id: 'google-calendar', label: 'Google Calendar', icon: CalendarIcon },
        { id: 'calendly', label: 'Calendly Link', icon: LinkIcon }
      ]
    },
    {
      id: 'privacy',
      label: 'Privacy',
      icon: ShieldCheckIcon,
      sections: [
        { id: 'privacy', label: 'Privacy Policy', icon: ShieldCheckIcon }
      ]
    }
  ];

  const toggleCategory = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? '' : categoryId);
  };

  const renderContent = () => {
    // Map section to valid SettingsContent tab
    const mapToTab = (section: SettingSection): 'profile' | 'budget' | 'calendar' | 'privacy' => {
      switch (section) {
        case 'profile':
        case 'company':
        case 'gmail':
        case 'email-preferences':
          return 'profile';
        case 'google-calendar':
        case 'calendly':
          return 'calendar';
        case 'privacy':
          return 'privacy';
        case 'budget':
          return 'budget';
        default:
          return 'profile';
      }
    };

    // Handle each section directly
    if (selectedSection === 'profile') {
      return (
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">User Profile</h1>
          <p className="text-white/70 mb-8">View your account information</p>
          <SettingsContent initialTab="profile" />
        </div>
      );
    }

    if (selectedSection === 'company') {
      return (
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Company Profile</h1>
          <p className="text-white/70 mb-8">Manage your company information for email responses</p>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-8">
            <p className="text-white/80 mb-6">
              Your company profile is used to personalize email responses and provide context to your AI agents.
              Click the button below to edit your company information.
            </p>
            <button
              onClick={() => setShowCompanyProfileModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Edit Company Profile
            </button>
          </div>
        </div>
      );
    }

    if (selectedSection === 'gmail') {
      return (
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Gmail Connection</h1>
          <p className="text-white/70 mb-8">Connect and manage your Gmail accounts</p>
          <SettingsContent initialTab="email" />
        </div>
      );
    }

    if (selectedSection === 'email-preferences') {
      return (
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Email Preferences</h1>
          <p className="text-white/70 mb-8">Configure default email settings and AI response behavior</p>
          <SettingsContent initialTab="emailPreferences" />
        </div>
      );
    }

    if (selectedSection === 'google-calendar') {
      return (
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Google Calendar</h1>
          <p className="text-white/70 mb-8">Connect your Google Calendar for automated meeting scheduling</p>
          <SettingsContent initialTab="calendar" calendarSection="google" />
        </div>
      );
    }

    if (selectedSection === 'calendly') {
      return (
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Calendly Link</h1>
          <p className="text-white/70 mb-8">Add your Calendly scheduling link for self-service booking</p>
          <SettingsContent initialTab="calendar" calendarSection="calendly" />
        </div>
      );
    }

    if (selectedSection === 'privacy') {
      return (
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-white/70 mb-8">Review our privacy policy</p>
          <SettingsContent initialTab="privacy" />
        </div>
      );
    }

    if (selectedSection === 'memory') {
      return (
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Keyword Memory</h1>
          <p className="text-white/70 mb-8">Manage keywords and training data for your agents</p>
          <KeywordMemoryPanel />
        </div>
      );
    }

    // Custom renders for billing sections
    if (selectedSection === 'payment-methods') {
      return (
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Payment Methods</h1>
          <p className="text-white/70 mb-8">Manage your credit cards and payment information</p>
          <BillingContent />
        </div>
      );
    }

    if (selectedSection === 'budget') {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Budget & Limits</h1>
            <p className="text-white/70 mb-8">Set monthly spending limits and track API usage</p>
          </div>
          <RateLimitSettings />
        </div>
      );
    }

    if (selectedSection === 'payment-history') {
      return (
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Payment History</h1>
          <p className="text-white/70 mb-8">View your transaction history and invoices</p>
          <PaymentHistory />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="h-screen bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <div className="border-b border-white/20 bg-black/20 backdrop-blur-sm flex-shrink-0">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-8 flex-1 overflow-hidden flex gap-6">
          {/* Vertical Sidebar - Fixed */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 space-y-2 h-full overflow-y-auto">
              {categories.map((category) => {
                const CategoryIcon = category.icon;
                const isExpanded = expandedCategory === category.id;

                return (
                  <div key={category.id}>
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/10 transition-all text-white group"
                    >
                      <div className="flex items-center gap-3">
                        <CategoryIcon className="w-5 h-5" />
                        <span className="font-semibold">{category.label}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDownIcon className="w-4 h-4 transition-transform" />
                      ) : (
                        <ChevronRightIcon className="w-4 h-4 transition-transform" />
                      )}
                    </button>

                    {/* Sections */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-4 mt-1 space-y-1 border-l border-white/20 pl-4">
                            {category.sections.map((section) => {
                              const SectionIcon = section.icon;
                              const isSelected = selectedSection === section.id;

                              return (
                                <button
                                  key={section.id}
                                  onClick={() => setSelectedSection(section.id)}
                                  className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left ${
                                    isSelected
                                      ? 'bg-white/20 text-white font-medium'
                                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                                  }`}
                                >
                                  <SectionIcon className="w-4 h-4" />
                                  <span className="text-sm">{section.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Content - Scrollable */}
          <div className="flex-1 overflow-y-auto pr-4 w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedSection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
      </div>

      {/* Company Profile Modal */}
      {showCompanyProfileModal && (
        <CompanyProfileModal 
          open={showCompanyProfileModal}
          onClose={() => setShowCompanyProfileModal(false)} 
        />
      )}
    </div>
  );
}
