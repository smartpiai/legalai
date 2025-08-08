import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ClockIcon,
  UserGroupIcon,
  ChartBarIcon,
  ShareIcon,
  BellIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  PencilIcon,
  ArrowPathIcon,
  PlayIcon,
  PauseIcon,
  ArrowUturnLeftIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  UserCircleIcon,
  LinkIcon,
  DocumentArrowDownIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid, ExclamationCircleIcon as ExclamationCircleSolid } from '@heroicons/react/24/solid';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';

// Types
interface Participant {
  id: string;
  name: string;
  email: string;
  role: string;
  party: string;
  permissions: string[];
  isOnline?: boolean;
  lastSeen?: string;
  cursorPosition?: {
    section: string;
    offset: number;
  };
}

interface Position {
  id: string;
  clause: string;
  ourPosition: string;
  theirPosition: string;
  status: 'open' | 'agreed' | 'disputed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  lastUpdate: string;
}

interface Change {
  id: string;
  type: 'text_change' | 'clause_addition' | 'clause_removal' | 'position_update';
  section: string;
  oldValue?: string;
  newValue?: string;
  author: string;
  timestamp: string;
  status: 'pending' | 'accepted' | 'rejected';
  requiresNotification?: boolean;
}

interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  section: string;
  replies: Comment[];
  isResolved?: boolean;
  mentions?: string[];
}

interface Version {
  id: string;
  versionNumber: string;
  createdBy: string;
  createdAt: string;
  changes: Change[];
}

interface NegotiationAnalytics {
  totalChanges: number;
  pendingChanges: number;
  acceptedChanges: number;
  negotiationDuration: string;
  responseTime: string;
  acceptanceRate?: number;
  progress?: number;
}

interface Negotiation {
  id: string;
  contractId: string;
  title: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  participants: Participant[];
  positions: Position[];
  versions: Version[];
  comments: Comment[];
  analytics: NegotiationAnalytics;
}

interface NegotiationWorkspaceProps {
  negotiationId: string;
  onSave: (data: any) => void;
  onComplete: () => void;
  userPermissions?: string[];
}

