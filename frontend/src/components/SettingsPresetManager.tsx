'use client';

import { useState, useEffect } from 'react';
import { 
  Cog6ToothIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface SettingsPreset {
  id: string;
  name: string;
  targetIndustries: string[];
  targetPositions: string[];
  companySizeMin: number;
  companySizeMax: number;
  leadLimit: number;
  isDefault?: boolean;
}

interface Props {
  onManageClick?: () => void;
  startWithCreate?: boolean;
}

export default function SettingsPresetManager({ onManageClick, startWithCreate = false }: Props) {
  const [presets, setPresets] = useState<SettingsPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(startWithCreate);
  const [newPreset, setNewPreset] = useState<Partial<SettingsPreset>>({
    name: '',
    targetIndustries: [],
    targetPositions: [],
    companySizeMin: 50,
    companySizeMax: 500,
    leadLimit: 10
  });
  const [industryInput, setIndustryInput] = useState('');
  const [positionInput, setPositionInput] = useState('');
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);

  // Common industries and positions for suggestions
  const commonIndustries = [
    'Technology', 'Healthcare', 'Finance', 'E-commerce', 'SaaS',
    'Manufacturing', 'Retail', 'Education', 'Real Estate', 'Marketing',
    'Consulting', 'Media', 'Telecommunications', 'Energy', 'Insurance'
  ];

  const commonPositions = [
    'CEO', 'CTO', 'CFO', 'CMO', 'COO',
    'VP of Sales', 'VP of Marketing', 'VP of Engineering',
    'Director of Sales', 'Director of Marketing', 'Director of Engineering',
    'Sales Manager', 'Product Manager', 'Engineering Manager',
    'Founder', 'Co-Founder', 'Partner', 'Owner'
  ];

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const response = await api.get('/api/settings/presets');
      setPresets(response.data.presets || []);
    } catch (error) {
      console.error('Error loading presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePreset = async () => {
    if (!newPreset.name?.trim()) {
      alert('Please enter a preset name');
      return;
    }

    try {
      const response = await api.post('/api/settings/presets', {
        ...newPreset,
        targetIndustries: newPreset.targetIndustries?.filter(i => i.trim()),
        targetPositions: newPreset.targetPositions?.filter(p => p.trim())
      });

      setPresets([...presets, response.data.preset]);
      setIsCreating(false);
      setNewPreset({
        name: '',
        targetIndustries: [],
        targetPositions: [],
        companySizeMin: 50,
        companySizeMax: 500,
        leadLimit: 10
      });
      setIndustryInput('');
      setPositionInput('');
    } catch (error) {
      console.error('Error creating preset:', error);
      alert('Failed to create preset');
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (!confirm('Are you sure you want to delete this preset?')) return;

    try {
      await api.delete(`/api/settings/presets/${id}`);
      setPresets(presets.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting preset:', error);
      alert('Failed to delete preset');
    }
  };

  const addIndustry = (industry: string) => {
    if (industry.trim() && !newPreset.targetIndustries?.includes(industry)) {
      setNewPreset({
        ...newPreset,
        targetIndustries: [...(newPreset.targetIndustries || []), industry.trim()]
      });
      setIndustryInput('');
      setShowIndustryDropdown(false);
    }
  };

  const removeIndustry = (industry: string) => {
    setNewPreset({
      ...newPreset,
      targetIndustries: newPreset.targetIndustries?.filter(i => i !== industry)
    });
  };

  const addPosition = (position: string) => {
    if (position.trim() && !newPreset.targetPositions?.includes(position)) {
      setNewPreset({
        ...newPreset,
        targetPositions: [...(newPreset.targetPositions || []), position.trim()]
      });
      setPositionInput('');
      setShowPositionDropdown(false);
    }
  };

  const removePosition = (position: string) => {
    setNewPreset({
      ...newPreset,
      targetPositions: newPreset.targetPositions?.filter(p => p !== position)
    });
  };

  const handleIndustryKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && industryInput.trim()) {
      e.preventDefault();
      addIndustry(industryInput);
    }
  };

  const handlePositionKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && positionInput.trim()) {
      e.preventDefault();
      addPosition(positionInput);
    }
  };

  const filteredIndustries = industryInput
    ? commonIndustries.filter(ind => 
        ind.toLowerCase().includes(industryInput.toLowerCase()) &&
        !newPreset.targetIndustries?.includes(ind)
      )
    : commonIndustries.filter(ind => !newPreset.targetIndustries?.includes(ind));

  const filteredPositions = positionInput
    ? commonPositions.filter(pos => 
        pos.toLowerCase().includes(positionInput.toLowerCase()) &&
        !newPreset.targetPositions?.includes(pos)
      )
    : commonPositions.filter(pos => !newPreset.targetPositions?.includes(pos));

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-neutral-200 rounded w-1/4"></div>
          <div className="h-8 bg-neutral-200 rounded"></div>
        </div>
      </div>
    );
  }

  // If modal-only mode (startWithCreate), render only the modal
  if (startWithCreate && isCreating) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onManageClick} />
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl z-10 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <h3 className="text-lg font-semibold">Create New Preset</h3>
            <button onClick={onManageClick} className="p-2 rounded hover:bg-neutral-100">
              <XMarkIcon className="w-5 h-5 text-neutral-600" />
            </button>
          </div>
          
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Preset Name *
              </label>
              <input
                type="text"
                value={newPreset.name}
                onChange={(e) => setNewPreset({ ...newPreset, name: e.target.value })}
                placeholder="e.g., Tech Startups, Enterprise Sales"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Target Industries
              </label>
              
              {newPreset.targetIndustries && newPreset.targetIndustries.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {newPreset.targetIndustries.map((industry) => (
                    <span
                      key={industry}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                    >
                      {industry}
                      <button
                        onClick={() => removeIndustry(industry)}
                        className="hover:bg-purple-200 rounded-full p-0.5"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  value={industryInput}
                  onChange={(e) => setIndustryInput(e.target.value)}
                  onFocus={() => setShowIndustryDropdown(true)}
                  onBlur={() => setTimeout(() => setShowIndustryDropdown(false), 200)}
                  onKeyPress={handleIndustryKeyPress}
                  placeholder="Search or type to add industry..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                
                {showIndustryDropdown && filteredIndustries.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredIndustries.map((industry) => (
                      <button
                        key={industry}
                        onClick={() => addIndustry(industry)}
                        className="w-full text-left px-3 py-2 hover:bg-purple-50 transition-colors"
                      >
                        {industry}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Target Positions
              </label>
              
              {newPreset.targetPositions && newPreset.targetPositions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {newPreset.targetPositions.map((position) => (
                    <span
                      key={position}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      {position}
                      <button
                        onClick={() => removePosition(position)}
                        className="hover:bg-blue-200 rounded-full p-0.5"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  value={positionInput}
                  onChange={(e) => setPositionInput(e.target.value)}
                  onFocus={() => setShowPositionDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPositionDropdown(false), 200)}
                  onKeyPress={handlePositionKeyPress}
                  placeholder="Search or type to add position..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                
                {showPositionDropdown && filteredPositions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredPositions.map((position) => (
                      <button
                        key={position}
                        onClick={() => addPosition(position)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors"
                      >
                        {position}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Min Company Size
                </label>
                <input
                  type="number"
                  value={newPreset.companySizeMin}
                  onChange={(e) => setNewPreset({ ...newPreset, companySizeMin: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Max Company Size
                </label>
                <input
                  type="number"
                  value={newPreset.companySizeMax}
                  onChange={(e) => setNewPreset({ ...newPreset, companySizeMax: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Lead Limit (per cycle)
              </label>
              <input
                type="number"
                value={newPreset.leadLimit || ''}
                onChange={(e) => setNewPreset({ ...newPreset, leadLimit: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 bg-white">
            <button
              onClick={onManageClick}
              className="px-4 py-2 text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await handleCreatePreset();
                if (onManageClick) onManageClick();
              }}
              style={{ backgroundColor: '#2563eb', color: 'white' }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
            >
              <CheckIcon className="w-4 h-4" />
              Create Preset
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Cog6ToothIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Settings Presets</h3>
              <p className="text-sm text-neutral-600">Manage agent configuration templates</p>
            </div>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New Preset
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Existing Presets */}
          {presets.length === 0 ? (
            <div className="text-center py-8 text-neutral-600">
              <p>No presets yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Preset Pills */}
              <div className="flex flex-wrap gap-2 mb-4">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-full text-sm font-medium text-purple-700"
                  >
                    {preset.name}
                    {preset.isDefault && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Manage Button */}
              <button
                onClick={onManageClick}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                Manage Presets →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Preset Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsCreating(false)} />
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h3 className="text-lg font-semibold">Create New Preset</h3>
              <button onClick={() => setIsCreating(false)} className="p-2 rounded hover:bg-neutral-100">
                <XMarkIcon className="w-5 h-5 text-neutral-600" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Preset Name *
                </label>
                <input
                  type="text"
                  value={newPreset.name}
                  onChange={(e) => setNewPreset({ ...newPreset, name: e.target.value })}
                  placeholder="e.g., Tech Startups, Enterprise Sales"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Target Industries
                </label>
                
                {/* Selected Industries - Bubbles */}
                {newPreset.targetIndustries && newPreset.targetIndustries.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {newPreset.targetIndustries.map((industry) => (
                      <span
                        key={industry}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                      >
                        {industry}
                        <button
                          onClick={() => removeIndustry(industry)}
                          className="hover:bg-purple-200 rounded-full p-0.5"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search Input */}
                <div className="relative">
                  <input
                    type="text"
                    value={industryInput}
                    onChange={(e) => setIndustryInput(e.target.value)}
                    onFocus={() => setShowIndustryDropdown(true)}
                    onBlur={() => setTimeout(() => setShowIndustryDropdown(false), 200)}
                    onKeyPress={handleIndustryKeyPress}
                    placeholder="Search or type to add industry..."
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  
                  {/* Suggestions Dropdown */}
                  {showIndustryDropdown && filteredIndustries.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredIndustries.map((industry) => (
                        <button
                          key={industry}
                          onClick={() => addIndustry(industry)}
                          className="w-full text-left px-3 py-2 hover:bg-purple-50 transition-colors"
                        >
                          {industry}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Target Positions
                </label>
                
                {/* Selected Positions - Bubbles */}
                {newPreset.targetPositions && newPreset.targetPositions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {newPreset.targetPositions.map((position) => (
                      <span
                        key={position}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                      >
                        {position}
                        <button
                          onClick={() => removePosition(position)}
                          className="hover:bg-blue-200 rounded-full p-0.5"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search Input */}
                <div className="relative">
                  <input
                    type="text"
                    value={positionInput}
                    onChange={(e) => setPositionInput(e.target.value)}
                    onFocus={() => setShowPositionDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPositionDropdown(false), 200)}
                    onKeyPress={handlePositionKeyPress}
                    placeholder="Search or type to add position..."
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  
                  {/* Suggestions Dropdown */}
                  {showPositionDropdown && filteredPositions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredPositions.map((position) => (
                        <button
                          key={position}
                          onClick={() => addPosition(position)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors"
                        >
                          {position}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Min Company Size
                  </label>
                  <input
                    type="number"
                    value={newPreset.companySizeMin}
                    onChange={(e) => setNewPreset({ ...newPreset, companySizeMin: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Max Company Size
                  </label>
                  <input
                    type="number"
                    value={newPreset.companySizeMax}
                    onChange={(e) => setNewPreset({ ...newPreset, companySizeMax: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Lead Limit (per cycle)
                </label>
                <input
                  type="number"
                  value={newPreset.leadLimit || ''}
                  onChange={(e) => setNewPreset({ ...newPreset, leadLimit: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 bg-white">
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePreset}
                style={{ backgroundColor: '#2563eb', color: 'white' }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
              >
                <CheckIcon className="w-4 h-4" />
                Create Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
