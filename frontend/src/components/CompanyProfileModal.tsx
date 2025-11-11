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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h3 className="text-lg font-semibold">Edit Company Profile</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-neutral-100">
            <XMarkIcon className="w-5 h-5 text-neutral-600" />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-blue-600"></div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Company Name</label>
                <input className="w-full px-3 py-2 border rounded-lg" value={profile.companyName || ''} onChange={(e)=>setProfile({...profile, companyName: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Industry</label>
                <input className="w-full px-3 py-2 border rounded-lg" value={profile.industry || ''} onChange={(e)=>setProfile({...profile, industry: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Services / Products</label>
                <textarea className="w-full px-3 py-2 border rounded-lg" rows={3} value={profile.services || ''} onChange={(e)=>setProfile({...profile, services: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Target Market</label>
                  <input className="w-full px-3 py-2 border rounded-lg" value={profile.targetMarket || ''} onChange={(e)=>setProfile({...profile, targetMarket: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Company Size</label>
                  <input className="w-full px-3 py-2 border rounded-lg" value={profile.companySize || ''} onChange={(e)=>setProfile({...profile, companySize: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Short Description</label>
                <textarea className="w-full px-3 py-2 border rounded-lg" rows={4} value={profile.description || ''} onChange={(e)=>setProfile({...profile, description: e.target.value})} />
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
          <button onClick={onClose} className="px-4 py-2 bg-neutral-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
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
