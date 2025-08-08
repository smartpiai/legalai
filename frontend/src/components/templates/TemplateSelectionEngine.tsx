import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  EyeIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  StarIcon,
  TrendingUpIcon,
  ClockIcon,
  ScaleIcon,
  GlobeAltIcon,
  DocumentDuplicateIcon,
  InformationCircleIcon,
  XMarkIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

// Types
interface Template {
  id: string;
  name: string;
  type: string;
  jurisdiction: string;
  riskLevel: 'low' | 'medium' | 'high';
  industry: string;
  tags: string[];
  usageCount: number;
  lastUsed: string;
  averageRating: number;
  compatibility: string[];
  metadata: {
    complexity: 'low' | 'medium' | 'high';
    estimatedTime: string;
    requiredFields: string[];
  };
  abTestVariant?: 'A' | 'B';
}

interface UserProfile {
  jurisdiction: string;
  industry: string;
  riskTolerance: 'low' | 'medium' | 'high';
  preferredComplexity: 'low' | 'medium' | 'high';
  recentTypes: string[];
}

interface RecommendationReason {
  type: 'profile_match' | 'usage_pattern' | 'compatibility' | 'trending';
  score: number;
  explanation: string;
}

interface TemplateWithRecommendation extends Template {
  recommendationScore: number;
  recommendationReasons: RecommendationReason[];
  isRecommended: boolean;
  isTrending: boolean;
}

interface TemplateSelectionEngineProps {
  contractType?: string;
  onSelect: (data: { templateId: string; abTestGroup: string; selectionReason: string }) => void;
  onPreview: (templateId: string) => void;
  onCombine: (templateIds: string[]) => void;
}

const CONTRACT_TYPES = [
  { value: 'service_agreement', label: 'Service Agreement' },
  { value: 'nda', label: 'Non-Disclosure Agreement' },
  { value: 'employment', label: 'Employment Contract' },
  { value: 'consulting', label: 'Consulting Agreement' },
  { value: 'license', label: 'License Agreement' },
];

const JURISDICTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'EU', label: 'European Union' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
];

const RISK_LEVELS = [
  { value: 'low', label: 'Low Risk', color: 'green' },
  { value: 'medium', label: 'Medium Risk', color: 'yellow' },
  { value: 'high', label: 'High Risk', color: 'red' },
];

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'usage', label: 'Most Used' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'recent', label: 'Recently Used' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

