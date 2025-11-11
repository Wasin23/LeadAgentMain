'use client';

import { useState, useEffect } from 'react';
import { 
  BuildingOfficeIcon, 
  PencilIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import CompanyProfileModal from './CompanyProfileModal';

interface CompanyProfile {
  companyName: string;
  industry: string;
  services: string;
  targetMarket: string;
  companySize: string;
  description: string;
}

interface CompanyProfileCardProps {
  onEdit?: () => void;
}

export default function CompanyProfileCard({ onEdit }: CompanyProfileCardProps) {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.get('/api/company-profile/profile');
      if (response.data.profile) {
        setProfile(response.data.profile);
      }
    } catch (error) {
      console.error('Error loading company profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-neutral-200 rounded w-1/4"></div>
          <div className="h-8 bg-neutral-200 rounded w-1/2"></div>
          <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8 text-center">
        <BuildingOfficeIcon className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          No Company Profile
        </h3>
        <p className="text-neutral-600 mb-4">
          Set up your company profile to get started with lead generation
        </p>
        <button
          onClick={onEdit}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Create Profile
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <BuildingOfficeIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Company Profile</h3>
            <p className="text-sm text-neutral-600">Your business information</p>
          </div>
        </div>
        <>
          <button
            onClick={() => setOpenModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            Edit
          </button>
          <CompanyProfileModal open={openModal} onClose={() => setOpenModal(false)} onSaved={async () => { await loadProfile(); }} />
        </>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <div>
          <h4 className="text-2xl font-bold text-neutral-900 mb-1">{profile.companyName}</h4>
          <p className="text-neutral-600">{profile.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-1">Industry</p>
            <p className="text-sm text-neutral-900 font-medium">{profile.industry}</p>
          </div>
          
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-1">Company Size</p>
            <p className="text-sm text-neutral-900 font-medium">{profile.companySize}</p>
          </div>
          
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-1">Services</p>
            <p className="text-sm text-neutral-900">{profile.services}</p>
          </div>
          
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-1">Target Market</p>
            <p className="text-sm text-neutral-900">{profile.targetMarket}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
