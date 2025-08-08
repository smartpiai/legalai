import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DocumentTextIcon,
  UserGroupIcon,
  PencilIcon,
  CogIcon,
  BellIcon,
  ShieldCheckIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';

// Types
interface Provider {
  id: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  capabilities: string[];
  status: 'connected' | 'disconnected' | 'available';
}

interface Signer {
  id: string;
  name: string;
  email: string;
  role: string;
  order: number;
  status: 'pending' | 'sent' | 'signed' | 'declined';
  authenticationType: 'email' | 'sms' | 'kba';
  fields: SignatureField[];
  phoneNumber?: string;
}

interface SignatureField {
  id: string;
  type: 'signature' | 'date' | 'text' | 'checkbox';
  label: string;
  required: boolean;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  assignedTo: string;
}

interface Document {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
}

interface SignatureRequest {
  id: string;
  documentId: string;
  title: string;
  status: 'draft' | 'sent' | 'completed' | 'cancelled';
  provider: string;
  signers: Signer[];
  settings: {
    expirationDays: number;
    reminderFrequency: number;
    allowDecline: boolean;
    requireSignerOrder: boolean;
    allowReassign: boolean;
  };
  createdAt: string;
  expiresAt: string;
}

interface ESignatureIntegrationHubProps {
  documentId: string;
  mode?: 'single' | 'bulk';
  onComplete: (result: any) => void;
  onCancel: () => void;
}

