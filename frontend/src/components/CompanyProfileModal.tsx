'use client';

import { useEffect, useState } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function CompanyProfileModal({ open, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>({
    companyName: '',
    industry: '',
    services: '',
    targetMarket: '',
    companySize: '',
    description: ''
  });

  useEffect(() => {
    if (open) loadProfile();
  }, [open]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/company-profile/profile');
      if (res.data.profile) setProfile(res.data.profile);
    } catch (err) {
      console.error('Error loading profile in modal:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await api.post('/api/company-profile/save', {
        profile,
        recommendedPreset: null
      });
      if (response.data.success) {
        onSaved && onSaved();
        onClose();
      } else {
        alert('Failed to save profile');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-[#1B2F52]/95 backdrop-blur-md border border-[#4FD1FF]/30 rounded-xl shadow-2xl shadow-[#4FD1FF]/10 w-full max-w-2xl z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#4FD1FF]/20">
          <h3 className="text-lg font-semibold text-white">Edit Company Profile</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-[#2A4472] transition-colors">
            <XMarkIcon className="w-5 h-5 text-[#A3B4CC] hover:text-white" />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-4 border-[#4FD1FF]/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#4FD1FF] border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-white mb-1">Company Name</label>
                <input className="w-full px-3 py-2 bg-[#12213B] border border-[#4FD1FF]/30 text-white placeholder-[#8FA6C1] rounded-lg focus:border-[#4FD1FF] focus:ring-2 focus:ring-[#4FD1FF]/20 focus:outline-none" value={profile.companyName || ''} onChange={(e)=>setProfile({...profile, companyName: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Industry</label>
                <input className="w-full px-3 py-2 bg-[#12213B] border border-[#4FD1FF]/30 text-white placeholder-[#8FA6C1] rounded-lg focus:border-[#4FD1FF] focus:ring-2 focus:ring-[#4FD1FF]/20 focus:outline-none" value={profile.industry || ''} onChange={(e)=>setProfile({...profile, industry: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Services / Products</label>
                <textarea className="w-full px-3 py-2 bg-[#12213B] border border-[#4FD1FF]/30 text-white placeholder-[#8FA6C1] rounded-lg focus:border-[#4FD1FF] focus:ring-2 focus:ring-[#4FD1FF]/20 focus:outline-none" rows={3} value={profile.services || ''} onChange={(e)=>setProfile({...profile, services: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Target Market</label>
                  <input className="w-full px-3 py-2 bg-[#12213B] border border-[#4FD1FF]/30 text-white placeholder-[#8FA6C1] rounded-lg focus:border-[#4FD1FF] focus:ring-2 focus:ring-[#4FD1FF]/20 focus:outline-none" value={profile.targetMarket || ''} onChange={(e)=>setProfile({...profile, targetMarket: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Company Size</label>
                  <input className="w-full px-3 py-2 bg-[#12213B] border border-[#4FD1FF]/30 text-white placeholder-[#8FA6C1] rounded-lg focus:border-[#4FD1FF] focus:ring-2 focus:ring-[#4FD1FF]/20 focus:outline-none" value={profile.companySize || ''} onChange={(e)=>setProfile({...profile, companySize: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Short Description</label>
                <textarea className="w-full px-3 py-2 bg-[#12213B] border border-[#4FD1FF]/30 text-white placeholder-[#8FA6C1] rounded-lg focus:border-[#4FD1FF] focus:ring-2 focus:ring-[#4FD1FF]/20 focus:outline-none" rows={4} value={profile.description || ''} onChange={(e)=>setProfile({...profile, description: e.target.value})} />
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#4FD1FF]/20">
          <button onClick={onClose} className="px-4 py-2 bg-[#2A4472] text-[#A3B4CC] hover:text-white rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-gradient-to-r from-[#4FD1FF] via-[#55C7F7] to-[#6BE3FF] text-[#0F1E35] rounded-lg hover:shadow-lg hover:shadow-[#4FD1FF]/30 transition-all flex items-center gap-2 disabled:opacity-50">
            {saving ? 'Saving...' : (
              <>
                <CheckIcon className="w-4 h-4" />
                Save Profile
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
