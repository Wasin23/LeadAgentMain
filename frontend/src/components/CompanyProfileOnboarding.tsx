'use client';

import { useState, useRef } from 'react';
import { 
  BuildingOfficeIcon, 
  SparklesIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import api from '../lib/api';
import AdminChatbot from './AdminChatbot';

interface CompanyProfile {
  companyName: string;
  industry: string;
  services: string;
  targetMarket: string;
  companySize: string;
  description: string;
}

interface CompanyProfileOnboardingProps {
  onComplete: () => void;
}

export default function CompanyProfileOnboarding({ onComplete }: CompanyProfileOnboardingProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [profile, setProfile] = useState({
    companyName: '',
    industry: '',
    services: '',
    targetMarket: '',
    companySize: '',
    description: '',
    logo: '',
    website: '',
    linkedinProfile: '',
    location: '',
    phone: '',
    email: '',
    tagline: '',
    founded: '',
    employees: '',
    coreOffering: '',
    keyAdvantages: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleWebsiteScrape = async () => {
    if (!websiteUrl.trim()) {
      alert('Please enter a website URL');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await api.post('/api/company-profile/scrape-website', {
        url: websiteUrl
      });

      if (response.data.success && response.data.profile) {
        setProfile({
          companyName: response.data.profile.companyName || '',
          industry: response.data.profile.industry || '',
          services: response.data.profile.services || '',
          targetMarket: response.data.profile.targetMarket || '',
          companySize: response.data.profile.companySize || '',
          description: response.data.profile.description || '',
          logo: response.data.profile.logo || '',
          website: response.data.profile.website || '',
          linkedinProfile: response.data.profile.linkedinProfile || '',
          location: response.data.profile.location || '',
          phone: response.data.profile.phone || '',
          email: response.data.profile.email || '',
          tagline: response.data.profile.tagline || '',
          founded: response.data.profile.founded || '',
          employees: response.data.profile.employees || '',
          coreOffering: response.data.profile.coreOffering || '',
          keyAdvantages: response.data.profile.keyAdvantages || '',
        });
        alert('Website scraped! Review and edit the extracted information below.');
      }
    } catch (error: any) {
      console.error('Error scraping website:', error);
      alert('Failed to scrape website. Please fill out the form manually.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsProcessing(true);

    try {
      let content = '';
      const isImage = file.type.startsWith('image/');
      
      if (isImage) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        content = await base64Promise;
      } else {
        content = await file.text();
      }
      
      const response = await api.post('/api/company-profile/analyze', {
        content: content,
        fileName: file.name,
        isImage: isImage
      });

      if (response.data.success && response.data.profile) {
        setProfile({
          companyName: response.data.profile.companyName || '',
          industry: response.data.profile.industry || '',
          services: response.data.profile.services || '',
          targetMarket: response.data.profile.targetMarket || '',
          companySize: response.data.profile.companySize || '',
          description: response.data.profile.description || '',
          logo: response.data.profile.logo || '',
          website: response.data.profile.website || '',
          linkedinProfile: response.data.profile.linkedinProfile || '',
          location: response.data.profile.location || '',
          phone: response.data.profile.phone || '',
          email: response.data.profile.email || '',
          tagline: response.data.profile.tagline || '',
          founded: response.data.profile.founded || '',
          employees: response.data.profile.employees || '',
          coreOffering: response.data.profile.coreOffering || '',
          keyAdvantages: response.data.profile.keyAdvantages || '',
        });
        alert('Document analyzed! Review and edit the extracted information below.');
      }
    } catch (error: any) {
      console.error('Error analyzing file:', error);
      alert('Failed to analyze file. Please fill out the form manually.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!profile.companyName || !profile.industry || !profile.services) {
      alert('Please fill out at least Company Name, Industry, and Services');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await api.post('/api/company-profile/save', {
        profile,
        recommendedPreset: null
      });

      if (response.data.success) {
        onComplete();
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <BuildingOfficeIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-neutral-900 mb-3">Company Profile Setup</h1>
            <p className="text-lg text-neutral-600">Fill out the form or let AI extract your information automatically</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Manual Form - Takes 2/3 width */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-xl overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600">
                <h2 className="text-xl font-semibold text-white">Company Information</h2>
              </div>
              
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Company Name <span className="text-red-500">*</span></label>
                  <input className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.companyName} onChange={(e) => setProfile({...profile, companyName: e.target.value})} placeholder="Your Company Name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Tagline</label>
                  <input className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.tagline} onChange={(e) => setProfile({...profile, tagline: e.target.value})} placeholder="Your company's tagline" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Company Description</label>
                  <textarea className="w-full px-3 py-2 border border-neutral-300 rounded-lg" rows={4} value={profile.description} onChange={(e) => setProfile({...profile, description: e.target.value})} placeholder="Tell your company's story..." />
                </div>
                
                <h4 className="text-sm font-semibold text-neutral-900 pt-2 border-t border-neutral-200">Contact Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Website</label>
                    <input type="url" className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.website} onChange={(e) => setProfile({...profile, website: e.target.value})} placeholder="https://yourcompany.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">LinkedIn Profile</label>
                    <input type="url" className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.linkedinProfile} onChange={(e) => setProfile({...profile, linkedinProfile: e.target.value})} placeholder="https://linkedin.com/company/your-company" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                    <input type="email" className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.email} onChange={(e) => setProfile({...profile, email: e.target.value})} placeholder="contact@company.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
                    <input type="tel" className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.phone} onChange={(e) => setProfile({...profile, phone: e.target.value})} placeholder="+1 (555) 000-0000" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Location</label>
                    <input className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.location} onChange={(e) => setProfile({...profile, location: e.target.value})} placeholder="City, Country" />
                  </div>
                </div>

                <h4 className="text-sm font-semibold text-neutral-900 pt-2 border-t border-neutral-200">Company Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Industry</label>
                    <input className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.industry} onChange={(e) => setProfile({...profile, industry: e.target.value})} placeholder="e.g., Technology, Healthcare" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Founded Year</label>
                    <input className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.founded} onChange={(e) => setProfile({...profile, founded: e.target.value})} placeholder="2020" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Number of Employees</label>
                    <input className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.employees} onChange={(e) => setProfile({...profile, employees: e.target.value})} placeholder="25" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Company Size</label>
                    <select className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.companySize} onChange={(e) => setProfile({...profile, companySize: e.target.value})}>
                      <option value="">Select size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="501-1000">501-1000 employees</option>
                      <option value="1000+">1000+ employees</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Target Market</label>
                    <input className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.targetMarket} onChange={(e) => setProfile({...profile, targetMarket: e.target.value})} placeholder="e.g., B2B SaaS companies in North America" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Services / Products</label>
                    <textarea className="w-full px-3 py-2 border border-neutral-300 rounded-lg" rows={3} value={profile.services} onChange={(e) => setProfile({...profile, services: e.target.value})} placeholder="Describe your main offerings..." />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Core Offering</label>
                    <input className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.coreOffering} onChange={(e) => setProfile({...profile, coreOffering: e.target.value})} placeholder="e.g., AI-powered sales automation platform" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Key Advantages</label>
                    <input className="w-full px-3 py-2 border border-neutral-300 rounded-lg" value={profile.keyAdvantages} onChange={(e) => setProfile({...profile, keyAdvantages: e.target.value})} placeholder="e.g., Automated, personalized, scalable" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end px-6 py-4 border-t border-neutral-200 bg-neutral-50">
                <button onClick={handleSave} disabled={isProcessing} className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 font-semibold">
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-5 h-5" />
                      Save & Continue
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Upload Options - Takes 1/3 width */}
            <div className="lg:col-span-1 space-y-4">
              {/* Upload Document */}
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl overflow-hidden">
                <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border-b border-neutral-200">
                  <div className="text-center">
                    <CloudArrowUpIcon className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">Upload Document</h3>
                    <p className="text-sm text-neutral-600 mb-4">PDF, Word, PNG, JPG</p>
                    {uploadedFileName && (
                      <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                        <CheckCircleIcon className="w-4 h-4" />
                        {uploadedFileName}
                      </div>
                    )}
                    <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full px-6 py-2 !bg-blue-600 text-white rounded-lg hover:!bg-blue-700 transition-colors disabled:opacity-50 font-medium">
                      {isProcessing ? 'Analyzing...' : 'Choose File'}
                    </button>
                    <input ref={fileInputRef} type="file" accept=".pdf,.txt,.doc,.docx,.md,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
                  </div>
                </div>
              </div>

              {/* Website Scraper */}
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl overflow-hidden">
                <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-b border-neutral-200">
                  <div>
                    <GlobeAltIcon className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2 text-center">Find from Website</h3>
                    <p className="text-sm text-neutral-600 mb-4 text-center">Enter your company URL</p>
                    <input 
                      type="url" 
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://yourcompany.com"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm mb-3"
                    />
                    <button onClick={handleWebsiteScrape} disabled={isProcessing} className="w-full px-4 py-2 !bg-purple-600 text-white rounded-lg hover:!bg-purple-700 transition-colors disabled:opacity-50 font-medium text-sm">
                      Find
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AdminChatbot />
    </>
  );
}
 