export const NegotiationWorkspace: React.FC<NegotiationWorkspaceProps> = ({
  negotiationId,
  onSave,
  onComplete,
  userPermissions = [],
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [activeView, setActiveView] = useState('overview');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [showVersionComparison, setShowVersionComparison] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [positionValues, setPositionValues] = useState<{[key: string]: string}>({});
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSection, setFilterSection] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [userCursors, setUserCursors] = useState<{[key: string]: any}>({});
  const [typingUsers, setTypingUsers] = useState<{[key: string]: any}>({});
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationPrefs, setShowNotificationPrefs] = useState(false);
  const [showExternalPortal, setShowExternalPortal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showPositionMatrix, setShowPositionMatrix] = useState(false);
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Query negotiation data
  const { data: negotiation, isLoading, error } = useQuery<Negotiation>({
    queryKey: ['negotiation', negotiationId],
    queryFn: () => api.get(`/negotiations/${negotiationId}`).then(res => res.data),
  });

  // WebSocket connection
  useEffect(() => {
    if (!negotiationId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/negotiations/${negotiationId}`;
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.addEventListener('open', () => {
      setConnectionStatus('connected');
    });

    wsRef.current.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    wsRef.current.addEventListener('error', () => {
      setConnectionStatus('disconnected');
    });

    wsRef.current.addEventListener('close', () => {
      setConnectionStatus('disconnected');
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [negotiationId]);

  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'presence_update':
        setOnlineUsers(prev => {
          const updated = new Set(prev);
          if (message.data.status === 'online') {
            updated.add(message.data.userId);
          } else {
            updated.delete(message.data.userId);
          }
          return updated;
        });
        break;

      case 'cursor_update':
        setUserCursors(prev => ({
          ...prev,
          [message.data.userId]: message.data,
        }));
        break;

      case 'typing_start':
        setTypingUsers(prev => ({
          ...prev,
          [message.data.userId]: message.data,
        }));
        break;

      case 'typing_stop':
        setTypingUsers(prev => {
          const updated = { ...prev };
          delete updated[message.data.userId];
          return updated;
        });
        break;

      case 'change_sync':
        // Invalidate queries to refetch data
        queryClient.invalidateQueries({ queryKey: ['negotiation', negotiationId] });
        
        // Show notification if required
        if (message.data.requiresNotification) {
          setNotifications(prev => [...prev, {
            id: Date.now(),
            text: 'Stakeholders have been notified',
            type: 'success',
          }]);
        }

        // Announce to screen readers
        const liveRegion = document.getElementById('live-region');
        if (liveRegion && message.data.section) {
          liveRegion.textContent = `New change in ${message.data.section} section`;
        }
        break;
    }
  }, [negotiationId, queryClient]);

  // Mutations
  const saveChangeMutation = useMutation({
    mutationFn: (data: any) => api.post('/negotiations/changes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['negotiation', negotiationId] });
    },
    onError: (error: any) => {
      if (error.response?.data?.error) {
        setValidationErrors([error.response.data.error]);
      }
    },
  });

  const saveCommentMutation = useMutation({
    mutationFn: (data: any) => api.post('/negotiations/comments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['negotiation', negotiationId] });
      setNewComment('');
      setReplyingTo(null);
    },
  });

  const savePositionMutation = useMutation({
    mutationFn: (data: any) => api.put(`/negotiations/positions/${data.positionId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['negotiation', negotiationId] });
      setEditingPosition(null);
      setPositionValues({});
    },
  });

  // Handlers
  const handleAcceptChange = useCallback((changeId: string) => {
    onSave({ changeId, action: 'accept' });
    saveChangeMutation.mutate({ changeId, action: 'accept' });
  }, [onSave, saveChangeMutation]);

  const handleRejectChange = useCallback((changeId: string) => {
    onSave({ changeId, action: 'reject' });
    saveChangeMutation.mutate({ changeId, action: 'reject' });
  }, [onSave, saveChangeMutation]);

  const handleAddComment = useCallback((text: string, section?: string) => {
    const commentData = {
      type: 'comment',
      text,
      section: section || 'general',
      negotiationId,
    };
    onSave(commentData);
    saveCommentMutation.mutate(commentData);
  }, [onSave, saveCommentMutation, negotiationId]);

  const handleResolveComment = useCallback((commentId: string) => {
    onSave({ commentId, action: 'resolve' });
    saveCommentMutation.mutate({ commentId, action: 'resolve' });
  }, [onSave, saveCommentMutation]);

  const handleSavePosition = useCallback((positionId: string) => {
    const newPosition = positionValues[positionId];
    onSave({ positionId, ourPosition: newPosition });
    savePositionMutation.mutate({ positionId, ourPosition: newPosition });
  }, [onSave, savePositionMutation, positionValues]);

  const reconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setConnectionStatus('connecting');
    // Re-establish connection (effect will handle this)
  }, []);

  // Filter functions
  const filteredChanges = useMemo(() => {
    if (!negotiation) return [];
    
    let changes = negotiation.versions[0]?.changes || [];
    
    if (filterStatus !== 'all') {
      changes = changes.filter(change => change.status === filterStatus);
    }
    
    if (filterSection !== 'all') {
      changes = changes.filter(change => change.section === filterSection);
    }
    
    if (searchQuery) {
      changes = changes.filter(change => 
        change.section.toLowerCase().includes(searchQuery.toLowerCase()) ||
        change.oldValue?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        change.newValue?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return changes;
  }, [negotiation, filterStatus, filterSection, searchQuery]);

  const filteredComments = useMemo(() => {
    if (!negotiation) return [];
    
    let comments = negotiation.comments;
    
    if (filterSection !== 'all') {
      comments = comments.filter(comment => comment.section === filterSection);
    }
    
    return comments;
  }, [negotiation, filterSection]);

  // Check permissions
  const canEdit = user?.permissions?.includes('edit_negotiations') && !userPermissions.length;
  const canComment = user?.permissions?.includes('comment') && !userPermissions.length;
  const canApprove = user?.permissions?.includes('approve') && !userPermissions.length;
  const isViewOnly = userPermissions.includes('view_negotiations') && userPermissions.length === 1;

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">Failed to load negotiation</p>
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['negotiation', negotiationId] })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <div data-testid="loading-spinner" className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading negotiation...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="negotiation-workspace" className="max-w-7xl mx-auto p-6">
      <main role="main" aria-label="Negotiation workspace">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Negotiation Workspace</h1>
              <p className="text-gray-600 mb-4">
                Negotiation workspace for {negotiation?.title || 'Loading...'}
              </p>
              <div className="flex items-center space-x-4">
                {negotiation && (
                  <>
                    <span 
                      data-testid="negotiation-status"
                      className={`px-3 py-1 text-sm rounded-full ${
                        negotiation.status === 'active' ? 'bg-green-100 text-green-800' :
                        negotiation.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                        negotiation.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}
                      aria-label={`Negotiation status: ${negotiation.status}`}
                    >
                      {negotiation.status.charAt(0).toUpperCase() + negotiation.status.slice(1)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {negotiation.participants.length} participants
                    </span>
                    {connectionStatus === 'disconnected' && (
                      <div data-testid="connection-error" className="flex items-center text-red-600">
                        <ExclamationCircleSolid className="h-4 w-4 mr-2" />
                        <span>Connection lost</span>
                        <button 
                          onClick={reconnectWebSocket}
                          className="ml-2 text-sm underline hover:no-underline"
                        >
                          Reconnect
                        </button>
                      </div>
                    )}
                    {isViewOnly && (
                      <span className="text-sm text-orange-600 bg-orange-100 px-2 py-1 rounded">
                        View-only access
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowTimeline(true)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <ClockIcon className="h-4 w-4 inline mr-2" />
                Timeline View
              </button>
              <button
                onClick={() => setShowPositionMatrix(true)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <TableCellsIcon className="h-4 w-4 inline mr-2" />
                Position Matrix
              </button>
              <button
                onClick={() => setShowAnalytics(true)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <ChartBarIcon className="h-4 w-4 inline mr-2" />
                Analytics
              </button>
              <button
                onClick={() => setShowNotificationPrefs(true)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <BellIcon className="h-4 w-4 inline mr-2" />
                Notifications
              </button>
              <button
                onClick={() => setShowExternalPortal(true)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <ShareIcon className="h-4 w-4 inline mr-2" />
                External Access
              </button>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <ul className="list-disc list-inside text-sm text-red-700">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Notifications */}
          {notifications.map(notification => (
            <div 
              key={notification.id}
              data-testid="notification-alert"
              className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg"
            >
              <p className="text-sm text-green-700">{notification.text}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Participants and Analytics */}
          <div className="lg:col-span-1 space-y-6">
            {/* Participants */}
            <div role="region" aria-label="Participants">
              <div data-testid="participants-list" className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  <UserGroupIcon className="h-5 w-5 inline mr-2" />
                  Participants
                </h2>
                
                {negotiation?.participants.map(participant => (
                  <div key={participant.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center">
                      <UserCircleIcon className="h-8 w-8 text-gray-400" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{participant.name}</p>
                        <p className="text-xs text-gray-500">{participant.role} • {participant.party}</p>
                      </div>
                    </div>
                    {onlineUsers.has(participant.id) && (
                      <div data-testid={`online-indicator-${participant.id}`} className="w-2 h-2 bg-green-400 rounded-full"></div>
                    )}
                    <div data-testid={`user-activity-${participant.id}`} className="text-xs text-gray-400">
                      {participant.lastSeen && `Last seen: ${new Date(participant.lastSeen).toLocaleDateString()}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            {negotiation?.analytics && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Changes:</span>
                    <span className="text-sm font-medium">{negotiation.analytics.totalChanges}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Pending Changes:</span>
                    <span className="text-sm font-medium">{negotiation.analytics.pendingChanges}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Duration:</span>
                    <span className="text-sm font-medium">{negotiation.analytics.negotiationDuration}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="space-y-6">
              {/* Navigation Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                  {[
                    { id: 'changes', label: 'Changes', icon: DocumentTextIcon },
                    { id: 'comments', label: 'Comments', icon: ChatBubbleLeftRightIcon },
                    { id: 'versions', label: 'Versions', icon: ClockIcon },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveView(tab.id)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeView === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <tab.icon className="h-4 w-4 inline mr-2" />
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <FunnelIcon className="h-4 w-4 text-gray-400" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                    aria-label="Filter by status"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <select
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                    aria-label="Filter by section"
                  >
                    <option value="all">All Sections</option>
                    <option value="Payment Terms">Payment Terms</option>
                    <option value="Liability">Liability</option>
                    <option value="Termination">Termination</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-2 flex-1">
                  <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search changes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-3 py-1 flex-1"
                    aria-label="Search changes"
                  />
                </div>
              </div>

              {/* Content Area */}
              <div role="region" aria-label="Changes" className="bg-white rounded-lg shadow-sm border">
                {activeView === 'changes' && (
                  <div data-testid="redlines-panel" className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Tracked Changes</h2>
                      <button
                        onClick={() => setShowVersionComparison(true)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Compare Versions
                      </button>
                    </div>
                    
                    {/* Typing Indicators */}
                    {Object.values(typingUsers).length > 0 && (
                      <div data-testid="typing-indicator" className="mb-4 p-3 bg-blue-50 rounded-lg">
                        {Object.values(typingUsers).map((typing: any) => (
                          <p key={typing.userId} className="text-sm text-blue-700">
                            {typing.userName} is typing in {typing.section}...
                          </p>
                        ))}
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {filteredChanges.map(change => (
                        <div 
                          key={change.id}
                          data-testid={`change-${change.id}`}
                          data-status={change.status}
                          className="p-4 border border-gray-200 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="font-medium text-gray-900">{change.section}</span>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  change.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  change.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {change.status}
                                </span>
                              </div>
                              <div className="space-y-2">
                                {change.oldValue && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-600">From:</span>
                                    <span className="text-sm line-through text-red-600">{change.oldValue}</span>
                                  </div>
                                )}
                                {change.newValue && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-600">To:</span>
                                    <span className="text-sm text-green-600">{change.newValue}</span>
                                  </div>
                                )}
                              </div>
                              <div className="mt-3 text-xs text-gray-500">
                                Changed by {negotiation?.participants.find(p => p.id === change.author)?.name || 'Unknown'} • {new Date(change.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                            </div>
                            
                            {canEdit && change.status === 'pending' && (
                              <div className="flex space-x-2">
                                <button
                                  data-testid={`accept-change-${change.id}`}
                                  onClick={() => handleAcceptChange(change.id)}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded"
                                  aria-label="Accept change"
                                >
                                  <CheckIcon className="h-4 w-4" />
                                </button>
                                <button
                                  data-testid={`reject-change-${change.id}`}
                                  onClick={() => handleRejectChange(change.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                                  aria-label="Reject change"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {expandedChanges.has(change.id) && (
                            <div data-testid={`change-details-${change.id}`} className="mt-4 pt-4 border-t border-gray-100">
                              <div className="text-sm text-gray-600">
                                <p><strong>Change Type:</strong> {change.type}</p>
                                <p><strong>Timestamp:</strong> {new Date(change.timestamp).toLocaleString()}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {filteredChanges.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>No changes found</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeView === 'comments' && (
                  <div data-testid="comments-panel" className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
                    </div>
                    
                    {/* Add Comment Form */}
                    {canComment && (
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add your comment..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                          rows={3}
                          aria-label="Add comment"
                        />
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => handleAddComment(newComment)}
                            disabled={!newComment.trim()}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            Post Comment
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {filteredComments.map(comment => (
                        <div 
                          key={comment.id}
                          data-testid={`comment-${comment.id}`}
                          data-section={comment.section}
                          className="p-4 border border-gray-200 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <UserCircleIcon className="h-6 w-6 text-gray-400" />
                                <span className="font-medium text-gray-900">
                                  {negotiation?.participants.find(p => p.id === comment.author)?.name || 'Unknown'}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {new Date(comment.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                <span className="text-xs text-gray-400">#{comment.section}</span>
                              </div>
                              <p className="text-gray-700">{comment.text}</p>
                              {comment.mentions && comment.mentions.includes('jane-smith') && (
                                <div data-testid="mention-jane-smith" className="mt-2 text-sm text-blue-600">
                                  @Jane Smith mentioned
                                </div>
                              )}
                            </div>
                            
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setReplyingTo(comment.id)}
                                className="text-sm text-blue-600 hover:text-blue-800"
                              >
                                Reply
                              </button>
                              {canApprove && (
                                <button
                                  data-testid={`resolve-comment-${comment.id}`}
                                  onClick={() => handleResolveComment(comment.id)}
                                  className="text-sm text-green-600 hover:text-green-800"
                                >
                                  Resolve
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {replyingTo === comment.id && (
                            <div data-testid={`reply-form-${comment.id}`} className="mt-4 pl-8">
                              <textarea
                                placeholder="Reply to comment..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm"
                                rows={2}
                                aria-label="Reply to comment"
                              />
                              <div className="flex justify-end space-x-2 mt-2">
                                <button
                                  onClick={() => setReplyingTo(null)}
                                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                                >
                                  Cancel
                                </button>
                                <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                                  Reply
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {filteredComments.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>No comments yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeView === 'versions' && (
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Version History</h2>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setShowVersionComparison(true)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Compare Versions
                        </button>
                        <button className="text-sm text-blue-600 hover:text-blue-800">
                          Change History
                        </button>
                        <button className="text-sm text-blue-600 hover:text-blue-800">
                          Change Statistics
                        </button>
                      </div>
                    </div>
                    
                    <div data-testid="version-selector" className="space-y-4">
                      {negotiation?.versions.map(version => (
                        <div key={version.id} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium text-gray-900">Version {version.versionNumber}</h3>
                              <div data-testid="version-info" className="text-sm text-gray-600 mt-1">
                                Created by {negotiation.participants.find(p => p.id === version.createdBy)?.name || 'Unknown'} • {new Date(version.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {/* Handle version history */}}
                                className="text-sm text-blue-600 hover:text-blue-800"
                              >
                                Version History
                              </button>
                              <button className="text-sm text-blue-600 hover:text-blue-800">
                                Restore Version
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* User Cursors */}
        {Object.values(userCursors).map((cursor: any) => (
          <div
            key={cursor.userId}
            data-testid={`user-cursor-${cursor.userId}`}
            className="fixed top-20 right-4 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded z-50"
          >
            {cursor.userName} is here
          </div>
        ))}

        {/* Modals */}
        {showVersionComparison && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Side-by-side Comparison</h2>
                <button onClick={() => setShowVersionComparison(false)}>
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div data-testid="version-comparison" className="space-y-4">
                <div data-testid="diff-added" className="p-3 bg-green-50 border-l-4 border-green-400">
                  <span className="text-green-800">+ Added content</span>
                </div>
                <div data-testid="diff-removed" className="p-3 bg-red-50 border-l-4 border-red-400">
                  <span className="text-red-800">- Removed content</span>
                </div>
                <div data-testid="diff-modified" className="p-3 bg-yellow-50 border-l-4 border-yellow-400">
                  <span className="text-yellow-800">~ Modified content</span>
                </div>
              </div>
              <div data-testid="restore-confirmation" className="mt-4 text-center">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Restore Version 1.0
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Modal */}
        {showTimeline && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Negotiation History</h2>
                <button onClick={() => setShowTimeline(false)}>
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="flex items-center space-x-4 mb-4">
                <select className="px-3 py-2 border border-gray-300 rounded" aria-label="Filter events">
                  <option value="all">All Events</option>
                  <option value="changes">Changes</option>
                  <option value="comments">Comments</option>
                </select>
              </div>
              <div data-testid="negotiation-timeline" className="space-y-4">
                <div data-testid="milestone-negotiation-start" className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Negotiation started</span>
                </div>
                <div data-testid="timeline-event-change1" data-type="change" className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span>Payment terms modified</span>
                </div>
                <div data-testid="timeline-event-comment1" data-type="comment" className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Comment added</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Position Matrix Modal */}
        {showPositionMatrix && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Negotiation Positions</h2>
                <button onClick={() => setShowPositionMatrix(false)}>
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div data-testid="position-matrix" className="space-y-4">
                {negotiation?.positions.map(position => (
                  <div 
                    key={position.id}
                    data-testid={`position-${position.id}`}
                    className="grid grid-cols-4 gap-4 p-4 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <h4 className="font-medium text-gray-900">{position.clause}</h4>
                      <div data-testid={`priority-${position.priority}`} className={`text-xs px-2 py-1 rounded mt-1 ${
                        position.priority === 'high' ? 'bg-red-100 text-red-800' :
                        position.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {position.priority} priority
                      </div>
                    </div>
                    <div>
                      {editingPosition === position.id ? (
                        <input
                          value={positionValues[position.id] || position.ourPosition}
                          onChange={(e) => setPositionValues({...positionValues, [position.id]: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          aria-label="Our position"
                        />
                      ) : (
                        <span className="text-sm">{position.ourPosition}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">{position.theirPosition}</span>
                    </div>
                    <div className="flex space-x-2">
                      {editingPosition === position.id ? (
                        <>
                          <button
                            onClick={() => handleSavePosition(position.id)}
                            className="text-sm text-green-600 hover:text-green-800"
                          >
                            Save Position
                          </button>
                          <button
                            onClick={() => setEditingPosition(null)}
                            className="text-sm text-gray-600 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            data-testid={`edit-position-${position.id}`}
                            onClick={() => setEditingPosition(position.id)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <button
                            data-testid={`position-history-${position.id}`}
                            onClick={() => {/* Show history */}}
                            className="text-sm text-gray-600 hover:text-gray-800"
                          >
                            History
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div data-testid="position-history" className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Position Changes</h3>
                <p className="text-sm text-gray-600">Position history would be displayed here</p>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Modal */}
        {showAnalytics && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Negotiation Metrics</h2>
                <button onClick={() => setShowAnalytics(false)}>
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div data-testid="analytics-dashboard" className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-medium text-blue-900">Response Time</h3>
                    <p className="text-2xl font-bold text-blue-700">Average response time: 2.5 hours</p>
                  </div>
                  <div data-testid="progress-indicator" className="p-4 bg-green-50 rounded-lg">
                    <h3 className="font-medium text-green-900">Progress</h3>
                    <p className="text-2xl font-bold text-green-700">60% complete</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div data-testid="acceptance-rate-chart" className="p-4 bg-yellow-50 rounded-lg">
                    <h3 className="font-medium text-yellow-900">Acceptance Rate</h3>
                    <p className="text-2xl font-bold text-yellow-700">60% acceptance rate</p>
                  </div>
                  <button
                    onClick={() => {/* Show export options */}}
                    className="w-full p-4 text-left border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Export Report
                  </button>
                </div>
              </div>
              <div data-testid="export-options" className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Export Options</h3>
                <div className="flex space-x-2">
                  <button className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">PDF</button>
                  <button className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">Excel</button>
                  <button className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">CSV</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notification Preferences Modal */}
        {showNotificationPrefs && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Notification Settings</h2>
                <button onClick={() => setShowNotificationPrefs(false)}>
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                  <button className="py-2 px-1 border-b-2 border-blue-500 text-blue-600 font-medium text-sm">
                    Preferences
                  </button>
                  <button 
                    role="tab" 
                    aria-label="Notification history"
                    className="py-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm"
                  >
                    History
                  </button>
                  <button 
                    role="tab" 
                    aria-label="Notification rules"
                    className="py-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm"
                  >
                    Rules
                  </button>
                </nav>
              </div>
              <div data-testid="notification-preferences" className="mt-4 space-y-4">
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" aria-label="Email notifications" />
                  <span>Email notifications</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" aria-label="Notify on high priority changes" />
                  <span>Notify on high priority changes</span>
                </label>
              </div>
              <div data-testid="notification-history" className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Recent Notifications</h3>
                <p className="text-sm text-gray-600">Notification history would appear here</p>
              </div>
              <div data-testid="notification-rules" className="mt-4">
                <h3 className="font-medium text-gray-900 mb-2">Notification Rules</h3>
                <p className="text-sm text-gray-600">Configure when to send notifications</p>
              </div>
            </div>
          </div>
        )}

        {/* External Portal Modal */}
        {showExternalPortal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Share with external parties</h2>
                <button onClick={() => setShowExternalPortal(false)}>
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                  <button className="py-2 px-1 border-b-2 border-blue-500 text-blue-600 font-medium text-sm">
                    Access
                  </button>
                  <button 
                    role="tab" 
                    aria-label="External activity"
                    className="py-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm"
                  >
                    Activity
                  </button>
                </nav>
              </div>
              <div data-testid="external-portal" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="radio" name="access" className="mr-2" aria-label="View only" />
                    <span>View only</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="access" className="mr-2" aria-label="Comment only" />
                    <span>Comment only</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="access" className="mr-2" aria-label="Edit access" />
                    <span>Edit access</span>
                  </label>
                </div>
                <button className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Generate Link
                </button>
                <div data-testid="access-link" className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">Secure link generated</p>
                  <input 
                    type="text" 
                    value="https://secure.example.com/negotiation/abc123"
                    readOnly
                    className="w-full mt-2 px-3 py-2 bg-white border border-green-300 rounded text-sm"
                  />
                </div>
              </div>
              <div data-testid="external-activity" className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">External Activity</h3>
                <p className="text-sm text-gray-600">External party activity would be tracked here</p>
              </div>
            </div>
          </div>
        )}

        {/* Live Region for Screen Reader Announcements */}
        <div id="live-region" role="status" aria-live="polite" className="sr-only"></div>
      </main>
    </div>
  );
};