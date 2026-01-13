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
import CRMDashboard from '@/components/CRMDashboard';
import CompanyProfileInstagram from '@/components/CompanyProfileInstagram';
import AppLayout from '@/components/AppLayout';

type SettingSection = 
  | 'profile' 
  | 'company' 
  | 'crm'
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const categories: SettingCategory[] = [
    {
      id: 'account',
      label: 'Account',
      icon: UserCircleIcon,
      sections: [
        { id: 'profile', label: 'Profile', icon: UserCircleIcon },
        { id: 'company', label: 'Company Profile', icon: BuildingOfficeIcon },
        { id: 'crm', label: 'CRM Integrations', icon: LinkIcon }
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
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">User Profile</h1>
          <p className="text-white/70 mb-8">View your account information</p>
          <SettingsContent initialTab="profile" />
        </div>
      );
    }

    if (selectedSection === 'company') {
      return (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Company Profile</h1>
          <p className="text-white/70 mb-8">Manage your company information for email responses</p>
          <CompanyProfileInstagram />
        </div>
      );
    }

    if (selectedSection === 'crm') {
      return (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">CRM Integrations</h1>
          <p className="text-white/70 mb-8">Connect and manage your CRM systems</p>
          <CRMDashboard />
        </div>
      );
    }

    if (selectedSection === 'gmail') {
      return (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Gmail Connection</h1>
          <p className="text-white/70 mb-8">Connect and manage your Gmail accounts</p>
          <SettingsContent initialTab="email" />
        </div>
      );
    }

    if (selectedSection === 'email-preferences') {
      return (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Email Preferences</h1>
          <p className="text-white/70 mb-8">Configure default email settings and AI response behavior</p>
          <SettingsContent initialTab="emailPreferences" />
        </div>
      );
    }

    if (selectedSection === 'google-calendar') {
      return (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Google Calendar</h1>
          <p className="text-white/70 mb-8">Connect your Google Calendar for automated meeting scheduling</p>
          <SettingsContent initialTab="calendar" calendarSection="google" />
        </div>
      );
    }

    if (selectedSection === 'calendly') {
      return (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Calendly Link</h1>
          <p className="text-white/70 mb-8">Add your Calendly scheduling link for self-service booking</p>
          <SettingsContent initialTab="calendar" calendarSection="calendly" />
        </div>
      );
    }

    if (selectedSection === 'privacy') {
      return (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-white/70 mb-8">Review our privacy policy</p>
          <SettingsContent initialTab="privacy" />
        </div>
      );
    }

    if (selectedSection === 'memory') {
      return (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Keyword Memory</h1>
          <p className="text-white/70 mb-8">Manage keywords and training data for your agents</p>
          <KeywordMemoryPanel />
        </div>
      );
    }

    // Custom renders for billing sections
    if (selectedSection === 'payment-methods') {
      return (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Payment Methods</h1>
          <p className="text-white/70 mb-8">Manage your credit cards and payment information</p>
          <BillingContent />
        </div>
      );
    }

    if (selectedSection === 'budget') {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Budget & Limits</h1>
            <p className="text-white/70 mb-8">Set monthly spending limits and track API usage</p>
          </div>
          <RateLimitSettings />
        </div>
      );
    }

    if (selectedSection === 'payment-history') {
      return (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Payment History</h1>
          <p className="text-white/70 mb-8">View your transaction history and invoices</p>
          <PaymentHistory />
        </div>
      );
    }

    return null;
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header - Fixed */}
        <div className="border-b border-white/20 bg-black/20 backdrop-blur-sm flex-shrink-0">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Settings</h1>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 py-4 sm:py-8 flex-1 overflow-hidden flex gap-6">
          {/* Vertical Sidebar - Hidden on mobile, shown as dropdown */}
          <div className={`fixed md:relative inset-0 md:inset-auto z-50 md:z-auto ${showMobileMenu ? 'block' : 'hidden md:block'}`}>
            {/* Mobile overlay */}
            <div 
              className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMobileMenu(false)}
            />
            {/* Sidebar content */}
            <div className="fixed md:relative left-0 top-0 bottom-0 w-72 md:w-72 flex-shrink-0 md:flex-shrink-0">
              <div className="bg-white/10 backdrop-blur-md rounded-none md:rounded-2xl border-r md:border border-white/20 p-4 space-y-2 h-full overflow-y-auto">
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
                                  onClick={() => {
                                    setSelectedSection(section.id);
                                    setShowMobileMenu(false); // Close mobile menu on selection
                                  }}
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
        </div>

          {/* Main Content - Scrollable */}
          <div className="flex-1 overflow-y-auto pr-0 sm:pr-4 w-full">
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
    </AppLayout>
  );
}
