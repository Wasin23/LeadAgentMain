'use client';

import { useEffect, useState, useRef } from 'react';
import { 
  BuildingOfficeIcon, 
  PencilIcon, 
  CameraIcon,
  MapPinIcon,
  LinkIcon,
  PhoneIcon,
  EnvelopeIcon,
  CheckBadgeIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface Props {
  onEdit?: () => void;
}

export default function CompanyProfileInstagram({ onEdit }: Props) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/company-profile/profile');
      if (res.data.profile) {
        setProfile(res.data.profile);
        setEditedProfile(res.data.profile);
      } else {
        // Initialize empty profile
        const emptyProfile = {
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
        };
        setProfile(emptyProfile);
        setEditedProfile(emptyProfile);
        setIsEditing(true); // Auto-open edit mode if no profile
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setUploadingImage(true);
    try {
      // Create image element to load and resize
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (event) => {
        img.src = event.target?.result as string;
      };

      img.onload = () => {
        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          alert('Failed to create canvas context');
          setUploadingImage(false);
          return;
        }

        // Calculate dimensions (max 800x800 to keep file size reasonable)
        const maxSize = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        // Set canvas size and draw resized image
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 (JPEG with 0.9 quality for smaller file size)
        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.9);
        setEditedProfile({ ...editedProfile, logo: resizedBase64 });
        setUploadingImage(false);
      };

      img.onerror = () => {
        alert('Failed to load image');
        setUploadingImage(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Failed to upload image');
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log('[COMPANY PROFILE] Saving profile:', editedProfile);
      const response = await api.post('/api/company-profile/save', {
        profile: editedProfile,
        recommendedPreset: null
      });
      console.log('[COMPANY PROFILE] Save response:', response.data);
      
      if (response.data.success) {
        setProfile(editedProfile);
        setIsEditing(false);
        alert('Profile saved successfully!');
      } else {
        console.error('[COMPANY PROFILE] Save failed:', response.data);
        alert('Failed to save profile: ' + (response.data.error || 'Unknown error'));
      }
    } catch (err: any) {
      console.error('[COMPANY PROFILE] Error saving profile:', err);
      console.error('[COMPANY PROFILE] Error details:', err.response?.data);
      alert('Error saving profile: ' + (err.response?.data?.error || err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden">
        <div className="animate-pulse">
          <div className="h-48 bg-gradient-to-br from-neutral-200 to-neutral-300"></div>
          <div className="p-8 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-neutral-200"></div>
              <div className="flex-1 space-y-2">
                <div className="h-6 bg-neutral-200 rounded w-1/2"></div>
                <div className="h-4 bg-neutral-200 rounded w-1/3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentProfile = isEditing ? editedProfile : profile;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden">
        {/* Header/Cover Image */}
        <div className="relative h-48 bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600">
          <div className="absolute inset-0 bg-black/20"></div>
          <button
            onClick={() => setIsEditing(true)}
            className="absolute top-4 right-4 p-2 bg-black/30 backdrop-blur-sm rounded-lg hover:bg-black/50 transition-all shadow-lg"
          >
            <PencilIcon className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Profile Content */}
        <div className="relative px-8 pb-8">
          {/* Profile Picture */}
          <div className="relative -mt-16 mb-6">
            <div className="relative inline-block">
              <div className="w-32 h-32 rounded-full border-4 border-white bg-white shadow-xl overflow-hidden">
                {currentProfile?.logo ? (
                  <img
                    src={currentProfile.logo}
                    alt="Company Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <BuildingOfficeIcon className="w-12 h-12 text-neutral-400" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Company Info */}
          <div className="space-y-6">
            {/* Name & Title */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold text-neutral-900">
                  {currentProfile?.companyName || 'Company Name'}
                </h1>
                {currentProfile?.companyName && (
                  <CheckBadgeIcon className="w-7 h-7 text-blue-500" />
                )}
              </div>
              {currentProfile?.tagline && (
                <p className="text-lg text-neutral-600">{currentProfile.tagline}</p>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-8 py-4 border-y border-neutral-200">
              <div className="text-center">
                <p className="text-2xl font-bold text-neutral-900">{currentProfile?.employees || '0'}</p>
                <p className="text-sm text-neutral-600">Employees</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-neutral-900">{currentProfile?.founded || 'N/A'}</p>
                <p className="text-sm text-neutral-600">Founded</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-neutral-900">{currentProfile?.companySize || 'N/A'}</p>
                <p className="text-sm text-neutral-600">Size</p>
              </div>
            </div>

            {/* Description/Bio */}
            {currentProfile?.description ? (
              <div>
                <p className="text-neutral-700 leading-relaxed">{currentProfile.description}</p>
              </div>
            ) : null}

            {/* Contact & Info */}
            <div className="space-y-3">
              {currentProfile?.website && (
                <div className="flex items-center gap-3 text-neutral-700">
                  <LinkIcon className="w-5 h-5 text-neutral-400" />
                  <a href={currentProfile.website} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
                    {currentProfile.website}
                  </a>
                </div>
              )}
              {currentProfile?.linkedinProfile && (
                <div className="flex items-center gap-3 text-neutral-700">
                  <svg className="w-5 h-5 text-neutral-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  <a href={currentProfile.linkedinProfile} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
                    LinkedIn Profile
                  </a>
                </div>
              )}
              {currentProfile?.location && (
                <div className="flex items-center gap-3 text-neutral-700">
                  <MapPinIcon className="w-5 h-5 text-neutral-400" />
                  <span>{currentProfile.location}</span>
                </div>
              )}
              {currentProfile?.email && (
                <div className="flex items-center gap-3 text-neutral-700">
                  <EnvelopeIcon className="w-5 h-5 text-neutral-400" />
                  <a href={`mailto:${currentProfile.email}`} className="hover:text-blue-600 transition-colors">
                    {currentProfile.email}
                  </a>
                </div>
              )}
              {currentProfile?.phone && (
                <div className="flex items-center gap-3 text-neutral-700">
                  <PhoneIcon className="w-5 h-5 text-neutral-400" />
                  <a href={`tel:${currentProfile.phone}`} className="hover:text-blue-600 transition-colors">
                    {currentProfile.phone}
                  </a>
                </div>
              )}
              {currentProfile?.industry && (
                <div className="flex items-center gap-3 text-neutral-700">
                  <GlobeAltIcon className="w-5 h-5 text-neutral-400" />
                  <span>{currentProfile.industry}</span>
                </div>
              )}
            </div>

            {/* Services/Products Section */}
            {currentProfile?.services && (
              <div className="pt-4 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">Services & Products</h3>
                <p className="text-neutral-700">{currentProfile.services}</p>
              </div>
            )}

            {/* Target Market Section */}
            {currentProfile?.targetMarket && (
              <div className="pt-4 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">Target Market</h3>
                <p className="text-neutral-700">{currentProfile.targetMarket}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-neutral-900">Edit Company Profile</h3>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="text-neutral-400 hover:text-neutral-600 transition-colors p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Profile Picture Upload */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-neutral-200 bg-white shadow-lg overflow-hidden">
                    {editedProfile?.logo ? (
                      <img
                        src={editedProfile.logo}
                        alt="Company Logo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                        <BuildingOfficeIcon className="w-10 h-10 text-neutral-400" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="absolute bottom-0 right-0 p-2 bg-indigo-600 rounded-full text-white hover:bg-indigo-700 transition-all shadow-lg"
                  >
                    <CameraIcon className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
                <div>
                  <h4 className="font-medium text-neutral-900 mb-1">Company Logo</h4>
                  <p className="text-sm text-neutral-600">Upload a square image (recommended: 400x400px)</p>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Company Name *</label>
                  <input
                    type="text"
                    value={editedProfile.companyName || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, companyName: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your Company Name"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Tagline</label>
                  <input
                    type="text"
                    value={editedProfile.tagline || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, tagline: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your company's tagline"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Company Description</label>
                  <textarea
                    value={editedProfile.description || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Tell your company's story..."
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h4 className="text-lg font-semibold text-neutral-900 mb-4">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Website</label>
                    <input
                      type="url"
                      value={editedProfile.website || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, website: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://yourcompany.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">LinkedIn Profile</label>
                    <input
                      type="url"
                      value={editedProfile.linkedinProfile || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, linkedinProfile: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://linkedin.com/company/your-company"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={editedProfile.email || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="contact@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={editedProfile.phone || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={editedProfile.location || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, location: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="City, Country"
                    />
                  </div>
                </div>
              </div>

              {/* Company Details */}
              <div>
                <h4 className="text-lg font-semibold text-neutral-900 mb-4">Company Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Industry</label>
                    <input
                      type="text"
                      value={editedProfile.industry || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, industry: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Technology, Healthcare"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Founded Year</label>
                    <input
                      type="text"
                      value={editedProfile.founded || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, founded: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="2020"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Number of Employees</label>
                    <input
                      type="text"
                      value={editedProfile.employees || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, employees: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="25"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Company Size</label>
                    <select
                      value={editedProfile.companySize || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, companySize: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="501-1000">501-1000 employees</option>
                      <option value="1000+">1000+ employees</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Target Market</label>
                    <input
                      type="text"
                      value={editedProfile.targetMarket || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, targetMarket: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., B2B SaaS companies in North America"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Services / Products</label>
                    <textarea
                      value={editedProfile.services || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, services: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Describe your main offerings..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Core Offering</label>
                    <input
                      type="text"
                      value={editedProfile.coreOffering || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, coreOffering: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., AI-powered sales automation platform"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Key Advantages</label>
                    <input
                      type="text"
                      value={editedProfile.keyAdvantages || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, keyAdvantages: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Automated, personalized, scalable"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-neutral-50 border-t border-neutral-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-6 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ backgroundColor: '#2563eb', color: 'white' }}
                className="px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
