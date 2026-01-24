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
        { id: 'budget', label: 'Credits & Usage', icon: CurrencyDollarIcon },
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
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Credits & Usage</h1>
            <p className="text-white/70 mb-8">Manage your credit balance and track API usage</p>
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
        <div className="border-b border-white/20 flex-shrink-0">
          <div className="px-4 sm:px-6 py-4">
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-4">Settings</h1>
            
            {/* Horizontal Main Tabs */}
            <div className="flex items-center gap-2 border-b border-[#4FD1FF]/20 pb-2">
              {categories.map((category) => {
                const CategoryIcon = category.icon;
                const isActive = expandedCategory === category.id;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setExpandedCategory(category.id);
                      // Auto-select first section in category
                      setSelectedSection(category.sections[0].id);
                    }}
                    className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                      isActive
                        ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-b-2 border-[#4FD1FF]'
                        : 'text-[#8FA6C1] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <CategoryIcon className="w-4 h-4" />
                    {category.label}
                  </button>
                );
              })}
            </div>
            
            {/* Sub-tabs for selected category */}
            {expandedCategory && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {categories
                  .find((cat) => cat.id === expandedCategory)
                  ?.sections.map((section) => {
                    const SectionIcon = section.icon;
                    const isSelected = selectedSection === section.id;
                    
                    return (
                      <button
                        key={section.id}
                        onClick={() => setSelectedSection(section.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <SectionIcon className="w-3.5 h-3.5" />
                        {section.label}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
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