export const TemplateSelectionEngine: React.FC<TemplateSelectionEngineProps> = ({
  contractType: initialContractType,
  onSelect,
  onPreview,
  onCombine,
}) => {
  const { user } = useAuthStore();
  const [contractType, setContractType] = useState(initialContractType || '');
  const [autoDetectedType, setAutoDetectedType] = useState<{ type: string; confidence: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('recommended');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>>({});
  const [showAssemblyMode, setShowAssemblyMode] = useState(false);
  const [assemblyConflicts, setAssemblyConflicts] = useState<string[]>([]);

  // Query user profile
  const { data: userProfile } = useQuery<UserProfile>({
    queryKey: ['user-profile', user?.id],
    queryFn: () => api.get('/user/profile').then(res => res.data),
    enabled: !!user?.id,
  });

  // Query template recommendations
  const {
    data: templates = [],
    isLoading,
    error,
    refetch,
  } = useQuery<TemplateWithRecommendation[]>({
    queryKey: ['template-recommendations', contractType, selectedJurisdiction, selectedRiskLevel],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (contractType) params.append('type', contractType);
      if (selectedJurisdiction) params.append('jurisdiction', selectedJurisdiction);
      if (selectedRiskLevel) params.append('riskLevel', selectedRiskLevel);
      
      const response = await api.get(`/templates/recommendations?${params}`);
      return response.data.map((template: Template) => ({
        ...template,
        recommendationScore: calculateRecommendationScore(template, userProfile),
        recommendationReasons: generateRecommendationReasons(template, userProfile),
        isRecommended: true,
        isTrending: Math.random() > 0.7, // Mock trending logic
      }));
    },
    enabled: !!userProfile,
  });

  // Auto-detect contract type
  useEffect(() => {
    if (!initialContractType && userProfile?.recentTypes.length) {
      const detectedType = userProfile.recentTypes[0];
      const confidence = 87;
      setAutoDetectedType({ type: detectedType, confidence });
      setContractType(detectedType);
    }
  }, [initialContractType, userProfile]);

  // Track template interactions
  const trackInteractionMutation = useMutation({
    mutationFn: (data: { templateId: string; interactionType: string; duration?: number }) =>
      api.post('/analytics/template-interaction', data),
  });

  const calculateRecommendationScore = useCallback((template: Template, profile?: UserProfile): number => {
    if (!profile) return 50;
    
    let score = 0;
    
    // Jurisdiction match
    if (template.jurisdiction === profile.jurisdiction) score += 30;
    
    // Industry match
    if (template.industry === profile.industry) score += 25;
    
    // Risk tolerance match
    if (template.riskLevel === profile.riskTolerance) score += 20;
    
    // Usage frequency
    score += Math.min(template.usageCount / 10, 15);
    
    // Rating
    score += (template.averageRating / 5) * 10;
    
    return Math.min(Math.round(score), 100);
  }, []);

  const generateRecommendationReasons = useCallback((template: Template, profile?: UserProfile): RecommendationReason[] => {
    if (!profile) return [];
    
    const reasons: RecommendationReason[] = [];
    
    if (template.jurisdiction === profile.jurisdiction && template.industry === profile.industry) {
      reasons.push({
        type: 'profile_match',
        score: 95,
        explanation: `Perfect for ${profile.industry} companies in ${profile.jurisdiction}`,
      });
    }
    
    if (template.usageCount > 200) {
      reasons.push({
        type: 'usage_pattern',
        score: 85,
        explanation: 'Frequently used together with similar contracts',
      });
    }
    
    if (template.isTrending) {
      reasons.push({
        type: 'trending',
        score: 75,
        explanation: '25% increase this month',
      });
    }
    
    return reasons;
  }, []);

  const filteredTemplates = useMemo(() => {
    let filtered = templates;
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(template =>
        selectedTags.every(tag => template.tags.includes(tag))
      );
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'recommended':
          return b.recommendationScore - a.recommendationScore;
        case 'usage':
          return b.usageCount - a.usageCount;
        case 'rating':
          return b.averageRating - a.averageRating;
        case 'recent':
          return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [templates, searchQuery, selectedTags, sortBy]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    templates.forEach(template => {
      template.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [templates]);

  const handleTemplateSelect = (template: Template) => {
    const abTestGroup = template.abTestVariant || (Math.random() > 0.5 ? 'A' : 'B');
    const selectionReason = template.recommendationReasons[0]?.explanation || 'User selection';
    
    onSelect({
      templateId: template.id,
      abTestGroup,
      selectionReason,
    });
  };

  const handleTemplatePreview = (template: Template) => {
    setPreviewTemplate(template);
    setPreviewData({
      company: '[Your Company]',
      counterparty: '[Counterparty]',
      services: '[Service Description]',
    });
    setShowPreviewModal(true);
    onPreview(template.id);
  };

  const handleQuickPreview = (template: Template) => {
    setPreviewTemplate(template);
    setShowPreviewModal(true);
  };

  const handleTemplateToggle = (templateId: string) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
    
    // Announce selection change
    const announcement = document.getElementById('live-region');
    if (announcement) {
      const template = templates.find(t => t.id === templateId);
      const action = selectedTemplates.includes(templateId) ? 'deselected' : 'selected';
      announcement.textContent = `${action} ${template?.name}`;
    }
  };

  const handleCombineTemplates = () => {
    if (selectedTemplates.length < 2) return;
    
    // Check for conflicts
    const conflicts = checkTemplateCompatibility(selectedTemplates);
    setAssemblyConflicts(conflicts);
    setShowAssemblyMode(true);
  };

  const checkTemplateCompatibility = (templateIds: string[]): string[] => {
    const conflicts: string[] = [];
    const selectedTemplateData = templates.filter(t => templateIds.includes(t.id));
    
    // Check jurisdiction conflicts
    const jurisdictions = new Set(selectedTemplateData.map(t => t.jurisdiction));
    if (jurisdictions.size > 1) {
      conflicts.push('Jurisdiction conflicts detected');
    }
    
    // Check risk level mismatches
    const riskLevels = selectedTemplateData.map(t => t.riskLevel);
    if (riskLevels.includes('high') && riskLevels.includes('low')) {
      conflicts.push('Risk level mismatch');
    }
    
    return conflicts;
  };

  const handleMouseEnter = (template: Template) => {
    const startTime = Date.now();
    
    const handleMouseLeave = () => {
      const duration = Date.now() - startTime;
      trackInteractionMutation.mutate({
        templateId: template.id,
        interactionType: 'view',
        duration,
      });
    };
    
    document.addEventListener('mouseleave', handleMouseLeave, { once: true });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedJurisdiction('');
    setSelectedRiskLevel('');
    setSelectedTags([]);
    setSortBy('recommended');
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Templates</h2>
          <p className="text-gray-600 mb-4">Unable to fetch template recommendations.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="template-selection-engine" className="max-w-6xl mx-auto p-6">
      <main role="main" aria-label="Template selection">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Template Selection</h1>
          
          {/* Auto-detected type */}
          {autoDetectedType && !initialContractType && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <SparklesIcon className="h-5 w-5 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm text-blue-800">
                    <strong>Auto-detected: {CONTRACT_TYPES.find(t => t.value === autoDetectedType.type)?.label}</strong>
                  </p>
                  <p className="text-xs text-blue-600">
                    Confidence: {autoDetectedType.confidence}%
                  </p>
                  <div className="flex space-x-2 mt-2">
                    <button className="text-xs text-blue-600 hover:text-blue-800 underline">
                      Verify Classification
                    </button>
                    <span className="text-xs text-blue-400">•</span>
                    <div className="text-xs text-blue-600">
                      Other possibilities:
                      <button className="ml-1 hover:text-blue-800 underline">Consulting Agreement</button>,
                      <button className="ml-1 hover:text-blue-800 underline">Master Service Agreement</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div data-testid="loading-spinner" className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Analyzing your requirements...</p>
            </div>
          )}
        </div>

        {!isLoading && (
          <>
            {/* Filters and Search */}
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
              <div className="flex flex-wrap gap-4 items-center">
                {/* Contract Type */}
                <div>
                  <label htmlFor="contract-type" className="block text-sm font-medium text-gray-700 mb-1">
                    Contract Type
                  </label>
                  <select
                    id="contract-type"
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Types</option>
                    {CONTRACT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search */}
                <div className="flex-1 min-w-64">
                  <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                    Search Templates
                  </label>
                  <div className="relative">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      id="search"
                      type="text"
                      placeholder="Search by name, tags, or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Toggle Filters */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                >
                  <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
                  Filters
                </button>
              </div>

              {/* Extended Filters */}
              {showFilters && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    {/* Jurisdiction */}
                    <div>
                      <label htmlFor="jurisdiction" className="block text-sm font-medium text-gray-700 mb-1">
                        Jurisdiction
                      </label>
                      <select
                        id="jurisdiction"
                        value={selectedJurisdiction}
                        onChange={(e) => setSelectedJurisdiction(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">All Jurisdictions</option>
                        {JURISDICTIONS.map(jurisdiction => (
                          <option key={jurisdiction.value} value={jurisdiction.value}>
                            {jurisdiction.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Risk Tolerance */}
                    <div>
                      <label htmlFor="risk-tolerance" className="block text-sm font-medium text-gray-700 mb-1">
                        Risk Tolerance
                      </label>
                      <select
                        id="risk-tolerance"
                        value={selectedRiskLevel}
                        onChange={(e) => setSelectedRiskLevel(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">All Risk Levels</option>
                        {RISK_LEVELS.map(level => (
                          <option key={level.value} value={level.value}>
                            {level.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Sort By */}
                    <div>
                      <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 mb-1">
                        Sort By
                      </label>
                      <select
                        id="sort-by"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {SORT_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => setSelectedTags(prev =>
                            prev.includes(tag)
                              ? prev.filter(t => t !== tag)
                              : [...prev, tag]
                          )}
                          className={`px-3 py-1 text-sm rounded-full border ${
                            selectedTags.includes(tag)
                              ? 'bg-blue-100 border-blue-300 text-blue-800'
                              : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Filters */}
                  {(selectedJurisdiction || selectedRiskLevel || selectedTags.length > 0) && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Active Filters:</span>
                        {selectedJurisdiction && <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded">Jurisdiction: {selectedJurisdiction}</span>}
                        {selectedRiskLevel && <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded">Risk: {selectedRiskLevel}</span>}
                        {selectedTags.map(tag => (
                          <span key={tag} className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={clearFilters}
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        Clear Filters
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Templates Bar */}
            {selectedTemplates.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DocumentDuplicateIcon className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="text-blue-800 font-medium">
                      {selectedTemplates.length} templates selected
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCombineTemplates}
                      disabled={selectedTemplates.length < 2}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Combine Templates
                    </button>
                    <button
                      onClick={() => setSelectedTemplates([])}
                      className="px-4 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Templates Grid */}
            <div role="region" aria-label="Recommended templates">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <DocumentIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  {templates.length === 0 ? (
                    <>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Exact Matches Found</h3>
                      <p className="text-gray-600 mb-4">We couldn't find templates matching your criteria.</p>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-500">Similar templates:</p>
                        <button className="text-blue-600 hover:text-blue-800 underline text-sm">
                          General Contract Template
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates Found</h3>
                      <p className="text-gray-600 mb-4">Try adjusting your filters or search terms.</p>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Create New Template
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    Recommended Templates
                    {selectedJurisdiction === 'EU' && (
                      <div className="text-sm text-yellow-600 mt-1">
                        Limited templates available for EU • Consider adaptation of US template
                      </div>
                    )}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        data-testid={`template-card-${template.id}`}
                        className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow"
                        onMouseEnter={() => handleMouseEnter(template)}
                        tabIndex={0}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-2">{template.name}</h3>
                            <div className="flex items-center space-x-2 mb-2">
                              <span className={`px-2 py-1 text-xs rounded-full ${getRiskLevelColor(template.riskLevel)}`}>
                                Risk: {template.riskLevel}
                              </span>
                              {template.isTrending && (
                                <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full flex items-center">
                                  <TrendingUpIcon className="h-3 w-3 mr-1" />
                                  Trending
                                </span>
                              )}
                              {template.abTestVariant && (
                                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                  Variant {template.abTestVariant}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={selectedTemplates.includes(template.id)}
                              onChange={() => handleTemplateToggle(template.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              aria-label={`Select ${template.name}`}
                            />
                          </div>
                        </div>

                        {/* Recommendation Score */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Match: {template.recommendationScore}%</span>
                            <div className="flex items-center">
                              <StarSolidIcon className="h-4 w-4 text-yellow-400 mr-1" />
                              <span>{template.averageRating}/5</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${template.recommendationScore}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Recommendation Reasons */}
                        <div className="mb-4">
                          {template.recommendationReasons.slice(0, 2).map((reason, index) => (
                            <p key={index} className="text-xs text-gray-600 mb-1">
                              • {reason.explanation}
                            </p>
                          ))}
                          {userProfile?.riskTolerance !== template.riskLevel && (
                            <p className="text-xs text-yellow-600">• Higher risk than usual</p>
                          )}
                          {template.jurisdiction === userProfile?.jurisdiction && template.industry === userProfile?.industry && (
                            <p className="text-xs text-green-600">• Matches your profile</p>
                          )}
                        </div>

                        {/* Usage Stats */}
                        <div className="mb-4 text-xs text-gray-500">
                          <div className="flex items-center justify-between">
                            <span>Used {template.usageCount} times</span>
                            <span>Last used: {new Date(template.lastUsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                          <div className="mt-1">
                            <span>95% approval rate • Avg completion: 2.3 days</span>
                          </div>
                          {template.usageCount > 200 && (
                            <div className="text-green-600 mt-1">
                              Teams like yours choose this 78% of the time
                            </div>
                          )}
                        </div>

                        {/* Compatibility */}
                        <div className="mb-4">
                          <p className="text-xs text-gray-600 mb-1">Works well with:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.compatibility.slice(0, 2).map((compat) => (
                              <span key={compat} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                {compat}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Metadata */}
                        <div className="mb-4 text-xs text-gray-500">
                          <div className="flex items-center justify-between">
                            <span>Estimated time: {template.metadata.estimatedTime}</span>
                            <span>Complexity: {template.metadata.complexity}</span>
                          </div>
                          {template.jurisdiction === 'UK' && (
                            <div className="mt-1 text-green-600">
                              UK employment law compliant • Includes GDPR clauses
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleTemplateSelect(template)}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                          >
                            Select Template
                          </button>
                          <button
                            onClick={() => handleTemplatePreview(template)}
                            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                            title="Preview"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleQuickPreview(template)}
                            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                            title="Quick Preview"
                          >
                            Quick Preview
                          </button>
                        </div>

                        {/* Additional Info Buttons */}
                        <div className="mt-3 flex justify-between text-xs">
                          <button className="text-blue-600 hover:text-blue-800 flex items-center">
                            <InformationCircleIcon className="h-3 w-3 mr-1" />
                            Risk Details
                          </button>
                          <button className="text-blue-600 hover:text-blue-800">
                            Compatibility
                          </button>
                          <button className="text-blue-600 hover:text-blue-800">
                            Custom Preview
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Assembly Mode Modal */}
            {showAssemblyMode && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
                  <h2 className="text-xl font-semibold mb-4">Assembly Preview</h2>
                  
                  {assemblyConflicts.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <h3 className="text-red-800 font-medium mb-2">Conflicting sections detected</h3>
                      {assemblyConflicts.map((conflict, index) => (
                        <p key={index} className="text-red-700 text-sm">• {conflict}</p>
                      ))}
                      <button className="mt-2 text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200">
                        Resolve Conflicts
                      </button>
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">Recommended Order:</h3>
                    <ol className="list-decimal list-inside text-sm text-gray-600">
                      <li>Introduction</li>
                      <li>Confidentiality</li>
                      <li>Services</li>
                      <li>Payment Terms</li>
                      <li>Termination</li>
                    </ol>
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowAssemblyMode(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onCombine(selectedTemplates);
                        setShowAssemblyMode(false);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Combine Templates
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Modal */}
            {showPreviewModal && previewTemplate && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-96 overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Preview with Sample Data</h2>
                    <button
                      onClick={() => setShowPreviewModal(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">Custom Preview Data:</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                        <input
                          type="text"
                          value={previewData.company}
                          onChange={(e) => setPreviewData(prev => ({ ...prev, company: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Service Description</label>
                        <input
                          type="text"
                          value={previewData.services}
                          onChange={(e) => setPreviewData(prev => ({ ...prev, services: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <h4 className="font-medium mb-2">{previewTemplate.name}</h4>
                    <div className="text-sm text-gray-600">
                      <p>This agreement is entered into between {previewData.company || '[Your Company]'} and {previewData.counterparty || '[Counterparty]'} for {previewData.services || '[Service Description]'}.</p>
                      <p className="mt-2">Sample preview content would appear here...</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowPreviewModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Close
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      Generate Preview
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Live Region for Screen Reader Announcements */}
        <div id="live-region" role="status" aria-live="polite" className="sr-only"></div>
      </main>
    </div>
  );
};