export const ESignatureIntegrationHub: React.FC<ESignatureIntegrationHubProps> = ({
  documentId,
  mode = 'single',
  onComplete,
  onCancel,
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  
  // State
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [signers, setSigners] = useState<Signer[]>([]);
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [showSignerForm, setShowSignerForm] = useState(false);
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [showMessageEditor, setShowMessageEditor] = useState(false);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [routingMode, setRoutingMode] = useState<'sequential' | 'parallel'>('sequential');
  const [reminderFrequency, setReminderFrequency] = useState(3);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [signerForm, setSignerForm] = useState({
    name: '',
    email: '',
    role: '',
    authenticationType: 'email',
    phoneNumber: '',
  });
  const [nativeSignatureMode, setNativeSignatureMode] = useState<'draw' | 'typed' | 'upload'>('draw');
  const [typedSignature, setTypedSignature] = useState('');

  // Query providers
  const { data: providers, isLoading: providersLoading } = useQuery<Provider[]>({
    queryKey: ['signature-providers'],
    queryFn: () => api.get('/signature-providers').then(res => res.data),
  });

  // Query document
  const { data: document } = useQuery<Document>({
    queryKey: ['document', documentId],
    queryFn: () => api.get(`/documents/${documentId}`).then(res => res.data),
    enabled: !!documentId,
  });

  // Query existing signature requests
  const { data: existingRequests } = useQuery<SignatureRequest[]>({
    queryKey: ['signature-requests', documentId],
    queryFn: () => api.get(`/signature-requests?documentId=${documentId}`).then(res => res.data),
    enabled: !!documentId,
  });

  // Create signature request mutation
  const createSignatureRequest = useMutation({
    mutationFn: (data: any) => api.post('/signature-requests', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['signature-requests'] });
      onComplete(response.data);
    },
  });

  // Test webhook mutation
  const testWebhook = useMutation({
    mutationFn: (url: string) => api.post('/signature-webhooks/test', { url }),
    onSuccess: () => {
      onComplete({ type: 'webhook_test' });
    },
  });

  // Effects
  useEffect(() => {
    if (providers?.length && !selectedProvider) {
      const defaultProvider = providers.find(p => p.isDefault && p.isActive);
      if (defaultProvider) {
        setSelectedProvider(defaultProvider.id);
      }
    }
  }, [providers, selectedProvider]);

  useEffect(() => {
    if (existingRequests?.length) {
      const latest = existingRequests[0];
      setSigners(latest.signers);
      setSelectedProvider(latest.provider);
      setRoutingMode(latest.settings.requireSignerOrder ? 'sequential' : 'parallel');
      setReminderFrequency(latest.settings.reminderFrequency);
    }
  }, [existingRequests]);

  // Handlers
  const handleProviderSelect = useCallback((providerId: string) => {
    setSelectedProvider(providerId);
    setValidationErrors([]);
  }, []);

  const handleAddSigner = useCallback(() => {
    setShowSignerForm(true);
    setSignerForm({
      name: '',
      email: '',
      role: '',
      authenticationType: 'email',
      phoneNumber: '',
    });
  }, []);

  const handleSaveSigner = useCallback(() => {
    const errors: string[] = [];
    
    if (!signerForm.name.trim()) {
      errors.push('Name is required');
    }
    if (!signerForm.email.trim()) {
      errors.push('Email is required');
    }
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const newSigner: Signer = {
      id: `signer-${Date.now()}`,
      name: signerForm.name,
      email: signerForm.email,
      role: signerForm.role || 'Signer',
      order: signers.length + 1,
      status: 'pending',
      authenticationType: signerForm.authenticationType as 'email' | 'sms' | 'kba',
      fields: [],
      phoneNumber: signerForm.phoneNumber,
    };

    setSigners(prev => [...prev, newSigner]);
    setShowSignerForm(false);
    setValidationErrors([]);
  }, [signerForm, signers]);

  const handleMoveSigner = useCallback((signerId: string, direction: 'up' | 'down') => {
    setSigners(prev => {
      const signerIndex = prev.findIndex(s => s.id === signerId);
      if (signerIndex === -1) return prev;
      
      const newSigners = [...prev];
      const targetIndex = direction === 'up' ? signerIndex - 1 : signerIndex + 1;
      
      if (targetIndex >= 0 && targetIndex < newSigners.length) {
        [newSigners[signerIndex], newSigners[targetIndex]] = 
        [newSigners[targetIndex], newSigners[signerIndex]];
        
        // Update order numbers
        newSigners.forEach((signer, index) => {
          signer.order = index + 1;
        });
      }
      
      return newSigners;
    });
  }, []);

  const handleAddSignatureField = useCallback(() => {
    setShowFieldEditor(true);
  }, []);

  const handleSendForSignature = useCallback(() => {
    const errors: string[] = [];
    
    if (signers.length === 0) {
      errors.push('Please add at least one signer');
    }
    
    if (signatureFields.length === 0) {
      errors.push('Please add signature fields');
    }
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const requestData = {
      documentId,
      provider: selectedProvider,
      signers: signers.map(s => ({
        ...s,
        fields: signatureFields.filter(f => f.assignedTo === s.id),
      })),
      settings: {
        expirationDays: 30,
        reminderFrequency,
        allowDecline: true,
        requireSignerOrder: routingMode === 'sequential',
        allowReassign: false,
      },
    };

    createSignatureRequest.mutate(requestData);
  }, [
    documentId,
    selectedProvider,
    signers,
    signatureFields,
    reminderFrequency,
    routingMode,
    createSignatureRequest,
  ]);

  const handleWebhookTest = useCallback((url: string) => {
    testWebhook.mutate(url);
  }, [testWebhook]);

  // Computed values
  const selectedProviderData = useMemo(() => 
    providers?.find(p => p.id === selectedProvider),
    [providers, selectedProvider]
  );

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  const getCapabilityDisplay = useCallback((capability: string) => {
    const displays: Record<string, string> = {
      bulk_send: 'Bulk Send',
      templates: 'Templates',
      advanced_routing: 'Advanced Routing',
      basic_signature: 'Basic Signature',
    };
    return displays[capability] || capability;
  }, []);

  // Loading state
  if (providersLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <div data-testid="loading-spinner" className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading signature providers...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="signature-integration-hub" className="max-w-7xl mx-auto p-6">
      <main role="main" aria-label="E-Signature Integration Hub">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                E-Signature Integration Hub
              </h1>
              <p className="text-gray-600 mb-4">
                Integration hub for sending documents for electronic signature
              </p>
              {document && (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    {document.name}
                  </span>
                  <span className="text-sm text-gray-600">
                    {formatFileSize(document.size)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowWebhookConfig(true)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <CogIcon className="h-4 w-4 inline mr-2" />
                Webhook Settings
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Error Messages */}
        {validationErrors.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Please fix the following errors:
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc list-inside space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Region for Screen Readers */}
        <div role="status" aria-live="polite" className="sr-only">
          {validationErrors.length > 0 && 'Signature request validation errors found'}
        </div>

        {mode === 'bulk' ? (
          /* Bulk Campaign Mode */
          <div data-testid="bulk-campaign" className="space-y-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Bulk Signature Campaign
              </h2>
              
              {/* Signer Data Upload */}
              <div data-testid="signer-data-upload" className="mb-6">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-center">
                    <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <p className="text-sm text-gray-600">Upload CSV file with signer data</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Validation */}
              <div data-testid="data-validation" className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Required Columns</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>Name</div>
                    <div>Email</div>
                    <div>Role</div>
                  </div>
                </div>
              </div>

              {/* Campaign Progress */}
              <div data-testid="campaign-progress">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Campaign Progress</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">0</div>
                    <div className="text-sm text-blue-600">Sent</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">0</div>
                    <div className="text-sm text-green-600">Signed</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">0</div>
                    <div className="text-sm text-yellow-600">Pending</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">0</div>
                    <div className="text-sm text-red-600">Declined</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Single Document Mode */
          <div className="space-y-8">
            {/* Provider Selection */}
            <section role="region" aria-label="Signature Providers">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Select Signature Provider
                </h2>
                <p aria-label="Select signature provider" className="sr-only">
                  Choose from available e-signature providers
                </p>
                
                <div data-testid="providers-list" className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {providers?.map((provider) => (
                    <div
                      key={provider.id}
                      data-testid={`provider-${provider.id}`}
                      className={`
                        relative border-2 rounded-lg p-4 cursor-pointer transition-all
                        ${selectedProvider === provider.id
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300'
                        }
                        ${provider.status === 'disconnected' ? 'opacity-50' : ''}
                      `}
                      onClick={() => provider.status !== 'disconnected' && handleProviderSelect(provider.id)}
                      tabIndex={provider.status !== 'disconnected' ? 0 : -1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && provider.status !== 'disconnected') {
                          handleProviderSelect(provider.id);
                        }
                      }}
                    >
                      <div className="text-center">
                        <h3 className="font-medium text-gray-900">{provider.name}</h3>
                        
                        {provider.isDefault && (
                          <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            Default
                          </span>
                        )}
                        
                        <div className="mt-2">
                          {provider.status === 'connected' && (
                            <CheckCircleSolid className="h-5 w-5 text-green-500 mx-auto" />
                          )}
                          {provider.status === 'disconnected' && (
                            <>
                              <XCircleIcon className="h-5 w-5 text-red-500 mx-auto" />
                              <div className="text-xs text-red-600 mt-1">Disconnected</div>
                              <button className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                                Setup
                              </button>
                            </>
                          )}
                          {provider.status === 'available' && (
                            <CheckCircleSolid className="h-5 w-5 text-blue-500 mx-auto" />
                          )}
                        </div>
                        
                        {/* Capabilities */}
                        <div className="mt-2 space-y-1">
                          {provider.capabilities.map((capability) => (
                            <div key={capability} className="text-xs text-gray-600">
                              {getCapabilityDisplay(capability)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedProvider === 'docusign' && (
                  <div className="mt-4 text-sm text-green-600">
                    ✓ Connected to DocuSign
                  </div>
                )}
                {selectedProvider === 'adobe_sign' && (
                  <div className="mt-4 text-sm text-blue-600">
                    ✓ Switched to Adobe Sign
                  </div>
                )}
              </div>
            </section>

            {/* Native Signature Interface */}
            {selectedProvider === 'native' && (
              <div data-testid="native-signature-interface" className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Native E-Signature
                </h2>
                
                <div className="border-b border-gray-200 mb-4">
                  <nav className="-mb-px flex space-x-8">
                    {[
                      { id: 'draw', label: 'Draw' },
                      { id: 'typed', label: 'Typed' },
                      { id: 'upload', label: 'Upload' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        role="tab"
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          nativeSignatureMode === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setNativeSignatureMode(tab.id as any)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                </div>

                {nativeSignatureMode === 'draw' && (
                  <div className="space-y-4">
                    <canvas data-testid="signature-canvas" className="border border-gray-300 rounded w-full h-32" />
                    <div className="flex space-x-2">
                      <button className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                        Clear
                      </button>
                      <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                        Save Signature
                      </button>
                    </div>
                  </div>
                )}

                {nativeSignatureMode === 'typed' && (
                  <div data-testid="typed-signature" className="space-y-4">
                    <div>
                      <label htmlFor="typed-name" className="block text-sm font-medium text-gray-700">
                        Type your name
                      </label>
                      <input
                        type="text"
                        id="typed-name"
                        value={typedSignature}
                        onChange={(e) => setTypedSignature(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Your full name"
                      />
                    </div>
                    <div className="text-2xl font-script border border-gray-300 rounded p-4 bg-gray-50">
                      {typedSignature || 'Your signature will appear here'}
                    </div>
                  </div>
                )}

                {nativeSignatureMode === 'upload' && (
                  <div data-testid="signature-upload" className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                      <div className="text-center">
                        <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="mt-4">
                          <p className="text-sm text-gray-600">Choose image file</p>
                          <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Signature Packet Builder */}
            <section role="region" aria-label="Signature Packet">
              <div data-testid="packet-builder" className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Signature Packet</h2>
                  <button
                    onClick={handleAddSigner}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <UserGroupIcon className="h-4 w-4 inline mr-2" />
                    Add Signer
                  </button>
                </div>

                {/* Signers List */}
                <div data-testid="signers-list" className="space-y-4">
                  {signers.map((signer) => (
                    <div
                      key={signer.id}
                      data-testid={`signer-${signer.id}`}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="bg-blue-100 text-blue-800 w-8 h-8 rounded-full flex items-center justify-center font-medium">
                          {signer.order}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{signer.name}</div>
                          <div className="text-sm text-gray-500">{signer.email}</div>
                          <div className="text-sm text-gray-500">{signer.role}</div>
                          <div className="text-sm text-gray-500 capitalize">{signer.authenticationType}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleMoveSigner(signer.id, 'up')}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          disabled={signer.order === 1}
                        >
                          ↑ <span className="sr-only">Move up</span>
                        </button>
                        <button
                          onClick={() => handleMoveSigner(signer.id, 'down')}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          disabled={signer.order === signers.length}
                        >
                          ↓ <span className="sr-only">Move down</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {signers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No signers added yet. Click "Add Signer" to get started.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Signature Fields Editor */}
            <div data-testid="field-editor" className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Signature Fields</h2>
                <button
                  onClick={handleAddSignatureField}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <PencilIcon className="h-4 w-4 inline mr-2" />
                  Add Signature Field
                </button>
              </div>

              {showFieldEditor && (
                <div data-testid="field-placement-tools" className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">Click to place signature field on the document</p>
                </div>
              )}

              {/* Field Types */}
              <div data-testid="field-types" className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Field Types</h3>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { type: 'signature', label: 'Signature', icon: PencilIcon },
                    { type: 'date', label: 'Date', icon: ClockIcon },
                    { type: 'text', label: 'Text', icon: DocumentTextIcon },
                    { type: 'checkbox', label: 'Checkbox', icon: CheckCircleIcon },
                  ].map((fieldType) => (
                    <button
                      key={fieldType.type}
                      data-testid={`field-type-${fieldType.type}`}
                      className="flex items-center space-x-2 p-2 border border-gray-300 rounded hover:bg-gray-50"
                      onClick={() => {
                        // Handle field type selection
                      }}
                    >
                      <fieldType.icon className="h-4 w-4" />
                      <span className="text-sm">{fieldType.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Field Properties */}
              <div data-testid="field-properties" className="space-y-4">
                <div>
                  <label htmlFor="field-label" className="block text-sm font-medium text-gray-700">
                    Field Label
                  </label>
                  <input
                    type="text"
                    id="field-label"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter field label"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="field-required"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="field-required" className="ml-2 text-sm text-gray-700">
                    Required
                  </label>
                </div>
              </div>
            </div>

            {/* Routing Configuration */}
            <div data-testid="routing-config" className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Routing Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <fieldset>
                    <legend className="text-sm font-medium text-gray-900">Signing Order</legend>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center">
                        <input
                          id="sequential"
                          type="radio"
                          name="routing"
                          value="sequential"
                          checked={routingMode === 'sequential'}
                          onChange={(e) => setRoutingMode(e.target.value as 'sequential')}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="sequential" className="ml-2 text-sm text-gray-700">
                          Sequential
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="parallel"
                          type="radio"
                          name="routing"
                          value="parallel"
                          checked={routingMode === 'parallel'}
                          onChange={(e) => setRoutingMode(e.target.value as 'parallel')}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="parallel" className="ml-2 text-sm text-gray-700">
                          Parallel
                        </label>
                      </div>
                    </div>
                  </fieldset>
                </div>

                {routingMode === 'sequential' && (
                  <div data-testid="sequential-order" className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">Signers will receive in order based on their assigned sequence</p>
                  </div>
                )}

                {routingMode === 'parallel' && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-800">All signers receive simultaneously</p>
                  </div>
                )}

                <div data-testid="conditional-routing" className="flex items-center">
                  <input
                    type="checkbox"
                    id="conditional-routing"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="conditional-routing" className="ml-2 text-sm text-gray-700">
                    Enable conditional routing
                  </label>
                </div>
              </div>
            </div>

            {/* Authentication Methods */}
            <div data-testid="auth-methods" className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Authentication Methods</h2>
              
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'email', label: 'Email', icon: '✉️' },
                  { id: 'sms', label: 'SMS', icon: '📱' },
                  { id: 'kba', label: 'Knowledge-Based', icon: '🔐' },
                ].map((method) => (
                  <div key={method.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{method.icon}</span>
                      <div>
                        <div className="font-medium">{method.label}</div>
                        <label className="flex items-center mt-2">
                          <input
                            type="radio"
                            name="auth-method"
                            value={method.id}
                            className="h-4 w-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm text-gray-600">Use for all signers</span>
                        </label>
                      </div>
                    </div>
                    
                    {method.id === 'sms' && (
                      <div data-testid="sms-config" className="mt-4">
                        <label htmlFor="phone-number" className="block text-sm font-medium text-gray-700">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          id="phone-number"
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    )}
                    
                    {method.id === 'kba' && (
                      <div data-testid="kba-config" className="mt-4">
                        <p className="text-sm text-gray-600">Identity verification questions will be generated automatically</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Reminder Settings */}
            <div data-testid="reminder-settings" className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Reminder Automation</h2>
                <button
                  onClick={() => setShowMessageEditor(true)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Customize Messages
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="reminder-frequency" className="block text-sm font-medium text-gray-700">
                    Reminder Frequency (days)
                  </label>
                  <select
                    id="reminder-frequency"
                    value={reminderFrequency}
                    onChange={(e) => setReminderFrequency(Number(e.target.value))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value={1}>Daily</option>
                    <option value={3}>Every 3 days</option>
                    <option value={7}>Weekly</option>
                  </select>
                </div>

                <div data-testid="reminder-templates" className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-900">Reminder Templates</h3>
                  <div className="space-y-2">
                    {[
                      'Initial Reminder',
                      'Follow-up Reminder', 
                      'Final Reminder',
                    ].map((template) => (
                      <div key={template} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                        <span className="text-sm">{template}</span>
                        <button className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Status Dashboard */}
            <div data-testid="status-dashboard" className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Signature Status</h2>
              
              <div data-testid="real-time-updates" className="space-y-4">
                {signers.map((signer) => (
                  <div key={signer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium">{signer.name}</div>
                      <div className="text-sm text-gray-500">{signer.email}</div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      signer.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      signer.status === 'signed' ? 'bg-green-100 text-green-800' :
                      signer.status === 'declined' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {signer.status.charAt(0).toUpperCase() + signer.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Send Button */}
            <div className="flex justify-end space-x-4">
              <button
                onClick={onCancel}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendForSignature}
                disabled={createSignatureRequest.isPending}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createSignatureRequest.isPending ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 inline mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send for Signature'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Signer Form Modal */}
        {showSignerForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div data-testid="signer-form" className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Signer</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="signer-name" className="block text-sm font-medium text-gray-700">
                    Signer Name
                  </label>
                  <input
                    type="text"
                    id="signer-name"
                    value={signerForm.name}
                    onChange={(e) => setSignerForm(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                
                <div>
                  <label htmlFor="signer-email" className="block text-sm font-medium text-gray-700">
                    Signer Email
                  </label>
                  <input
                    type="email"
                    id="signer-email"
                    value={signerForm.email}
                    onChange={(e) => setSignerForm(prev => ({ ...prev, email: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                
                <div>
                  <label htmlFor="signer-role" className="block text-sm font-medium text-gray-700">
                    Role
                  </label>
                  <input
                    type="text"
                    id="signer-role"
                    value={signerForm.role}
                    onChange={(e) => setSignerForm(prev => ({ ...prev, role: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="e.g., Client, Vendor"
                  />
                </div>
                
                <div>
                  <label htmlFor="auth-type" className="block text-sm font-medium text-gray-700">
                    Authentication
                  </label>
                  <select
                    id="auth-type"
                    value={signerForm.authenticationType}
                    onChange={(e) => setSignerForm(prev => ({ ...prev, authenticationType: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="kba">Knowledge-Based</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowSignerForm(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSigner}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Signer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Webhook Configuration Modal */}
        {showWebhookConfig && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div data-testid="webhook-config" className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Webhook Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="webhook-url" className="block text-sm font-medium text-gray-700">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    id="webhook-url"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="https://your-app.com/webhooks/signature"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowWebhookConfig(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleWebhookTest('test-url')}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Test Webhook
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Message Editor Modal */}
        {showMessageEditor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div data-testid="message-editor" className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Customize Reminder Messages</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="subject-line" className="block text-sm font-medium text-gray-700">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    id="subject-line"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Please sign the document"
                  />
                </div>
                
                <div>
                  <label htmlFor="message-body" className="block text-sm font-medium text-gray-700">
                    Message Body
                  </label>
                  <textarea
                    id="message-body"
                    rows={6}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter your custom message here..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowMessageEditor(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                  Save Template
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};